import { Module } from "@nestjs/common";
import { StorageModule } from "../storage/storage.module";
import { DocumentExtractionService } from "./extraction/document-extraction.service";
import { DocumentTextNormalizationService } from "./extraction/document-text-normalization.service";
import { PdfTextExtractionService } from "./extraction/pdf-text-extraction.service";
import { DocumentParsingService } from "./parsing/document-parsing.service";
import { GenericInvoiceParser } from "./parsing/generic-invoice.parser";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";

@Module({
  imports: [StorageModule],
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    DocumentExtractionService,
    DocumentTextNormalizationService,
    DocumentParsingService,
    GenericInvoiceParser,
    PdfTextExtractionService
  ],
  exports: [DocumentsService]
})
export class DocumentsModule {}
