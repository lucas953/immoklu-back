import { Injectable } from "@nestjs/common";
import pdfParse from "pdf-parse";
import { DocumentTextNormalizationService } from "./document-text-normalization.service";

@Injectable()
export class PdfTextExtractionService {
  constructor(private readonly textNormalizationService: DocumentTextNormalizationService) {}

  async extract(buffer: Buffer) {
    const parsed = await pdfParse(buffer);
    const rawText = parsed.text ?? "";
    const normalizedText = this.textNormalizationService.normalize(rawText);
    const needsOcr = this.textNormalizationService.shouldUseOcr(normalizedText);
    const warnings: string[] = [];

    if (needsOcr) {
      warnings.push("Embedded PDF text is empty or weak. Local OCR may be needed in a later phase.");
    }

    return {
      extractionMethod: "pdf-parse",
      rawText,
      normalizedText,
      pageCount: parsed.numpages ?? null,
      textLength: normalizedText.length,
      needsOcr,
      warnings
    };
  }
}
