import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { DocumentParsingStatus, Prisma } from "@prisma/client";
import type { AuthenticatedUser } from "../../common/types/authenticated-user.type";
import { PrismaService } from "../../database/prisma/prisma.service";
import { GenericInvoiceParser } from "./generic-invoice.parser";

const extractionInclude = Prisma.validator<Prisma.DocumentExtractionInclude>()({
  document: {
    select: {
      id: true,
      extractionStatus: true,
      parsingStatus: true
    }
  }
});

type ExtractionWithDocument = Prisma.DocumentExtractionGetPayload<{
  include: typeof extractionInclude;
}>;

@Injectable()
export class DocumentParsingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly genericInvoiceParser: GenericInvoiceParser
  ) {}

  async parse(user: AuthenticatedUser, documentId: string) {
    const document = await this.getDocumentForWorkspace(user.workspaceId, documentId);
    const extraction = await this.prisma.documentExtraction.findUnique({
      where: {
        documentId
      }
    });

    if (!extraction?.normalizedText) {
      throw new BadRequestException("Extract text from this document before parsing it.");
    }

    const parsed = this.genericInvoiceParser.parse({
      text: extraction.normalizedText,
      documentCategory: document.category
    });

    const parsingStatus =
      parsed.missing_fields.length > 0 || parsed.warnings.length > 0
        ? DocumentParsingStatus.NEEDS_REVIEW
        : DocumentParsingStatus.PARSED;

    const updatedExtraction = await this.prisma.$transaction(async (tx) => {
      const record = await tx.documentExtraction.update({
        where: {
          documentId
        },
        data: {
          parsedJson: parsed as Prisma.InputJsonValue,
          correctedJson: Prisma.JsonNull,
          parserName: parsed.parser_name,
          parserVersion: parsed.parser_version,
          confidenceScore: parsed.confidence.toString(),
          warnings: parsed.warnings as Prisma.InputJsonValue,
          missingFields: parsed.missing_fields as Prisma.InputJsonValue
        },
        include: extractionInclude
      });

      await tx.document.update({
        where: {
          id: documentId
        },
        data: {
          parsingStatus
        }
      });

      return record;
    });

    return this.serializeExtraction(updatedExtraction);
  }

  private async getDocumentForWorkspace(workspaceId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        workspaceId
      },
      select: {
        id: true,
        category: true
      }
    });

    if (!document) {
      throw new NotFoundException("Document not found.");
    }

    return document;
  }

  private serializeExtraction(extraction: ExtractionWithDocument) {
    return {
      id: extraction.id,
      documentId: extraction.documentId,
      documentExtractionStatus: extraction.document.extractionStatus,
      documentParsingStatus: extraction.document.parsingStatus,
      extractionMethod: extraction.extractionMethod,
      rawText: extraction.rawText,
      normalizedText: extraction.normalizedText,
      parsedJson: extraction.parsedJson,
      correctedJson: extraction.correctedJson,
      parserName: extraction.parserName,
      parserVersion: extraction.parserVersion,
      confidenceScore: extraction.confidenceScore?.toString() ?? null,
      warnings: extraction.warnings,
      missingFields: extraction.missingFields,
      textChecksum: extraction.textChecksum,
      createdAt: extraction.createdAt.toISOString(),
      updatedAt: extraction.updatedAt.toISOString()
    };
  }
}
