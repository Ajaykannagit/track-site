import ExcelJS from "exceljs";

export type ExcelColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
  width?: number;
  type?: "text" | "number" | "currency" | "date";
};

export type ExcelExportOptions<T> = {
  filename: string;
  sheetName?: string | undefined;
  title: string; // e.g. "Attendance Report"
  description?: string | undefined; // e.g. "Construction Project Control System — Attendance Report"
  filters?: Record<string, string | number | null | undefined> | undefined;
  columns: ExcelColumn<T>[];
  rows: T[];
};

function formatDateTime(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();

  let hours = d.getHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 becomes 12
  const mins = pad(d.getMinutes());

  return `${day}-${month}-${year} ${pad(hours)}:${mins} ${ampm}`;
}

export async function exportToExcel<T>({
  filename,
  sheetName = "Report",
  title,
  description,
  filters,
  columns,
  rows,
}: ExcelExportOptions<T>) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Brickweld Construction Project Control";
  workbook.lastModifiedBy = "Brickweld";
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "normal" }],
    pageSetup: {
      orientation: columns.length > 5 ? "landscape" : "portrait",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9, // A4
    },
  });

  const totalCols = Math.max(columns.length, 6);

  // 1. Try to fetch and embed company logo
  let hasLogo = false;
  try {
    const logoUrl =
      typeof window !== "undefined" && window.location?.origin
        ? `${window.location.origin}/logo.png`
        : "/logo.png";
    const res = await fetch(logoUrl);
    if (res.ok) {
      const buffer = await res.arrayBuffer();
      const imageId = workbook.addImage({
        buffer,
        extension: "png",
      });

      // Place logo centered at the top
      const centerCol = Math.max(0, Math.floor(totalCols / 2) - 1);
      worksheet.addImage(imageId, {
        tl: { col: centerCol + 0.35, row: 0.5 },
        ext: { width: 56, height: 56 },
      });
      hasLogo = true;
    }
  } catch {
    // If logo fetch fails, continue without logo
  }

  // Row heights for header
  worksheet.getRow(1).height = hasLogo ? 24 : 15;
  worksheet.getRow(2).height = hasLogo ? 30 : 15;
  worksheet.getRow(3).height = 10; // spacing

  // Company Name
  const companyRowIdx = 4;
  const companyRow = worksheet.getRow(companyRowIdx);
  companyRow.height = 28;
  worksheet.mergeCells(companyRowIdx, 1, companyRowIdx, totalCols);
  const companyCell = worksheet.getCell(companyRowIdx, 1);
  companyCell.value = "BRICKWELD";
  companyCell.font = { name: "Arial", size: 16, bold: true, color: { argb: "FF0F172A" } };
  companyCell.alignment = { horizontal: "center", vertical: "middle" };

  // Report Description
  const descRowIdx = 5;
  const descRow = worksheet.getRow(descRowIdx);
  descRow.height = 20;
  worksheet.mergeCells(descRowIdx, 1, descRowIdx, totalCols);
  const descCell = worksheet.getCell(descRowIdx, 1);
  descCell.value = description ?? `Construction Project Control System — ${title}`;
  descCell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FF334155" } };
  descCell.alignment = { horizontal: "center", vertical: "middle" };

  // Generated Date & Time
  const metaRowIdx = 6;
  const metaRow = worksheet.getRow(metaRowIdx);
  metaRow.height = 18;
  worksheet.mergeCells(metaRowIdx, 1, metaRowIdx, totalCols);
  const metaCell = worksheet.getCell(metaRowIdx, 1);
  metaCell.value = `Generated Date & Time: ${formatDateTime()}`;
  metaCell.font = { name: "Arial", size: 9, italic: true, color: { argb: "FF64748B" } };
  metaCell.alignment = { horizontal: "center", vertical: "middle" };

  // Optional Filter Information
  let nextRowIdx = 7;
  const activeFilters = Object.entries(filters ?? {}).filter(
    ([, v]) => v !== undefined && v !== null && v !== "" && v !== "all",
  );

  if (activeFilters.length > 0) {
    const filterRow = worksheet.getRow(nextRowIdx);
    filterRow.height = 20;
    worksheet.mergeCells(nextRowIdx, 1, nextRowIdx, totalCols);
    const filterCell = worksheet.getCell(nextRowIdx, 1);
    const filterText = activeFilters
      .map(
        ([k, v]) => `${k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}: ${v}`,
      )
      .join("  |  ");
    filterCell.value = `Applied Filters: ${filterText}`;
    filterCell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF1E293B" } };
    filterCell.alignment = { horizontal: "center", vertical: "middle" };
    filterCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" },
    };
    nextRowIdx++;
  }

  // Blank row separator
  worksheet.getRow(nextRowIdx).height = 12;
  nextRowIdx++;

  // Data Table Headers
  const headerRowIdx = nextRowIdx;
  const headerRow = worksheet.getRow(headerRowIdx);
  headerRow.height = 26;

  columns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E293B" }, // Slate-800
    };
    cell.alignment = {
      horizontal:
        col.type === "currency" || col.type === "number"
          ? "right"
          : col.type === "date"
            ? "center"
            : "left",
      vertical: "middle",
      wrapText: true,
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FF0F172A" } },
      left: { style: "thin", color: { argb: "FF0F172A" } },
      bottom: { style: "medium", color: { argb: "FF0F172A" } },
      right: { style: "thin", color: { argb: "FF0F172A" } },
    };
  });

  // Freeze panes so header row stays visible on scroll
  worksheet.views = [
    {
      state: "frozen",
      xSplit: 0,
      ySplit: headerRowIdx,
      activeCell: `A${headerRowIdx + 1}`,
    },
  ];

  // Enable Auto-Filter on data table
  worksheet.autoFilter = {
    from: { row: headerRowIdx, column: 1 },
    to: { row: headerRowIdx, column: columns.length },
  };

  // Set repeating headers for print
  worksheet.pageSetup.printTitlesRow = `${headerRowIdx}:${headerRowIdx}`;

  // Data Rows
  let currentRowIdx = headerRowIdx + 1;

  rows.forEach((row, rIdx) => {
    const dataRow = worksheet.getRow(currentRowIdx);
    dataRow.height = 20;
    const isEven = rIdx % 2 === 0;

    columns.forEach((col, cIdx) => {
      const cell = dataRow.getCell(cIdx + 1);
      const rawVal = col.value(row);

      const isCurr =
        col.type === "currency" ||
        (typeof rawVal === "number" &&
          (col.header.includes("₹") ||
            col.header.toLowerCase().includes("wage") ||
            col.header.toLowerCase().includes("cost") ||
            col.header.toLowerCase().includes("amount") ||
            col.header.toLowerCase().includes("rate") ||
            col.header.toLowerCase().includes("value") ||
            col.header.toLowerCase().includes("gross") ||
            col.header.toLowerCase().includes("net") ||
            col.header.toLowerCase().includes("profit") ||
            col.header.toLowerCase().includes("spent") ||
            col.header.toLowerCase().includes("received")));

      if (rawVal === null || rawVal === undefined) {
        cell.value = "—";
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else if (typeof rawVal === "number") {
        cell.value = rawVal;
        if (isCurr) {
          cell.numFmt = "₹#,##0.00";
          cell.alignment = { horizontal: "right", vertical: "middle" };
        } else {
          cell.numFmt = "#,##0.##";
          cell.alignment = { horizontal: "right", vertical: "middle" };
        }
      } else {
        cell.value = String(rawVal);
        cell.alignment = {
          horizontal: col.type === "date" ? "center" : "left",
          vertical: "middle",
          wrapText: true,
        };
      }

      cell.font = { name: "Arial", size: 9.5, color: { argb: "FF1E293B" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isEven ? "FFFFFFFF" : "FFF8FAFC" },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });

    currentRowIdx++;
  });

  // Calculate dynamic column widths
  columns.forEach((col, idx) => {
    let maxLen = col.header.length;
    rows.forEach((r) => {
      const v = col.value(r);
      const str = v === null || v === undefined ? "—" : String(v);
      if (str.length > maxLen) maxLen = str.length;
    });
    const calculatedWidth = Math.min(Math.max(maxLen + 4, col.width ?? 12), 40);
    worksheet.getColumn(idx + 1).width = calculatedWidth;
  });

  // Generate buffer and trigger browser download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
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
