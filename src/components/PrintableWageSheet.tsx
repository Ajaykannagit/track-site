import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X, Users, CalendarDays, TableProperties } from "lucide-react";
import { currency, dateFmt } from "@/lib/format";

export type WagePrintType = "weekly" | "monthly";

export type PrintableWorkerRow = {
  id: string;
  code?: string;
  name: string;
  staff_type: "labour" | "supervisor" | "officer";
  designation?: string | null;
  team_name?: string;
  total_days: number;
  rate: number;
  earned_wage: number;
  ot_hours?: number;
  ot_amount?: number;
  allowances: number; // bus/petrol etc.
  deductions: number; // advance etc.
  net_payable: number;
  amount_paid?: number;
  pending_balance?: number;
  dailyAttendance?: Record<number, { day_value: number; is_leave?: boolean }>;
};

interface PrintableWageSheetProps {
  type: WagePrintType;
  periodLabel: string; // e.g. "Week: 13 Sep 2026 - 19 Sep 2026" or "Month: September 2026"
  daysInMonth?: number; // e.g. 30 or 31 (when monthly)
  workers: PrintableWorkerRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrintableWageSheet({
  type,
  periodLabel,
  daysInMonth = 30,
  workers,
  open,
  onOpenChange,
}: PrintableWageSheetProps) {
  // Format layout mode for monthly: "summary" (Wage Master) or "muster" (30-day daily grid)
  const [formatMode, setFormatMode] = useState<"summary" | "muster">("summary");

  // Weekly print: LABOUR ONLY (exclude supervisor & officer)
  // Monthly print: ALL staff (labour, supervisor, officer)
  const filteredWorkers = workers.filter((w) => {
    if (type === "weekly") {
      return w.staff_type === "labour";
    }
    return true; // monthly includes all
  });

  const totals = filteredWorkers.reduce(
    (acc, w) => {
      acc.days += w.total_days;
      acc.earned += w.earned_wage;
      acc.allowances += w.allowances;
      acc.deductions += w.deductions;
      acc.net += w.net_payable;
      return acc;
    },
    { days: 0, earned: 0, allowances: 0, deductions: 0, net: 0 }
  );

  const handlePrint = () => {
    window.print();
  };

  // Generate day numbers array [1..daysInMonth] for 30-day muster roll view
  const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl overflow-y-auto max-h-[92vh] p-0 border-0 bg-transparent shadow-none">
        {/* Print Bar */}
        <div className="no-print sticky top-0 z-50 flex flex-wrap items-center justify-between gap-2 p-3 bg-card border-b rounded-t-lg shadow-sm">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Users className="size-4 text-primary" />
            {type === "weekly"
              ? "Weekly Labour Wage Sheet (Workers Only)"
              : formatMode === "muster"
                ? `30-Day Monthly Attendance Muster Roll (${daysInMonth} Days — A4 Fitted)`
                : "Monthly Staff & Labour Wage Master (Summary Register)"}
          </div>

          <div className="flex items-center gap-2">
            {/* Format Switcher for Monthly Attendance */}
            {type === "monthly" && (
              <div className="flex items-center rounded-md border bg-muted p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setFormatMode("summary")}
                  className={`px-2 py-1 rounded cursor-pointer font-medium transition-colors ${
                    formatMode === "summary"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Summary Register: Fits A4 landscape with full wage & deductions breakdown"
                >
                  <TableProperties className="inline size-3 mr-1" />
                  Summary Register (A4 Safe)
                </button>
                <button
                  type="button"
                  onClick={() => setFormatMode("muster")}
                  className={`px-2 py-1 rounded cursor-pointer font-medium transition-colors ${
                    formatMode === "muster"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="30-Day Muster Roll: Full 30-day matrix with compact columns guaranteed to fit A4 landscape"
                >
                  <CalendarDays className="inline size-3 mr-1" />
                  30-Day Muster Roll (A4 Fitted)
                </button>
              </div>
            )}

            <Button size="sm" onClick={handlePrint} className="gap-1.5 h-8">
              <Printer className="size-3.5" /> Print / Save as PDF (A4 Landscape)
            </Button>
            <Button size="sm" variant="ghost" className="size-8 p-0" onClick={() => onOpenChange(false)}>
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Paper Sheet */}
        <div className="bg-white text-zinc-900 p-6 sm:p-8 font-sans shadow-lg rounded-b-lg border border-zinc-200 print:border-0 print:shadow-none print:p-0 print:m-0 print:text-black">
          {/* Header */}
          <div className="border-b-2 border-zinc-900 pb-3 mb-4">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-xl font-bold tracking-tight uppercase text-zinc-900">
                  Brickweld Private Limited
                </h1>
                <p className="text-xs text-zinc-600">
                  Civil • Interior • Fabrication • Project Control
                </p>
                <p className="text-sm font-semibold text-zinc-800 mt-1">
                  {type === "weekly"
                    ? "Weekly Labour Wages & Wage Distribution Register"
                    : formatMode === "muster"
                      ? `Monthly Attendance Muster Roll (${daysInMonth}-Day Record)`
                      : "Monthly Payroll & Salary Disbursement Sheet"}
                </p>
              </div>
              <div className="text-right">
                <span className="inline-block px-2 py-0.5 text-xs font-bold tracking-wider uppercase bg-zinc-100 text-zinc-800 rounded border border-zinc-300">
                  {type === "weekly"
                    ? "Labour Only (Workers / Helpers)"
                    : formatMode === "muster"
                      ? `Muster Roll (Days 1–${daysInMonth})`
                      : "All Personnel (Staff + Labour)"}
                </span>
                <p className="font-semibold text-xs text-zinc-800 mt-1">{periodLabel}</p>
                <p className="text-[11px] text-zinc-500">Generated: {dateFmt(new Date().toISOString())}</p>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* OPTION A: 30-DAY COMPACT MUSTER ROLL TABLE (Guaranteed to fit A4 Landscape) */}
          {/* ========================================================================= */}
          {type === "monthly" && formatMode === "muster" ? (
            <div className="overflow-x-visible mb-6">
              <table className="w-full text-[7.5pt] border-collapse print-compact-muster border border-zinc-300">
                <thead>
                  <tr className="border-b-2 border-zinc-900 bg-zinc-100 text-zinc-800 font-bold">
                    <th className="py-1 px-1 text-center w-7 border-r border-zinc-300">#</th>
                    <th className="py-1 px-1 text-left w-36 border-r border-zinc-300">Worker Name</th>
                    <th className="py-1 px-1 text-left w-20 border-r border-zinc-300">Designation</th>
                    {dayNumbers.map((d) => (
                      <th key={d} className="py-1 px-0.5 text-center font-mono w-[18px] border-r border-zinc-300">
                        {d}
                      </th>
                    ))}
                    <th className="py-1 px-1 text-center font-bold w-12 border-r border-zinc-300 bg-zinc-200">Days</th>
                    <th className="py-1 px-1 text-right font-bold w-14 border-r border-zinc-300">Rate (₹)</th>
                    <th className="py-1 px-1 text-right font-bold w-16 border-r border-zinc-300 bg-zinc-200">Net Pay</th>
                    <th className="py-1 px-1 text-center font-bold w-16">Sign</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {filteredWorkers.map((w, idx) => (
                    <tr key={w.id} className="hover:bg-zinc-50 leading-tight">
                      <td className="py-1 px-1 font-mono text-center border-r border-zinc-200">{idx + 1}</td>
                      <td className="py-1 px-1 font-semibold text-zinc-900 border-r border-zinc-200 truncate max-w-[130px]" title={w.name}>
                        {w.name}
                      </td>
                      <td className="py-1 px-1 text-zinc-600 border-r border-zinc-200 truncate max-w-[80px]">
                        {w.designation || "Helper"}
                      </td>

                      {/* 30/31 Day Cells with Compact Status Badges */}
                      {dayNumbers.map((d) => {
                        const rec = w.dailyAttendance?.[d];
                        let label = "—";
                        let cls = "text-zinc-300";

                        if (rec) {
                          if (rec.is_leave) {
                            label = "L";
                            cls = "text-rose-600 font-bold";
                          } else if (rec.day_value >= 1.0) {
                            label = "1";
                            cls = "text-emerald-700 font-bold";
                          } else if (rec.day_value > 0) {
                            label = "½";
                            cls = "text-amber-700 font-bold";
                          } else {
                            label = "A";
                            cls = "text-rose-500 font-bold";
                          }
                        }

                        return (
                          <td key={d} className={`py-1 px-0.5 text-center font-mono text-[7pt] border-r border-zinc-200 ${cls}`}>
                            {label}
                          </td>
                        );
                      })}

                      <td className="py-1 px-1 text-center font-mono font-bold border-r border-zinc-200 bg-zinc-50">
                        {w.total_days.toFixed(1)}
                      </td>
                      <td className="py-1 px-1 text-right font-mono border-r border-zinc-200">
                        {currency(w.rate).replace("₹", "")}
                      </td>
                      <td className="py-1 px-1 text-right font-mono font-bold text-zinc-900 border-r border-zinc-200 bg-zinc-50">
                        {currency(w.net_payable).replace("₹", "")}
                      </td>
                      <td className="py-1 px-1 border-b border-zinc-200"></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-zinc-900 bg-zinc-100 font-bold text-zinc-900">
                    <td colSpan={3} className="py-1.5 px-1 text-right uppercase text-[7.5pt] border-r border-zinc-300">
                      Totals ({filteredWorkers.length}):
                    </td>
                    <td colSpan={daysInMonth} className="border-r border-zinc-300 text-center text-[7pt] text-zinc-500 italic">
                      [P=1.0 Full Day, ½=0.5 Half Day, L=Leave, A=Absent]
                    </td>
                    <td className="py-1.5 px-1 text-center font-mono border-r border-zinc-300 bg-zinc-200">
                      {totals.days.toFixed(1)}
                    </td>
                    <td className="py-1.5 px-1 border-r border-zinc-300"></td>
                    <td className="py-1.5 px-1 text-right font-mono text-[8pt] border-r border-zinc-300 bg-zinc-200">
                      {currency(totals.net)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            /* ========================================================================= */
            /* OPTION B: STANDARD SUMMARY REGISTER (12-Column High-Readability Payroll Master) */
            /* ========================================================================= */
            <table className="w-full text-xs border-collapse mb-6">
              <thead>
                <tr className="border-b-2 border-zinc-900 bg-zinc-100 text-zinc-800">
                  <th className="py-2 px-1 text-left font-bold">#</th>
                  <th className="py-2 px-1 text-left font-bold">Code</th>
                  <th className="py-2 px-1 text-left font-bold">Employee Name</th>
                  {type === "monthly" && <th className="py-2 px-1 text-left font-bold">Type</th>}
                  <th className="py-2 px-1 text-left font-bold">Designation / Team</th>
                  <th className="py-2 px-1 text-right font-bold">Days</th>
                  <th className="py-2 px-1 text-right font-bold">Rate (₹)</th>
                  <th className="py-2 px-1 text-right font-bold">Earned Wage</th>
                  <th className="py-2 px-1 text-right font-bold">Bus / Allowance</th>
                  <th className="py-2 px-1 text-right font-bold">Advance / Ded.</th>
                  <th className="py-2 px-1 text-right font-bold">Net Pay (₹)</th>
                  <th className="py-2 px-2 text-center font-bold w-24">Signature / Thumb</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {filteredWorkers.map((w, idx) => (
                  <tr key={w.id} className="hover:bg-zinc-50">
                    <td className="py-1.5 px-1 font-mono">{idx + 1}</td>
                    <td className="py-1.5 px-1 font-mono text-zinc-600">{w.code || "—"}</td>
                    <td className="py-1.5 px-1 font-semibold text-zinc-900">{w.name}</td>
                    {type === "monthly" && (
                      <td className="py-1.5 px-1 capitalize font-medium text-zinc-600">{w.staff_type}</td>
                    )}
                    <td className="py-1.5 px-1 text-zinc-600">
                      {w.designation || "Helper"} {w.team_name ? `(${w.team_name})` : ""}
                    </td>
                    <td className="py-1.5 px-1 text-right font-mono">{w.total_days.toFixed(1)}</td>
                    <td className="py-1.5 px-1 text-right font-mono">{currency(w.rate)}</td>
                    <td className="py-1.5 px-1 text-right font-mono">{currency(w.earned_wage)}</td>
                    <td className="py-1.5 px-1 text-right font-mono">{currency(w.allowances)}</td>
                    <td className="py-1.5 px-1 text-right font-mono text-destructive">
                      {w.deductions > 0 ? `-${currency(w.deductions)}` : "—"}
                    </td>
                    <td className="py-1.5 px-1 text-right font-mono font-bold text-zinc-900">
                      {currency(w.net_payable)}
                    </td>
                    <td className="py-1.5 px-2 border-b border-zinc-200"></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-zinc-900 bg-zinc-100 font-bold text-zinc-900">
                  <td colSpan={type === "monthly" ? 5 : 4} className="py-2 px-1 text-right uppercase">
                    Grand Totals ({filteredWorkers.length} persons):
                  </td>
                  <td className="py-2 px-1 text-right font-mono">{totals.days.toFixed(1)}</td>
                  <td className="py-2 px-1"></td>
                  <td className="py-2 px-1 text-right font-mono">{currency(totals.earned)}</td>
                  <td className="py-2 px-1 text-right font-mono">{currency(totals.allowances)}</td>
                  <td className="py-2 px-1 text-right font-mono text-destructive">
                    {totals.deductions > 0 ? `-${currency(totals.deductions)}` : "—"}
                  </td>
                  <td className="py-2 px-1 text-right font-mono text-sm">{currency(totals.net)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}

          {/* Official Signatures Block (Guaranteed to avoid page break cut) */}
          <div className="print-signature-block grid grid-cols-2 gap-16 pt-8 border-t border-zinc-300 text-xs text-center max-w-2xl mx-auto">
            <div>
              <div className="border-b border-zinc-400 pb-8"></div>
              <p className="mt-2 font-semibold text-zinc-800">Prepared by (Accounts)</p>
            </div>
            <div>
              <div className="border-b border-zinc-400 pb-8"></div>
              <p className="mt-2 font-semibold text-zinc-800">Approved by (MD)</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
