import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Split, ArrowDownToLine, Calculator } from "lucide-react";

export type PayableItem = {
  id: string; // unique identifier
  key: string;
  projectId: string;
  projectName: string;
  itemNumber: string; // e.g. "WO-101", "PO-204", "Bill #12"
  itemTitle: string; // description or job type
  date?: string;
  totalAmount: number;
  paidAmount: number;
  pendingBalance: number;
  workOrderId?: string;
  contractorBillId?: string;
  poId?: string;
};

export type AllocationResult = {
  itemId: string;
  projectId: string;
  workOrderId?: string;
  contractorBillId?: string;
  poId?: string;
  amount: number;
  pendingBalance: number;
  remarks?: string;
};

interface PaymentAllocationInputProps {
  items: PayableItem[];
  totalAmount: number;
  onTotalAmountChange: (amount: number) => void;
  selectedItemKeys: string[];
  onSelectedItemKeysChange: (keys: string[]) => void;
  allocations: Record<string, number>; // key -> allocated amount
  onAllocationsChange: (allocations: Record<string, number>) => void;
  onValidityChange?: (isValid: boolean, errorMsg?: string) => void;
}

export function PaymentAllocationInput({
  items,
  totalAmount,
  onTotalAmountChange,
  selectedItemKeys,
  onSelectedItemKeysChange,
  allocations,
  onAllocationsChange,
  onValidityChange,
}: PaymentAllocationInputProps) {
  // Temporary string store for inputs so typing isn't snapped or leading zero trapped
  const [inputStrings, setInputStrings] = useState<Record<string, string>>({});

  // Active items based on selection
  const selectedItems = useMemo(() => {
    return items.filter((it) => selectedItemKeys.includes(it.key));
  }, [items, selectedItemKeys]);

  // Total pending across selected items
  const totalSelectedPending = useMemo(() => {
    return selectedItems.reduce((acc, it) => acc + it.pendingBalance, 0);
  }, [selectedItems]);

  // Current allocated sum
  const totalAllocated = useMemo(() => {
    return selectedItems.reduce((acc, it) => acc + (allocations[it.key] || 0), 0);
  }, [selectedItems, allocations]);

  const diff = useMemo(() => {
    return Math.round((totalAmount - totalAllocated) * 100) / 100;
  }, [totalAmount, totalAllocated]);

  // Validation
  const validation = useMemo(() => {
    if (selectedItems.length === 0) {
      return { isValid: false, message: "Please select at least one item to pay." };
    }
    if (totalAmount <= 0) {
      return { isValid: false, message: "Payment amount must be greater than zero." };
    }
    if (Math.abs(diff) > 0.01) {
      if (diff > 0) {
        return {
          isValid: false,
          message: `Unallocated ₹${diff.toLocaleString("en-IN")}. Total must match allocations exactly.`,
        };
      } else {
        return {
          isValid: false,
          message: `Over-allocated by ₹${Math.abs(diff).toLocaleString("en-IN")}. Reduce item amounts.`,
        };
      }
    }
    for (const it of selectedItems) {
      const amt = allocations[it.key] || 0;
      if (amt < 0) {
        return { isValid: false, message: `Negative amount on ${it.itemNumber} is not allowed.` };
      }
      if (amt > it.pendingBalance + 0.01) {
        return {
          isValid: false,
          message: `${it.itemNumber} allocation (₹${amt}) exceeds pending balance (₹${it.pendingBalance}).`,
        };
      }
    }
    return { isValid: true, message: "Allocations match payment total perfectly." };
  }, [selectedItems, totalAmount, diff, allocations]);

  useEffect(() => {
    onValidityChange?.(validation.isValid, validation.message);
  }, [validation, onValidityChange]);

  // Synchronize input strings whenever allocations or items change
  useEffect(() => {
    setInputStrings((prev) => {
      const next = { ...prev };
      for (const it of items) {
        const val = allocations[it.key] ?? 0;
        if (next[it.key] === undefined || Number(next[it.key]) !== val) {
          next[it.key] = val > 0 ? String(val) : "";
        }
      }
      return next;
    });
  }, [allocations, items]);

  // Strategy 1: Oldest first auto-split
  const splitOldestFirst = useCallback(
    (targetAmount: number) => {
      let remaining = targetAmount;
      const nextAlloc: Record<string, number> = { ...allocations };
      // Sort selected items by date or id
      const sorted = [...selectedItems].sort((a, b) => {
        if (a.date && b.date) return a.date.localeCompare(b.date);
        return a.itemNumber.localeCompare(b.itemNumber);
      });

      for (const it of sorted) {
        if (remaining <= 0) {
          nextAlloc[it.key] = 0;
        } else {
          const allocate = Math.min(it.pendingBalance, remaining);
          nextAlloc[it.key] = Math.round(allocate * 100) / 100;
          remaining -= allocate;
        }
      }
      onAllocationsChange(nextAlloc);
    },
    [selectedItems, allocations, onAllocationsChange]
  );

  // Strategy 2: Proportional auto-split
  const splitProportional = useCallback(
    (targetAmount: number) => {
      if (totalSelectedPending <= 0) return;
      const nextAlloc: Record<string, number> = { ...allocations };
      let allocatedSum = 0;

      selectedItems.forEach((it, idx) => {
        if (idx === selectedItems.length - 1) {
          // Last item gets remainder to avoid rounding penny differences
          const rem = Math.max(0, Math.round((targetAmount - allocatedSum) * 100) / 100);
          nextAlloc[it.key] = Math.min(it.pendingBalance, rem);
        } else {
          const ratio = it.pendingBalance / totalSelectedPending;
          const share = Math.min(it.pendingBalance, Math.round(targetAmount * ratio * 100) / 100);
          nextAlloc[it.key] = share;
          allocatedSum += share;
        }
      });
      onAllocationsChange(nextAlloc);
    },
    [selectedItems, totalSelectedPending, allocations, onAllocationsChange]
  );

  // Shortcut: Pay full balance for all selected
  const handlePayFullBalance = useCallback(() => {
    onTotalAmountChange(totalSelectedPending);
    const nextAlloc: Record<string, number> = { ...allocations };
    selectedItems.forEach((it) => {
      nextAlloc[it.key] = it.pendingBalance;
    });
    onAllocationsChange(nextAlloc);
  }, [totalSelectedPending, selectedItems, allocations, onTotalAmountChange, onAllocationsChange]);

  // Handle single item allocation change
  const handleItemAllocChange = (key: string, rawVal: string, pendingBalance: number) => {
    setInputStrings((prev) => ({ ...prev, [key]: rawVal }));
    const parsed = rawVal.trim() === "" ? 0 : Number(rawVal);
    if (!isNaN(parsed)) {
      onAllocationsChange({
        ...allocations,
        [key]: Math.max(0, parsed),
      });
    }
  };

  // Toggle item selection
  const toggleItem = (key: string) => {
    const isSelected = selectedItemKeys.includes(key);
    let nextKeys: string[];
    if (isSelected) {
      nextKeys = selectedItemKeys.filter((k) => k !== key);
      const nextAlloc = { ...allocations, [key]: 0 };
      onAllocationsChange(nextAlloc);
    } else {
      nextKeys = [...selectedItemKeys, key];
    }
    onSelectedItemKeysChange(nextKeys);
  };

  const toggleAll = () => {
    if (selectedItemKeys.length === items.length) {
      onSelectedItemKeysChange([]);
      const nextAlloc: Record<string, number> = {};
      items.forEach((it) => (nextAlloc[it.key] = 0));
      onAllocationsChange(nextAlloc);
    } else {
      const allKeys = items.map((it) => it.key);
      onSelectedItemKeysChange(allKeys);
      // Auto-split oldest first across all
      splitOldestFirst(totalAmount);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-border/80 bg-card p-4 text-card-foreground shadow-xs">
      {/* Top Bar: Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="alloc-select-all"
            checked={items.length > 0 && selectedItemKeys.length === items.length}
            onCheckedChange={toggleAll}
          />
          <label htmlFor="alloc-select-all" className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Select All ({selectedItemKeys.length}/{items.length} items)
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => splitOldestFirst(totalAmount)}
            disabled={selectedItems.length === 0 || totalAmount <= 0}
          >
            <ArrowDownToLine className="mr-1 h-3.5 w-3.5 text-primary" />
            Oldest First
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => splitProportional(totalAmount)}
            disabled={selectedItems.length === 0 || totalAmount <= 0}
          >
            <Split className="mr-1 h-3.5 w-3.5 text-primary" />
            Proportional
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 text-xs font-medium"
            onClick={handlePayFullBalance}
            disabled={selectedItems.length === 0 || totalSelectedPending <= 0}
          >
            <Calculator className="mr-1 h-3.5 w-3.5" />
            Pay Full Balance (₹{totalSelectedPending.toLocaleString("en-IN")})
          </Button>
        </div>
      </div>

      {/* Items Table / List */}
      <div className="max-h-72 overflow-y-auto rounded-md border">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-muted/80 backdrop-blur-xs font-medium text-muted-foreground border-b">
            <tr>
              <th className="p-2 w-8 text-center"></th>
              <th className="p-2">Item / Order</th>
              <th className="p-2">Project</th>
              <th className="p-2 text-right">Total (₹)</th>
              <th className="p-2 text-right">Paid (₹)</th>
              <th className="p-2 text-right">Pending (₹)</th>
              <th className="p-2 text-right w-36">Allocate (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {items.map((it) => {
              const isSelected = selectedItemKeys.includes(it.key);
              const allocated = allocations[it.key] || 0;
              const hasError = allocated > it.pendingBalance;

              return (
                <tr
                  key={it.key}
                  className={`transition-colors ${
                    isSelected ? "bg-primary/5 hover:bg-primary/10" : "opacity-60 hover:opacity-100"
                  }`}
                >
                  <td className="p-2 text-center">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleItem(it.key)}
                      aria-label={`Select ${it.itemNumber}`}
                    />
                  </td>
                  <td className="p-2">
                    <div className="font-semibold text-foreground">{it.itemNumber}</div>
                    <div className="text-[11px] text-muted-foreground line-clamp-1">{it.itemTitle}</div>
                  </td>
                  <td className="p-2 font-medium text-muted-foreground">
                    <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
                      {it.projectName}
                    </Badge>
                  </td>
                  <td className="p-2 text-right">{it.totalAmount.toLocaleString("en-IN")}</td>
                  <td className="p-2 text-right text-muted-foreground">{it.paidAmount.toLocaleString("en-IN")}</td>
                  <td className="p-2 text-right font-semibold text-foreground">
                    ₹{it.pendingBalance.toLocaleString("en-IN")}
                  </td>
                  <td className="p-2 text-right">
                    <Input
                      type="number"
                      step="any"
                      min={0}
                      max={it.pendingBalance}
                      disabled={!isSelected}
                      value={inputStrings[it.key] ?? ""}
                      placeholder="0"
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => handleItemAllocChange(it.key, e.target.value, it.pendingBalance)}
                      className={`h-7 w-32 ml-auto text-right text-xs font-mono font-medium ${
                        hasError
                          ? "border-destructive text-destructive focus-visible:ring-destructive"
                          : allocated > 0
                          ? "border-emerald-500 font-semibold text-emerald-700 dark:text-emerald-400"
                          : ""
                      }`}
                    />
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  No pending payable items found for this party.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Live Allocation Summary & Indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2 border-t text-xs">
        <div className="p-2 rounded-md bg-muted/50 border">
          <div className="text-muted-foreground">Total Payment Amount</div>
          <div className="text-sm font-bold text-foreground">₹{totalAmount.toLocaleString("en-IN")}</div>
        </div>

        <div className="p-2 rounded-md bg-muted/50 border">
          <div className="text-muted-foreground">Total Allocated</div>
          <div className="text-sm font-bold text-foreground">₹{totalAllocated.toLocaleString("en-IN")}</div>
        </div>

        <div className="p-2 rounded-md bg-muted/50 border">
          <div className="text-muted-foreground">Unallocated Remaining</div>
          <div
            className={`text-sm font-bold ${
              diff > 0.01
                ? "text-amber-600 dark:text-amber-400"
                : diff < -0.01
                ? "text-destructive"
                : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            ₹{Math.abs(diff).toLocaleString("en-IN")}
            {diff < -0.01 ? " (Over)" : diff > 0.01 ? " (Pending)" : " (Balanced)"}
          </div>
        </div>

        <div className="flex items-center gap-1.5 p-2 rounded-md border text-xs">
          {validation.isValid ? (
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{validation.message}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-500 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="line-clamp-2">{validation.message}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
