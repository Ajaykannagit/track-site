import { useState, useRef } from "react";
import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { currency, dateFmt } from "@/lib/format";

export function numberToWordsINR(amount: number): string {
  const num = Math.floor(Math.abs(amount));
  if (num === 0) return "Zero Rupees Only";

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

  const twoDigits = (n: number) => {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 === 0 ? "" : " " + ones[n % 10]);
  };

  const threeDigits = (n: number) => {
    const h = Math.floor(n / 100);
    const rem = n % 100;
    let res = "";
    if (h > 0) res += ones[h] + " Hundred";
    if (rem > 0) res += (res ? " " : "") + twoDigits(rem);
    return res;
  };

  const parts: string[] = [];
  const crore = Math.floor(num / 10000000);
  let rem = num % 10000000;
  if (crore > 0) parts.push(twoDigits(crore) + " Crore");

  const lakh = Math.floor(rem / 100000);
  rem = rem % 100000;
  if (lakh > 0) parts.push(twoDigits(lakh) + " Lakh");

  const thousand = Math.floor(rem / 1000);
  rem = rem % 1000;
  if (thousand > 0) parts.push(twoDigits(thousand) + " Thousand");

  if (rem > 0) parts.push(threeDigits(rem));

  return "Rupees " + parts.join(" ") + " Only";
}

export type PrintableReceiptData = {
  receipt_number: string;
  payment_date: string;
  client_name?: string | null;
  project_name: string;
  amount: number;
  payment_method: string;
  reference_number?: string | null;
  payment_category: string;
  account_type: string;
  invoice_reference?: string | null;
  notes?: string | null;
};

interface PrintableClientReceiptProps {
  receipt: PrintableReceiptData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrintableClientReceipt({
  receipt,
  open,
  onOpenChange,
}: PrintableClientReceiptProps) {
  if (!receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const amountWords = numberToWordsINR(receipt.amount);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden sm:max-w-3xl">
        <DialogHeader className="p-4 border-b no-print flex flex-row items-center justify-between">
          <DialogTitle className="text-base font-bold flex items-center gap-2">
            <Printer className="size-4 text-primary" /> Client Payment Receipt Voucher
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handlePrint} className="gap-1.5 h-8">
              <Printer className="size-3.5" /> Print / Save as PDF
            </Button>
          </div>
        </DialogHeader>

        {/* Printable Voucher Paper */}
        <div id="printable-client-receipt" className="p-8 bg-white text-slate-900 font-sans print:p-6 text-sm">
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-4 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900">
                  BRICKWELD PRIVATE LIMITED
                </h1>
                <p className="text-xs uppercase tracking-wider text-slate-600 font-semibold mt-0.5">
                  Civil • Interior • Fabrication • Infrastructure Control
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Official Client Remittance &amp; Payment Receipt
                </p>
              </div>
              <div className="text-right">
                <span className="inline-block border border-slate-900 px-3 py-1 text-xs font-mono font-bold tracking-widest uppercase bg-slate-100">
                  RECEIPT VOUCHER
                </span>
                <p className="text-xs font-mono font-bold text-slate-900 mt-2">
                  No: <span className="text-sm font-black">{receipt.receipt_number}</span>
                </p>
                <p className="text-xs text-slate-600">
                  Date: <span className="font-semibold">{dateFmt(receipt.payment_date)}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Key Details Grid */}
          <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-50 p-4 rounded border border-slate-200">
            <div>
              <p className="text-[11px] font-bold uppercase text-slate-500">Received From (Client):</p>
              <p className="text-base font-bold text-slate-900 mt-0.5">
                {receipt.client_name || "Client M/s (Against Project)"}
              </p>
              <p className="text-xs text-slate-600 mt-1">
                <span className="font-semibold">Project:</span> {receipt.project_name}
              </p>
              {receipt.invoice_reference && (
                <p className="text-xs text-slate-600 mt-0.5">
                  <span className="font-semibold">Against Invoice / Ref:</span> {receipt.invoice_reference}
                </p>
              )}
            </div>

            <div className="text-right flex flex-col justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase text-slate-500">Amount Received:</p>
                <p className="text-2xl font-black font-mono text-emerald-700 mt-0.5">
                  {currency(receipt.amount)}
                </p>
              </div>
              <div className="text-xs text-slate-600 mt-2">
                <span className="font-semibold">Category:</span>{" "}
                <span className="uppercase font-mono text-[11px] bg-slate-200 px-1.5 py-0.5 rounded">
                  {receipt.payment_category}
                </span>
              </div>
            </div>
          </div>

          {/* Amount in words */}
          <div className="border-l-4 border-emerald-600 bg-emerald-50/50 p-3 mb-6 rounded-r">
            <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              Amount in Words:
            </p>
            <p className="text-sm font-semibold text-emerald-950 mt-0.5 italic">
              {amountWords}
            </p>
          </div>

          {/* Transaction Metadata Table */}
          <div className="border border-slate-200 rounded overflow-hidden mb-8">
            <table className="w-full text-xs text-left border-collapse">
              <tbody className="divide-y divide-slate-200">
                <tr className="bg-slate-50/50">
                  <th className="py-2.5 px-4 font-semibold text-slate-700 w-1/3">Payment Mode / Instrument</th>
                  <td className="py-2.5 px-4 font-mono font-medium text-slate-900 uppercase">
                    {receipt.payment_method || "Bank Transfer"}
                  </td>
                </tr>
                <tr>
                  <th className="py-2.5 px-4 font-semibold text-slate-700">UTR / Cheque / Reference No.</th>
                  <td className="py-2.5 px-4 font-mono font-bold text-slate-900">
                    {receipt.reference_number || "— (Direct Deposit / Cheque in Clearing)"}
                  </td>
                </tr>
                <tr className="bg-slate-50/50">
                  <th className="py-2.5 px-4 font-semibold text-slate-700">Credited To Account</th>
                  <td className="py-2.5 px-4 font-medium text-slate-900 capitalize">
                    {receipt.account_type === "bank" ? "Company Bank Account" : "Site Petty Cash"}
                  </td>
                </tr>
                {receipt.notes && (
                  <tr>
                    <th className="py-2.5 px-4 font-semibold text-slate-700 align-top">Remarks / Scope Notes</th>
                    <td className="py-2.5 px-4 text-slate-800 whitespace-pre-wrap">
                      {receipt.notes}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Verification Statement & Signatures */}
          <div className="pt-6 border-t border-slate-200 mt-8">
            <p className="text-[11px] text-slate-500 italic mb-10 text-center">
              This is an official system-generated payment receipt acknowledgment from Brickweld Pvt Ltd. Subject to cheque realization.
            </p>

            <div className="flex justify-between items-end pt-4 px-4">
              <div className="text-center">
                <div className="w-48 border-b border-slate-400 mb-1" />
                <p className="text-xs font-semibold text-slate-800">Received &amp; Entered By</p>
                <p className="text-[10px] text-slate-500">Accounts Department</p>
              </div>

              <div className="text-center">
                <div className="w-48 border-b border-slate-400 mb-1" />
                <p className="text-xs font-semibold text-slate-800">Authorized Signatory</p>
                <p className="text-[10px] text-slate-500">For BRICKWELD PRIVATE LIMITED</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-3 bg-muted/20 border-t no-print">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button size="sm" onClick={handlePrint} className="gap-1.5">
            <Printer className="size-3.5" /> Print Receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
