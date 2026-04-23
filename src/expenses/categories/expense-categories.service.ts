import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../database/prisma/prisma.service";
import type { AuthenticatedUser } from "../../common/types/authenticated-user.type";
import { slugify } from "../../common/utils/slug.util";
import { CreateExpenseCategoryDto } from "./dto/create-expense-category.dto";
import { UpdateExpenseCategoryDto } from "./dto/update-expense-category.dto";

@Injectable()
export class ExpenseCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthenticatedUser) {
    const categories = await this.prisma.expenseCategory.findMany({
      where: {
        workspaceId: user.workspaceId
      },
      orderBy: [{ isSystem: "desc" }, { name: "asc" }]
    });

    return categories.map((category) => this.serializeCategory(category));
  }

  async create(user: AuthenticatedUser, dto: CreateExpenseCategoryDto) {
    const slug = await this.generateUniqueSlug(user.workspaceId, dto.slug ?? dto.name);

    const category = await this.prisma.expenseCategory.create({
      data: {
        workspaceId: user.workspaceId,
        name: dto.name,
        slug,
        color: dto.color ?? null,
        isSystem: false
      }
    });

    return this.serializeCategory(category);
  }

  async update(user: AuthenticatedUser, categoryId: string, dto: UpdateExpenseCategoryDto) {
    const category = await this.getCategoryForWorkspace(user.workspaceId, categoryId);

    const nextSlug =
      dto.slug || (dto.name && dto.name !== category.name)
        ? await this.generateUniqueSlug(user.workspaceId, dto.slug ?? dto.name ?? category.slug, categoryId)
        : undefined;

    const updated = await this.prisma.expenseCategory.update({
      where: { id: categoryId },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(nextSlug ? { slug: nextSlug } : {}),
        ...(dto.color !== undefined ? { color: dto.color || null } : {})
      }
    });

    return this.serializeCategory(updated);
  }

  async archive(user: AuthenticatedUser, categoryId: string) {
    const category = await this.getCategoryForWorkspace(user.workspaceId, categoryId);

    if (category.isSystem) {
      throw new ConflictException("System categories cannot be archived.");
    }

    const updated = await this.prisma.expenseCategory.update({
      where: { id: categoryId },
      data: { archivedAt: new Date() }
    });

    return this.serializeCategory(updated);
  }

  private async getCategoryForWorkspace(workspaceId: string, categoryId: string) {
    const category = await this.prisma.expenseCategory.findFirst({
      where: {
        id: categoryId,
        workspaceId
      }
    });

    if (!category) {
      throw new NotFoundException("Expense category not found.");
    }

    return category;
  }

  private async generateUniqueSlug(workspaceId: string, value: string, excludeId?: string) {
    const base = slugify(value);
    let candidate = base;
    let suffix = 1;

    while (
      await this.prisma.expenseCategory.findFirst({
        where: {
          workspaceId,
          slug: candidate,
          ...(excludeId ? { id: { not: excludeId } } : {})
        }
      })
    ) {
      suffix += 1;
      candidate = `${base}-${suffix}`;
    }

    return candidate;
  }

  private serializeCategory(category: {
    id: string;
    name: string;
    slug: string;
    color: string | null;
    isSystem: boolean;
    archivedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      color: category.color,
      isSystem: category.isSystem,
      archivedAt: category.archivedAt?.toISOString() ?? null,
      createdAt: category.createdAt.toISOString(),
      updatedAt: category.updatedAt.toISOString()
    };
  }
}
