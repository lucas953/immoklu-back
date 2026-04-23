import { randomUUID } from "node:crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import type { AuthenticatedUser } from "../common/types/authenticated-user.type";
import { CreateDocumentDto } from "./dto/create-document.dto";
import { InitiateDocumentUploadDto } from "./dto/initiate-document-upload.dto";
import { UpdateDocumentDto } from "./dto/update-document.dto";

const documentInclude = Prisma.validator<Prisma.DocumentInclude>()({
  property: {
    select: {
      id: true,
      name: true
    }
  },
  unit: {
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
  },
  lease: {
    select: {
      id: true,
      startDate: true,
      endDate: true
    }
  },
  expense: {
    select: {
      id: true,
      amount: true,
      currency: true,
      expenseDate: true
    }
  },
  documentTags: {
    include: {
      tag: {
        select: {
          id: true,
          name: true,
          color: true
        }
      }
    },
    orderBy: {
      tag: {
        name: "asc"
      }
    }
  }
});

type DocumentWithRelations = Prisma.DocumentGetPayload<{
  include: typeof documentInclude;
}>;

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService
  ) {}

  async initiateUpload(user: AuthenticatedUser, dto: InitiateDocumentUploadDto) {
    const objectKey = this.storageService.createDocumentObjectKey(user.workspaceId, dto.originalFileName);
    const upload = await this.storageService.createUploadUrl({
      objectKey,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes
    });

    return {
      objectKey,
      originalFileName: dto.originalFileName,
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      ...upload
    };
  }

  async create(user: AuthenticatedUser, dto: CreateDocumentDto) {
    this.assertDocumentObjectKeyBelongsToWorkspace(user.workspaceId, dto.objectKey);
    await this.assertDocumentRelations(user.workspaceId, dto);

    const document = await this.prisma.$transaction(async (tx) => {
      const tagIds = await this.resolveTagIds(tx, user.workspaceId, dto.tagNames);
      const data: Prisma.DocumentCreateInput = {
        workspace: {
          connect: {
            id: user.workspaceId
          }
        },
        category: dto.category,
        title: dto.title ?? null,
        originalFileName: dto.originalFileName,
        mimeType: dto.mimeType,
        sizeBytes: dto.sizeBytes,
        storageProvider: this.storageService.provider,
        storageBucket: this.storageService.bucket,
        objectKey: dto.objectKey,
        checksum: dto.checksum ?? null,
        ...(dto.propertyId
          ? {
              property: {
                connect: {
                  id: dto.propertyId
                }
              }
            }
          : {}),
        ...(dto.unitId
          ? {
              unit: {
                connect: {
                  id: dto.unitId
                }
              }
            }
          : {}),
        ...(dto.tenantId
          ? {
              tenant: {
                connect: {
                  id: dto.tenantId
                }
              }
            }
          : {}),
        ...(dto.leaseId
          ? {
              lease: {
                connect: {
                  id: dto.leaseId
                }
              }
            }
          : {}),
        ...(dto.expenseId
          ? {
              expense: {
                connect: {
                  id: dto.expenseId
                }
              }
            }
          : {}),
        ...(dto.metadata
          ? {
              metadata: dto.metadata as Prisma.InputJsonValue
            }
          : {}),
        ...(tagIds.length > 0
          ? {
              documentTags: {
                create: tagIds.map((tagId) => ({
                  tag: {
                    connect: {
                      id: tagId
                    }
                  }
                }))
              }
            }
          : {})
      };

      return tx.document.create({
        data,
        include: documentInclude
      });
    });

    return this.serializeDocument(document);
  }

  async findAll(user: AuthenticatedUser) {
    const documents = await this.prisma.document.findMany({
      where: {
        workspaceId: user.workspaceId
      },
      include: documentInclude,
      orderBy: [{ uploadedAt: "desc" }, { updatedAt: "desc" }]
    });

    return documents.map((document) => this.serializeDocument(document));
  }

  async findOne(user: AuthenticatedUser, documentId: string) {
    const document = await this.getDocumentForWorkspace(user.workspaceId, documentId);
    return this.serializeDocument(document);
  }

  async update(user: AuthenticatedUser, documentId: string, dto: UpdateDocumentDto) {
    await this.getDocumentForWorkspace(user.workspaceId, documentId);
    await this.assertDocumentRelations(user.workspaceId, dto);

    const document = await this.prisma.$transaction(async (tx) => {
      const tagIds = dto.tagNames ? await this.resolveTagIds(tx, user.workspaceId, dto.tagNames) : null;
      const data: Prisma.DocumentUpdateInput = {
        ...(dto.category
          ? {
              category: dto.category
            }
          : {}),
        ...(dto.title !== undefined
          ? {
              title: dto.title ?? null
            }
          : {}),
        ...(dto.propertyId !== undefined
          ? {
              property: dto.propertyId
                ? {
                    connect: {
                      id: dto.propertyId
                    }
                  }
                : {
                    disconnect: true
                  }
            }
          : {}),
        ...(dto.unitId !== undefined
          ? {
              unit: dto.unitId
                ? {
                    connect: {
                      id: dto.unitId
                    }
                  }
                : {
                    disconnect: true
                  }
            }
          : {}),
        ...(dto.tenantId !== undefined
          ? {
              tenant: dto.tenantId
                ? {
                    connect: {
                      id: dto.tenantId
                    }
                  }
                : {
                    disconnect: true
                  }
            }
          : {}),
        ...(dto.leaseId !== undefined
          ? {
              lease: dto.leaseId
                ? {
                    connect: {
                      id: dto.leaseId
                    }
                  }
                : {
                    disconnect: true
                  }
            }
          : {}),
        ...(dto.expenseId !== undefined
          ? {
              expense: dto.expenseId
                ? {
                    connect: {
                      id: dto.expenseId
                    }
                  }
                : {
                    disconnect: true
                  }
            }
          : {}),
        ...(dto.metadata
          ? {
              metadata: dto.metadata as Prisma.InputJsonValue
            }
          : {}),
        ...(tagIds
          ? {
              documentTags: {
                deleteMany: {},
                create: tagIds.map((tagId) => ({
                  tag: {
                    connect: {
                      id: tagId
                    }
                  }
                }))
              }
            }
          : {})
      };

      return tx.document.update({
        where: { id: documentId },
        data,
        include: documentInclude
      });
    });

    return this.serializeDocument(document);
  }

  async remove(user: AuthenticatedUser, documentId: string) {
    const document = await this.getDocumentForWorkspace(user.workspaceId, documentId);

    await this.storageService.deleteObject(document.objectKey);
    await this.prisma.document.delete({
      where: { id: documentId }
    });

    return { success: true };
  }

  async getDownloadUrl(user: AuthenticatedUser, documentId: string) {
    const document = await this.getDocumentForWorkspace(user.workspaceId, documentId);

    return this.storageService.createDownloadUrl({
      objectKey: document.objectKey,
      fileName: document.originalFileName
    });
  }

  private assertDocumentObjectKeyBelongsToWorkspace(workspaceId: string, objectKey: string) {
    const expectedPrefix = `workspaces/${workspaceId}/documents/`;
    if (!objectKey.startsWith(expectedPrefix)) {
      throw new BadRequestException("The document upload key is invalid for this workspace.");
    }
  }

  private async assertDocumentRelations(
    workspaceId: string,
    dto: {
      propertyId?: string | null;
      unitId?: string | null;
      tenantId?: string | null;
      leaseId?: string | null;
      expenseId?: string | null;
    }
  ) {
    const checks = [
      dto.propertyId
        ? this.prisma.property.findFirst({
            where: { id: dto.propertyId, workspaceId },
            select: { id: true }
          })
        : Promise.resolve(true),
      dto.unitId
        ? this.prisma.unit.findFirst({
            where: { id: dto.unitId, workspaceId },
            select: { id: true }
          })
        : Promise.resolve(true),
      dto.tenantId
        ? this.prisma.tenant.findFirst({
            where: { id: dto.tenantId, workspaceId },
            select: { id: true }
          })
        : Promise.resolve(true),
      dto.leaseId
        ? this.prisma.lease.findFirst({
            where: { id: dto.leaseId, workspaceId },
            select: { id: true }
          })
        : Promise.resolve(true),
      dto.expenseId
        ? this.prisma.expense.findFirst({
            where: { id: dto.expenseId, workspaceId },
            select: { id: true }
          })
        : Promise.resolve(true)
    ];

    const [property, unit, tenant, lease, expense] = await Promise.all(checks);

    if (!property) {
      throw new NotFoundException("Property not found.");
    }

    if (!unit) {
      throw new NotFoundException("Unit not found.");
    }

    if (!tenant) {
      throw new NotFoundException("Tenant not found.");
    }

    if (!lease) {
      throw new NotFoundException("Lease not found.");
    }

    if (!expense) {
      throw new NotFoundException("Expense not found.");
    }
  }

  private async resolveTagIds(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    tagNames: string[]
  ) {
    const uniqueTagNames = Array.from(new Set(tagNames.map((tag) => tag.trim()).filter(Boolean)));

    if (uniqueTagNames.length === 0) {
      return [];
    }

    const tags = await Promise.all(
      uniqueTagNames.map((tagName) =>
        tx.tag.upsert({
          where: {
            workspaceId_name: {
              workspaceId,
              name: tagName
            }
          },
          update: {},
          create: {
            workspaceId,
            name: tagName
          },
          select: {
            id: true
          }
        })
      )
    );

    return tags.map((tag) => tag.id);
  }

  private async getDocumentForWorkspace(workspaceId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        workspaceId
      },
      include: documentInclude
    });

    if (!document) {
      throw new NotFoundException("Document not found.");
    }

    return document;
  }

  private serializeDocument(document: DocumentWithRelations) {
    return {
      id: document.id,
      category: document.category,
      title: document.title,
      originalFileName: document.originalFileName,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      propertyId: document.propertyId,
      unitId: document.unitId,
      tenantId: document.tenantId,
      leaseId: document.leaseId,
      expenseId: document.expenseId,
      property: document.property,
      unit: document.unit,
      tenant: document.tenant,
      lease: document.lease
        ? {
            id: document.lease.id,
            startDate: document.lease.startDate.toISOString(),
            endDate: document.lease.endDate?.toISOString() ?? null
          }
        : null,
      expense: document.expense
        ? {
            id: document.expense.id,
            amount: document.expense.amount.toString(),
            currency: document.expense.currency,
            expenseDate: document.expense.expenseDate.toISOString()
          }
        : null,
      tags: document.documentTags.map((documentTag) => documentTag.tag),
      metadata: document.metadata,
      uploadedAt: document.uploadedAt.toISOString(),
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString()
    };
  }
}
