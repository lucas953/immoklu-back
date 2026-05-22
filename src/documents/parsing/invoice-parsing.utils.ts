const DATE_FORMAT_PATTERNS = [
  /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/,
  /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/
];

export function normalizeLines(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export function foldText(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function parseSpanishAmount(value: string) {
  const cleaned = value.replace(/[^\d,.-]/g, "");
  if (!cleaned) {
    return null;
  }

  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    normalized =
      cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if (cleaned.includes(",")) {
    const parts = cleaned.split(",");
    normalized = parts[parts.length - 1]?.length === 2 ? cleaned.replace(",", ".") : cleaned.replace(/,/g, "");
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount)) {
    return null;
  }

  return amount.toFixed(2);
}

export function detectCurrency(text: string) {
  const folded = foldText(text);
  if (text.includes("€") || folded.includes("eur")) {
    return "EUR";
  }

  if (text.includes("$") || folded.includes("usd")) {
    return "USD";
  }

  if (text.includes("£") || folded.includes("gbp")) {
    return "GBP";
  }

  return null;
}

export function parseDateToken(value: string) {
  const cleaned = value.trim().replace(/[.,]$/, "");

  for (const pattern of DATE_FORMAT_PATTERNS) {
    const match = cleaned.match(pattern);
    if (!match) {
      continue;
    }

    let year: number;
    let month: number;
    let day: number;

    if (match[1]?.length === 4) {
      year = Number(match[1]);
      month = Number(match[2]);
      day = Number(match[3]);
    } else {
      day = Number(match[1]);
      month = Number(match[2]);
      year = Number(match[3]);
      if (year < 100) {
        year += 2000;
      }
    }

    if (!isValidDateParts(year, month, day)) {
      return null;
    }

    return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
      .toString()
      .padStart(2, "0")}`;
  }

  return null;
}

function isValidDateParts(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
