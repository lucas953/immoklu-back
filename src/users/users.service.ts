import { Injectable } from "@nestjs/common";
import { PrismaService } from "../database/prisma/prisma.service";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { fromAppLocale, toAppLocale } from "../common/utils/locale.util";
import { UpdateUserDto } from "./dto/update-user.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(user: AuthenticatedUser) {
    const currentUser = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.userId }
    });

    return {
      id: currentUser.id,
      email: currentUser.email,
      fullName: currentUser.fullName,
      preferredLocale: fromAppLocale(currentUser.preferredLocale),
      status: currentUser.status
    };
  }

  async updateMe(user: AuthenticatedUser, dto: UpdateUserDto) {
    const updatedUser = await this.prisma.user.update({
      where: { id: user.userId },
      data: {
        ...(dto.fullName ? { fullName: dto.fullName } : {}),
        ...(dto.preferredLocale ? { preferredLocale: toAppLocale(dto.preferredLocale) } : {})
      }
    });

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      fullName: updatedUser.fullName,
      preferredLocale: fromAppLocale(updatedUser.preferredLocale),
      status: updatedUser.status
    };
  }
}
