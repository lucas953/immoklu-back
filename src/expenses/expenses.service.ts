import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma/prisma.service";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { UpdateExpenseDto } from "./dto/update-expense.dto";

const expenseInclude = Prisma.validator<Prisma.ExpenseInclude>()({
  property: {
    select: {
      id: true,
      name: true
    }
  },
  category: {
    select: {
      id: true,
      name: true,
      slug: true
    }
  }
});

type ExpenseWithRelations = Prisma.ExpenseGetPayload<{
  include: typeof expenseInclude;
}>;

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthenticatedUser) {
    const expenses = await this.prisma.expense.findMany({
      where: {
        workspaceId: user.workspaceId
      },
      include: expenseInclude,
      orderBy: [{ expenseDate: "desc" }, { updatedAt: "desc" }]
    });

    return expenses.map((expense) => this.serializeExpense(expense));
  }

  async create(user: AuthenticatedUser, dto: CreateExpenseDto) {
    if (dto.propertyId) {
      await this.assertPropertyOwnedByWorkspace(user.workspaceId, dto.propertyId);
    }

    if (dto.categoryId) {
      await this.assertCategoryOwnedByWorkspace(user.workspaceId, dto.categoryId);
    }

    const expense = await this.prisma.expense.create({
      data: {
        workspaceId: user.workspaceId,
        propertyId: dto.propertyId ?? null,
        categoryId: dto.categoryId ?? null,
        amount: dto.amount,
        currency: dto.currency,
        expenseDate: dto.expenseDate,
        vendorPayee: dto.vendorPayee ?? null,
        notes: dto.notes ?? null
      },
      include: expenseInclude
    });

    return this.serializeExpense(expense);
  }

  async findOne(user: AuthenticatedUser, expenseId: string) {
    const expense = await this.getExpenseForWorkspace(user.workspaceId, expenseId);
    return this.serializeExpense(expense);
  }

  async update(user: AuthenticatedUser, expenseId: string, dto: UpdateExpenseDto) {
    await this.getExpenseForWorkspace(user.workspaceId, expenseId);

    if (dto.propertyId) {
      await this.assertPropertyOwnedByWorkspace(user.workspaceId, dto.propertyId);
    }

    if (dto.categoryId) {
      await this.assertCategoryOwnedByWorkspace(user.workspaceId, dto.categoryId);
    }

    const expense = await this.prisma.expense.update({
      where: { id: expenseId },
      data: {
        ...(dto.propertyId !== undefined ? { propertyId: dto.propertyId || null } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId || null } : {}),
        ...(dto.amount ? { amount: dto.amount } : {}),
        ...(dto.currency ? { currency: dto.currency } : {}),
        ...(dto.expenseDate ? { expenseDate: dto.expenseDate } : {}),
        ...(dto.vendorPayee !== undefined ? { vendorPayee: dto.vendorPayee || null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes || null } : {})
      },
      include: expenseInclude
    });

    return this.serializeExpense(expense);
  }

  async remove(user: AuthenticatedUser, expenseId: string) {
    await this.getExpenseForWorkspace(user.workspaceId, expenseId);

    await this.prisma.expense.delete({
      where: { id: expenseId }
    });

    return { success: true };
  }

  private async getExpenseForWorkspace(workspaceId: string, expenseId: string) {
    const expense = await this.prisma.expense.findFirst({
      where: {
        id: expenseId,
        workspaceId
      },
      include: expenseInclude
    });

    if (!expense) {
      throw new NotFoundException("Expense not found.");
    }

    return expense;
  }

  private async assertPropertyOwnedByWorkspace(workspaceId: string, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: {
        id: propertyId,
        workspaceId
      }
    });

    if (!property) {
      throw new NotFoundException("Property not found.");
    }
  }

  private async assertCategoryOwnedByWorkspace(workspaceId: string, categoryId: string) {
    const category = await this.prisma.expenseCategory.findFirst({
      where: {
        id: categoryId,
        workspaceId
      }
    });

    if (!category) {
      throw new NotFoundException("Expense category not found.");
    }
  }

  private serializeExpense(expense: ExpenseWithRelations) {
    return {
      id: expense.id,
      propertyId: expense.propertyId,
      categoryId: expense.categoryId,
      property: expense.property,
      category: expense.category,
      amount: expense.amount.toString(),
      currency: expense.currency,
      expenseDate: expense.expenseDate.toISOString(),
      vendorPayee: expense.vendorPayee,
      notes: expense.notes,
      createdAt: expense.createdAt.toISOString(),
      updatedAt: expense.updatedAt.toISOString()
    };
  }
}
