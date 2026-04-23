function escapePdfText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildContentStream(lines: string[]) {
  const contentLines = ["BT", "/F1 12 Tf", "50 760 Td"];

  lines.forEach((line, index) => {
    if (index === 0) {
      contentLines.push(`(${escapePdfText(line)}) Tj`);
      return;
    }

    contentLines.push("0 -16 Td");
    contentLines.push(`(${escapePdfText(line)}) Tj`);
  });

  contentLines.push("ET");

  return contentLines.join("\n");
}

export function buildPdfDocument(title: string, sections: Array<{ heading: string; lines: string[] }>) {
  const flattenedLines = [title, ""];

  sections.forEach((section) => {
    flattenedLines.push(section.heading);
    flattenedLines.push(...section.lines);
    flattenedLines.push("");
  });

  const pageLineLimit = 42;
  const pages = [];

  for (let index = 0; index < flattenedLines.length; index += pageLineLimit) {
    pages.push(flattenedLines.slice(index, index + pageLineLimit));
  }

  if (pages.length === 0) {
    pages.push([title]);
  }

  const objects: string[] = [];
  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");

  const pageObjectIds: number[] = [];
  const contentObjectIds: number[] = [];
  let nextObjectId = 3;

  pages.forEach(() => {
    pageObjectIds.push(nextObjectId);
    nextObjectId += 1;
    contentObjectIds.push(nextObjectId);
    nextObjectId += 1;
  });

  const kids = pageObjectIds.map((id) => `${id} 0 R`).join(" ");
  objects.push(`2 0 obj\n<< /Type /Pages /Count ${pages.length} /Kids [${kids}] >>\nendobj`);

  pages.forEach((lines, pageIndex) => {
    const pageObjectId = pageObjectIds[pageIndex];
    const contentObjectId = contentObjectIds[pageIndex];
    const contentStream = buildContentStream(lines);

    objects.push(
      `${pageObjectId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${nextObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>\nendobj`
    );
    objects.push(
      `${contentObjectId} 0 obj\n<< /Length ${Buffer.byteLength(contentStream, "utf8")} >>\nstream\n${contentStream}\nendstream\nendobj`
    );
  });

  objects.push(`${nextObjectId} 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj`);

  const header = "%PDF-1.4\n";
  let pdf = header;
  const offsets = [0];

  objects.forEach((object) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${object}\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}
