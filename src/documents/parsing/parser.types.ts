export type ParsedInvoiceData = {
  document_type: string;
  supplier_name: string | null;
  supplier_tax_id: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  period_start: string | null;
  period_end: string | null;
  service_address: string | null;
  property_reference: string | null;
  total_amount: string | null;
  tax_amount: string | null;
  net_amount: string | null;
  currency: string | null;
  utility_type: string | null;
  expense_category: string | null;
  line_items: Array<Record<string, unknown>>;
  iban_last_digits: string | null;
  contract_number: string | null;
  meter_number: string | null;
  confidence: number;
  parser_name: string;
  parser_version: string;
  warnings: string[];
  missing_fields: string[];
};

export type ParserInput = {
  text: string;
  documentCategory: string;
};

export interface DocumentParser {
  readonly name: string;
  readonly version: string;
  parse(input: ParserInput): ParsedInvoiceData;
}
