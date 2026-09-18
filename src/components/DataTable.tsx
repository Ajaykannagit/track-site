import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Download, FileSpreadsheet, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadCsv } from "@/lib/csv";
import { exportToExcel, type ExcelColumn } from "@/lib/excel";

export type Column<T> = {
  header: string;
  cell: (row: T) => ReactNode;
  /** Plain value used for search, Excel and CSV export. */
  value?: (row: T) => string | number | null | undefined;
  className?: string;
  /** Excel specific export customizations */
  type?: "text" | "number" | "currency" | "date";
  excelValue?: (row: T) => string | number | Date | null | undefined;
  width?: number;
  align?: "left" | "center" | "right";
};

export function DataTable<T extends { id?: string }>({
  rows,
  columns,
  loading,
  searchable = true,
  exportName,
  exportTitle,
  exportDescription,
  appliedFilters,
  empty = "No records yet.",
  onRowClick,
}: {
  rows: T[];
  columns: Column<T>[];
  loading?: boolean | undefined;
  searchable?: boolean | undefined;
  exportName?: string | undefined;
  exportTitle?: string | undefined;
  exportDescription?: string | undefined;
  appliedFilters?: Record<string, string | number | null | undefined> | undefined;
  empty?: string | undefined;
  onRowClick?: ((row: T) => void) | undefined;
}) {
  const [q, setQ] = useState("");
  const [exporting, setExporting] = useState(false);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const needle = q.toLowerCase();
    return rows.filter((r) =>
      columns.some((c) =>
        String(c.value?.(r) ?? "")
          .toLowerCase()
          .includes(needle),
      ),
    );
  }, [rows, columns, q]);

  const handleExportExcel = async () => {
    if (!exportName) return;
    try {
      setExporting(true);
      await exportToExcel({
        filename: exportName,
        title:
          exportTitle ?? exportName.replace(/[-_]/g, " ").replace(/^./, (s) => s.toUpperCase()),
        description: exportDescription,
        filters: appliedFilters,
        rows: filtered,
        columns: columns
          .filter((c) => c.header && (c.excelValue || c.value))
          .map((c) => {
            const valFn = (r: unknown) =>
              c.excelValue ? c.excelValue(r as T) : (c.value ? c.value(r as T) : "");
            const col: ExcelColumn<unknown> = { header: c.header, value: valFn };
            if (c.type !== undefined) col.type = c.type;
            if (c.width !== undefined) col.width = c.width;
            if (c.align !== undefined) col.align = c.align;
            return col;
          }),
      });
    } finally {
      setExporting(false);
    }
  };

  const handleExportCsv = () => {
    if (!exportName) return;
    downloadCsv(
      exportName,
      filtered,
      columns
        .filter((c) => c.header && c.value)
        .map((c) => ({ header: c.header, value: (r: T) => c.value?.(r) ?? "" })),
    );
  };

  return (
    <div className="space-y-3">
      {(searchable || exportName) && (
        <div className="no-print flex flex-wrap items-center gap-2">
          {searchable && (
            <div className="relative w-full max-w-xs">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search…"
                className="pl-8"
              />
            </div>
          )}
          {exportName && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={exporting}>
                  <Download className="mr-2 size-4" />
                  {exporting ? "Exporting…" : "Export"}
                  <ChevronDown className="ml-1 size-3.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportExcel} className="cursor-pointer">
                  <FileSpreadsheet className="mr-2 size-4 text-emerald-600" />
                  <span>Excel (.xlsx)</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCsv} className="cursor-pointer">
                  <Download className="mr-2 size-4 text-muted-foreground" />
                  <span>CSV (.csv)</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <span className="ml-auto text-xs text-muted-foreground">{filtered.length} records</span>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((c) => (
                <TableHead key={c.header} className={c.className}>
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((c) => (
                    <TableCell key={c.header}>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="py-10 text-center text-muted-foreground"
                >
                  {empty}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row, i) => (
                <TableRow
                  key={row.id ?? i}
                  onClick={() => onRowClick?.(row)}
                  className={onRowClick ? "cursor-pointer" : undefined}
                >
                  {columns.map((c) => (
                    <TableCell key={c.header} className={c.className}>
                      {c.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "success" | "warning" | "destructive";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "destructive"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="stat-card">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${toneClass}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
