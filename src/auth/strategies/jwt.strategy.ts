import { ExtractJwt, Strategy } from "passport-jwt";
import { PassportStrategy } from "@nestjs/passport";
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import { ACCESS_TOKEN_COOKIE_NAME } from "../auth.constants";
import type { AuthenticatedUser } from "../../common/types/authenticated-user.type";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => request.cookies?.[ACCESS_TOKEN_COOKIE_NAME] ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken()
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>("JWT_ACCESS_SECRET")
    });
  }

  validate(payload: { sub: string; wid: string; type: "access" }) {
    if (payload.type !== "access") {
      throw new UnauthorizedException("Access token is invalid.");
    }

    const user: AuthenticatedUser = {
      userId: payload.sub,
      workspaceId: payload.wid
    };

    return user;
  }
}
