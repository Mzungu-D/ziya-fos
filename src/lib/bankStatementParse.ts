import * as XLSX from "xlsx";

export type Cell = string | number;
export type DateFormat = "AUTO" | "DMY" | "MDY" | "YMD";

export interface ParsedLine {
  date: string;
  description: string;
  reference: string;
  amount: number;
  balance: number | null;
}

export interface ColumnMapping {
  date: number;
  description: number;
  reference: number;
  amount: number;
  debit: number;
  credit: number;
  balance: number;
}

export const EMPTY_MAPPING: ColumnMapping = {
  date: -1,
  description: -1,
  reference: -1,
  amount: -1,
  debit: -1,
  credit: -1,
  balance: -1,
};

/* ---------- reading files ---------- */

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts: Record<string, number> = {
    ",": (firstLine.match(/,/g) ?? []).length,
    ";": (firstLine.match(/;/g) ?? []).length,
    "\t": (firstLine.match(/\t/g) ?? []).length,
  };
  const delimiter =
    Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field.trim());
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field.trim());
      field = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }

  row.push(field.trim());
  if (row.some((c) => c !== "")) rows.push(row);

  return rows;
}

export function readExcel(buffer: ArrayBuffer): Cell[][] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: "",
    blankrows: false,
  });

  return rows
    .map((r) =>
      (r as unknown[]).map((c) =>
        typeof c === "number" ? c : String(c ?? "").trim()
      )
    )
    .filter((r) => r.some((c) => c !== ""));
}

/* ---------- column detection ---------- */

export function detectHeaderRow(rows: Cell[][]): number {
  const limit = Math.min(rows.length, 30);

  for (let i = 0; i < limit; i += 1) {
    const filled = rows[i].filter((c) => String(c).trim() !== "");
    const hasDate = rows[i].some((c) => /date/i.test(String(c)));

    if (filled.length >= 3 && hasDate) return i;
  }

  return 0;
}

export function guessMapping(headers: string[]): ColumnMapping {
  const find = (re: RegExp, taken: number[] = []) =>
    headers.findIndex((h, i) => !taken.includes(i) && re.test(h));

  const mapping: ColumnMapping = { ...EMPTY_MAPPING };

  mapping.date =
    find(/trans.*date|posting.*date|value.*date/i) >= 0
      ? find(/trans.*date|posting.*date|value.*date/i)
      : find(/date/i);

  mapping.description = find(/descr|narrat|detail|particular|memo/i, [
    mapping.date,
  ]);
  mapping.reference = find(/ref|cheque|chq|receipt|txn|transaction id/i, [
    mapping.date,
    mapping.description,
  ]);
  mapping.debit = find(/debit|withdraw|paid out|money out|\bdr\b/i);
  mapping.credit = find(/credit|deposit|paid in|money in|\bcr\b/i);
  mapping.balance = find(/balance/i);

  if (mapping.debit < 0 && mapping.credit < 0) {
    mapping.amount = find(/amount/i, [mapping.balance]);
  }

  return mapping;
}

/* ---------- converting values ---------- */

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");

function validYmd(y: number, m: number, d: number): string | null {
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) {
    return null;
  }

  const test = new Date(Date.UTC(y, m - 1, d));

  if (
    test.getUTCFullYear() !== y ||
    test.getUTCMonth() !== m - 1 ||
    test.getUTCDate() !== d
  ) {
    return null;
  }

  return `${y}-${pad(m)}-${pad(d)}`;
}

export function parseDate(value: Cell, format: DateFormat): string | null {
  if (typeof value === "number") {
    if (value > 20000 && value < 80000) {
      // Excel serial date: days since 1899-12-30
      const d = new Date(
        Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000
      );

      return validYmd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }

    return null;
  }

  const text = value.trim();

  if (!text) return null;

  let m = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);

  if (m) return validYmd(Number(m[1]), Number(m[2]), Number(m[3]));

  m = text.match(/^(\d{1,2})[\s\-/.]([A-Za-z]{3})[A-Za-z]*[\s\-/.,]+(\d{2,4})/);

  if (m) {
    const month = MONTHS[m[2].toLowerCase()];
    const year = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);

    return month ? validYmd(year, month, Number(m[1])) : null;
  }

  m = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);

  if (!m) return null;

  const a = Number(m[1]);
  const b = Number(m[2]);
  const year = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);

  let day = a;
  let month = b;

  if (format === "MDY") {
    day = b;
    month = a;
  } else if (format === "AUTO" && b > 12 && a <= 12) {
    day = b;
    month = a;
  }

  return validYmd(year, month, day);
}

export function parseAmount(value: Cell): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  let text = value.trim();

  if (!text) return null;

  let negative = false;

  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }

  if (/\bdr\b/i.test(text)) negative = true;

  text = text.replace(/(kes|ksh|usd|eur|gbp|\bdr\b|\bcr\b)/gi, "");
  // "1 000,50" style: a comma followed by 1-2 digits is a decimal comma
  if (/^[\d\s]+,\d{1,2}$/.test(text)) {
    text = text.replace(/\s/g, "").replace(",", ".");
  } else {
    text = text.replace(/[\s,]/g, "");
  }

  if (text.startsWith("-")) {
    negative = !negative;
    text = text.slice(1);
  }

  if (!/^\d*\.?\d+$/.test(text)) return null;

  const n = Number(text);

  if (!Number.isFinite(n)) return null;

  return negative ? -n : n;
}

/* ---------- turning rows into transactions ---------- */

export function normalizeRows(
  rows: Cell[][],
  headerRow: number,
  mapping: ColumnMapping,
  format: DateFormat
): { lines: ParsedLine[]; skipped: number } {
  const lines: ParsedLine[] = [];
  let skipped = 0;

  if (mapping.date < 0) return { lines, skipped };

  const hasSplit = mapping.debit >= 0 || mapping.credit >= 0;

  if (!hasSplit && mapping.amount < 0) return { lines, skipped };

  for (let i = headerRow + 1; i < rows.length; i += 1) {
    const row = rows[i];
    const date = parseDate(row[mapping.date] ?? "", format);

    let amount: number | null = null;

    if (hasSplit) {
      const debit =
        mapping.debit >= 0 ? parseAmount(row[mapping.debit] ?? "") : null;
      const credit =
        mapping.credit >= 0 ? parseAmount(row[mapping.credit] ?? "") : null;

      if (credit && credit !== 0) amount = Math.abs(credit);
      else if (debit && debit !== 0) amount = -Math.abs(debit);
    } else {
      amount = parseAmount(row[mapping.amount] ?? "");
    }

    if (!date || amount === null || amount === 0) {
      skipped += 1;
      continue;
    }

    lines.push({
      date,
      description:
        mapping.description >= 0
          ? String(row[mapping.description] ?? "").trim()
          : "",
      reference:
        mapping.reference >= 0
          ? String(row[mapping.reference] ?? "").trim()
          : "",
      amount: Math.round(amount * 100) / 100,
      balance:
        mapping.balance >= 0 ? parseAmount(row[mapping.balance] ?? "") : null,
    });
  }

  return { lines, skipped };
}

export function deriveBalances(lines: ParsedLine[]): {
  openingBalance: number | null;
  closingBalance: number | null;
} {
  const withBalance = lines.filter((l) => l.balance !== null);

  if (withBalance.length === 0 || lines.length < 1) {
    return { openingBalance: null, closingBalance: null };
  }

  const ascending = lines[0].date <= lines[lines.length - 1].date;
  const first = ascending ? lines[0] : lines[lines.length - 1];
  const last = ascending ? lines[lines.length - 1] : lines[0];

  return {
    closingBalance: last.balance,
    openingBalance:
      first.balance === null
        ? null
        : Math.round((first.balance - first.amount) * 100) / 100,
  };
}

/* ---------- export ---------- */

export function linesToCsv(
  lines: {
    transactionDate: string;
    description: string;
    reference?: string | null;
    amount: number;
    balance?: number | null;
  }[]
): string {
  const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const out = ["Date,Description,Reference,Money In,Money Out,Balance"];

  for (const l of lines) {
    out.push(
      [
        l.transactionDate.slice(0, 10),
        q(l.description ?? ""),
        q(l.reference ?? ""),
        l.amount > 0 ? l.amount.toFixed(2) : "",
        l.amount < 0 ? Math.abs(l.amount).toFixed(2) : "",
        l.balance === null || l.balance === undefined
          ? ""
          : l.balance.toFixed(2),
      ].join(",")
    );
  }

  return out.join("\r\n");
}
