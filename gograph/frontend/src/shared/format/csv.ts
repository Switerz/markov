// Lightweight CSV exporter for client-side downloads of mock/api rows.
// Quotes any cell containing a comma, double-quote, or newline (RFC 4180).
export type CsvCell = string | number | null | undefined;

export function toCsv(rows: Record<string, CsvCell>[]): string {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const header = cols.join(",");
  const body = rows
    .map((r) => cols.map((c) => formatCell(r[c])).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

function formatCell(v: CsvCell): string {
  if (v == null) return "";
  const s = String(v);
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function downloadCsv(
  filename: string,
  rows: Record<string, CsvCell>[],
): void {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Helper for callers that just want today's ISO date for filenames.
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
