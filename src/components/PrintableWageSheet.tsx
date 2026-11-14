import React from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X, Users, Calendar } from "lucide-react";
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
};

interface PrintableWageSheetProps {
  type: WagePrintType;
  periodLabel: string; // e.g. "Week: 13 Sep 2026 - 19 Sep 2026" or "Month: September 2026"
  workers: PrintableWorkerRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrintableWageSheet({
  type,
  periodLabel,
  workers,
  open,
  onOpenChange,
}: PrintableWageSheetProps) {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl overflow-y-auto max-h-[90vh] p-0 border-0 bg-transparent shadow-none">
        {/* Print Bar */}
        <div className="no-print sticky top-0 z-50 flex items-center justify-between gap-2 p-3 bg-card border-b rounded-t-lg shadow-sm">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Users className="size-4 text-primary" />
            {type === "weekly" ? "Weekly Labour Wage Sheet (Workers Only)" : "Monthly Staff & Labour Wage Master"}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handlePrint} className="gap-1.5 h-8">
              <Printer className="size-3.5" /> Print / Save as PDF (A4 Landscape)
            </Button>
            <Button size="sm" variant="ghost" className="size-8 p-0" onClick={() => onOpenChange(false)}>
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Paper Sheet */}
        <div className="bg-white text-zinc-900 p-8 font-sans shadow-lg rounded-b-lg border border-zinc-200 print:border-0 print:shadow-none print:p-0 print:m-0 print:text-black">
          {/* Header */}
          <div className="border-b-2 border-zinc-900 pb-3 mb-5">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-xl font-bold tracking-tight uppercase text-zinc-900">
                  Brickweld Private Limited
                </h1>
                <p className="text-xs text-zinc-600">
                  {type === "weekly"
                    ? "Weekly Labour Wages & Wage Distribution Register"
                    : "Monthly Payroll & Salary Disbursement Sheet"}
                </p>
              </div>
              <div className="text-right">
                <span className="inline-block px-2 py-0.5 text-xs font-bold tracking-wider uppercase bg-zinc-100 text-zinc-800 rounded border border-zinc-300">
                  {type === "weekly" ? "Labour Only (Workers / Helpers)" : "All Personnel (Staff + Labour)"}
                </span>
                <p className="font-semibold text-xs text-zinc-800 mt-1">{periodLabel}</p>
                <p className="text-[11px] text-zinc-500">Generated: {dateFmt(new Date().toISOString())}</p>
              </div>
            </div>
          </div>

          {/* Workers Table */}
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

          {/* Signature block */}
          <div className="grid grid-cols-3 gap-8 pt-10 border-t border-zinc-300 text-xs text-center">
            <div>
              <div className="border-b border-zinc-400 pb-8"></div>
              <p className="mt-2 font-semibold text-zinc-800">Prepared by (Accounts)</p>
            </div>
            <div>
              <div className="border-b border-zinc-400 pb-8"></div>
              <p className="mt-2 font-semibold text-zinc-800">Verified by (Site Supervisor)</p>
            </div>
            <div>
              <div className="border-b border-zinc-400 pb-8"></div>
              <p className="mt-2 font-semibold text-zinc-800">Approved by (Managing Director)</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
