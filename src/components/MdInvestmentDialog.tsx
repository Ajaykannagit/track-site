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
  const [amount, setAmount] = useState<string>("");
  const [investmentDate, setInvestmentDate] = useState<string>(today());
  const [paymentSource, setPaymentSource] = useState<PaymentSourceType | "">("bank");
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: balances } = useAccountBalances();
  const saveInvestment = useSaveRow("md_investments", "MD Investment");

  const numericAmount = parseFloat(amount) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!paymentSource) {
      toast.error("Please select 'Received in': Bank or Petty Cash is mandatory.");
      return;
    }

    if (numericAmount <= 0) {
      toast.error("Investment amount must be greater than zero.");
      return;
    }

    try {
      setIsSubmitting(true);

      await saveInvestment.mutateAsync({
        values: {
          investment_date: investmentDate,
          amount: numericAmount,
          payment_source: paymentSource,
          reference_number: referenceNumber.trim() || null,
          remarks: remarks.trim() || null,
        },
      });

      toast.success(`${currency(numericAmount)} MD Investment recorded in ${paymentSource === "bank" ? "Bank" : "Petty Cash"}.`);
      setAmount("");
      setReferenceNumber("");
      setRemarks("");
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.message || "Failed to record MD investment.");
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
              <Landmark className="size-4 text-primary" /> Record MD Investment / Capital Infusion
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="rounded-md border p-2.5 bg-blue-50/50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200">
              Money coming in directly from the Managing Director into Bank or Petty Cash. It increases running cash balances and is excluded from project P&L and customer revenue.
            </div>

            {/* Amount */}
            <div>
              <Label htmlFor="inv-amount" className="text-xs font-semibold block mb-1">
                Investment Amount (₹) <span className="text-destructive font-bold">*</span>
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

            {/* Mandatory Received in */}
            <PaymentSourceSelect
              value={paymentSource}
              onChange={(val) => setPaymentSource(val)}
              bankBalance={balances?.bank?.balance ?? 0}
              pettyCashBalance={balances?.petty_cash?.balance ?? 0}
              paymentAmount={numericAmount}
              isInflow={true}
            />

            {/* Date & Reference */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="inv-date" className="text-xs font-semibold block mb-1">
                  Date Received <span className="text-destructive font-bold">*</span>
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
                placeholder="e.g. Site liquidity infusion / Working capital"
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
              className="gap-1.5"
            >
              <ArrowDownLeft className="size-3.5" />
              {isSubmitting ? "Saving..." : `Record Inflow (${currency(numericAmount)})`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
