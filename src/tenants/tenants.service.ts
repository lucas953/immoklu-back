import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma/prisma.service";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { TenantStatus } from "@prisma/client";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { UpdateTenantDto } from "./dto/update-tenant.dto";

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthenticatedUser) {
    const tenants = await this.prisma.tenant.findMany({
      where: {
        workspaceId: user.workspaceId
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }]
    });

    return tenants.map((tenant) => this.serializeTenant(tenant));
  }

  async create(user: AuthenticatedUser, dto: CreateTenantDto) {
    const tenant = await this.prisma.tenant.create({
      data: {
        workspaceId: user.workspaceId,
        fullName: dto.fullName,
        email: dto.email ?? null,
        phone: dto.phone ?? null,
        tenantType: dto.tenantType,
        notes: dto.notes ?? null
      }
    });

    return this.serializeTenant(tenant);
  }

  async findOne(user: AuthenticatedUser, tenantId: string) {
    const tenant = await this.getTenantForWorkspace(user.workspaceId, tenantId);
    return this.serializeTenant(tenant);
  }

  async update(user: AuthenticatedUser, tenantId: string, dto: UpdateTenantDto) {
    await this.getTenantForWorkspace(user.workspaceId, tenantId);

    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(dto.fullName ? { fullName: dto.fullName } : {}),
        ...(dto.email !== undefined ? { email: dto.email || null } : {}),
        ...(dto.phone !== undefined ? { phone: dto.phone || null } : {}),
        ...(dto.tenantType ? { tenantType: dto.tenantType } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes || null } : {})
      }
    });

    return this.serializeTenant(tenant);
  }

  async archive(user: AuthenticatedUser, tenantId: string) {
    await this.getTenantForWorkspace(user.workspaceId, tenantId);

    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        status: TenantStatus.ARCHIVED,
        archivedAt: new Date()
      }
    });

    return this.serializeTenant(tenant);
  }

  async unarchive(user: AuthenticatedUser, tenantId: string) {
    await this.getTenantForWorkspace(user.workspaceId, tenantId);

    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        status: TenantStatus.ACTIVE,
        archivedAt: null
      }
    });

    return this.serializeTenant(tenant);
  }

  private async getTenantForWorkspace(workspaceId: string, tenantId: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        id: tenantId,
        workspaceId
      }
    });

    if (!tenant) {
      throw new NotFoundException("Tenant not found.");
    }

    return tenant;
  }

  private serializeTenant(tenant: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    tenantType: string;
    notes: string | null;
    status: string;
    archivedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: tenant.id,
      fullName: tenant.fullName,
      email: tenant.email,
      phone: tenant.phone,
      tenantType: tenant.tenantType,
      notes: tenant.notes,
      status: tenant.status,
      archivedAt: tenant.archivedAt?.toISOString() ?? null,
      createdAt: tenant.createdAt.toISOString(),
      updatedAt: tenant.updatedAt.toISOString()
    };
  }
}
