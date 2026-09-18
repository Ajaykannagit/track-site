import ExcelJS from "exceljs";

export type ExcelColumn<T> = {
  header: string;
  value: (row: T) => string | number | Date | null | undefined;
  width?: number;
  type?: "text" | "number" | "currency" | "date";
  align?: "left" | "center" | "right";
};

export type ExcelExportOptions<T> = {
  filename: string;
  sheetName?: string | undefined;
  title: string; // e.g. "Attendance Report"
  description?: string | undefined; // e.g. "Construction Project Control System — Attendance Report"
  filters?: Record<string, string | number | null | undefined> | undefined;
  columns: ExcelColumn<T>[];
  rows: T[];
  logoBuffer?: ArrayBuffer | Uint8Array | undefined;
};

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatDateTime(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = pad(d.getDate());
  const month = MONTH_NAMES[d.getMonth()];
  const year = d.getFullYear();

  let hours = d.getHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12
  const mins = pad(d.getMinutes());

  return `${day}-${month}-${year} ${pad(hours)}:${mins} ${ampm}`;
}

function parseToExcelDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return new Date(val.getFullYear(), val.getMonth(), val.getDate(), 12, 0, 0);
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    // Match YYYY-MM-DD
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
    if (isoMatch && isoMatch[1] && isoMatch[2] && isoMatch[3]) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10) - 1;
      const day = parseInt(isoMatch[3], 10);
      return new Date(year, month, day, 12, 0, 0);
    }
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) {
      return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0);
    }
  }
  return null;
}

function getColumnLetter(colIndex1Based: number): string {
  let temp = colIndex1Based;
  let letter = "";
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter;
}

export async function exportToExcel<T>({
  filename,
  sheetName = "Attendance Report",
  title,
  description,
  filters,
  columns,
  rows,
  logoBuffer,
}: ExcelExportOptions<T>): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BRICKWELD PVT LTD";
  workbook.lastModifiedBy = "BRICKWELD PVT LTD";
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "normal" }],
  });

  // Calculate dynamic column widths early so we can accurately position and center header elements
  const computedColWidths: number[] = [];
  columns.forEach((col) => {
    let maxLen = col.header.length;
    const sampleRows = rows.slice(0, 100);
    sampleRows.forEach((r) => {
      const raw = col.value(r);
      if (raw !== null && raw !== undefined) {
        if (raw instanceof Date) {
          maxLen = Math.max(maxLen, 12);
        } else {
          maxLen = Math.max(maxLen, String(raw).length);
        }
      }
    });

    const hLower = col.header.toLowerCase();
    let minW = 12;
    let maxW = 32;

    if (col.type === "date" || hLower.includes("date")) {
      minW = 14;
      maxW = 16;
    } else if (hLower.includes("project")) {
      minW = 28;
      maxW = 42;
    } else if (hLower.includes("kind")) {
      minW = 12;
      maxW = 15;
    } else if (hLower.includes("person") || hLower.includes("gang") || hLower.includes("employee")) {
      minW = 22;
      maxW = 32;
    } else if (hLower.includes("status")) {
      minW = 13;
      maxW = 16;
    } else if (hLower.includes("hour")) {
      minW = 11;
      maxW = 14;
    } else if (
      col.type === "currency" ||
      hLower.includes("rate") ||
      hLower.includes("wage") ||
      hLower.includes("amount") ||
      hLower.includes("cost")
    ) {
      minW = 15;
      maxW = 20;
    }

    const base = col.width ?? Math.max(col.header.length + 4, maxLen + 3);
    const finalWidth = Math.min(Math.max(base, minW), maxW);
    computedColWidths.push(finalWidth);
  });

  // Apply column widths to worksheet
  columns.forEach((_, idx) => {
    worksheet.getColumn(idx + 1).width = computedColWidths[idx] ?? 14;
  });

  // 1. Fetch / load logo and center it horizontally across the total table width
  let hasLogo = false;
  try {
    let buffer: ArrayBuffer | Uint8Array | undefined = logoBuffer;

    if (!buffer && typeof window !== "undefined" && window.location?.origin) {
      const res = await fetch(`${window.location.origin}/logo.png`);
      if (res.ok) {
        buffer = await res.arrayBuffer();
      }
    } else if (!buffer && typeof process !== "undefined" && process.versions?.node) {
      try {
        const fs = await import("fs");
        const path = await import("path");
        const possiblePath = path.resolve(process.cwd(), "public", "logo.png");
        if (fs.existsSync(possiblePath)) {
          buffer = fs.readFileSync(possiblePath);
        }
      } catch {
        // Continue if Node fs is not accessible
      }
    }

    if (buffer) {
      const imageId = workbook.addImage({
        buffer: buffer as unknown as ExcelJS.Buffer,
        extension: "png",
      });

      // Target logo display dimensions preserving aspect ratio (1024 / 856 = 1.196)
      const logoH = 46;
      const logoW = Math.round(logoH * 1.196); // ~55px

      // Calculate total pixel width of columns 1..columns.length (approx 8 pixels per Excel width unit)
      const colPxWidths = computedColWidths.map((w) => w * 8);
      const totalTablePx = colPxWidths.reduce((sum, px) => sum + px, 0);

      // Target horizontal center:
      const targetCenterPx = totalTablePx / 2;
      const targetLeftPx = Math.max(0, targetCenterPx - logoW / 2);

      // Find the column index and fractional offset for targetLeftPx
      let accumulatedPx = 0;
      let targetColIndex = 0;
      let fracOffset = 0;

      for (let i = 0; i < colPxWidths.length; i++) {
        const cWidth = colPxWidths[i]!;
        if (accumulatedPx + cWidth > targetLeftPx) {
          targetColIndex = i;
          fracOffset = (targetLeftPx - accumulatedPx) / cWidth;
          break;
        }
        accumulatedPx += cWidth;
      }

      worksheet.addImage(imageId, {
        tl: { col: targetColIndex + fracOffset, row: 1.15 },
        ext: { width: logoW, height: logoH },
        editAs: "oneCell",
      });
      hasLogo = true;
    }
  } catch {
    // Continue cleanly if logo is unavailable
  }

  // Row heights for header
  worksheet.getRow(1).height = hasLogo ? 12 : 8; // Top padding
  worksheet.getRow(2).height = hasLogo ? 44 : 10; // Logo area
  worksheet.getRow(3).height = 10; // Spacing

  // Row 4: Company Name
  const companyRowIdx = 4;
  const companyRow = worksheet.getRow(companyRowIdx);
  companyRow.height = 28;
  worksheet.mergeCells(companyRowIdx, 1, companyRowIdx, columns.length);
  const companyCell = worksheet.getCell(companyRowIdx, 1);
  companyCell.value = "BRICKWELD PVT LTD";
  companyCell.font = { name: "Arial", size: 16, bold: true, color: { argb: "FF0F172A" } };
  companyCell.alignment = { horizontal: "center", vertical: "middle" };

  // Row 5: Report Description / Title
  const descRowIdx = 5;
  const descRow = worksheet.getRow(descRowIdx);
  descRow.height = 20;
  worksheet.mergeCells(descRowIdx, 1, descRowIdx, columns.length);
  const descCell = worksheet.getCell(descRowIdx, 1);
  descCell.value = description ?? `Construction Project Control System — ${title}`;
  descCell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF334155" } };
  descCell.alignment = { horizontal: "center", vertical: "middle" };

  // Row 6: Generated Date & Time
  const metaRowIdx = 6;
  const metaRow = worksheet.getRow(metaRowIdx);
  metaRow.height = 18;
  worksheet.mergeCells(metaRowIdx, 1, metaRowIdx, columns.length);
  const metaCell = worksheet.getCell(metaRowIdx, 1);
  metaCell.value = `Generated Date & Time: ${formatDateTime()}`;
  metaCell.font = { name: "Arial", size: 9.5, italic: true, color: { argb: "FF64748B" } };
  metaCell.alignment = { horizontal: "center", vertical: "middle" };

  // Row 7: Applied Filters Summary
  const filterRowIdx = 7;
  const filterRow = worksheet.getRow(filterRowIdx);
  filterRow.height = 22;
  worksheet.mergeCells(filterRowIdx, 1, filterRowIdx, columns.length);
  const filterCell = worksheet.getCell(filterRowIdx, 1);

  const activeFilters = Object.entries(filters ?? {}).filter(
    ([, v]) => v !== undefined && v !== null && v !== "" && v !== "all",
  );

  if (activeFilters.length > 0) {
    const filterText = activeFilters
      .map(([k, v]) => {
        const formattedKey = k
          .replace(/([A-Z])/g, " $1")
          .trim()
          .replace(/^./, (s) => s.toUpperCase());
        return `${formattedKey}: ${v}`;
      })
      .join("   |   ");
    filterCell.value = `Applied Filters: ${filterText}`;
  } else {
    filterCell.value = "Applied Filters: All records";
  }

  filterCell.font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FF1E293B" } };
  filterCell.alignment = { horizontal: "center", vertical: "middle" };
  filterCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF1F5F9" },
  };
  filterCell.border = {
    top: { style: "thin", color: { argb: "FFE2E8F0" } },
    bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
  };

  // Row 8: Clean spacing before Table
  worksheet.getRow(8).height = 12;

  // Row 9: Table Header
  const headerRowIdx = 9;

  // Prepare table columns with unique non-empty names
  const seenHeaders = new Set<string>();
  const tableColumns = columns.map((col, idx) => {
    let hName = col.header.trim() || `Column_${idx + 1}`;
    if (seenHeaders.has(hName)) {
      let counter = 2;
      while (seenHeaders.has(`${hName}_${counter}`)) counter++;
      hName = `${hName}_${counter}`;
    }
    seenHeaders.add(hName);
    return {
      name: hName,
      filterButton: true,
    };
  });

  // Prepare row data values
  const hasRecords = rows.length > 0;
  const tableDataRows: (string | number | Date | null)[][] = [];

  if (hasRecords) {
    rows.forEach((row) => {
      const rowArr: (string | number | Date | null)[] = [];
      columns.forEach((col) => {
        const rawVal = col.value(row);
        const colType = col.type ?? inferColumnType(col.header, rawVal);

        if (rawVal === null || rawVal === undefined || rawVal === "") {
          rowArr.push(colType === "number" || colType === "currency" ? 0 : "—");
        } else if (colType === "date") {
          const dt = parseToExcelDate(rawVal);
          rowArr.push(dt ?? String(rawVal));
        } else if (colType === "number" || colType === "currency") {
          const num =
            typeof rawVal === "number"
              ? rawVal
              : parseFloat(String(rawVal).replace(/[^0-9.-]+/g, ""));
          rowArr.push(isNaN(num) ? 0 : num);
        } else {
          rowArr.push(String(rawVal));
        }
      });
      tableDataRows.push(rowArr);
    });
  } else {
    // If there are 0 records, supply 1 placeholder row so the Excel Table remains valid
    const emptyRow: (string | number | Date | null)[] = [];
    columns.forEach((_, idx) => {
      if (idx === 0) {
        emptyRow.push("—");
      } else if (idx === 1) {
        emptyRow.push("No attendance records found matching the selected filters");
      } else {
        emptyRow.push("—");
      }
    });
    tableDataRows.push(emptyRow);
  }

  // Create sanitized unique table name
  const safeTableName = (
    "Table_" + (title || filename || "Report").replace(/[^a-zA-Z0-9_]/g, "_")
  ).slice(0, 50);

  // Add native Excel Table covering the header and all data rows
  worksheet.addTable({
    name: safeTableName,
    ref: `A${headerRowIdx}`,
    headerRow: true,
    totalsRow: false,
    style: {
      theme: "TableStyleMedium9",
      showRowStripes: true,
    },
    columns: tableColumns,
    rows: tableDataRows as (string | number | Date)[][],
  });

  // Table header formatting
  const headerRow = worksheet.getRow(headerRowIdx);
  headerRow.height = 28;
  columns.forEach((_, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0F172A" }, // Slate-900
    };
    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };
    cell.border = {
      top: { style: "medium", color: { argb: "FF0F172A" } },
      left: { style: "thin", color: { argb: "FF334155" } },
      bottom: { style: "medium", color: { argb: "FF0F172A" } },
      right: { style: "thin", color: { argb: "FF334155" } },
    };
  });

  // Table Data Row formatting
  const endRowIdx = headerRowIdx + tableDataRows.length;
  let statusColIdx = -1;

  columns.forEach((col, idx) => {
    if (col.header.toLowerCase().includes("status")) {
      statusColIdx = idx + 1;
    }
  });

  for (let rIdx = headerRowIdx + 1; rIdx <= endRowIdx; rIdx++) {
    const dataRow = worksheet.getRow(rIdx);
    dataRow.height = 22;

    if (!hasRecords) {
      // Empty placeholder row styling
      for (let c = 1; c <= columns.length; c++) {
        const cell = dataRow.getCell(c);
        cell.font = { name: "Arial", size: 9.5, italic: true, color: { argb: "FF64748B" } };
        cell.alignment = {
          horizontal: c === 2 ? "left" : "center",
          vertical: "middle",
        };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      }
      continue;
    }

    columns.forEach((col, cIdx) => {
      const cell = dataRow.getCell(cIdx + 1);
      const val = cell.value;
      const colType = col.type ?? inferColumnType(col.header, val);
      const align =
        col.align ??
        (colType === "currency" || colType === "number"
          ? "right"
          : colType === "date"
            ? "center"
            : "left");

      cell.font = { name: "Arial", size: 9.5, color: { argb: "FF1E293B" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };

      if (val instanceof Date || colType === "date") {
        cell.numFmt = "dd-mmm-yyyy";
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else if (colType === "currency") {
        cell.numFmt = "₹#,##0.00";
        cell.alignment = { horizontal: "right", vertical: "middle" };
      } else if (colType === "number") {
        cell.numFmt = col.header.toLowerCase().includes("hour") ? "0.00" : "#,##0.##";
        cell.alignment = { horizontal: "right", vertical: "middle" };
      } else {
        cell.alignment = {
          horizontal: align,
          vertical: "middle",
          wrapText: true,
        };
      }

      // Status Badge formatting
      if (cIdx + 1 === statusColIdx && typeof val === "string") {
        const s = val.toLowerCase().trim();
        if (s === "present") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F5E9" } };
          cell.font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FF1B5E20" } };
        } else if (s === "absent") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFEBEE" } };
          cell.font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FFB71C1C" } };
        } else if (s === "half_day" || s === "half day") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF8E1" } };
          cell.font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FFB78103" } };
        } else if (s === "leave") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE3F2FD" } };
          cell.font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FF0D47A1" } };
        } else if (s === "holiday") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3E5F5" } };
          cell.font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FF4A148C" } };
        }
      }
    });
  }

  // Add Excel native conditional formatting for Status column if present
  if (statusColIdx > 0 && hasRecords) {
    const statusColLetter = getColumnLetter(statusColIdx);
    const cfRef = `${statusColLetter}10:${statusColLetter}${endRowIdx}`;
    worksheet.addConditionalFormatting({
      ref: cfRef,
      rules: [
        {
          priority: 1,
          type: "cellIs",
          operator: "equal",
          formulae: ['"present"'],
          style: {
            fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFE8F5E9" } },
            font: { bold: true, color: { argb: "FF1B5E20" } },
          },
        },
        {
          priority: 2,
          type: "cellIs",
          operator: "equal",
          formulae: ['"absent"'],
          style: {
            fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFFEBEE" } },
            font: { bold: true, color: { argb: "FFB71C1C" } },
          },
        },
        {
          priority: 3,
          type: "cellIs",
          operator: "equal",
          formulae: ['"half_day"'],
          style: {
            fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFFFF8E1" } },
            font: { bold: true, color: { argb: "FFB78103" } },
          },
        },
        {
          priority: 4,
          type: "cellIs",
          operator: "equal",
          formulae: ['"leave"'],
          style: {
            fill: { type: "pattern", pattern: "solid", bgColor: { argb: "FFE3F2FD" } },
            font: { bold: true, color: { argb: "FF0D47A1" } },
          },
        },
      ],
    });
  }

  // Freeze pane: Row 9 stays pinned so headers remain visible when scrolling through data rows
  worksheet.views = [
    {
      state: "frozen",
      xSplit: 0,
      ySplit: headerRowIdx,
      activeCell: `A${headerRowIdx + 1}`,
      topLeftCell: `A${headerRowIdx + 1}`,
    },
  ];

  // Print and Page Setup: Landscape, fit to 1 page wide, repeat headers, dynamic print area
  const lastColLetter = getColumnLetter(columns.length);
  worksheet.pageSetup = {
    orientation: columns.length > 5 ? "landscape" : "portrait",
    paperSize: 9, // A4
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0, // Unconstrained vertical pages for large datasets
    printTitlesRow: `${headerRowIdx}:${headerRowIdx}`,
    printArea: `A1:${lastColLetter}${endRowIdx}`,
    margins: {
      left: 0.5,
      right: 0.5,
      top: 0.6,
      bottom: 0.6,
      header: 0.3,
      footer: 0.3,
    },
  };

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  const uint8Buffer = new Uint8Array(buffer);

  // Trigger browser download when running in browser
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    const blob = new Blob([uint8Buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const cleanFilename = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
    a.download = cleanFilename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return uint8Buffer;
}

function inferColumnType(
  header: string,
  sampleVal: unknown,
): "text" | "number" | "currency" | "date" {
  const h = header.toLowerCase();
  if (
    sampleVal instanceof Date ||
    h.includes("date") ||
    (typeof sampleVal === "string" && /^\d{4}-\d{2}-\d{2}/.test(sampleVal))
  ) {
    return "date";
  }

  if (
    h.includes("₹") ||
    h.includes("rate") ||
    h.includes("wage") ||
    h.includes("cost") ||
    h.includes("amount") ||
    h.includes("price") ||
    h.includes("gross") ||
    h.includes("net") ||
    h.includes("profit") ||
    h.includes("balance") ||
    h.includes("total")
  ) {
    return "currency";
  }

  if (
    typeof sampleVal === "number" ||
    h.includes("hour") ||
    h.includes("count") ||
    h.includes("qty")
  ) {
    return "number";
  }

  return "text";
}
