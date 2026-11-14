import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PaymentAllocationInput, type PayableItem } from "@/components/PaymentAllocationInput";
import { PaymentSourceSelect, type PaymentSourceType } from "@/components/PaymentSourceSelect";
import { useAccountBalances } from "@/lib/db";
import { useCreateGroupPayment } from "@/lib/db";
import { today } from "@/lib/format";
import { Layers } from "lucide-react";
import { toast } from "sonner";

interface SupplierGroupPaymentDialogProps {
  suppliers: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string }>;
  purchaseOrders: Array<any>;
  existingPayments: Array<any>;
  bankAccounts?: Array<{ id: string; name: string; account_number?: string }>;
}

export function SupplierGroupPaymentDialog({
  suppliers,
  projects,
  purchaseOrders,
  existingPayments,
  bankAccounts = [],
}: SupplierGroupPaymentDialogProps) {
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState<string>("");
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [paymentDate, setPaymentDate] = useState<string>(today());
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<string>("Bank");
  const [paymentSource, setPaymentSource] = useState<PaymentSourceType | "">("bank");
  const { data: balances } = useAccountBalances();
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");

  // Allocation state
  const [selectedItemKeys, setSelectedItemKeys] = useState<string[]>([]);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [isAllocationValid, setIsAllocationValid] = useState<boolean>(false);
  const [allocationError, setAllocationError] = useState<string | undefined>();

  const createGroupPayment = useCreateGroupPayment();

  // Projects where this supplier has active purchase orders
  const supplierProjects = useMemo(() => {
    if (!supplierId) return [];
    const pSet = new Set<string>();
    purchaseOrders.forEach((po) => {
      if (po.supplier_id === supplierId && po.project_id) pSet.add(po.project_id);
    });
    return projects.filter((p) => pSet.has(p.id));
  }, [supplierId, purchaseOrders, projects]);

  // Handle supplier change -> auto-select all projects
  const handleSupplierChange = (sId: string) => {
    setSupplierId(sId);
    setAllocations({});
    setSelectedItemKeys([]);
    setTotalAmount(0);
    const pIds = new Set<string>();
    purchaseOrders.forEach((po) => {
      if (po.supplier_id === sId && po.project_id) pIds.add(po.project_id);
    });
    setSelectedProjectIds(Array.from(pIds));
  };

  // Compile payable items (POs with pending balance)
  const payableItems = useMemo<PayableItem[]>(() => {
    if (!supplierId) return [];
    const items: PayableItem[] = [];

    purchaseOrders.forEach((po) => {
      if (po.supplier_id !== supplierId) return;
      if (selectedProjectIds.length > 0 && !selectedProjectIds.includes(po.project_id)) return;

      const paidAgainstPo = existingPayments
        .filter((p) => !p.is_void && p.po_id === po.id)
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      const poTotal = Number(po.total_amount) || 0;
      const pendingBalance = Math.max(0, poTotal - paidAgainstPo);

      if (pendingBalance > 0) {
        const pName = projects.find((p) => p.id === po.project_id)?.name ?? "Unknown Project";
        items.push({
          id: po.id,
          key: `po_${po.id}`,
          projectId: po.project_id,
          projectName: pName,
          itemNumber: po.po_number,
          itemTitle: po.remarks ? `PO: ${po.remarks}` : "Purchase Order",
          date: po.po_date,
          totalAmount: poTotal,
          paidAmount: paidAgainstPo,
          pendingBalance,
          poId: po.id,
        });
      }
    });

    return items;
  }, [supplierId, selectedProjectIds, purchaseOrders, existingPayments, projects]);

  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setSupplierId("");
      setSelectedProjectIds([]);
      setTotalAmount(0);
      setAllocations({});
      setSelectedItemKeys([]);
      setRemarks("");
      setReferenceNumber("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      toast.error("Please select a supplier.");
      return;
    }
    if (!isAllocationValid) {
      toast.error(allocationError || "Allocation validation failed.");
      return;
    }

    const allocationPayload = selectedItemKeys
      .map((k) => {
        const item = payableItems.find((it) => it.key === k);
        const amount = allocations[k] || 0;
        if (!item || amount <= 0) return null;
        return {
          project_id: item.projectId,
          po_id: item.poId || null,
          allocated_amount: amount,
          remarks: `Multi-project payment allocated to ${item.itemNumber}`,
        };
      })
      .filter(Boolean) as Array<{
        project_id: string;
        po_id: string | null;
        allocated_amount: number;
        remarks: string;
      }>;

    if (allocationPayload.length === 0) {
      toast.error("No valid allocations to save.");
      return;
    }

    try {
      await createGroupPayment.mutateAsync({
        payment_type: "supplier",
        party_id: supplierId,
        payment_date: paymentDate,
        total_amount: totalAmount,
        payment_mode: paymentMode,
        payment_source: (paymentSource || "bank") as any,
        reference_number: referenceNumber || null,
        bank_account_id: bankAccountId || null,
        remarks: remarks || null,
        allocations: allocationPayload,
      });
      setOpen(false);
    } catch (err: any) {
      // Handled in mutate onError
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="default" className="gap-1.5 shadow-sm">
          <Layers className="size-4" />
          <span>Multi-Project Supplier Payment</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Layers className="size-5 text-primary" />
            <span>Multi-Project Material Supplier Payment</span>
          </DialogTitle>
          <div className="text-xs text-muted-foreground">
            Pay a material supplier across multiple construction projects in ONE transaction (e.g. steel deliveries
            across 3-4 sites). Outflow is registered once, and each project receives its allocated expense.
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Row 1: Supplier Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">
                Material Supplier <span className="text-destructive">*</span>
              </Label>
              <Select value={supplierId} onValueChange={handleSupplierChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Projects Included</Label>
              <div className="text-xs text-muted-foreground pt-1.5 truncate">
                {supplierProjects.length === 0
                  ? "Select a supplier first"
                  : `${selectedProjectIds.length} of ${supplierProjects.length} sites with pending orders`}
              </div>
            </div>
          </div>

          {/* Row 2: Multi-Project Selection Chips */}
          {supplierProjects.length > 0 && (
            <div className="space-y-1.5 rounded-md border p-2.5 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Select Projects / Sites:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedProjectIds.length === supplierProjects.length) {
                      setSelectedProjectIds([]);
                    } else {
                      setSelectedProjectIds(supplierProjects.map((p) => p.id));
                    }
                  }}
                  className="text-[11px] text-primary hover:underline font-medium"
                >
                  {selectedProjectIds.length === supplierProjects.length ? "Deselect All" : "Select All Projects"}
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {supplierProjects.map((p) => {
                  const isChecked = selectedProjectIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedProjectIds((prev) =>
                          isChecked ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                        );
                      }}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                        isChecked
                          ? "bg-primary text-primary-foreground border-primary font-medium shadow-xs"
                          : "bg-background text-muted-foreground border-border hover:border-foreground"
                      }`}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Row 3: Payment Details */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-md bg-muted/40 border">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">
                Total Payment Amount (₹) <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                step="any"
                min={0}
                value={totalAmount === 0 ? "" : totalAmount}
                placeholder="0"
                onFocus={(e) => e.target.select()}
                onChange={(e) => setTotalAmount(Number(e.target.value) || 0)}
                className="h-8 text-xs font-mono font-bold"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">
                Payment Date <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Mode</Label>
              <Select value={paymentMode} onValueChange={setPaymentMode}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["Bank", "Cash", "UPI", "Cheque", "NEFT", "RTGS"].map((m) => (
                    <SelectItem key={m} value={m} className="text-xs">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">UTR / Ref #</Label>
              <Input
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="Cheque / UTR number"
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Row 4: Shared Payment Allocation Component */}
          {supplierId && (
            <div className="space-y-1">
              <Label className="text-xs font-semibold">
                Allocate to Purchase Orders ({payableItems.length} orders available)
              </Label>
              <PaymentAllocationInput
                items={payableItems}
                totalAmount={totalAmount}
                onTotalAmountChange={setTotalAmount}
                selectedItemKeys={selectedItemKeys}
                onSelectedItemKeysChange={setSelectedItemKeys}
                allocations={allocations}
                onAllocationsChange={setAllocations}
                onValidityChange={(valid, msg) => {
                  setIsAllocationValid(valid);
                  setAllocationError(msg);
                }}
              />
            </div>
          )}

          {/* Row 5: Remarks */}
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Remarks</Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Steel payment for 3 projects"
              rows={2}
              className="text-xs resize-none"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createGroupPayment.isPending || !supplierId || !isAllocationValid}
              className="text-xs font-semibold"
            >
              {createGroupPayment.isPending ? "Recording Payment..." : "Save Multi-Project Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
