import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { PaymentStatusDto } from "./dto/payment-status.dto";
import { UpdatePaymentDto } from "./dto/update-payment.dto";
import { PaymentsService } from "./payments.service";

@UseGuards(JwtAuthGuard)
@Controller("payments")
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.paymentsService.findAll(user);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(user, dto);
  }

  @Get(":paymentId")
  findOne(@CurrentUser() user: AuthenticatedUser, @Param("paymentId") paymentId: string) {
    return this.paymentsService.findOne(user, paymentId);
  }

  @Patch(":paymentId")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("paymentId") paymentId: string,
    @Body() dto: UpdatePaymentDto
  ) {
    return this.paymentsService.update(user, paymentId, dto);
  }

  @Post(":paymentId/mark-paid")
  markPaid(
    @CurrentUser() user: AuthenticatedUser,
    @Param("paymentId") paymentId: string,
    @Body() dto: PaymentStatusDto
  ) {
    return this.paymentsService.markPaid(user, paymentId, dto);
  }

  @Post(":paymentId/mark-pending")
  markPending(@CurrentUser() user: AuthenticatedUser, @Param("paymentId") paymentId: string) {
    return this.paymentsService.markPending(user, paymentId);
  }

  @Post(":paymentId/mark-overdue")
  markOverdue(@CurrentUser() user: AuthenticatedUser, @Param("paymentId") paymentId: string) {
    return this.paymentsService.markOverdue(user, paymentId);
  }
}
