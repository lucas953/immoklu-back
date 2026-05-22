import { createHash } from "node:crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { DocumentExtractionStatus, DocumentParsingStatus, Prisma } from "@prisma/client";
import type { AuthenticatedUser } from "../../common/types/authenticated-user.type";
import { PrismaService } from "../../database/prisma/prisma.service";
import { StorageService } from "../../storage/storage.service";
import { PdfTextExtractionService } from "./pdf-text-extraction.service";

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
export class DocumentExtractionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly pdfTextExtractionService: PdfTextExtractionService
  ) {}

  async extractText(user: AuthenticatedUser, documentId: string) {
    const document = await this.getDocumentForWorkspace(user.workspaceId, documentId);

    if (document.mimeType !== "application/pdf") {
      throw new BadRequestException("Only PDF documents can be extracted in this phase.");
    }

    try {
      const file = await this.storageService.getObjectBuffer(document.objectKey);
      const extracted = await this.pdfTextExtractionService.extract(file);
      const extractionStatus = extracted.needsOcr
        ? DocumentExtractionStatus.NEEDS_OCR
        : DocumentExtractionStatus.EXTRACTED;
      const textChecksum = extracted.normalizedText
        ? createHash("sha256").update(extracted.normalizedText).digest("hex")
        : null;
      const warnings = extracted.warnings.length > 0 ? extracted.warnings : undefined;

      const extraction = await this.prisma.$transaction(async (tx) => {
        const record = await tx.documentExtraction.upsert({
          where: {
            documentId
          },
          update: {
            extractionMethod: extracted.extractionMethod,
            rawText: extracted.rawText,
            normalizedText: extracted.normalizedText,
            parsedJson: Prisma.JsonNull,
            correctedJson: Prisma.JsonNull,
            parserName: null,
            parserVersion: null,
            confidenceScore: null,
            warnings: warnings ?? Prisma.JsonNull,
            missingFields: Prisma.JsonNull,
            textChecksum
          },
          create: {
            documentId,
            extractionMethod: extracted.extractionMethod,
            rawText: extracted.rawText,
            normalizedText: extracted.normalizedText,
            warnings: warnings ?? Prisma.JsonNull,
            textChecksum
          },
          include: extractionInclude
        });

        await tx.document.update({
          where: {
            id: documentId
          },
          data: {
            extractionStatus,
            parsingStatus: DocumentParsingStatus.NOT_STARTED
          }
        });

        return record;
      });

      return this.serializeExtraction(extraction);
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) {
        throw error;
      }

      await this.prisma.document.update({
        where: {
          id: documentId
        },
        data: {
          extractionStatus: DocumentExtractionStatus.FAILED
        }
      });

      throw error;
    }
  }

  async findExtraction(user: AuthenticatedUser, documentId: string) {
    await this.getDocumentForWorkspace(user.workspaceId, documentId);

    const extraction = await this.prisma.documentExtraction.findUnique({
      where: {
        documentId
      },
      include: extractionInclude
    });

    if (!extraction) {
      return null;
    }

    return this.serializeExtraction(extraction);
  }

  private async getDocumentForWorkspace(workspaceId: string, documentId: string) {
    const document = await this.prisma.document.findFirst({
      where: {
        id: documentId,
        workspaceId
      },
      select: {
        id: true,
        mimeType: true,
        objectKey: true
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
