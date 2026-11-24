import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X, Download } from "lucide-react";
import { currency, dateFmt } from "@/lib/format";

export type VoucherDocumentType =
  | "supplier_payment"
  | "contractor_payment"
  | "client_receipt"
  | "purchase_order"
  | "grn_bill"
  | "material_indent"
  | "contractor_bill"
  | "work_order"
  | "quotation"
  | "expense_voucher";

export interface VoucherLineItem {
  description: string;
  unit?: string | null;
  quantity?: number | null;
  rate?: number | null;
  amount: number;
}

export interface PrintableVoucherData {
  type: VoucherDocumentType;
  voucherNumber: string;
  date: string;
  statusBadge?: string; // e.g., "Paid", "Advance", "Approved", "Billed"
  statusTone?: "emerald" | "blue" | "amber" | "slate";
  partyLabel: string; // e.g., "Paid To", "Received From", "Vendor / Supplier", "Contractor", "Customer / Buyer"
  partyName: string;
  partyAddress?: string | null;
  partyPhone?: string | null;
  partyGstin?: string | null;
  partyCode?: string | null;
  projectName?: string | null;
  projectCode?: string | null;
  paymentMode?: string | null;
  paymentSource?: string | null;
  walletName?: string | null;
  referenceNumber?: string | null;
  linkedDocLabel?: string | null; // e.g. "Bill / PO Number", "Milestone / Invoice"
  linkedDocNumber?: string | null;
  linkedDocDate?: string | null;
  linkedDocTotal?: number | null;
  amount: number; // Main amount paid / received / billed
  grossAmount?: number | null;
  taxAmount?: number | null;
  travelCharges?: number | null;
  tdsAmount?: number | null;
  retentionAmount?: number | null;
  overPaymentAmount?: number | null; // Zoho orange "Over payment / Unused Advance" box
  notes?: string | null;
  lineItems?: VoucherLineItem[];
}

interface PrintableVoucherDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: PrintableVoucherData | null;
}

function numberToIndianWords(num: number): string {
  const n = Math.round(Math.abs(num || 0));
  if (n === 0) return "Zero Rupees Only";

  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  const convertBelowThousand = (val: number): string => {
    let str = "";
    if (val >= 100) {
      str += ones[Math.floor(val / 100)] + " Hundred ";
      val %= 100;
    }
    if (val >= 20) {
      str += tens[Math.floor(val / 10)] + " ";
      val %= 10;
    }
    if (val > 0) {
      str += ones[val] + " ";
    }
    return str.trim();
  };

  let rem = n;
  const parts: string[] = [];

  const crore = Math.floor(rem / 10000000);
  rem %= 10000000;
  if (crore > 0) parts.push(convertBelowThousand(crore) + " Crore");

  const lakh = Math.floor(rem / 100000);
  rem %= 100000;
  if (lakh > 0) parts.push(convertBelowThousand(lakh) + " Lakh");

  const thousand = Math.floor(rem / 1000);
  rem %= 1000;
  if (thousand > 0) parts.push(convertBelowThousand(thousand) + " Thousand");

  if (rem > 0) parts.push(convertBelowThousand(rem));

  return `Indian Rupee ${parts.join(" ")} Only`;
}

function getTitleMeta(type: VoucherDocumentType): {
  docTitle: string;
  greenBoxLabel: string;
  isPaymentVoucher: boolean;
} {
  switch (type) {
    case "supplier_payment":
      return {
        docTitle: "PAYMENTS MADE",
        greenBoxLabel: "Amount Paid",
        isPaymentVoucher: true,
      };
    case "contractor_payment":
      return {
        docTitle: "PAYMENTS MADE (CONTRACTOR)",
        greenBoxLabel: "Amount Paid",
        isPaymentVoucher: true,
      };
    case "client_receipt":
      return {
        docTitle: "PAYMENT RECEIPT",
        greenBoxLabel: "Amount Received",
        isPaymentVoucher: true,
      };
    case "purchase_order":
      return {
        docTitle: "PURCHASE ORDER",
        greenBoxLabel: "Order Total",
        isPaymentVoucher: false,
      };
    case "grn_bill":
      return {
        docTitle: "GOODS RECEIPT / VENDOR BILL",
        greenBoxLabel: "Bill Total",
        isPaymentVoucher: false,
      };
    case "material_indent":
      return {
        docTitle: "MATERIAL INDENT REQUEST",
        greenBoxLabel: "Estimated Value",
        isPaymentVoucher: false,
      };
    case "contractor_bill":
      return {
        docTitle: "CONTRACTOR RA BILL",
        greenBoxLabel: "Net Payable",
        isPaymentVoucher: false,
      };
    case "work_order":
      return {
        docTitle: "CONTRACTOR WORK ORDER",
        greenBoxLabel: "Work Order Value",
        isPaymentVoucher: false,
      };
    case "quotation":
      return {
        docTitle: "PROJECT QUOTATION / ESTIMATE",
        greenBoxLabel: "Quotation Amount",
        isPaymentVoucher: false,
      };
    case "expense_voucher":
      return {
        docTitle: "EXPENSE VOUCHER",
        greenBoxLabel: "Expense Amount",
        isPaymentVoucher: true,
      };
  }
}

export function PrintableVoucherDialog({
  open,
  onOpenChange,
  data,
}: PrintableVoucherDialogProps) {
  if (!data) return null;

  const meta = getTitleMeta(data.type);
  const badgeText =
    data.statusBadge ||
    (data.overPaymentAmount && data.overPaymentAmount > 0 && !data.linkedDocNumber
      ? "Advance"
      : meta.isPaymentVoucher
      ? "Paid"
      : "Approved");

  const handlePrint = () => {
    const el = document.getElementById("zoho-printable-voucher-sheet");
    if (!el) {
      window.print();
      return;
    }
    const win = window.open("", "_blank", "width=950,height=1100");
    if (!win) {
      window.print();
      return;
    }
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${meta.docTitle} - ${data.voucherNumber} - ${data.partyName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #0f172a;
      background: #ffffff;
      padding: 24px;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    @page { size: A4 portrait; margin: 12mm; }
  </style>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  ${el.outerHTML}
  <script>
    setTimeout(() => {
      window.print();
    }, 350);
  </script>
</body>
</html>`);
    win.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-slate-100 dark:bg-slate-900 max-h-[94vh] flex flex-col">
        {/* Top Action Bar */}
        <DialogHeader className="px-6 py-3.5 bg-white dark:bg-slate-950 border-b flex flex-row items-center justify-between space-y-0 shrink-0">
          <div>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <span>{meta.docTitle}</span>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {data.voucherNumber}
              </span>
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Zoho Books A4 Document Template · Ready for PDF download or physical print
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="default" onClick={handlePrint} className="gap-1.5">
              <Printer className="size-3.5" /> Print / Save as PDF
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-8"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
            </Button>
          </div>
        </DialogHeader>

        {/* Scrollable A4 Sheet Container */}
        <div className="p-6 overflow-y-auto flex-1">
          <div
            id="zoho-printable-voucher-sheet"
            className="relative mx-auto max-w-[794px] bg-white text-slate-900 shadow-lg border border-slate-200 p-10 rounded-sm overflow-hidden"
          >
            {/* Zoho Diagonal Corner Status Ribbon */}
            <div className="pointer-events-none absolute top-0 left-0 w-32 h-32 overflow-hidden">
              <div
                className={`absolute top-6 -left-9 w-40 text-center py-1 text-[11px] font-bold uppercase tracking-wider text-white -rotate-45 shadow-sm ${
                  data.statusTone === "amber"
                    ? "bg-amber-600"
                    : data.statusTone === "blue"
                    ? "bg-blue-600"
                    : "bg-emerald-600"
                }`}
              >
                {badgeText}
              </div>
            </div>

            {/* Company Letterhead Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pb-6 border-b-2 border-slate-800 pl-10">
              <div>
                <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                  BRICKWELD PRIVATE LIMITED
                </h1>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-md">
                  No 598, 2nd Floor, 1st A Main Road, Sector 6, HSR Layout
                  <br />
                  Bengaluru, Karnataka / Tamil Nadu · India
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5 text-xs font-medium text-slate-700">
                  <span>GSTIN: <strong className="font-mono">33AAOCB3181E1ZU</strong></span>
                  <span>Email: brickweldprivatelimited@gmail.com</span>
                </div>
              </div>

              <div className="text-right">
                <div className="inline-block bg-slate-900 text-white px-3.5 py-1.5 rounded text-xs font-bold tracking-widest uppercase">
                  {meta.docTitle}
                </div>
                <p className="text-xs text-slate-500 mt-2 font-mono">
                  Doc #: <strong className="text-slate-900">{data.voucherNumber}</strong>
                </p>
                <p className="text-xs text-slate-500 font-mono">
                  Date: <strong className="text-slate-900">{dateFmt(data.date)}</strong>
                </p>
              </div>
            </div>

            {/* Main Metadata Grid + Zoho Green Amount Box */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 py-6 items-center border-b border-slate-200">
              <div className="md:col-span-8 space-y-2.5 text-xs">
                <div className="grid grid-cols-3 py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Document / Ref #</span>
                  <span className="col-span-2 font-mono font-bold text-slate-900">
                    {data.voucherNumber}
                    {data.referenceNumber ? ` (Ref: ${data.referenceNumber})` : ""}
                  </span>
                </div>
                <div className="grid grid-cols-3 py-1.5 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Date</span>
                  <span className="col-span-2 font-semibold text-slate-900">
                    {dateFmt(data.date)}
                  </span>
                </div>
                {data.projectName && (
                  <div className="grid grid-cols-3 py-1.5 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Project / Site</span>
                    <span className="col-span-2 font-semibold text-slate-900">
                      {data.projectName}
                      {data.projectCode ? ` (${data.projectCode})` : ""}
                    </span>
                  </div>
                )}
                {data.paymentMode && (
                  <div className="grid grid-cols-3 py-1.5 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Payment Mode</span>
                    <span className="col-span-2 font-semibold uppercase text-slate-900">
                      {data.paymentMode}
                    </span>
                  </div>
                )}
                {(data.walletName || data.paymentSource) && (
                  <div className="grid grid-cols-3 py-1.5 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Paid Through / Account</span>
                    <span className="col-span-2 font-semibold text-slate-900">
                      {data.walletName ||
                        (data.paymentSource === "bank"
                          ? "Brickweld Private Limited (xxxx5909) — Bank"
                          : "Kodak- Petty Cash")}
                    </span>
                  </div>
                )}
                {data.linkedDocNumber && (
                  <div className="grid grid-cols-3 py-1.5 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">
                      {data.linkedDocLabel || "Applied To Document"}
                    </span>
                    <span className="col-span-2 font-mono font-semibold text-slate-900">
                      {data.linkedDocNumber}
                      {data.linkedDocDate ? ` (${dateFmt(data.linkedDocDate)})` : ""}
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-3 py-1.5">
                  <span className="text-slate-500 font-medium">Amount in Words</span>
                  <span className="col-span-2 font-semibold italic text-slate-800">
                    {numberToIndianWords(data.amount)}
                  </span>
                </div>
              </div>

              {/* Zoho-style Green Callout Box */}
              <div className="md:col-span-4">
                <div className="rounded-md bg-emerald-600 text-white p-5 text-center shadow-sm">
                  <p className="text-xs uppercase tracking-wider font-semibold text-emerald-100">
                    {meta.greenBoxLabel}
                  </p>
                  <p className="text-2xl font-black tracking-tight mt-1.5 font-mono">
                    {currency(data.amount)}
                  </p>
                  {data.tdsAmount && data.tdsAmount > 0 ? (
                    <p className="text-[11px] text-emerald-100 mt-1">
                      + TDS Withheld: {currency(data.tdsAmount)}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Party Block */}
            <div className="py-5 border-b border-slate-200 flex flex-col sm:flex-row justify-between gap-6">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {data.partyLabel}
                </p>
                <h2 className="text-base font-bold text-slate-900 mt-1">{data.partyName}</h2>
                {data.partyCode && (
                  <p className="text-xs text-slate-600 font-mono mt-0.5">Code: {data.partyCode}</p>
                )}
                {data.partyAddress && (
                  <p className="text-xs text-slate-600 mt-0.5 max-w-md">{data.partyAddress}</p>
                )}
                <div className="flex flex-wrap gap-4 mt-1 text-xs text-slate-600">
                  {data.partyPhone && <span>Phone: {data.partyPhone}</span>}
                  {data.partyGstin && (
                    <span>
                      GSTIN: <strong className="font-mono">{data.partyGstin}</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Financial Breakdown Pill if Gross/Tax/TDS/Retention exist */}
              {(data.grossAmount != null ||
                data.taxAmount != null ||
                data.tdsAmount != null ||
                data.retentionAmount != null) && (
                <div className="bg-slate-50 border border-slate-200 rounded p-3.5 min-w-[230px] text-xs space-y-1.5">
                  {data.grossAmount != null && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Gross / Subtotal:</span>
                      <span className="font-mono font-semibold">{currency(data.grossAmount)}</span>
                    </div>
                  )}
                  {data.taxAmount != null && data.taxAmount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">GST / Tax:</span>
                      <span className="font-mono font-semibold">{currency(data.taxAmount)}</span>
                    </div>
                  )}
                  {data.travelCharges != null && data.travelCharges > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Transport / Freight:</span>
                      <span className="font-mono font-semibold">{currency(data.travelCharges)}</span>
                    </div>
                  )}
                  {data.tdsAmount != null && data.tdsAmount > 0 && (
                    <div className="flex justify-between text-amber-800">
                      <span>Deductions / TDS:</span>
                      <span className="font-mono font-semibold">-{currency(data.tdsAmount)}</span>
                    </div>
                  )}
                  {data.retentionAmount != null && data.retentionAmount > 0 && (
                    <div className="flex justify-between text-amber-800">
                      <span>Retention Held:</span>
                      <span className="font-mono font-semibold">
                        -{currency(data.retentionAmount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1.5 border-t border-slate-200 font-bold text-slate-900">
                    <span>Net Total:</span>
                    <span className="font-mono">{currency(data.amount)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Line Items Table (for PO, GRN, Indent, Work Order, Contractor Bill, Quotation) */}
            {data.lineItems && data.lineItems.length > 0 && (
              <div className="py-5 border-b border-slate-200">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Itemized Breakdown
                </h3>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="py-2 px-3 text-left font-semibold w-10">#</th>
                      <th className="py-2 px-3 text-left font-semibold">Item / Description</th>
                      <th className="py-2 px-3 text-center font-semibold w-20">Unit</th>
                      <th className="py-2 px-3 text-right font-semibold w-24">Qty</th>
                      <th className="py-2 px-3 text-right font-semibold w-28">Rate</th>
                      <th className="py-2 px-3 text-right font-semibold w-32">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {data.lineItems.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-slate-500 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {item.description}
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-600">
                          {item.unit || "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {item.quantity != null ? item.quantity : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          {item.rate != null ? currency(item.rate) : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                          {currency(item.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Payment Allocation Table (when a payment is linked to a PO or Bill) */}
            {meta.isPaymentVoucher && data.linkedDocNumber && (
              <div className="py-5 border-b border-slate-200">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                  Payment For
                </h3>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-y border-slate-200">
                      <th className="py-2 px-3 text-left font-semibold">Bill / PO Number</th>
                      <th className="py-2 px-3 text-left font-semibold">Document Date</th>
                      <th className="py-2 px-3 text-right font-semibold">Document Amount</th>
                      <th className="py-2 px-3 text-right font-semibold">Payment Applied</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                        {data.linkedDocNumber}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {data.linkedDocDate ? dateFmt(data.linkedDocDate) : dateFmt(data.date)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {data.linkedDocTotal != null
                          ? currency(data.linkedDocTotal)
                          : currency(data.amount)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                        {currency(
                          data.overPaymentAmount && data.overPaymentAmount > 0
                            ? Math.max(0, data.amount - data.overPaymentAmount)
                            : data.amount
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Zoho Books Orange "Over payment / Unused Advance" Callout Box */}
            {data.overPaymentAmount != null && data.overPaymentAmount > 0 && (
              <div className="mt-5 rounded-md border border-amber-300 bg-amber-50/90 px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                    Over payment / Unused Advance Credit
                  </p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    {data.linkedDocNumber
                      ? "Excess payment over bill amount — held as open advance credit for this party."
                      : "Standalone advance payment (not yet applied to a Bill or PO)."}
                  </p>
                </div>
                <span className="font-mono text-base font-black text-amber-900">
                  {currency(data.overPaymentAmount)}
                </span>
              </div>
            )}

            {/* Notes / Remarks */}
            {data.notes && (
              <div className="mt-5 text-xs">
                <p className="font-bold uppercase tracking-wider text-slate-400 text-[11px]">
                  Notes / Narration
                </p>
                <p className="text-slate-700 mt-1 bg-slate-50 p-3 rounded border border-slate-200 whitespace-pre-wrap">
                  {data.notes}
                </p>
              </div>
            )}

            {/* Signatures Footer */}
            <div className="mt-12 pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-xs text-slate-500">
              <div>
                <p className="font-semibold text-slate-700">Prepared / Verified By</p>
                <div className="h-12 border-b border-dashed border-slate-300 w-48 mt-2" />
                <p className="text-[11px] mt-1">Accounts & Site Control — Brickweld Pvt Ltd</p>
              </div>
              <div className="text-right flex flex-col items-end">
                <p className="font-semibold text-slate-700">
                  For BRICKWELD PRIVATE LIMITED
                </p>
                <div className="h-12 border-b border-dashed border-slate-300 w-48 mt-2" />
                <p className="text-[11px] mt-1">Authorized Signatory / Receiver</p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
