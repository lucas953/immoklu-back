import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, RentPaymentStatus } from "@prisma/client";
import { PrismaService } from "../database/prisma/prisma.service";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { CreatePaymentDto } from "./dto/create-payment.dto";
import { PaymentStatusDto } from "./dto/payment-status.dto";
import { UpdatePaymentDto } from "./dto/update-payment.dto";

const paymentInclude = Prisma.validator<Prisma.RentPaymentInclude>()({
  lease: {
    select: {
      id: true,
      startDate: true,
      endDate: true
    }
  },
  property: {
    select: {
      id: true,
      name: true
    }
  },
  tenant: {
    select: {
      id: true,
      fullName: true
    }
  }
});

type PaymentWithRelations = Prisma.RentPaymentGetPayload<{
  include: typeof paymentInclude;
}>;

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthenticatedUser) {
    const payments = await this.prisma.rentPayment.findMany({
      where: {
        workspaceId: user.workspaceId
      },
      include: paymentInclude,
      orderBy: [{ dueDate: "desc" }, { updatedAt: "desc" }]
    });

    return payments.map((payment) => this.serializePayment(payment));
  }

  async create(user: AuthenticatedUser, dto: CreatePaymentDto) {
    const lease = await this.getLeaseForWorkspace(user.workspaceId, dto.leaseId);

    const payment = await this.prisma.rentPayment.create({
      data: {
        workspaceId: user.workspaceId,
        propertyId: lease.propertyId,
        leaseId: lease.id,
        tenantId: lease.tenantId,
        periodStart: dto.periodStart,
        periodEnd: dto.periodEnd,
        dueDate: dto.dueDate,
        paidDate: dto.paidDate ?? null,
        amountDue: dto.amountDue,
        amountPaid: dto.amountPaid ?? "0",
        currency: dto.currency,
        paymentMethod: dto.paymentMethod ?? null,
        status: dto.status,
        notes: dto.notes ?? null
      },
      include: paymentInclude
    });

    return this.serializePayment(payment);
  }

  async findOne(user: AuthenticatedUser, paymentId: string) {
    const payment = await this.getPaymentForWorkspace(user.workspaceId, paymentId);
    return this.serializePayment(payment);
  }

  async update(user: AuthenticatedUser, paymentId: string, dto: UpdatePaymentDto) {
    const current = await this.getPaymentForWorkspace(user.workspaceId, paymentId);
    const lease = dto.leaseId ? await this.getLeaseForWorkspace(user.workspaceId, dto.leaseId) : null;

    const payment = await this.prisma.rentPayment.update({
      where: { id: paymentId },
      data: {
        ...(lease
          ? {
              leaseId: lease.id,
              propertyId: lease.propertyId,
              tenantId: lease.tenantId
            }
          : {}),
        ...(dto.periodStart ? { periodStart: dto.periodStart } : {}),
        ...(dto.periodEnd ? { periodEnd: dto.periodEnd } : {}),
        ...(dto.dueDate ? { dueDate: dto.dueDate } : {}),
        ...(dto.paidDate !== undefined ? { paidDate: dto.paidDate ?? null } : {}),
        ...(dto.amountDue ? { amountDue: dto.amountDue } : {}),
        ...(dto.amountPaid !== undefined ? { amountPaid: dto.amountPaid || current.amountPaid.toString() } : {}),
        ...(dto.currency ? { currency: dto.currency } : {}),
        ...(dto.paymentMethod !== undefined ? { paymentMethod: dto.paymentMethod ?? null } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes || null } : {})
      },
      include: paymentInclude
    });

    return this.serializePayment(payment);
  }

  async markPaid(user: AuthenticatedUser, paymentId: string, dto: PaymentStatusDto) {
    const current = await this.getPaymentForWorkspace(user.workspaceId, paymentId);

    const payment = await this.prisma.rentPayment.update({
      where: { id: paymentId },
      data: {
        status: RentPaymentStatus.PAID,
        paidDate: dto.paidDate ?? new Date(),
        amountPaid: dto.amountPaid ?? current.amountDue.toString(),
        ...(dto.paymentMethod !== undefined ? { paymentMethod: dto.paymentMethod ?? null } : {})
      },
      include: paymentInclude
    });

    return this.serializePayment(payment);
  }

  async markPending(user: AuthenticatedUser, paymentId: string) {
    await this.getPaymentForWorkspace(user.workspaceId, paymentId);

    const payment = await this.prisma.rentPayment.update({
      where: { id: paymentId },
      data: {
        status: RentPaymentStatus.PENDING,
        paidDate: null
      },
      include: paymentInclude
    });

    return this.serializePayment(payment);
  }

  async markOverdue(user: AuthenticatedUser, paymentId: string) {
    await this.getPaymentForWorkspace(user.workspaceId, paymentId);

    const payment = await this.prisma.rentPayment.update({
      where: { id: paymentId },
      data: {
        status: RentPaymentStatus.OVERDUE
      },
      include: paymentInclude
    });

    return this.serializePayment(payment);
  }

  private async getLeaseForWorkspace(workspaceId: string, leaseId: string) {
    const lease = await this.prisma.lease.findFirst({
      where: {
        id: leaseId,
        workspaceId
      }
    });

    if (!lease) {
      throw new NotFoundException("Lease not found.");
    }

    return lease;
  }

  private async getPaymentForWorkspace(workspaceId: string, paymentId: string) {
    const payment = await this.prisma.rentPayment.findFirst({
      where: {
        id: paymentId,
        workspaceId
      },
      include: paymentInclude
    });

    if (!payment) {
      throw new NotFoundException("Payment not found.");
    }

    return payment;
  }

  private serializePayment(payment: PaymentWithRelations) {
    return {
      id: payment.id,
      leaseId: payment.leaseId,
      propertyId: payment.propertyId,
      tenantId: payment.tenantId,
      property: payment.property,
      tenant: payment.tenant,
      lease: {
        id: payment.lease.id,
        startDate: payment.lease.startDate.toISOString(),
        endDate: payment.lease.endDate?.toISOString() ?? null
      },
      periodStart: payment.periodStart.toISOString(),
      periodEnd: payment.periodEnd.toISOString(),
      dueDate: payment.dueDate.toISOString(),
      paidDate: payment.paidDate?.toISOString() ?? null,
      amountDue: payment.amountDue.toString(),
      amountPaid: payment.amountPaid.toString(),
      currency: payment.currency,
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      notes: payment.notes,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString()
    };
  }
}
