import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../../common/types/authenticated-user.type";
import { CreateExpenseCategoryDto } from "./dto/create-expense-category.dto";
import { UpdateExpenseCategoryDto } from "./dto/update-expense-category.dto";
import { ExpenseCategoriesService } from "./expense-categories.service";

@UseGuards(JwtAuthGuard)
@Controller("expense-categories")
export class ExpenseCategoriesController {
  constructor(private readonly expenseCategoriesService: ExpenseCategoriesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.expenseCategoriesService.findAll(user);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateExpenseCategoryDto) {
    return this.expenseCategoriesService.create(user, dto);
  }

  @Patch(":categoryId")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("categoryId") categoryId: string,
    @Body() dto: UpdateExpenseCategoryDto
  ) {
    return this.expenseCategoriesService.update(user, categoryId, dto);
  }

  @Post(":categoryId/archive")
  archive(@CurrentUser() user: AuthenticatedUser, @Param("categoryId") categoryId: string) {
    return this.expenseCategoriesService.archive(user, categoryId);
  }
}
