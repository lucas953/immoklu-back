import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma/prisma.service";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { fromAppLocale, toAppLocale } from "../common/utils/locale.util";
import { UpdateWorkspaceDto } from "./dto/update-workspace.dto";

@Injectable()
export class WorkspaceService {
  constructor(private readonly prisma: PrismaService) {}

  async getWorkspace(user: AuthenticatedUser) {
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: user.workspaceId }
    });

    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      countryCode: workspace.countryCode,
      defaultCurrency: workspace.defaultCurrency,
      preferredLocale: fromAppLocale(workspace.preferredLocale),
      timezone: workspace.timezone
    };
  }

  async updateWorkspace(user: AuthenticatedUser, dto: UpdateWorkspaceDto) {
    const workspace = await this.prisma.workspace.update({
      where: { id: user.workspaceId },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.countryCode ? { countryCode: dto.countryCode } : {}),
        ...(dto.defaultCurrency ? { defaultCurrency: dto.defaultCurrency } : {}),
        ...(dto.preferredLocale ? { preferredLocale: toAppLocale(dto.preferredLocale) } : {}),
        ...(dto.timezone ? { timezone: dto.timezone } : {})
      }
    });

    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      countryCode: workspace.countryCode,
      defaultCurrency: workspace.defaultCurrency,
      preferredLocale: fromAppLocale(workspace.preferredLocale),
      timezone: workspace.timezone
    };
  }
}
