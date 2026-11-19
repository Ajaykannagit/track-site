import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PaymentSourceSelect, type PaymentSourceType } from "@/components/PaymentSourceSelect";
import { useAccountBalances, useSaveRow } from "@/lib/db";
import { currency, today } from "@/lib/format";
import { Landmark, ArrowDownLeft } from "lucide-react";
import { toast } from "sonner";

interface MdInvestmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function MdInvestmentDialog({
  open,
  onOpenChange,
  onSuccess,
}: MdInvestmentDialogProps) {
  const [transactionType, setTransactionType] = useState<"investment" | "drawing">("investment");
  const [amount, setAmount] = useState<string>("");
  const [investmentDate, setInvestmentDate] = useState<string>(today());
  const [paymentSource, setPaymentSource] = useState<PaymentSourceType | "">("bank");
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: balances } = useAccountBalances();
  const saveInvestment = useSaveRow("md_investments", "Owner Capital");

  const numericAmount = parseFloat(amount) || 0;
  const isDrawing = transactionType === "drawing";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!paymentSource) {
      toast.error(isDrawing ? "Please select 'Paid from': Bank or Petty Cash is mandatory." : "Please select 'Received in': Bank or Petty Cash is mandatory.");
      return;
    }

    if (numericAmount <= 0) {
      toast.error("Amount must be greater than zero.");
      return;
    }

    try {
      setIsSubmitting(true);

      await saveInvestment.mutateAsync({
        values: {
          investment_date: investmentDate,
          amount: numericAmount,
          payment_source: paymentSource,
          transaction_type: transactionType,
          reference_number: referenceNumber.trim() || null,
          remarks: remarks.trim() || null,
        },
      });

      const label = isDrawing ? "Owner Drawing (Capital Out)" : "MD Investment (Capital In)";
      toast.success(`${currency(numericAmount)} ${label} recorded in ${paymentSource === "bank" ? "Bank" : "Petty Cash"}.`);
      setAmount("");
      setReferenceNumber("");
      setRemarks("");
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.message || "Failed to record transaction.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="mb-3">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Landmark className="size-4 text-primary" /> Owner Capital: Investment or Drawing
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Transaction Type Selector */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-md border">
              <button
                type="button"
                onClick={() => setTransactionType("investment")}
                className={`py-1.5 text-xs font-semibold rounded transition-colors ${
                  !isDrawing ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                + Owner Investment (Inflow)
              </button>
              <button
                type="button"
                onClick={() => setTransactionType("drawing")}
                className={`py-1.5 text-xs font-semibold rounded transition-colors ${
                  isDrawing ? "bg-background text-destructive shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                - Owner Drawing (Outflow)
              </button>
            </div>

            <div className={`rounded-md border p-2.5 ${isDrawing ? "bg-amber-50/50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200" : "bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200"}`}>
              {isDrawing
                ? "Money withdrawn by the Managing Director from Bank or Petty Cash. It decreases running cash balances as an Equity withdrawal and is excluded from operating site expenses."
                : "Money infused directly from the Managing Director into Bank or Petty Cash. It increases running cash balances as an Equity investment."}
            </div>

            {/* Amount */}
            <div>
              <Label htmlFor="inv-amount" className="text-xs font-semibold block mb-1">
                {isDrawing ? "Drawing Amount (₹)" : "Investment Amount (₹)"} <span className="text-destructive font-bold">*</span>
              </Label>
              <Input
                id="inv-amount"
                type="number"
                step="0.01"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 500000"
                required
                className="h-9 text-sm font-mono font-semibold"
              />
            </div>

            {/* Mandatory Source / Destination */}
            <PaymentSourceSelect
              value={paymentSource}
              onChange={(val) => setPaymentSource(val)}
              bankBalance={balances?.bank?.balance ?? 0}
              pettyCashBalance={balances?.petty_cash?.balance ?? 0}
              paymentAmount={numericAmount}
              isInflow={!isDrawing}
            />

            {/* Date & Reference */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="inv-date" className="text-xs font-semibold block mb-1">
                  {isDrawing ? "Date Withdrawn" : "Date Received"} <span className="text-destructive font-bold">*</span>
                </Label>
                <Input
                  id="inv-date"
                  type="date"
                  value={investmentDate}
                  onChange={(e) => setInvestmentDate(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              </div>
              <div>
                <Label htmlFor="inv-ref" className="text-xs font-semibold block mb-1">
                  Reference / Cheque #
                </Label>
                <Input
                  id="inv-ref"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="Txn ID / Cheque #"
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            {/* Remarks */}
            <div>
              <Label htmlFor="inv-remarks" className="text-xs font-semibold block mb-1">
                Remarks / Purpose
              </Label>
              <Textarea
                id="inv-remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder={isDrawing ? "e.g. Personal withdrawal / Owner drawing" : "e.g. Site liquidity infusion / Working capital"}
                rows={2}
                className="text-xs resize-none"
              />
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || !paymentSource || numericAmount <= 0}
              className={`gap-1.5 ${isDrawing ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}`}
            >
              <ArrowDownLeft className={`size-3.5 ${isDrawing ? "rotate-180" : ""}`} />
              {isSubmitting ? "Saving..." : isDrawing ? `Record Drawing (${currency(numericAmount)})` : `Record Inflow (${currency(numericAmount)})`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
