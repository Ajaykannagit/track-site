import React from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, PlusCircle, Building2, Wallet } from "lucide-react";
import { currency } from "@/lib/format";
import { Button } from "@/components/ui/button";

export type PaymentSourceType = "bank" | "petty_cash";

interface PaymentSourceSelectProps {
  value: PaymentSourceType | "";
  onChange: (val: PaymentSourceType) => void;
  bankBalance?: number;
  pettyCashBalance?: number;
  paymentAmount?: number;
  isInflow?: boolean; // True for client receipt / MD investment (where money is "Received in")
  onOpenMdInvestment?: (() => void) | undefined;
  className?: string;
}

export function PaymentSourceSelect({
  value,
  onChange,
  bankBalance = 0,
  pettyCashBalance = 0,
  paymentAmount = 0,
  isInflow = false,
  onOpenMdInvestment,
  className = "",
}: PaymentSourceSelectProps) {
  const currentSelectedBalance = value === "bank" ? bankBalance : value === "petty_cash" ? pettyCashBalance : null;
  const isNegative = !isInflow && currentSelectedBalance !== null && paymentAmount > 0 && currentSelectedBalance - paymentAmount < 0;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          {isInflow ? (
            <>
              <Building2 className="size-3.5 text-primary" /> Received in (Mandatory)
            </>
          ) : (
            <>
              <Wallet className="size-3.5 text-primary" /> Pay from (Mandatory)
            </>
          )}
          <span className="text-destructive font-bold">*</span>
        </Label>
        {value && currentSelectedBalance !== null && (
          <span className={`text-[11px] font-mono font-medium ${currentSelectedBalance < 0 ? "text-destructive" : "text-muted-foreground"}`}>
            Available: <strong className={currentSelectedBalance < 0 ? "text-destructive" : "text-foreground"}>{currency(currentSelectedBalance)}</strong>
          </span>
        )}
      </div>

      <Select value={value} onValueChange={(val) => onChange(val as PaymentSourceType)}>
        <SelectTrigger className="h-9 text-xs">
          <SelectValue placeholder="-- Choose Bank or Petty Cash --" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="bank">
            <div className="flex items-center justify-between w-full min-w-[210px] gap-2">
              <span className="font-medium">Bank Account</span>
              <span className="text-[11px] font-mono text-muted-foreground">({currency(bankBalance)})</span>
            </div>
          </SelectItem>
          <SelectItem value="petty_cash">
            <div className="flex items-center justify-between w-full min-w-[210px] gap-2">
              <span className="font-medium">Petty Cash</span>
              <span className="text-[11px] font-mono text-muted-foreground">({currency(pettyCashBalance)})</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>

      {/* Warning when payment would push source into negative */}
      {isNegative && (
        <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 p-2 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
          <div className="flex items-start gap-1.5 font-medium">
            <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <span>
              Warning: This payment ({currency(paymentAmount)}) exceeds available {value === "bank" ? "Bank" : "Petty Cash"} balance ({currency(currentSelectedBalance ?? 0)}). Balance will become {currency((currentSelectedBalance ?? 0) - paymentAmount)}.
            </span>
          </div>
          {onOpenMdInvestment && (
            <div className="flex items-center justify-between pt-1 border-t border-amber-200 dark:border-amber-800/60">
              <span className="text-[11px] text-amber-800 dark:text-amber-300">Need funds? Add MD capital infusion:</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onOpenMdInvestment}
                className="h-6 text-[11px] px-2 gap-1 border-amber-300 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50"
              >
                <PlusCircle className="size-3" /> + MD Investment
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
