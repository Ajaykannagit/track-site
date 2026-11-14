import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X, Building2 } from "lucide-react";
import { currency, dateFmt } from "@/lib/format";

export type PrintablePoData = {
  po_number: string;
  po_date: string;
  status: string;
  project_name?: string | undefined;
  supplier_name?: string | undefined;
  terms?: string | null | undefined;
  items: Array<{
    material: string;
    specification?: string | null;
    unit?: string | null;
    quantity: number;
    rate: number;
    gst_percent?: number;
    amount: number;
  }>;
  subtotal: number;
  total_gst: number;
  subtotal_with_gst: number;
  travel_charges: number;
  final_total: number;
};

interface PrintablePoDialogProps {
  po: PrintablePoData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrintablePoDialog({ po, open, onOpenChange }: PrintablePoDialogProps) {
  if (!po) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl overflow-y-auto max-h-[90vh] p-0 border-0 bg-transparent shadow-none">
        {/* Floating Print Bar (hidden during browser print) */}
        <div className="no-print sticky top-0 z-50 flex items-center justify-between gap-2 p-3 bg-card border-b rounded-t-lg shadow-sm">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Building2 className="size-4 text-primary" /> Purchase Order Voucher — {po.po_number}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handlePrint} className="gap-1.5 h-8">
              <Printer className="size-3.5" /> Print / Save as PDF
            </Button>
            <Button size="sm" variant="ghost" className="size-8 p-0" onClick={() => onOpenChange(false)}>
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Printable Voucher Paper */}
        <div className="bg-white text-zinc-900 p-8 sm:p-10 font-sans shadow-lg rounded-b-lg border border-zinc-200 print:border-0 print:shadow-none print:p-0 print:m-0 print:text-black">
          {/* Company & Document Header */}
          <div className="border-b-2 border-zinc-900 pb-4 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-xl font-bold tracking-tight uppercase text-zinc-900">
                  Brickweld Private Limited
                </h1>
                <p className="text-xs text-zinc-600 mt-0.5">
                  Civil Engineering & Construction Project Control
                </p>
                <p className="text-xs text-zinc-500">Corporate & Operational Head Office</p>
              </div>
              <div className="text-right">
                <span className="inline-block px-2.5 py-1 text-xs font-bold tracking-wider uppercase bg-zinc-100 text-zinc-800 rounded border border-zinc-300">
                  Purchase Order
                </span>
                <p className="font-mono text-sm font-bold text-zinc-900 mt-2">{po.po_number}</p>
                <p className="text-xs text-zinc-600">Date: {dateFmt(po.po_date)}</p>
                <p className="text-xs text-zinc-500">Status: <span className="uppercase font-semibold">{po.status}</span></p>
              </div>
            </div>
          </div>

          {/* Supplier & Project Meta */}
          <div className="grid grid-cols-2 gap-6 mb-6 p-4 bg-zinc-50 rounded border border-zinc-200 text-xs">
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-500 block">Vendor / Supplier</span>
              <p className="text-sm font-bold text-zinc-900 mt-0.5">{po.supplier_name || "—"}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-zinc-500 block">Site / Project</span>
              <p className="text-sm font-bold text-zinc-900 mt-0.5">{po.project_name || "Head Office / General"}</p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="mb-6">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b-2 border-zinc-900 bg-zinc-100 text-zinc-800">
                  <th className="py-2 px-2 text-left font-bold">#</th>
                  <th className="py-2 px-2 text-left font-bold">Material / Specification</th>
                  <th className="py-2 px-2 text-right font-bold">Unit</th>
                  <th className="py-2 px-2 text-right font-bold">Qty</th>
                  <th className="py-2 px-2 text-right font-bold">Rate</th>
                  <th className="py-2 px-2 text-right font-bold">GST %</th>
                  <th className="py-2 px-2 text-right font-bold">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {po.items.map((it, idx) => (
                  <tr key={idx} className="hover:bg-zinc-50">
                    <td className="py-2 px-2 text-left font-mono">{idx + 1}</td>
                    <td className="py-2 px-2 text-left">
                      <div className="font-semibold text-zinc-900">{it.material}</div>
                      {it.specification && <div className="text-[11px] text-zinc-500">{it.specification}</div>}
                    </td>
                    <td className="py-2 px-2 text-right uppercase text-zinc-600">{it.unit || "—"}</td>
                    <td className="py-2 px-2 text-right font-mono">{it.quantity}</td>
                    <td className="py-2 px-2 text-right font-mono">{currency(it.rate)}</td>
                    <td className="py-2 px-2 text-right font-mono">{it.gst_percent ? `${it.gst_percent}%` : "0%"}</td>
                    <td className="py-2 px-2 text-right font-mono font-semibold">{currency(it.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Breakdown & Totals */}
          <div className="flex justify-end mb-8">
            <div className="w-72 space-y-1.5 text-xs bg-zinc-50 p-3 rounded border border-zinc-200">
              <div className="flex justify-between py-0.5 text-zinc-600">
                <span>Materials Subtotal:</span>
                <span className="font-mono">{currency(po.subtotal)}</span>
              </div>
              <div className="flex justify-between py-0.5 text-zinc-600">
                <span>GST (Materials Only):</span>
                <span className="font-mono">{currency(po.total_gst)}</span>
              </div>
              <div className="flex justify-between py-1 border-t border-zinc-200 font-semibold text-zinc-900">
                <span>Materials Total (with GST):</span>
                <span className="font-mono">{currency(po.subtotal_with_gst)}</span>
              </div>
              <div className="flex justify-between py-0.5 text-zinc-700">
                <span>+ Travel / Transport Charge:</span>
                <span className="font-mono font-medium">{currency(po.travel_charges)}</span>
              </div>
              <div className="flex justify-between py-2 border-t-2 border-zinc-900 text-sm font-bold text-zinc-900">
                <span>Final PO Total:</span>
                <span className="font-mono text-base">{currency(po.final_total)}</span>
              </div>
            </div>
          </div>

          {po.terms && (
            <div className="mb-8 p-3 bg-zinc-50 rounded border border-zinc-200 text-xs">
              <span className="font-bold text-zinc-700 block mb-1">Terms & Conditions / Remarks:</span>
              <p className="text-zinc-600 whitespace-pre-wrap">{po.terms}</p>
            </div>
          )}

          {/* Signatures */}
          <div className="grid grid-cols-3 gap-6 pt-12 border-t border-zinc-200 text-xs text-center">
            <div>
              <div className="border-b border-zinc-400 pb-8"></div>
              <p className="mt-2 font-semibold text-zinc-800">Prepared By (Accounts)</p>
            </div>
            <div>
              <div className="border-b border-zinc-400 pb-8"></div>
              <p className="mt-2 font-semibold text-zinc-800">Verified By (Site Supervisor)</p>
            </div>
            <div>
              <div className="border-b border-zinc-400 pb-8"></div>
              <p className="mt-2 font-semibold text-zinc-800">Authorized Signatory (MD)</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
