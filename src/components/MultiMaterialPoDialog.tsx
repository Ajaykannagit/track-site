import { useState, useEffect } from "react";
import { Plus, Trash2, ShoppingCart, ArrowDownToLine } from "lucide-react";
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
import type { MaterialLineItem } from "./MultiMaterialIndentDialog";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = typedSupabase as any;

interface Props {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  projectOptions: { value: string; label: string }[];
  supplierOptions: { value: string; label: string }[];
  indentOptions: { value: string; label: string }[];
  editingPo?: {
    id: string;
    po_number: string;
    project_id: string;
    supplier_id: string | null;
    request_id?: string | null;
    po_date: string;
    status: string;
    subtotal: number;
    tax_percent: number;
    tax_amount: number;
    total_amount: number;
    terms?: string | null;
  } | null;
  onSuccess?: () => void;
}

const emptyItem = (): MaterialLineItem => ({
  material: "",
  specification: "",
  unit: "bag",
  quantity: 1,
  rate: 0,
  amount: 0,
});

export function MultiMaterialPoDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  projectOptions,
  supplierOptions,
  indentOptions,
  editingPo,
  onSuccess,
}: Props) {
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = controlledOpen ?? uncontrolled;
  const setOpen = onOpenChange ?? setUncontrolled;

  const [poNumber, setPoNumber] = useState("");
  const [projectId, setProjectId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [requestId, setRequestId] = useState("");
  const [poDate, setPoDate] = useState(today());
  const [status, setStatus] = useState("draft");
  const [taxPercent, setTaxPercent] = useState<number>(18);
  const [terms, setTerms] = useState("");
  const [editReason, setEditReason] = useState("");
  const [items, setItems] = useState<MaterialLineItem[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);

  const savePo = useSaveRow("purchase_orders", "Purchase Order");

  useEffect(() => {
    if (open) {
      if (editingPo) {
        setPoNumber(editingPo.po_number);
        setProjectId(editingPo.project_id);
        setSupplierId(editingPo.supplier_id ?? "");
        setRequestId(editingPo.request_id ?? "");
        setPoDate(editingPo.po_date);
        setStatus(editingPo.status);
        setTaxPercent(editingPo.tax_percent ?? 18);
        setTerms(editingPo.terms ?? "");
        setEditReason("");

        // Load existing PO line items
        supabase
          .from("purchase_order_items")
          .select("*")
          .eq("po_id", editingPo.id)
          .then(({ data }: any) => {
            if (data && data.length > 0) {
              setItems(
                data.map((d: any) => ({
                  id: d.id,
                  material: d.material,
                  specification: d.specification ?? "",
                  unit: d.unit ?? "",
                  quantity: Number(d.quantity ?? 0),
                  rate: Number(d.rate ?? 0),
                  amount: Number(d.amount ?? 0),
                }))
              );
            } else {
              setItems([emptyItem()]);
            }
          });
      } else {
        setPoNumber(`PO-${Date.now().toString().slice(-8)}`);
        setProjectId(projectOptions[0]?.value ?? "");
        setSupplierId(supplierOptions[0]?.value ?? "");
        setRequestId("");
        setPoDate(today());
        setStatus("draft");
        setTaxPercent(18);
        setTerms("");
        setEditReason("");
        setItems([emptyItem()]);
      }
    }
  }, [open, editingPo, projectOptions, supplierOptions]);

  // When an indent is selected, optionally pull its line items
  const handleIndentSelected = async (indentId: string) => {
    setRequestId(indentId);
    if (!indentId || indentId === "none") return;

    try {
      // Find indent parent for project id
      const { data: indentData } = await supabase
        .from("material_requests")
        .select("*")
        .eq("id", indentId)
        .single();

      if (indentData?.project_id) {
        setProjectId(indentData.project_id);
      }

      // Fetch items for this indent
      const { data: indentItems } = await supabase
        .from("material_request_items")
        .select("*")
        .eq("request_id", indentId);

      if (indentItems && indentItems.length > 0) {
        setItems(
          indentItems.map((i: any) => ({
            material: i.material,
            specification: i.specification ?? "",
            unit: i.unit ?? "",
            quantity: Number(i.quantity ?? 0),
            rate: Number(i.rate ?? 0),
            amount: Number(i.amount ?? 0),
          }))
        );
        toast.info(`Imported ${indentItems.length} materials from Indent ${indentData?.request_number || ""}`);
      }
    } catch {
      // ignore
    }
  };

  const updateItem = (index: number, field: keyof MaterialLineItem, value: any) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], [field]: value };
      if (field === "quantity" || field === "rate") {
        const qty = field === "quantity" ? Number(value) || 0 : item.quantity;
        const rate = field === "rate" ? Number(value) || 0 : item.rate;
        item.amount = Math.round(qty * rate * 100) / 100;
      }
      next[index] = item;
      return next;
    });
  };

  const addItem = () => {
    setItems((prev) => [...prev, emptyItem()]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) {
      toast.error("A purchase order must have at least one material.");
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const subtotal = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const taxAmount = Math.round((subtotal * (Number(taxPercent) || 0)) / 100);
  const totalAmount = subtotal + taxAmount;

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

    if (editingPo && !editReason.trim()) {
      toast.error("Please provide a reason for editing this purchase order.");
      return;
    }

    try {
      setSaving(true);
      const isEdit = !!editingPo;
      let poId = editingPo?.id;

      if (isEdit && editingPo) {
        await logRecordFieldDiffs(
          "purchase_orders",
          editingPo.id,
          "materials",
          editingPo as Record<string, unknown>,
          {
            status,
            subtotal,
            tax_percent: taxPercent,
            tax_amount: taxAmount,
            total_amount: totalAmount,
            terms,
          },
          ["status", "subtotal", "tax_percent", "tax_amount", "total_amount", "terms"],
          editReason,
          "corrected"
        );

        await savePo.mutateAsync({
          id: editingPo.id,
          values: {
            po_number: poNumber,
            project_id: projectId,
            supplier_id: supplierId || null,
            request_id: requestId || null,
            po_date: poDate,
            status,
            subtotal,
            tax_percent: taxPercent,
            tax_amount: taxAmount,
            total_amount: totalAmount,
            terms: terms || null,
          },
        });
      } else {
        const res = await savePo.mutateAsync({
          values: {
            po_number: poNumber,
            project_id: projectId,
            supplier_id: supplierId || null,
            request_id: requestId || null,
            po_date: poDate,
            status,
            subtotal,
            tax_percent: taxPercent,
            tax_amount: taxAmount,
            total_amount: totalAmount,
            terms: terms || null,
          },
        });
        poId = res;
      }

      // Save line items
      if (poId) {
        if (isEdit) {
          await supabase.from("purchase_order_items").delete().eq("po_id", poId);
        }

        const itemsToInsert = validItems.map((item) => ({
          po_id: poId,
          material: item.material.trim(),
          specification: item.specification?.trim() || null,
          unit: item.unit?.trim() || null,
          quantity: Number(item.quantity) || 0,
          rate: Number(item.rate) || 0,
          amount: Number(item.amount) || 0,
        }));

        await supabase.from("purchase_order_items").insert(itemsToInsert);
      }

      toast.success(isEdit ? "PO updated successfully" : "Purchase Order created with multiple materials");
      setOpen(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save purchase order.");
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
              <ShoppingCart className="size-5 text-primary" />
              {editingPo ? `Edit Purchase Order — ${editingPo.po_number}` : "Create Purchase Order (PO)"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Issue a purchase order to a supplier. You can import materials from an Indent or enter multiple materials manually.
            </DialogDescription>
          </DialogHeader>

          {/* Header fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-muted/40 rounded-lg border">
            <div>
              <Label className="text-xs mb-1 block">PO Number *</Label>
              <Input
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                required
                className="h-8 text-xs font-mono"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Against Indent (Optional)</Label>
              <Select value={requestId || "none"} onValueChange={(v) => handleIndentSelected(v === "none" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select indent..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (Direct PO)</SelectItem>
                  {indentOptions.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
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
              <Label className="text-xs mb-1 block">Supplier *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {supplierOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">PO Date *</Label>
              <Input
                type="date"
                value={poDate}
                onChange={(e) => setPoDate(e.target.value)}
                required
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["draft", "approved", "ordered", "partially_received", "received", "closed"].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace(/_/g, " ").toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Line items table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-foreground">
                PO Materials ({items.length} items)
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
                    <TableHead className="w-[30%]">Material Name *</TableHead>
                    <TableHead className="w-[22%]">Specification</TableHead>
                    <TableHead className="w-[12%]">Unit</TableHead>
                    <TableHead className="w-[12%] text-right">Quantity *</TableHead>
                    <TableHead className="w-[12%] text-right">Rate (₹) *</TableHead>
                    <TableHead className="w-[12%] text-right">Amount (₹)</TableHead>
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
                          placeholder="e.g. TMT Steel 16mm"
                          required
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell className="p-1.5">
                        <Input
                          value={item.specification ?? ""}
                          onChange={(e) => updateItem(idx, "specification", e.target.value)}
                          placeholder="e.g. Fe500D Grade"
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell className="p-1.5">
                        <Input
                          value={item.unit ?? ""}
                          onChange={(e) => updateItem(idx, "unit", e.target.value)}
                          placeholder="kg/ton/nos"
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell className="p-1.5">
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          value={item.quantity || ""}
                          onChange={(e) => updateItem(idx, "quantity", e.target.value)}
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
                          required
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

              {/* Totals and Tax calculation */}
              <div className="p-3 border-t bg-muted/30 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={addItem}
                    className="h-7 text-xs text-primary"
                  >
                    <Plus className="mr-1 size-3.5" /> + Add More Material
                  </Button>
                  <div className="mt-2">
                    <Label className="text-xs mb-1 block">Payment Terms & Remarks</Label>
                    <Textarea
                      value={terms}
                      onChange={(e) => setTerms(e.target.value)}
                      placeholder="e.g. 50% advance, 50% on delivery..."
                      rows={2}
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-right sm:border-l sm:pl-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-mono font-medium">{currency(subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">GST / Tax Rate:</span>
                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={taxPercent}
                        onChange={(e) => setTaxPercent(Number(e.target.value) || 0)}
                        className="w-16 h-7 text-xs text-right font-mono"
                      />
                      <span>%</span>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax Amount:</span>
                    <span className="font-mono font-medium">{currency(taxAmount)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1.5 text-sm font-bold">
                    <span>PO Total Amount:</span>
                    <span className="font-mono text-primary text-base">{currency(totalAmount)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {editingPo && (
            <div className="border border-red-200 dark:border-red-950 bg-red-500/5 p-3 rounded-lg space-y-1">
              <Label className="text-xs font-semibold text-destructive block">
                Reason for edit <span className="text-destructive">*</span>
              </Label>
              <Input
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Explain why this PO is being modified (notifies MD)..."
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
              {saving ? "Saving PO…" : editingPo ? "Save PO Changes" : "Create Purchase Order"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
