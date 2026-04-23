import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { CreateExpenseDto } from "./dto/create-expense.dto";
import { UpdateExpenseDto } from "./dto/update-expense.dto";
import { ExpensesService } from "./expenses.service";

@UseGuards(JwtAuthGuard)
@Controller("expenses")
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.expensesService.findAll(user);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateExpenseDto) {
    return this.expensesService.create(user, dto);
  }

  @Get(":expenseId")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("expenseId") expenseId: string) {
    return this.expensesService.findOne(user, expenseId);
  }

  @Patch(":expenseId")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("expenseId") expenseId: string,
    @Body() dto: UpdateExpenseDto
  ) {
    return this.expensesService.update(user, expenseId, dto);
  }

  @Delete(":expenseId")
  remove(@CurrentUser() user: AuthenticatedUser, @Param("expenseId") expenseId: string) {
    return this.expensesService.remove(user, expenseId);
  }
}
