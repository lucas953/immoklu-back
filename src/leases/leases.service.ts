import { Injectable, NotFoundException } from "@nestjs/common";
import { LeaseStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma/prisma.service";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { CreateLeaseDto } from "./dto/create-lease.dto";
import { TerminateLeaseDto } from "./dto/terminate-lease.dto";
import { UpdateLeaseDto } from "./dto/update-lease.dto";

const leaseInclude = Prisma.validator<Prisma.LeaseInclude>()({
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

type LeaseWithRelations = Prisma.LeaseGetPayload<{
  include: typeof leaseInclude;
}>;

@Injectable()
export class LeasesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthenticatedUser) {
    const leases = await this.prisma.lease.findMany({
      where: {
        workspaceId: user.workspaceId
      },
      include: leaseInclude,
      orderBy: [{ updatedAt: "desc" }]
    });

    return leases.map((lease) => this.serializeLease(lease));
  }

  async create(user: AuthenticatedUser, dto: CreateLeaseDto) {
    await this.assertPropertyOwnedByWorkspace(user.workspaceId, dto.propertyId);
    await this.assertTenantOwnedByWorkspace(user.workspaceId, dto.tenantId);

    const lease = await this.prisma.lease.create({
      data: {
        workspaceId: user.workspaceId,
        propertyId: dto.propertyId,
        unitId: dto.unitId ?? null,
        tenantId: dto.tenantId,
        startDate: dto.startDate,
        endDate: dto.endDate ?? null,
        monthlyRent: dto.monthlyRent,
        depositAmount: dto.depositAmount ?? null,
        currency: dto.currency,
        paymentFrequency: dto.paymentFrequency,
        paymentDayOfMonth: dto.paymentDayOfMonth,
        status: dto.status,
        notes: dto.notes ?? null
      },
      include: leaseInclude
    });

    return this.serializeLease(lease);
  }

  async findOne(user: AuthenticatedUser, leaseId: string) {
    const lease = await this.getLeaseForWorkspace(user.workspaceId, leaseId);
    return this.serializeLease(lease);
  }

  async update(user: AuthenticatedUser, leaseId: string, dto: UpdateLeaseDto) {
    await this.getLeaseForWorkspace(user.workspaceId, leaseId);

    if (dto.propertyId) {
      await this.assertPropertyOwnedByWorkspace(user.workspaceId, dto.propertyId);
    }

    if (dto.tenantId) {
      await this.assertTenantOwnedByWorkspace(user.workspaceId, dto.tenantId);
    }

    const lease = await this.prisma.lease.update({
      where: { id: leaseId },
      data: {
        ...(dto.propertyId ? { propertyId: dto.propertyId } : {}),
        ...(dto.unitId !== undefined ? { unitId: dto.unitId || null } : {}),
        ...(dto.tenantId ? { tenantId: dto.tenantId } : {}),
        ...(dto.startDate ? { startDate: dto.startDate } : {}),
        ...(dto.endDate !== undefined ? { endDate: dto.endDate || null } : {}),
        ...(dto.monthlyRent ? { monthlyRent: dto.monthlyRent } : {}),
        ...(dto.depositAmount !== undefined ? { depositAmount: dto.depositAmount || null } : {}),
        ...(dto.currency ? { currency: dto.currency } : {}),
        ...(dto.paymentFrequency ? { paymentFrequency: dto.paymentFrequency } : {}),
        ...(dto.paymentDayOfMonth ? { paymentDayOfMonth: dto.paymentDayOfMonth } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes || null } : {})
      },
      include: leaseInclude
    });

    return this.serializeLease(lease);
  }

  async terminate(user: AuthenticatedUser, leaseId: string, dto: TerminateLeaseDto) {
    await this.getLeaseForWorkspace(user.workspaceId, leaseId);

    const lease = await this.prisma.lease.update({
      where: { id: leaseId },
      data: {
        status: LeaseStatus.TERMINATED,
        terminatedAt: dto.terminatedAt ?? new Date(),
        ...(dto.notes !== undefined ? { notes: dto.notes || null } : {})
      },
      include: leaseInclude
    });

    return this.serializeLease(lease);
  }

  private async getLeaseForWorkspace(workspaceId: string, leaseId: string) {
    const lease = await this.prisma.lease.findFirst({
      where: {
        id: leaseId,
        workspaceId
      },
      include: leaseInclude
    });

    if (!lease) {
      throw new NotFoundException("Lease not found.");
    }

    return lease;
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

  private async assertTenantOwnedByWorkspace(workspaceId: string, tenantId: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        id: tenantId,
        workspaceId
      }
    });

    if (!tenant) {
      throw new NotFoundException("Tenant not found.");
    }
  }

  private serializeLease(lease: LeaseWithRelations) {
    return {
      id: lease.id,
      propertyId: lease.propertyId,
      unitId: lease.unitId,
      tenantId: lease.tenantId,
      property: lease.property,
      tenant: lease.tenant,
      startDate: lease.startDate.toISOString(),
      endDate: lease.endDate?.toISOString() ?? null,
      monthlyRent: lease.monthlyRent.toString(),
      depositAmount: lease.depositAmount?.toString() ?? null,
      currency: lease.currency,
      paymentFrequency: lease.paymentFrequency,
      paymentDayOfMonth: lease.paymentDayOfMonth,
      status: lease.status,
      terminatedAt: lease.terminatedAt?.toISOString() ?? null,
      notes: lease.notes,
      createdAt: lease.createdAt.toISOString(),
      updatedAt: lease.updatedAt.toISOString()
    };
  }
}
