import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../database/prisma/prisma.service";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { CreatePropertyDto } from "./dto/create-property.dto";
import { UpdatePropertyDto } from "./dto/update-property.dto";
import { PropertyStatus } from "@prisma/client";

@Injectable()
export class PropertiesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthenticatedUser) {
    const properties = await this.prisma.property.findMany({
      where: {
        workspaceId: user.workspaceId
      },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }]
    });

    return properties.map((property) => this.serializeProperty(property));
  }

  async create(user: AuthenticatedUser, dto: CreatePropertyDto) {
    const property = await this.prisma.property.create({
      data: {
        workspaceId: user.workspaceId,
        name: dto.name,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2 ?? null,
        postalCode: dto.postalCode ?? null,
        city: dto.city,
        stateRegion: dto.stateRegion ?? null,
        countryCode: dto.countryCode,
        type: dto.type,
        purchasePrice: dto.purchasePrice,
        acquisitionDate: dto.acquisitionDate,
        currentValue: dto.currentValue ?? null,
        currency: dto.currency,
        status: dto.status,
        notes: dto.notes ?? null
      }
    });

    return this.serializeProperty(property);
  }

  async findOne(user: AuthenticatedUser, propertyId: string) {
    const property = await this.getPropertyForWorkspace(user.workspaceId, propertyId);
    return this.serializeProperty(property);
  }

  async update(user: AuthenticatedUser, propertyId: string, dto: UpdatePropertyDto) {
    await this.getPropertyForWorkspace(user.workspaceId, propertyId);

    const property = await this.prisma.property.update({
      where: { id: propertyId },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.addressLine1 ? { addressLine1: dto.addressLine1 } : {}),
        ...(dto.addressLine2 !== undefined ? { addressLine2: dto.addressLine2 || null } : {}),
        ...(dto.postalCode !== undefined ? { postalCode: dto.postalCode || null } : {}),
        ...(dto.city ? { city: dto.city } : {}),
        ...(dto.stateRegion !== undefined ? { stateRegion: dto.stateRegion || null } : {}),
        ...(dto.countryCode ? { countryCode: dto.countryCode } : {}),
        ...(dto.type ? { type: dto.type } : {}),
        ...(dto.purchasePrice ? { purchasePrice: dto.purchasePrice } : {}),
        ...(dto.acquisitionDate ? { acquisitionDate: dto.acquisitionDate } : {}),
        ...(dto.currentValue !== undefined ? { currentValue: dto.currentValue || null } : {}),
        ...(dto.currency ? { currency: dto.currency } : {}),
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes || null } : {})
      }
    });

    return this.serializeProperty(property);
  }

  async archive(user: AuthenticatedUser, propertyId: string) {
    await this.getPropertyForWorkspace(user.workspaceId, propertyId);

    const property = await this.prisma.property.update({
      where: { id: propertyId },
      data: {
        status: PropertyStatus.ARCHIVED,
        archivedAt: new Date()
      }
    });

    return this.serializeProperty(property);
  }

  async unarchive(user: AuthenticatedUser, propertyId: string) {
    await this.getPropertyForWorkspace(user.workspaceId, propertyId);

    const property = await this.prisma.property.update({
      where: { id: propertyId },
      data: {
        status: PropertyStatus.ACTIVE,
        archivedAt: null
      }
    });

    return this.serializeProperty(property);
  }

  private async getPropertyForWorkspace(workspaceId: string, propertyId: string) {
    const property = await this.prisma.property.findFirst({
      where: {
        id: propertyId,
        workspaceId
      }
    });

    if (!property) {
      throw new NotFoundException("Property not found.");
    }

    return property;
  }

  private serializeProperty(property: {
    id: string;
    name: string;
    addressLine1: string;
    addressLine2: string | null;
    postalCode: string | null;
    city: string;
    stateRegion: string | null;
    countryCode: string;
    type: string;
    purchasePrice: { toString(): string } | null;
    acquisitionDate: Date | null;
    currentValue: { toString(): string } | null;
    currency: string;
    status: string;
    archivedAt: Date | null;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: property.id,
      name: property.name,
      addressLine1: property.addressLine1,
      addressLine2: property.addressLine2,
      postalCode: property.postalCode,
      city: property.city,
      stateRegion: property.stateRegion,
      countryCode: property.countryCode,
      type: property.type,
      purchasePrice: property.purchasePrice?.toString() ?? null,
      acquisitionDate: property.acquisitionDate?.toISOString() ?? null,
      currentValue: property.currentValue?.toString() ?? null,
      currency: property.currency,
      status: property.status,
      archivedAt: property.archivedAt?.toISOString() ?? null,
      notes: property.notes,
      createdAt: property.createdAt.toISOString(),
      updatedAt: property.updatedAt.toISOString()
    };
  }
}
