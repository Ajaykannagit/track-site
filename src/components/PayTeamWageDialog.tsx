import React, { useState, useEffect } from "react";
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
import { currency, today, dateFmt } from "@/lib/format";
import { Users, Banknote, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export type TeamWagePayTarget = {
  teamId: string;
  teamName: string;
  weekStart: string; // ISO date YYYY-MM-DD
  membersCount: number;
  totalWageDue: number; // total earned wage + bus/petrol - advance
  alreadyPaid: number;
  pendingAmount: number;
};

interface PayTeamWageDialogProps {
  target: TeamWagePayTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  onOpenMdInvestment?: () => void;
}

export function PayTeamWageDialog({
  target,
  open,
  onOpenChange,
  onSuccess,
  onOpenMdInvestment,
}: PayTeamWageDialogProps) {
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(today());
  const [paymentSource, setPaymentSource] = useState<PaymentSourceType | "">("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: balances } = useAccountBalances();
  const saveWagePayment = useSaveRow("wage_payments", "Team Wage Payment");

  useEffect(() => {
    if (target) {
      setPaymentAmount(String(target.pendingAmount > 0 ? target.pendingAmount : ""));
      setPaymentDate(today());
      setPaymentSource("");
      setPaymentMethod("cash");
      setReferenceNumber("");
      setRemarks(`Wage disbursement for ${target.teamName} (Week ${dateFmt(target.weekStart)})`);
    }
  }, [target]);

  if (!target) return null;

  const numericAmount = parseFloat(paymentAmount) || 0;

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!paymentSource) {
      toast.error("Please select 'Pay from': Bank or Petty Cash is mandatory.");
      return;
    }

    if (numericAmount <= 0) {
      toast.error("Payment amount must be greater than zero.");
      return;
    }

    if (numericAmount > target.pendingAmount) {
      toast.error(`Payment amount (${currency(numericAmount)}) cannot exceed pending wage (${currency(target.pendingAmount)}).`);
      return;
    }

    try {
      setIsSubmitting(true);

      // Save wage payment record
      await saveWagePayment.mutateAsync({
        values: {
          team_id: target.teamId,
          week_start_date: target.weekStart,
          payment_date: paymentDate,
          amount: numericAmount,
          payment_source: paymentSource,
          payment_method: paymentMethod,
          reference_number: referenceNumber.trim() || null,
          notes: remarks.trim() || null,
        },
      });

      toast.success(`${currency(numericAmount)} paid to ${target.teamName} from ${paymentSource === "bank" ? "Bank" : "Petty Cash"}.`);
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.message || "Failed to record team wage payment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handlePay}>
          <DialogHeader className="mb-3">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Users className="size-4 text-primary" /> Pay Team Wages — {target.teamName}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Summary card */}
            <div className="rounded-md border p-3 bg-muted/40 space-y-1.5 font-sans">
              <div className="flex justify-between text-muted-foreground">
                <span>Period / Week Start:</span>
                <span className="font-semibold text-foreground">{dateFmt(target.weekStart)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Team Members:</span>
                <span className="font-semibold text-foreground">{target.membersCount} workers</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Total Earned Wage:</span>
                <span className="font-mono font-semibold text-foreground">{currency(target.totalWageDue)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Already Paid:</span>
                <span className="font-mono text-emerald-600 font-semibold">{currency(target.alreadyPaid)}</span>
              </div>
              <div className="flex justify-between pt-1.5 border-t font-bold text-sm">
                <span>Pending Balance:</span>
                <span className="font-mono text-destructive">{currency(target.pendingAmount)}</span>
              </div>
            </div>

            {/* Payment Amount */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="pay-amt" className="text-xs font-semibold">
                  Payment Amount (₹) <span className="text-destructive font-bold">*</span>
                </Label>
                <div className="space-x-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-5 text-[11px] px-1.5 text-primary"
                    onClick={() => setPaymentAmount(String(target.pendingAmount))}
                  >
                    Pay Full ({currency(target.pendingAmount)})
                  </Button>
                </div>
              </div>
              <Input
                id="pay-amt"
                type="number"
                step="0.01"
                min="1"
                max={target.pendingAmount}
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="Enter payment amount"
                required
                className="h-9 text-sm font-mono font-semibold"
              />
            </div>

            {/* Mandatory Payment Source Selector */}
            <PaymentSourceSelect
              value={paymentSource}
              onChange={(val) => {
                setPaymentSource(val);
                if (val === "bank") setPaymentMethod("bank");
                else if (val === "petty_cash") setPaymentMethod("cash");
              }}
              bankBalance={balances?.bank?.balance ?? 0}
              pettyCashBalance={balances?.petty_cash?.balance ?? 0}
              paymentAmount={numericAmount}
              onOpenMdInvestment={onOpenMdInvestment}
            />

            {/* Date & Reference */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="pay-date" className="text-xs font-semibold block mb-1">
                  Payment Date <span className="text-destructive font-bold">*</span>
                </Label>
                <Input
                  id="pay-date"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              </div>
              <div>
                <Label htmlFor="pay-ref" className="text-xs font-semibold block mb-1">
                  Ref / Voucher #
                </Label>
                <Input
                  id="pay-ref"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="Optional ref"
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            {/* Remarks */}
            <div>
              <Label htmlFor="pay-remarks" className="text-xs font-semibold block mb-1">
                Remarks
              </Label>
              <Textarea
                id="pay-remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
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
              <Banknote className="size-3.5" />
              {isSubmitting ? "Recording..." : `Confirm Payment (${currency(numericAmount)})`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
