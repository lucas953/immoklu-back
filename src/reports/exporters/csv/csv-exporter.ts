function escapeCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);

  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

export function buildCsv(headers: string[], rows: Array<Array<string | number | null | undefined>>) {
  const lines = [
    headers.map((header) => escapeCell(header)).join(","),
    ...rows.map((row) => row.map((cell) => escapeCell(cell)).join(","))
  ];

  return Buffer.from(lines.join("\n"), "utf8");
}
