import { Injectable } from "@nestjs/common";

@Injectable()
export class DocumentTextNormalizationService {
  normalize(text: string) {
    return text
      .replace(/\u00a0/g, " ")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  textQualityScore(text: string) {
    if (!text.trim()) {
      return 0;
    }

    const visible = Array.from(text).filter((char) => !/\s/.test(char));
    if (visible.length === 0) {
      return 0;
    }

    const alphaNumericCount = visible.filter((char) => /[\p{L}\p{N}]/u.test(char)).length;
    const longWords = text.match(/[\p{L}\p{N}]{3,}/gu) ?? [];

    return Math.min(
      1,
      (text.length / 2000) * 0.45 +
        (alphaNumericCount / visible.length) * 0.35 +
        (longWords.length / 120) * 0.2
    );
  }

  shouldUseOcr(text: string) {
    const normalized = this.normalize(text);
    return normalized.length < 120 || this.textQualityScore(normalized) < 0.22;
  }
}
