import { Injectable } from "@nestjs/common";
import type { DocumentParser, ParsedInvoiceData, ParserInput } from "./parser.types";
import {
  detectCurrency,
  foldText,
  normalizeLines,
  parseDateToken,
  parseSpanishAmount
} from "./invoice-parsing.utils";

const DATE_TOKEN = String.raw`(?:\d{4}[/-]\d{1,2}[/-]\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4})`;
const AMOUNT_TOKEN = String.raw`(?:EUR|€)?\s*-?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})\s*(?:EUR|€)?`;

@Injectable()
export class GenericInvoiceParser implements DocumentParser {
  readonly name = "generic_invoice";
  readonly version = "1.0.0";

  parse(input: ParserInput): ParsedInvoiceData {
    const lines = normalizeLines(input.text);
    const text = input.text;
    const supplierName = this.findSupplier(lines, text);
    const invoiceNumber = this.findInvoiceNumber(lines, text);
    const invoiceDate = this.findLabeledDate(lines, /(fecha\s+factura|fecha\s+de\s+emision|invoice\s+date)/i);
    const dueDate = this.findLabeledDate(lines, /(fecha\s+vencimiento|vencimiento|due\s+date)/i);
    const [periodStart, periodEnd] = this.findPeriod(lines, text);
    const totalAmount = this.findTotalAmount(lines, text);
    const utilityType = this.findUtilityType(text);
    const serviceAddress = this.findAddress(lines);
    const supplierTaxId = this.findTaxId(text);
    const currency = detectCurrency(text) ?? (totalAmount ? "EUR" : null);
    const missingFields = this.findMissingFields({
      supplierName,
      invoiceNumber,
      invoiceDate,
      totalAmount,
      currency
    });
    const warnings = this.findWarnings({
      missingFields,
      periodStart,
      periodEnd,
      serviceAddress
    });
    const confidence = this.calculateConfidence({
      supplierName,
      supplierTaxId,
      invoiceNumber,
      invoiceDate,
      dueDate,
      periodStart,
      periodEnd,
      serviceAddress,
      totalAmount,
      currency,
      utilityType
    });

    return {
      document_type: "invoice",
      supplier_name: supplierName,
      supplier_tax_id: supplierTaxId,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      due_date: dueDate,
      period_start: periodStart,
      period_end: periodEnd,
      service_address: serviceAddress,
      property_reference: null,
      total_amount: totalAmount,
      tax_amount: null,
      net_amount: null,
      currency,
      utility_type: utilityType,
      expense_category: this.inferExpenseCategory(input.documentCategory, utilityType),
      line_items: [],
      iban_last_digits: this.findIbanLastDigits(text),
      contract_number: this.findLabeledValue(lines, /(contrato|contract)/i),
      meter_number: this.findLabeledValue(lines, /(contador|meter)/i),
      confidence,
      parser_name: this.name,
      parser_version: this.version,
      warnings,
      missing_fields: missingFields
    };
  }

  private findSupplier(lines: string[], text: string) {
    const knownSuppliers = [
      "Iberdrola",
      "Endesa",
      "Naturgy",
      "Repsol",
      "Plenitude",
      "Octopus",
      "Contigo Energia",
      "Canal de Isabel II",
      "Movistar",
      "Vodafone",
      "Orange"
    ];
    const foldedText = foldText(text);

    for (const supplier of knownSuppliers) {
      if (foldedText.includes(foldText(supplier))) {
        return supplier;
      }
    }

    const labeled = this.findLabeledValue(lines, /(comercializadora|empresa|proveedor|supplier|issued by)/i);
    if (labeled) {
      return labeled;
    }

    return (
      lines
        .slice(0, 12)
        .find(
          (line) =>
            /[A-Za-zÀ-ÿ]/.test(line) &&
            !/\b(factura|invoice|resumen|cliente|fecha|total)\b/i.test(foldText(line)) &&
            !/\d{4}/.test(line)
        ) ?? null
    );
  }

  private findInvoiceNumber(lines: string[], text: string) {
    const patterns = [
      /(?:n[úu]mero\s+de\s+factura|num\.?\s*factura|factura\s+n[ºo.]?|invoice\s+(?:number|no\.?))\s*[:#-]?\s*([A-Z0-9][A-Z0-9/-]{3,})/i,
      /\b(?:factura|invoice)\s+([A-Z0-9][A-Z0-9/-]{5,})\b/i
    ];

    for (const line of lines.slice(0, 100)) {
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match?.[1]) {
          return match[1].trim();
        }
      }
    }

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        return match[1].trim();
      }
    }

    return null;
  }

  private findPeriod(lines: string[], text: string): [string | null, string | null] {
    const pairPattern = new RegExp(`(${DATE_TOKEN}).{0,32}?(${DATE_TOKEN})`, "i");
    const periodKeywords = /(periodo|facturacion|consumo|desde|hasta|billing|period)/i;

    for (const line of lines) {
      if (!periodKeywords.test(foldText(line))) {
        continue;
      }

      const match = line.match(pairPattern);
      if (match?.[1] && match[2]) {
        const start = parseDateToken(match[1]);
        const end = parseDateToken(match[2]);
        if (start && end) {
          return [start, end];
        }
      }
    }

    const match = text.match(pairPattern);
    if (match?.[1] && match[2]) {
      return [parseDateToken(match[1]), parseDateToken(match[2])];
    }

    return [null, null];
  }

  private findLabeledDate(lines: string[], label: RegExp) {
    for (const line of lines) {
      if (!label.test(foldText(line))) {
        continue;
      }

      const match = line.match(new RegExp(DATE_TOKEN, "i"));
      if (match?.[0]) {
        return parseDateToken(match[0]);
      }
    }

    return null;
  }

  private findTotalAmount(lines: string[], text: string) {
    const totalPatterns = [
      new RegExp(`(?:total\\s+factura|importe\\s+total|total\\s+a\\s+pagar|total\\s+amount|amount\\s+due)\\D{0,30}(${AMOUNT_TOKEN})`, "i"),
      new RegExp(`(?:total)\\D{0,20}(${AMOUNT_TOKEN})`, "i")
    ];

    for (const line of lines) {
      for (const pattern of totalPatterns) {
        const match = line.match(pattern);
        if (match?.[1]) {
          return parseSpanishAmount(match[1]);
        }
      }
    }

    const values = Array.from(text.matchAll(new RegExp(AMOUNT_TOKEN, "gi")))
      .map((match) => parseSpanishAmount(match[0]))
      .filter((value): value is string => Boolean(value));

    if (values.length === 0) {
      return null;
    }

    return values.sort((a, b) => Number(b) - Number(a))[0] ?? null;
  }

  private findUtilityType(text: string) {
    const folded = foldText(text);
    if (/\b(electricidad|electricity|luz|energia electrica)\b/.test(folded)) {
      return "electricity";
    }
    if (/\b(gas)\b/.test(folded)) {
      return "gas";
    }
    if (/\b(agua|water)\b/.test(folded)) {
      return "water";
    }
    if (/\b(internet|fibra|fiber|movil|telefono|telecom)\b/.test(folded)) {
      return "internet";
    }
    return null;
  }

  private findAddress(lines: string[]) {
    const labels = [
      "direccion de suministro",
      "direccion del suministro",
      "direccion suministro",
      "supply address",
      "service address",
      "property address"
    ];

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? "";
      const folded = foldText(line);
      if (!labels.some((label) => folded.includes(label))) {
        continue;
      }

      const afterColon = line.includes(":") ? line.split(":").slice(1).join(":").trim() : "";
      if (afterColon) {
        return afterColon;
      }

      return lines[index + 1] ?? null;
    }

    return lines.find((line) => /\b(calle|avda|avenida|plaza|paseo|c\/)\b/i.test(foldText(line)) && /\d/.test(line)) ?? null;
  }

  private findTaxId(text: string) {
    const match = text.match(/\b([ABCDEFGHJKLMNPQRSUVW]\d{7}[0-9A-J]|\d{8}[A-Z])\b/i);
    return match?.[1]?.toUpperCase() ?? null;
  }

  private findIbanLastDigits(text: string) {
    const match = text.match(/\bES\d{2}\s?(?:\d{4}\s?){4}(\d{4})\b/i);
    return match?.[1] ?? null;
  }

  private findLabeledValue(lines: string[], label: RegExp) {
    for (const line of lines.slice(0, 120)) {
      if (!label.test(foldText(line))) {
        continue;
      }

      const value = line.includes(":") ? line.split(":").slice(1).join(":").trim() : "";
      if (value) {
        return value.replace(/^[#\-. ]+/, "").trim();
      }
    }

    return null;
  }

  private inferExpenseCategory(documentCategory: string, utilityType: string | null) {
    if (utilityType) {
      return "utilities";
    }
    if (documentCategory === "INSURANCE") {
      return "insurance";
    }
    if (documentCategory === "MORTGAGE_CONTRACT") {
      return "mortgage";
    }
    return "property_expense";
  }

  private findMissingFields(values: {
    supplierName: string | null;
    invoiceNumber: string | null;
    invoiceDate: string | null;
    totalAmount: string | null;
    currency: string | null;
  }) {
    const missing: string[] = [];
    if (!values.supplierName) missing.push("supplier_name");
    if (!values.invoiceNumber) missing.push("invoice_number");
    if (!values.invoiceDate) missing.push("invoice_date");
    if (!values.totalAmount) missing.push("total_amount");
    if (!values.currency) missing.push("currency");
    return missing;
  }

  private findWarnings(values: {
    missingFields: string[];
    periodStart: string | null;
    periodEnd: string | null;
    serviceAddress: string | null;
  }) {
    const warnings: string[] = [];
    if (values.missingFields.length > 0) {
      warnings.push(`Missing fields: ${values.missingFields.join(", ")}.`);
    }
    if (!values.periodStart || !values.periodEnd) {
      warnings.push("Billing period was not detected.");
    }
    if (!values.serviceAddress) {
      warnings.push("Service address was not detected.");
    }
    return warnings;
  }

  private calculateConfidence(values: Record<string, string | null>) {
    const weightedFields: Array<[string, number]> = [
      ["supplierName", 0.14],
      ["supplierTaxId", 0.07],
      ["invoiceNumber", 0.14],
      ["invoiceDate", 0.12],
      ["dueDate", 0.06],
      ["periodStart", 0.08],
      ["periodEnd", 0.08],
      ["serviceAddress", 0.09],
      ["totalAmount", 0.14],
      ["currency", 0.05],
      ["utilityType", 0.03]
    ];

    const score = weightedFields.reduce(
      (total, [field, weight]) => total + (values[field] ? weight : 0),
      0.15
    );

    return Number(Math.min(0.95, score).toFixed(2));
  }
}
