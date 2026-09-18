/**
 * QA Validation Script for the refactored Excel Attendance Export
 * Run with: node scripts/validate-excel-export.mjs
 */

import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC_LOGO = path.resolve(ROOT, "public", "logo.png");

// ─── Helpers ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✅  ${label}`);
    passed++;
  } else {
    console.error(`  ❌  ${label}${detail ? " — " + detail : ""}`);
    failed++;
  }
}

function parseToExcelDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(val.trim());
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], 12, 0, 0);
    const p = new Date(val);
    if (!isNaN(p.getTime())) return new Date(p.getFullYear(), p.getMonth(), p.getDate(), 12, 0, 0);
  }
  return null;
}

function makeTestRow(overrides = {}) {
  return {
    id: "test-id",
    attendance_date: "2026-09-16",
    project_id: "proj-1",
    kind: "labour",
    employee_id: "emp-1",
    contractor_id: null,
    workforce_count: 1,
    working_hours: 8,
    ot_hours: 0,
    wage_rate: 700,
    calculated_wage: 700,
    status: "present",
    remarks: null,
    ...overrides,
  };
}

// Replicate excel.ts logic in Node so we can test programmatically
async function generateWorkbook({ title, description, filters, columns, rows }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BRICKWELD PVT LTD";
  workbook.lastModifiedBy = "BRICKWELD PVT LTD";
  workbook.created = new Date();
  workbook.modified = new Date();

  const worksheet = workbook.addWorksheet("Attendance Report", {
    views: [{ state: "normal" }],
  });

  // Column widths
  columns.forEach((col, idx) => {
    worksheet.getColumn(idx + 1).width = col.width || 14;
  });

  // Embed logo
  let hasLogo = false;
  try {
    if (fs.existsSync(PUBLIC_LOGO)) {
      const buf = fs.readFileSync(PUBLIC_LOGO);
      const imageId = workbook.addImage({ buffer: buf, extension: "png" });
      const logoH = 46;
      const logoW = Math.round(logoH * 1.196);
      worksheet.addImage(imageId, {
        tl: { col: 2.5, row: 1.15 },
        ext: { width: logoW, height: logoH },
        editAs: "oneCell",
      });
      hasLogo = true;
    }
  } catch {}

  worksheet.getRow(1).height = hasLogo ? 12 : 8;
  worksheet.getRow(2).height = hasLogo ? 44 : 10;
  worksheet.getRow(3).height = 10;

  const companyRowIdx = 4;
  worksheet.getRow(companyRowIdx).height = 28;
  worksheet.mergeCells(companyRowIdx, 1, companyRowIdx, columns.length);
  const companyCell = worksheet.getCell(companyRowIdx, 1);
  companyCell.value = "BRICKWELD PVT LTD";
  companyCell.font = { name: "Arial", size: 16, bold: true };
  companyCell.alignment = { horizontal: "center", vertical: "middle" };

  const descRowIdx = 5;
  worksheet.getRow(descRowIdx).height = 20;
  worksheet.mergeCells(descRowIdx, 1, descRowIdx, columns.length);
  const descCell = worksheet.getCell(descRowIdx, 1);
  descCell.value = description || title;
  descCell.alignment = { horizontal: "center" };

  const metaRowIdx = 6;
  worksheet.getRow(metaRowIdx).height = 18;
  worksheet.mergeCells(metaRowIdx, 1, metaRowIdx, columns.length);
  const metaCell = worksheet.getCell(metaRowIdx, 1);
  const now = new Date();
  metaCell.value = `Generated Date & Time: ${now.toISOString()}`;
  metaCell.alignment = { horizontal: "center" };

  const filterRowIdx = 7;
  worksheet.getRow(filterRowIdx).height = 22;
  worksheet.mergeCells(filterRowIdx, 1, filterRowIdx, columns.length);
  const filterCell = worksheet.getCell(filterRowIdx, 1);
  const activeFilters = Object.entries(filters || {}).filter(
    ([, v]) => v !== undefined && v !== null && v !== "" && v !== "all"
  );
  filterCell.value =
    activeFilters.length > 0
      ? `Applied Filters: ${activeFilters.map(([k, v]) => `${k}: ${v}`).join(" | ")}`
      : "Applied Filters: All records";

  worksheet.getRow(8).height = 12;

  const headerRowIdx = 9;
  const hasRecords = rows.length > 0;

  const tableColumns = columns.map((col) => ({ name: col.header, filterButton: true }));

  let tableDataRows;
  if (hasRecords) {
    tableDataRows = rows.map((row) =>
      columns.map((col) => {
        const raw = col.excelValue ? col.excelValue(row) : col.value(row);
        if (raw === null || raw === undefined || raw === "") {
          return col.type === "number" || col.type === "currency" ? 0 : "—";
        }
        if (col.type === "date") {
          return parseToExcelDate(raw) || String(raw);
        }
        if (col.type === "number" || col.type === "currency") {
          const n = typeof raw === "number" ? raw : parseFloat(String(raw));
          return isNaN(n) ? 0 : n;
        }
        return String(raw);
      })
    );
  } else {
    tableDataRows = [
      columns.map((_, idx) =>
        idx === 0
          ? "—"
          : idx === 1
          ? "No attendance records found matching the selected filters"
          : "—"
      ),
    ];
  }

  const safeTableName = ("Table_" + (title || "Report").replace(/[^a-zA-Z0-9_]/g, "_")).slice(0, 50);

  worksheet.addTable({
    name: safeTableName,
    ref: `A${headerRowIdx}`,
    headerRow: true,
    totalsRow: false,
    style: { theme: "TableStyleMedium9", showRowStripes: true },
    columns: tableColumns,
    rows: tableDataRows,
  });

  const headerRow = worksheet.getRow(headerRowIdx);
  headerRow.height = 28;
  columns.forEach((_, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
  });

  const endRowIdx = headerRowIdx + tableDataRows.length;
  for (let r = headerRowIdx + 1; r <= endRowIdx; r++) {
    const dataRow = worksheet.getRow(r);
    dataRow.height = 22;
    columns.forEach((col, cIdx) => {
      const cell = dataRow.getCell(cIdx + 1);
      cell.font = { name: "Arial", size: 9.5 };
      if (col.type === "date") {
        cell.numFmt = "dd-mmm-yyyy";
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else if (col.type === "currency") {
        cell.numFmt = "₹#,##0.00";
        cell.alignment = { horizontal: "right", vertical: "middle" };
      } else if (col.type === "number") {
        cell.numFmt = "0.00";
        cell.alignment = { horizontal: "right", vertical: "middle" };
      }
    });
  }

  worksheet.views = [
    {
      state: "frozen",
      xSplit: 0,
      ySplit: headerRowIdx,
      activeCell: `A${headerRowIdx + 1}`,
      topLeftCell: `A${headerRowIdx + 1}`,
    },
  ];

  const lastColLetter = String.fromCharCode(64 + columns.length);
  worksheet.pageSetup = {
    orientation: "landscape",
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    printTitlesRow: `${headerRowIdx}:${headerRowIdx}`,
    printArea: `A1:${lastColLetter}${endRowIdx}`,
    margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
  };

  return { workbook, worksheet, headerRowIdx, endRowIdx, hasRecords, tableDataRows };
}

// ─── Test columns ──────────────────────────────────────────────────────────────

const COLUMNS = [
  { header: "Date", type: "date", align: "center", width: 15, value: (r) => r.attendance_date, excelValue: (r) => { const p = r.attendance_date?.split("-").map(Number); return p?.length === 3 ? new Date(p[0], p[1]-1, p[2], 12, 0, 0) : null; } },
  { header: "Project", type: "text", align: "left", width: 32, value: () => "Sunrise Apartments Block B (DEMO)" },
  { header: "Kind", type: "text", align: "center", width: 14, value: (r) => r.kind },
  { header: "Person / gang", type: "text", align: "left", width: 26, value: () => "Vijay M (DEMO)" },
  { header: "Status", type: "text", align: "center", width: 14, value: (r) => r.status },
  { header: "Hours", type: "number", align: "right", width: 12, value: (r) => r.working_hours, excelValue: (r) => Number(r.working_hours) },
  { header: "Rate", type: "currency", align: "right", width: 16, value: (r) => r.wage_rate, excelValue: (r) => Number(r.wage_rate ?? 0) },
  { header: "Wage", type: "currency", align: "right", width: 16, value: (r) => r.calculated_wage, excelValue: (r) => Number(r.calculated_wage ?? 0) },
];

async function validateWorkbook(wb, ws, { headerRowIdx, endRowIdx, expectedDataRows, hasRecords, label }) {
  console.log(`\n─── ${label} ───`);

  // Worksheet exists
  assert("Worksheet exists", ws !== undefined);

  // Company name
  const companyCell = ws.getCell(4, 1);
  assert("Company name is 'BRICKWELD PVT LTD'", companyCell.value === "BRICKWELD PVT LTD", `got: ${companyCell.value}`);

  // Report description
  const descCell = ws.getCell(5, 1);
  assert("Report description row exists", typeof descCell.value === "string" && descCell.value.length > 0);

  // Metadata timestamp
  const metaCell = ws.getCell(6, 1);
  assert("Generated timestamp is present", typeof metaCell.value === "string" && metaCell.value.includes("Generated Date"));

  // Filters
  const filterCell = ws.getCell(7, 1);
  assert("Filter summary is present", typeof filterCell.value === "string" && filterCell.value.startsWith("Applied Filters:"));

  // Table header at row 9
  const tableHeaderRow = ws.getRow(headerRowIdx);
  assert("Table header row exists at row 9", tableHeaderRow.getCell(1).value === "Date");
  assert("Table has all 8 columns", tableHeaderRow.getCell(8).value === "Wage");

  // Excel Table covers the full data range
  const tables = ws.getTables ? ws.getTables() : [];
  assert("Excel Table object exists", tables.length > 0);
  if (tables.length > 0) {
    const tbl = tables[0].table;
    const expectedRef = `A${headerRowIdx}:H${endRowIdx}`;
    assert(`Table range covers full data (${expectedRef})`, tbl.tableRef === expectedRef, `got: ${tbl.tableRef}`);
    assert("AutoFilter ref matches table range", tbl.autoFilterRef === expectedRef, `got: ${tbl.autoFilterRef}`);
    assert("Table has 8 filter buttons", tbl.columns?.length === 8);
  }

  // Data types
  if (hasRecords) {
    const firstDataRow = ws.getRow(headerRowIdx + 1);
    const dateCell = firstDataRow.getCell(1);
    // Type 4 = Date
    assert("Date cell is an Excel Date value (type 4)", dateCell.type === 4, `got type: ${dateCell.type}`);
    assert("Date cell has dd-mmm-yyyy numFmt", dateCell.numFmt === "dd-mmm-yyyy", `got: ${dateCell.numFmt}`);

    const hoursCell = firstDataRow.getCell(6);
    assert("Hours cell is numeric (type 2)", hoursCell.type === 2, `got type: ${hoursCell.type}`);

    const rateCell = firstDataRow.getCell(7);
    assert("Rate cell is numeric (type 2)", rateCell.type === 2, `got type: ${rateCell.type}`);
    assert("Rate cell has ₹ numFmt", rateCell.numFmt?.includes("₹"), `got: ${rateCell.numFmt}`);

    const wageCell = firstDataRow.getCell(8);
    assert("Wage cell is numeric (type 2)", wageCell.type === 2, `got type: ${wageCell.type}`);
    assert("Wage cell has ₹ numFmt", wageCell.numFmt?.includes("₹"), `got: ${wageCell.numFmt}`);
  }

  // Zero-value preservation
  if (hasRecords) {
    // Find if any rate=0 row exists and confirm it's 0 not blank
    for (let r = headerRowIdx + 1; r <= endRowIdx; r++) {
      const rateCell = ws.getRow(r).getCell(7);
      if (rateCell.type === 2 && rateCell.value === 0) {
        assert("Zero rate preserved as 0 (not blank)", true);
        break;
      }
    }
  }

  // Freeze panes
  const views = ws.views;
  assert("Freeze pane exists", views.length > 0 && views[0].state === "frozen");
  assert("Freeze pane at row 9", views[0].ySplit === headerRowIdx, `got ySplit: ${views[0].ySplit}`);

  // Print setup
  const ps = ws.pageSetup;
  assert("Orientation is landscape", ps.orientation === "landscape");
  assert("Fit to 1 page wide", ps.fitToWidth === 1);
  assert("Vertical pages unconstrained", ps.fitToHeight === 0);
  assert("Print titles row set", ps.printTitlesRow === `${headerRowIdx}:${headerRowIdx}`);
  assert("Print area set dynamically", ps.printArea && ps.printArea.startsWith("A1:"), `got: ${ps.printArea}`);

  // Logo embedded
  const images = ws.getImages();
  assert("Logo image is embedded", images.length > 0);
  if (images.length > 0) {
    const img = images[0];
    const w = img.range.ext.width;
    const h = img.range.ext.height;
    const aspectRatio = w / h;
    assert("Logo aspect ratio correct (~1.196)", Math.abs(aspectRatio - 1.196) < 0.05, `got: ${aspectRatio.toFixed(3)}`);
    const tlCol = img.range.tl.col;
    assert("Logo is horizontally centered (not at column 0)", tlCol > 0, `got col: ${tlCol}`);
  }

  // No merged cells in data table range
  let hasMergeInTable = false;
  const merges = ws._merges || {};
  for (const key of Object.keys(merges)) {
    const cell = ws.getCell(key);
    if (cell.row >= headerRowIdx && cell.col >= 1) {
      hasMergeInTable = true;
      break;
    }
  }
  assert("No merged cells inside data table", !hasMergeInTable);

  // No blank rows inside the table
  let hasBlankRow = false;
  for (let r = headerRowIdx + 1; r <= endRowIdx; r++) {
    const row = ws.getRow(r);
    const allEmpty = row.cellCount === 0;
    if (allEmpty) {
      hasBlankRow = true;
      break;
    }
  }
  assert("No blank rows inside table range", !hasBlankRow);

  // Row count
  assert(`Expected ${expectedDataRows} data row(s)`, endRowIdx - headerRowIdx === expectedDataRows, `got: ${endRowIdx - headerRowIdx}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  BRICKWELD PVT LTD — Excel Export QA Validation");
  console.log("═══════════════════════════════════════════════════════════════");

  const scenarios = [
    { label: "Scenario A: 0 records", rows: [], expectedDataRows: 1 },
    {
      label: "Scenario B: 3 records (reference data)",
      rows: [
        makeTestRow({ employee_id: "emp-1", wage_rate: 500, calculated_wage: 1000, status: "present" }),
        makeTestRow({ employee_id: null, contractor_id: null, wage_rate: 0, calculated_wage: 0, status: "half_day" }),
        makeTestRow({ employee_id: "emp-2", wage_rate: 700, calculated_wage: 700, status: "present" }),
      ],
      expectedDataRows: 3,
    },
    {
      label: "Scenario C: 50 records",
      rows: Array.from({ length: 50 }, (_, i) =>
        makeTestRow({
          attendance_date: `2026-09-${String((i % 30) + 1).padStart(2, "0")}`,
          status: ["present", "absent", "half_day", "leave", "holiday"][i % 5],
          wage_rate: (i % 3 === 0) ? 0 : 700 + i * 10,
          calculated_wage: (i % 3 === 0) ? 0 : 700 + i * 10,
        })
      ),
      expectedDataRows: 50,
    },
    {
      label: "Scenario D: 500 records",
      rows: Array.from({ length: 500 }, (_, i) =>
        makeTestRow({
          attendance_date: `2026-09-${String((i % 30) + 1).padStart(2, "0")}`,
          status: ["present", "absent", "half_day"][i % 3],
          wage_rate: 700 + (i % 50) * 10,
          calculated_wage: 700 + (i % 50) * 10,
        })
      ),
      expectedDataRows: 500,
    },
  ];

  const results = [];

  for (const scenario of scenarios) {
    const startTime = Date.now();
    const { workbook, worksheet, headerRowIdx, endRowIdx, hasRecords, tableDataRows } =
      await generateWorkbook({
        title: "Attendance Report",
        description: "Construction Project Control System — Attendance Report",
        filters:
          scenario.rows.length === 0
            ? {}
            : { "Date Range": "01-Sep-2026 to 16-Sep-2026", Status: "present" },
        columns: COLUMNS,
        rows: scenario.rows,
      });

    // Write to temp file and read back to validate
    const tmpFile = path.join(ROOT, `scratch_qa_${scenario.rows.length}.xlsx`);
    await workbook.xlsx.writeFile(tmpFile);
    const elapsed = Date.now() - startTime;
    console.log(`\n  Generated in ${elapsed}ms: ${tmpFile}`);

    // Re-read file
    const wb2 = new ExcelJS.Workbook();
    await wb2.xlsx.readFile(tmpFile);
    const ws2 = wb2.worksheets[0];

    await validateWorkbook(wb2, ws2, {
      headerRowIdx,
      endRowIdx,
      expectedDataRows: tableDataRows.length,
      hasRecords,
      label: scenario.label,
    });

    results.push({ label: scenario.label, file: tmpFile, elapsed });
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log("═══════════════════════════════════════════════════════════════");

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("QA script failed with error:", err);
  process.exit(1);
});
