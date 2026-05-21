import { randomBytes, randomUUID } from "node:crypto";
import {
  ConflictException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { Request, Response } from "express";
import { Prisma, SubscriptionStatus, UserStatus } from "@prisma/client";
import { PrismaService } from "../database/prisma/prisma.service";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { hashPassword, verifyPassword } from "../common/utils/password.util";
import { hashToken } from "../common/utils/token.util";
import { slugify } from "../common/utils/slug.util";
import { fromAppLocale, toAppLocale } from "../common/utils/locale.util";
import {
  ACCESS_TOKEN_COOKIE_NAME,
  ACCESS_TOKEN_TTL_MS,
  REFRESH_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_TTL_MS
} from "./auth.constants";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService
  ) {}

  async register(dto: RegisterDto, req: Request, res: Response) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email }
    });

    if (existingUser) {
      throw new ConflictException("An account with this email already exists.");
    }

    const passwordHash = await hashPassword(dto.password);
    const workspaceSlug = await this.generateUniqueWorkspaceSlug(dto.workspaceName);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          fullName: dto.fullName,
          passwordHash,
          preferredLocale: toAppLocale(dto.preferredLocale)
        }
      });

      const workspace = await tx.workspace.create({
        data: {
          ownerUserId: user.id,
          name: dto.workspaceName,
          slug: workspaceSlug,
          countryCode: dto.countryCode,
          defaultCurrency: dto.defaultCurrency,
          preferredLocale: toAppLocale(dto.preferredLocale),
          timezone: dto.timezone
        }
      });

      await tx.expenseCategory.createMany({
        data: this.getDefaultExpenseCategories(workspace.id)
      });

      await tx.subscription.create({
        data: {
          workspaceId: workspace.id,
          planCode: "free",
          status: SubscriptionStatus.TRIAL
        }
      });

      return { user, workspace };
    });

    await this.prisma.user.update({
      where: { id: result.user.id },
      data: { lastLoginAt: new Date() }
    });

    return this.issueSession({
      userId: result.user.id,
      workspaceId: result.workspace.id,
      req,
      res
    });
  }

  async login(dto: LoginDto, req: Request, res: Response) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { workspace: true }
    });

    if (!user?.passwordHash) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("This account is not active.");
    }

    const passwordMatches = await verifyPassword(dto.password, user.passwordHash);
    if (!passwordMatches || !user.workspace) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    return this.issueSession({
      userId: user.id,
      workspaceId: user.workspace.id,
      req,
      res
    });
  }

  async refresh(req: Request, res: Response) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];
    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token is required.");
    }

    const payload = await this.verifyRefreshToken(refreshToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { id: payload.sid }
    });

    if (!session || session.userId !== payload.sub || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh session is invalid.");
    }

    if (session.hashedToken !== hashToken(refreshToken)) {
      throw new UnauthorizedException("Refresh token does not match the active session.");
    }

    return this.issueSession({
      userId: payload.sub,
      workspaceId: payload.wid,
      req,
      res,
      existingSessionId: session.id
    });
  }

  async logout(req: Request, res: Response) {
    const refreshToken = req.cookies?.[REFRESH_TOKEN_COOKIE_NAME];

    if (refreshToken) {
      try {
        const payload = await this.verifyRefreshToken(refreshToken);
        await this.prisma.refreshSession.updateMany({
          where: {
            id: payload.sid,
            userId: payload.sub,
            revokedAt: null
          },
          data: { revokedAt: new Date() }
        });
      } catch {
        // Intentionally ignore invalid refresh tokens during logout.
      }
    }

    this.clearAuthCookies(res);
    return { success: true };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email }
    });

    if (!user) {
      return { success: true };
    }

    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt
      }
    });

    return {
      success: true,
      ...(this.isDevelopment() ? { resetToken: rawToken } : {})
    };
  }

  async resetPassword(dto: ResetPasswordDto, req: Request, res: Response) {
    const tokenHash = hashToken(dto.token);

    const resetRecord = await this.prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() }
      }
    });

    if (!resetRecord) {
      throw new UnauthorizedException("The password reset token is invalid or expired.");
    }

    const passwordHash = await hashPassword(dto.newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: resetRecord.userId },
        data: { passwordHash }
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() }
      }),
      this.prisma.refreshSession.updateMany({
        where: { userId: resetRecord.userId, revokedAt: null },
        data: { revokedAt: new Date() }
      })
    ]);

    const userWithWorkspace = await this.prisma.user.findUnique({
      where: { id: resetRecord.userId },
      include: { workspace: true }
    });

    if (!userWithWorkspace?.workspace) {
      throw new UnauthorizedException("No workspace was found for this account.");
    }

    return this.issueSession({
      userId: userWithWorkspace.id,
      workspaceId: userWithWorkspace.workspace.id,
      req,
      res
    });
  }

  async me(user: AuthenticatedUser) {
    const session = await this.getSessionPayload(user.userId, user.workspaceId);
    return session;
  }

  async getSessionPayload(userId: string, workspaceId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        workspace: true
      }
    });

    if (!user || !user.workspace || user.workspace.id !== workspaceId) {
      throw new UnauthorizedException("Session is no longer valid.");
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        preferredLocale: fromAppLocale(user.preferredLocale),
        status: user.status
      },
      workspace: {
        id: user.workspace.id,
        name: user.workspace.name,
        slug: user.workspace.slug,
        countryCode: user.workspace.countryCode,
        defaultCurrency: user.workspace.defaultCurrency,
        preferredLocale: fromAppLocale(user.workspace.preferredLocale),
        timezone: user.workspace.timezone
      }
    };
  }

  private async issueSession({
    userId,
    workspaceId,
    req,
    res,
    existingSessionId
  }: {
    userId: string;
    workspaceId: string;
    req: Request;
    res: Response;
    existingSessionId?: string;
  }) {
    const refreshSessionId = existingSessionId ?? randomUUID();
    const now = Date.now();
    const accessTokenExpiresAt = new Date(now + ACCESS_TOKEN_TTL_MS);
    const refreshTokenExpiresAt = new Date(now + REFRESH_TOKEN_TTL_MS);

    const accessToken = await this.jwtService.signAsync(
      {
        sub: userId,
        wid: workspaceId,
        type: "access"
      },
      {
        secret: this.configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
        expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000)
      }
    );

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: userId,
        wid: workspaceId,
        sid: refreshSessionId,
        type: "refresh"
      },
      {
        secret: this.configService.getOrThrow<string>("JWT_REFRESH_SECRET"),
        expiresIn: Math.floor(REFRESH_TOKEN_TTL_MS / 1000)
      }
    );

    await this.prisma.refreshSession.upsert({
      where: { id: refreshSessionId },
      update: {
        userId,
        hashedToken: hashToken(refreshToken),
        userAgent: req.headers["user-agent"] ?? null,
        ipAddress: req.ip ?? null,
        expiresAt: refreshTokenExpiresAt,
        revokedAt: null
      },
      create: {
        id: refreshSessionId,
        userId,
        hashedToken: hashToken(refreshToken),
        userAgent: req.headers["user-agent"] ?? null,
        ipAddress: req.ip ?? null,
        expiresAt: refreshTokenExpiresAt
      }
    });

    this.setAuthCookies(res, {
      accessToken,
      refreshToken,
      accessTokenExpiresAt,
      refreshTokenExpiresAt
    });

    return this.getSessionPayload(userId, workspaceId);
  }

  private setAuthCookies(
    res: Response,
    tokens: {
      accessToken: string;
      refreshToken: string;
      accessTokenExpiresAt: Date;
      refreshTokenExpiresAt: Date;
    }
  ) {
    const isProduction = this.configService.get<string>("NODE_ENV") === "production";
    const cookieBase = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? ("none" as const) : ("lax" as const),
      path: "/"
    };

    res.cookie(ACCESS_TOKEN_COOKIE_NAME, tokens.accessToken, {
      ...cookieBase,
      expires: tokens.accessTokenExpiresAt
    });

    res.cookie(REFRESH_TOKEN_COOKIE_NAME, tokens.refreshToken, {
      ...cookieBase,
      expires: tokens.refreshTokenExpiresAt
    });
  }

  private clearAuthCookies(res: Response) {
    const isProduction = this.configService.get<string>("NODE_ENV") === "production";
    const cookieBase = {
      secure: isProduction,
      sameSite: isProduction ? ("none" as const) : ("lax" as const),
      path: "/"
    };

    res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, cookieBase);
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, cookieBase);
  }

  private async verifyRefreshToken(refreshToken: string) {
    try {
      return await this.jwtService.verifyAsync<{
        sub: string;
        wid: string;
        sid: string;
        type: "refresh";
      }>(refreshToken, {
        secret: this.configService.getOrThrow<string>("JWT_REFRESH_SECRET")
      }).then((payload) => {
        if (payload.type !== "refresh") {
          throw new UnauthorizedException("Refresh token is invalid.");
        }

        return payload;
      });
    } catch {
      throw new UnauthorizedException("Refresh token is invalid.");
    }
  }

  private async generateUniqueWorkspaceSlug(workspaceName: string) {
    const baseSlug = slugify(workspaceName);
    let slugCandidate = baseSlug;
    let suffix = 1;

    while (
      await this.prisma.workspace.findUnique({
        where: { slug: slugCandidate }
      })
    ) {
      suffix += 1;
      slugCandidate = `${baseSlug}-${suffix}`;
    }

    return slugCandidate;
  }

  private getDefaultExpenseCategories(workspaceId: string): Prisma.ExpenseCategoryCreateManyInput[] {
    const categories: ReadonlyArray<readonly [string, string]> = [
      ["Repairs", "repairs"],
      ["Insurance", "insurance"],
      ["Utilities", "utilities"],
      ["Mortgage", "mortgage"],
      ["Taxes", "taxes"],
      ["Community Fees", "community-fees"],
      ["Other", "other"]
    ];

    return categories.map(([name, slug]) => ({
      workspaceId,
      name,
      slug,
      isSystem: true
    }));
  }

  private isDevelopment() {
    return this.configService.get<string>("NODE_ENV") !== "production";
  }
}
