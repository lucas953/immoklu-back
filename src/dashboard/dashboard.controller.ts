import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { DashboardService } from "./dashboard.service";

@UseGuards(JwtAuthGuard)
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("summary")
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.summary(user);
  }

  @Get("cash-flow")
  cashFlow(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.cashFlow(user);
  }

  @Get("profitability")
  profitability(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.profitability(user);
  }

  @Get("occupancy")
  occupancy(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.occupancy(user);
  }

  @Get("overdue-payments")
  overduePayments(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.overduePayments(user);
  }
}
