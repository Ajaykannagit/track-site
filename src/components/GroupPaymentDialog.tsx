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
import { useCreateGroupPayment, useRows } from "@/lib/db";
import { today } from "@/lib/format";
import { Layers, Plus } from "lucide-react";
import { toast } from "sonner";

interface GroupPaymentDialogProps {
  contractors: Array<{ id: string; name: string }>;
  projects: Array<{ id: string; name: string }>;
  workOrders: Array<any>;
  bills: Array<any>;
  existingPayments: Array<any>;
  jobTypes: Array<{ id: string; name: string }>;
  bankAccounts?: Array<{ id: string; name: string; account_number?: string }>;
  defaultMode?: "wo_group" | "multi_project";
}

export function GroupPaymentDialog({
  contractors,
  projects,
  workOrders,
  bills,
  existingPayments,
  jobTypes,
  bankAccounts = [],
  defaultMode = "wo_group",
}: GroupPaymentDialogProps) {
  const [open, setOpen] = useState(false);
  const [contractorId, setContractorId] = useState<string>("");
  const [jobTypeFilter, setJobTypeFilter] = useState<string>("all");
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [paymentDate, setPaymentDate] = useState<string>(today());
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<string>("Bank");
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");

  // Allocation state
  const [selectedItemKeys, setSelectedItemKeys] = useState<string[]>([]);
  const [allocations, setAllocations] = useState<Record<string, number>>({});
  const [isAllocationValid, setIsAllocationValid] = useState<boolean>(false);
  const [allocationError, setAllocationError] = useState<string | undefined>();

  const createGroupPayment = useCreateGroupPayment();

  // Projects where this contractor has work orders or bills
  const contractorProjects = useMemo(() => {
    if (!contractorId) return [];
    const pSet = new Set<string>();
    workOrders.forEach((wo) => {
      if (wo.contractor_id === contractorId && wo.project_id) pSet.add(wo.project_id);
    });
    bills.forEach((b) => {
      if (b.contractor_id === contractorId && b.project_id) pSet.add(b.project_id);
    });
    return projects.filter((p) => pSet.has(p.id));
  }, [contractorId, workOrders, bills, projects]);

  // Handle contractor selection -> auto-select all relevant projects
  const handleContractorChange = (cId: string) => {
    setContractorId(cId);
    setAllocations({});
    setSelectedItemKeys([]);
    setTotalAmount(0);
    // Find all projects for this contractor
    const pIds = new Set<string>();
    workOrders.forEach((wo) => {
      if (wo.contractor_id === cId && wo.project_id) pIds.add(wo.project_id);
    });
    bills.forEach((b) => {
      if (b.contractor_id === cId && b.project_id) pIds.add(b.project_id);
    });
    setSelectedProjectIds(Array.from(pIds));
  };

  // Compile payable items based on filters
  const payableItems = useMemo<PayableItem[]>(() => {
    if (!contractorId) return [];
    const items: PayableItem[] = [];

    // 1. Unbilled or ongoing Work Orders for this contractor
    workOrders.forEach((wo) => {
      if (wo.contractor_id !== contractorId) return;
      if (jobTypeFilter !== "all" && wo.job_type_id !== jobTypeFilter) return;
      if (selectedProjectIds.length > 0 && !selectedProjectIds.includes(wo.project_id)) return;

      // Paid against this WO (either directly or via bills)
      const paidAgainstWo = existingPayments
        .filter((p) => !p.is_void && (p.work_order_id === wo.id || (p.bill_id && bills.find((b) => b.id === p.bill_id)?.work_order_id === wo.id)))
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      const contractAmount = Number(wo.contract_amount) || 0;
      const pendingBalance = Math.max(0, contractAmount - paidAgainstWo);

      if (pendingBalance > 0) {
        const pName = projects.find((p) => p.id === wo.project_id)?.name ?? "Unknown Project";
        const jtName = jobTypes.find((jt) => jt.id === wo.job_type_id)?.name;
        items.push({
          id: wo.id,
          key: `wo_${wo.id}`,
          projectId: wo.project_id,
          projectName: pName,
          itemNumber: wo.work_order_number,
          itemTitle: jtName ? `[${jtName}] ${wo.work_description || "Work Order"}` : wo.work_description || "Work Order",
          date: wo.wo_date,
          totalAmount: contractAmount,
          paidAmount: paidAgainstWo,
          pendingBalance,
          workOrderId: wo.id,
        });
      }
    });

    // 2. Verified/Approved Contractor Bills
    bills.forEach((bill) => {
      if (bill.contractor_id !== contractorId) return;
      if (selectedProjectIds.length > 0 && !selectedProjectIds.includes(bill.project_id)) return;

      const paidAgainstBill = existingPayments
        .filter((p) => !p.is_void && p.bill_id === bill.id)
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

      const netAmount = Number(bill.net_amount) || 0;
      const pendingBalance = Math.max(0, netAmount - paidAgainstBill);

      if (pendingBalance > 0) {
        // Only include if not already represented by a WO line or bill is standalone
        const pName = projects.find((p) => p.id === bill.project_id)?.name ?? "Unknown Project";
        items.push({
          id: bill.id,
          key: `bill_${bill.id}`,
          projectId: bill.project_id,
          projectName: pName,
          itemNumber: bill.bill_number,
          itemTitle: bill.remarks ? `Bill: ${bill.remarks}` : "Contractor Bill",
          date: bill.bill_date,
          totalAmount: netAmount,
          paidAmount: paidAgainstBill,
          pendingBalance,
          contractorBillId: bill.id,
          workOrderId: bill.work_order_id ?? undefined,
        });
      }
    });

    return items;
  }, [contractorId, jobTypeFilter, selectedProjectIds, workOrders, bills, existingPayments, projects, jobTypes]);

  // Reset dialog on open
  const handleOpenChange = (v: boolean) => {
    setOpen(v);
    if (!v) {
      setContractorId("");
      setJobTypeFilter("all");
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
    if (!contractorId) {
      toast.error("Please select a contractor.");
      return;
    }
    if (!isAllocationValid) {
      toast.error(allocationError || "Allocation validation failed.");
      return;
    }

    // Build payload allocations
    const allocationPayload = selectedItemKeys
      .map((k) => {
        const item = payableItems.find((it) => it.key === k);
        const amount = allocations[k] || 0;
        if (!item || amount <= 0) return null;
        return {
          project_id: item.projectId,
          work_order_id: item.workOrderId || null,
          contractor_bill_id: item.contractorBillId || null,
          allocated_amount: amount,
          remarks: `Group payment allocated to ${item.itemNumber}`,
        };
      })
      .filter(Boolean) as Array<{
        project_id: string;
        work_order_id: string | null;
        contractor_bill_id: string | null;
        allocated_amount: number;
        remarks: string;
      }>;

    if (allocationPayload.length === 0) {
      toast.error("No valid allocations to save.");
      return;
    }

    try {
      await createGroupPayment.mutateAsync({
        payment_type: "contractor",
        party_id: contractorId,
        payment_date: paymentDate,
        total_amount: totalAmount,
        payment_mode: paymentMode,
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
          <span>{defaultMode === "wo_group" ? "Group Payment (By Job Type)" : "Multi-Project Payment"}</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Layers className="size-5 text-primary" />
            <span>
              {defaultMode === "wo_group"
                ? "Consolidated Work Order Payment by Job Type"
                : "Multi-Project Contractor Payment"}
            </span>
          </DialogTitle>
          <div className="text-xs text-muted-foreground">
            Pay a contractor across multiple work orders or sites in ONE transaction. Outflow is counted once in the cash
            ledger while each project receives its exact allocated cost.
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Row 1: Contractor & Job Type */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">
                Contractor <span className="text-destructive">*</span>
              </Label>
              <Select value={contractorId} onValueChange={handleContractorChange}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select contractor" />
                </SelectTrigger>
                <SelectContent>
                  {contractors.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Filter by Job Type</Label>
              <Select value={jobTypeFilter} onValueChange={setJobTypeFilter}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="All Job Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    All Job Types
                  </SelectItem>
                  {jobTypes.map((jt) => (
                    <SelectItem key={jt.id} value={jt.id} className="text-xs">
                      {jt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Projects Included</Label>
              <div className="text-xs text-muted-foreground pt-1.5 truncate">
                {contractorProjects.length === 0
                  ? "Select a contractor first"
                  : `${selectedProjectIds.length} of ${contractorProjects.length} sites with pending work`}
              </div>
            </div>
          </div>

          {/* Row 2: Multi-Project Selection Chips */}
          {contractorProjects.length > 0 && (
            <div className="space-y-1.5 rounded-md border p-2.5 bg-muted/30">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Select Sites / Projects:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedProjectIds.length === contractorProjects.length) {
                      setSelectedProjectIds([]);
                    } else {
                      setSelectedProjectIds(contractorProjects.map((p) => p.id));
                    }
                  }}
                  className="text-[11px] text-primary hover:underline font-medium"
                >
                  {selectedProjectIds.length === contractorProjects.length ? "Deselect All" : "Select All Projects"}
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                {contractorProjects.map((p) => {
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
          {contractorId && (
            <div className="space-y-1">
              <Label className="text-xs font-semibold">
                Allocate to Work Orders &amp; Bills ({payableItems.length} items available)
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
              placeholder="e.g. Paid against same gauge work across Site A, B, C"
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
              disabled={createGroupPayment.isPending || !contractorId || !isAllocationValid}
              className="text-xs font-semibold"
            >
              {createGroupPayment.isPending ? "Recording Payment..." : "Save Consolidated Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
