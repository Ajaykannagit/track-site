export type CsvColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
};

/**
 * Escape a cell value for CSV output.
 * - Wraps in double-quotes if the value contains commas, double-quotes or newlines.
 * - Prefixes text cells that start with formula characters (=, +, -, @) with a single
 *   quote so spreadsheet software (Excel, Sheets) does not interpret them as formulas.
 *   Numeric values are left unchanged.
 */
function escCsvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  // Numbers pass through unchanged — no formula risk
  if (typeof v === "number") return String(v);
  let s = String(v);
  // Prevent formula injection on text values
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  // Wrap in quotes if the string contains special CSV characters
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]) {
  const head = columns.map((c) => escCsvCell(c.header)).join(",");
  const body = rows.map((r) => columns.map((c) => escCsvCell(c.value(r))).join(",")).join("\n");
  // UTF-8 BOM ensures Excel opens Tamil text and ₹ correctly
  return `\uFEFF${head}\n${body}`;
}

export function downloadCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]) {
  const blob = new Blob([toCsv(rows, columns)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Parses a CSV file (comma separated, quoted fields supported) into rows of objects. */
export function parseCsv(text: string): Record<string, string>[] {
  // Strip UTF-8 BOM if present
  const input = text.startsWith("\uFEFF") ? text.slice(1) : text;
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") field += ch;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...rest] = rows.filter((r) => r.some((c) => c.trim() !== ""));
  if (!header) return [];
  return rest.map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, i) => (obj[h.trim()] = (r[i] ?? "").trim()));
    return obj;
  });
}
