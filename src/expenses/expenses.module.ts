import { Module } from "@nestjs/common";
import { ExpensesController } from "./expenses.controller";
import { ExpensesService } from "./expenses.service";
import { ExpenseCategoriesController } from "./categories/expense-categories.controller";
import { ExpenseCategoriesService } from "./categories/expense-categories.service";

@Module({
  controllers: [ExpensesController, ExpenseCategoriesController],
  providers: [ExpensesService, ExpenseCategoriesService],
  exports: [ExpensesService, ExpenseCategoriesService]
})
export class ExpensesModule {}
