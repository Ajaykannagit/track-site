import { useState, useEffect } from "react";
import { Plus, Trash2, Truck, ArrowDownToLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { currency, today } from "@/lib/format";
import { supabase as typedSupabase } from "@/integrations/supabase/client";
import { useSaveRow } from "@/lib/db";
import { logRecordFieldDiffs } from "@/lib/audit";
import { toast } from "sonner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = typedSupabase as any;

export type ReceiptLineItem = {
  id?: string;
  po_item_id?: string | null;
  material: string;
  unit?: string | null;
  ordered_quantity?: number;
  received_quantity: number;
  rate: number;
  amount: number;
};

interface Props {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  projectOptions: { value: string; label: string }[];
  supplierOptions: { value: string; label: string }[];
  poOptions: { value: string; label: string }[];
  editingReceipt?: {
    id: string;
    receipt_number: string;
    project_id: string;
    supplier_id: string | null;
    po_id: string | null;
    receipt_date: string;
    total_amount: number;
    remarks: string | null;
  } | null;
  onSuccess?: () => void;
}

const emptyItem = (): ReceiptLineItem => ({
  material: "",
  unit: "nos",
  ordered_quantity: 0,
  received_quantity: 1,
  rate: 0,
  amount: 0,
});

export function MultiMaterialReceiptDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  projectOptions,
  supplierOptions,
  poOptions,
  editingReceipt,
  onSuccess,
}: Props) {
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = controlledOpen ?? uncontrolled;
  const setOpen = onOpenChange ?? setUncontrolled;

  const [receiptNumber, setReceiptNumber] = useState("");
  const [projectId, setProjectId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [poId, setPoId] = useState("");
  const [receiptDate, setReceiptDate] = useState(today());
  const [remarks, setRemarks] = useState("");
  const [editReason, setEditReason] = useState("");
  const [items, setItems] = useState<ReceiptLineItem[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);

  const saveReceipt = useSaveRow("material_receipts", "Material Receipt");

  useEffect(() => {
    if (open) {
      if (editingReceipt) {
        setReceiptNumber(editingReceipt.receipt_number);
        setProjectId(editingReceipt.project_id);
        setSupplierId(editingReceipt.supplier_id ?? "");
        setPoId(editingReceipt.po_id ?? "");
        setReceiptDate(editingReceipt.receipt_date);
        setRemarks(editingReceipt.remarks ?? "");
        setEditReason("");

        // Load existing receipt line items
        supabase
          .from("material_receipt_items")
          .select("*")
          .eq("receipt_id", editingReceipt.id)
          .then(({ data }: any) => {
            if (data && data.length > 0) {
              setItems(
                data.map((d: any) => ({
                  id: d.id,
                  po_item_id: d.po_item_id,
                  material: d.material,
                  unit: d.unit ?? "",
                  ordered_quantity: Number(d.ordered_quantity ?? 0),
                  received_quantity: Number(d.received_quantity ?? 0),
                  rate: Number(d.rate ?? 0),
                  amount: Number(d.amount ?? 0),
                }))
              );
            } else {
              setItems([emptyItem()]);
            }
          });
      } else {
        setReceiptNumber(`GRN-${Date.now().toString().slice(-8)}`);
        setProjectId(projectOptions[0]?.value ?? "");
        setSupplierId(supplierOptions[0]?.value ?? "");
        setPoId("");
        setReceiptDate(today());
        setRemarks("");
        setEditReason("");
        setItems([emptyItem()]);
      }
    }
  }, [open, editingReceipt, projectOptions, supplierOptions]);

  // When a PO is selected, optionally pull its line items
  const handlePoSelected = async (selectedPoId: string) => {
    setPoId(selectedPoId);
    if (!selectedPoId || selectedPoId === "none") return;

    try {
      const { data: poData } = await supabase
        .from("purchase_orders")
        .select("*")
        .eq("id", selectedPoId)
        .single();

      if (poData?.project_id) setProjectId(poData.project_id);
      if (poData?.supplier_id) setSupplierId(poData.supplier_id);

      const { data: poItems } = await supabase
        .from("purchase_order_items")
        .select("*")
        .eq("po_id", selectedPoId);

      if (poItems && poItems.length > 0) {
        setItems(
          poItems.map((i: any) => ({
            po_item_id: i.id,
            material: i.material,
            unit: i.unit ?? "",
            ordered_quantity: Number(i.quantity ?? 0),
            received_quantity: Number(i.quantity ?? 0),
            rate: Number(i.rate ?? 0),
            amount: Number(i.amount ?? 0),
          }))
        );
        toast.info(`Imported ${poItems.length} materials from PO ${poData?.po_number || ""}`);
      }
    } catch {
      // ignore
    }
  };

  const updateItem = (index: number, field: keyof ReceiptLineItem, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: value } as ReceiptLineItem;
      const qty = Number(item.received_quantity ?? 0);
      const rate = Number(item.rate ?? 0);
      item.amount = Math.round(qty * rate * 100) / 100;
      next[index] = item;
      return next;
    });
  };

  const addItem = () => {
    setItems((prev) => [...prev, emptyItem()]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) {
      toast.error("A material receipt must have at least one material.");
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const totalAmount = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      toast.error("Please select a project.");
      return;
    }
    const validItems = items.filter((i) => i.material.trim());
    if (validItems.length === 0) {
      toast.error("Please enter at least one material name.");
      return;
    }

    if (editingReceipt && !editReason.trim()) {
      toast.error("Please provide a reason for editing this receipt.");
      return;
    }

    try {
      setSaving(true);
      const isEdit = !!editingReceipt;
      let receiptId = editingReceipt?.id;

      if (isEdit && editingReceipt) {
        await logRecordFieldDiffs(
          "material_receipts",
          editingReceipt.id,
          "materials",
          editingReceipt as Record<string, unknown>,
          {
            total_amount: totalAmount,
            remarks,
          },
          ["total_amount", "remarks"],
          editReason,
          "corrected"
        );

        await saveReceipt.mutateAsync({
          id: editingReceipt.id,
          values: {
            receipt_number: receiptNumber,
            project_id: projectId,
            supplier_id: supplierId || null,
            po_id: poId || null,
            receipt_date: receiptDate,
            total_amount: totalAmount,
            remarks: remarks || null,
          },
        });
      } else {
        const res = await saveReceipt.mutateAsync({
          values: {
            receipt_number: receiptNumber,
            project_id: projectId,
            supplier_id: supplierId || null,
            po_id: poId || null,
            receipt_date: receiptDate,
            total_amount: totalAmount,
            remarks: remarks || null,
          },
        });
        receiptId = res;
      }

      // Save line items
      if (receiptId) {
        if (isEdit) {
          await supabase.from("material_receipt_items").delete().eq("receipt_id", receiptId);
        }

        const itemsToInsert = validItems.map((item) => ({
          receipt_id: receiptId,
          po_item_id: item.po_item_id || null,
          material: item.material.trim(),
          unit: item.unit?.trim() || null,
          ordered_quantity: Number(item.ordered_quantity) || 0,
          received_quantity: Number(item.received_quantity) || 0,
          rate: Number(item.rate) || 0,
          amount: Number(item.amount) || 0,
        }));

        await supabase.from("material_receipt_items").insert(itemsToInsert);
      }

      toast.success(isEdit ? "Receipt updated successfully" : "Material Receipt recorded with multiple materials");
      setOpen(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save material receipt.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Truck className="size-5 text-primary" />
              {editingReceipt ? `Edit Material Receipt — ${editingReceipt.receipt_number}` : "Record Material Receipt (GRN)"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Log site delivery of materials against a Purchase Order or direct delivery. Enter multiple received materials.
            </DialogDescription>
          </DialogHeader>

          {/* Header fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-muted/40 rounded-lg border">
            <div>
              <Label className="text-xs mb-1 block">GRN Number *</Label>
              <Input
                value={receiptNumber}
                onChange={(e) => setReceiptNumber(e.target.value)}
                required
                className="h-8 text-xs font-mono"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Against PO (Optional)</Label>
              <Select value={poId || "none"} onValueChange={(v) => handlePoSelected(v === "none" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select PO..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Direct Delivery (No PO)</SelectItem>
                  {poOptions.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Project *</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projectOptions.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Supplier (Optional)</Label>
              <Select value={supplierId || "none"} onValueChange={(v) => setSupplierId(v === "none" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select supplier..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {supplierOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Receipt Date *</Label>
              <Input
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                required
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Delivery Remarks</Label>
              <Input
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Delivery challan #1234"
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Line items table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Received Materials ({items.length} items)
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addItem}
                className="h-7 text-xs border-primary/40 text-primary hover:bg-primary/10"
              >
                <Plus className="mr-1 size-3.5" /> + Add More Material
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs bg-muted/60">
                    <TableHead className="w-[35%]">Material Received *</TableHead>
                    <TableHead className="w-[15%]">Unit</TableHead>
                    <TableHead className="w-[15%] text-right">Qty Received *</TableHead>
                    <TableHead className="w-[15%] text-right">Rate (₹)</TableHead>
                    <TableHead className="w-[15%] text-right">Amount (₹)</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, idx) => (
                    <TableRow key={idx} className="hover:bg-muted/30">
                      <TableCell className="p-1.5">
                        <Input
                          value={item.material}
                          onChange={(e) => updateItem(idx, "material", e.target.value)}
                          placeholder="e.g. River Sand"
                          required
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell className="p-1.5">
                        <Input
                          value={item.unit ?? ""}
                          onChange={(e) => updateItem(idx, "unit", e.target.value)}
                          placeholder="cft/ton/bag"
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell className="p-1.5">
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          value={item.received_quantity || ""}
                          onChange={(e) => updateItem(idx, "received_quantity", e.target.value)}
                          required
                          className="h-8 text-xs text-right"
                        />
                      </TableCell>
                      <TableCell className="p-1.5">
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          value={item.rate || ""}
                          onChange={(e) => updateItem(idx, "rate", e.target.value)}
                          className="h-8 text-xs text-right"
                        />
                      </TableCell>
                      <TableCell className="p-1.5 text-right font-mono font-medium text-xs">
                        {currency(item.amount)}
                      </TableCell>
                      <TableCell className="p-1.5 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:bg-destructive/10"
                          onClick={() => removeItem(idx)}
                          disabled={items.length <= 1}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between p-3 border-t bg-muted/30">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={addItem}
                  className="h-7 text-xs text-primary"
                >
                  <Plus className="mr-1 size-3.5" /> + Add More Material
                </Button>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground mr-3">Received Total Value:</span>
                  <span className="font-bold text-base font-mono text-foreground">{currency(totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {editingReceipt && (
            <div className="border border-red-200 dark:border-red-950 bg-red-500/5 p-3 rounded-lg space-y-1">
              <Label className="text-xs font-semibold text-destructive block">
                Reason for edit <span className="text-destructive">*</span>
              </Label>
              <Input
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Explain why this receipt is being modified (notifies MD)..."
                required
                className="h-8 text-xs"
              />
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving Receipt…" : editingReceipt ? "Save Receipt Changes" : "Save Material Receipt"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
