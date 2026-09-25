import { useState, useEffect } from "react";
import { Plus, Trash2, Package } from "lucide-react";
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

export type MaterialLineItem = {
  id?: string;
  material: string;
  specification?: string | null;
  unit?: string | null;
  quantity: number;
  rate: number;
  amount: number;
};

interface Props {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  projectOptions: { value: string; label: string }[];
  editingIndent?: {
    id: string;
    request_number: string;
    project_id: string;
    request_date: string;
    required_date: string | null;
    status: string;
    total_amount: number;
    material_name?: string | null;
    remarks: string | null;
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

export function MultiMaterialIndentDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  projectOptions,
  editingIndent,
  onSuccess,
}: Props) {
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = controlledOpen ?? uncontrolled;
  const setOpen = onOpenChange ?? setUncontrolled;

  const [requestNumber, setRequestNumber] = useState("");
  const [projectId, setProjectId] = useState("");
  const [requestDate, setRequestDate] = useState(today());
  const [requiredDate, setRequiredDate] = useState("");
  const [status, setStatus] = useState("draft");
  const [remarks, setRemarks] = useState("");
  const [editReason, setEditReason] = useState("");
  const [items, setItems] = useState<MaterialLineItem[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);

  const saveIndent = useSaveRow("material_requests", "Material Indent");

  useEffect(() => {
    if (open) {
      if (editingIndent) {
        setRequestNumber(editingIndent.request_number);
        setProjectId(editingIndent.project_id);
        setRequestDate(editingIndent.request_date);
        setRequiredDate(editingIndent.required_date ?? "");
        setStatus(editingIndent.status);
        setRemarks(editingIndent.remarks ?? "");
        setEditReason("");

        // Load existing line items
        supabase
          .from("material_request_items")
          .select("*")
          .eq("request_id", editingIndent.id)
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
            } else if (editingIndent.material_name) {
              setItems([
                {
                  material: editingIndent.material_name,
                  specification: "",
                  unit: "nos",
                  quantity: 1,
                  rate: editingIndent.total_amount || 0,
                  amount: editingIndent.total_amount || 0,
                },
              ]);
            } else {
              setItems([emptyItem()]);
            }
          });
      } else {
        setRequestNumber(`MR-${Date.now().toString().slice(-8)}`);
        setProjectId(projectOptions[0]?.value ?? "");
        setRequestDate(today());
        setRequiredDate("");
        setStatus("draft");
        setRemarks("");
        setEditReason("");
        setItems([emptyItem()]);
      }
    }
  }, [open, editingIndent, projectOptions]);

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
      toast.error("An indent must have at least one material.");
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const totalAmount = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const materialSummary = Array.from(new Set(items.map((i) => i.material.trim()).filter(Boolean)))
    .slice(0, 3)
    .join(", ");

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

    if (editingIndent && !editReason.trim()) {
      toast.error("Please provide a reason for editing this indent.");
      return;
    }

    try {
      setSaving(true);
      const isEdit = !!editingIndent;

      let indentId = editingIndent?.id;

      if (isEdit && editingIndent) {
        await logRecordFieldDiffs(
          "material_requests",
          editingIndent.id,
          "materials",
          editingIndent as Record<string, unknown>,
          {
            material_name: materialSummary || null,
            status,
            total_amount: totalAmount,
            remarks,
          },
          ["material_name", "status", "total_amount", "remarks"],
          editReason,
          "corrected"
        );

        await saveIndent.mutateAsync({
          id: editingIndent.id,
          values: {
            request_number: requestNumber,
            project_id: projectId,
            request_date: requestDate,
            required_date: requiredDate || null,
            status,
            total_amount: totalAmount,
            material_name: materialSummary || null,
            remarks: remarks || null,
          },
        });
      } else {
        const res = await saveIndent.mutateAsync({
          values: {
            request_number: requestNumber,
            project_id: projectId,
            request_date: requestDate,
            required_date: requiredDate || null,
            status,
            total_amount: totalAmount,
            material_name: materialSummary || null,
            remarks: remarks || null,
          },
        });
        indentId = res;
      }

      // Save line items
      if (indentId) {
        // Delete old items if edit
        if (isEdit) {
          await supabase.from("material_request_items").delete().eq("request_id", indentId);
        }

        const itemsToInsert = validItems.map((item) => ({
          request_id: indentId,
          material: item.material.trim(),
          specification: item.specification?.trim() || null,
          unit: item.unit?.trim() || null,
          quantity: Number(item.quantity) || 0,
          rate: Number(item.rate) || 0,
          amount: Number(item.amount) || 0,
        }));

        await supabase.from("material_request_items").insert(itemsToInsert);
      }

      toast.success(isEdit ? "Indent updated successfully" : "Indent created with multiple materials");
      setOpen(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save indent.");
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
              <Package className="size-5 text-primary" />
              {editingIndent ? `Edit Material Indent — ${editingIndent.request_number}` : "Raise Material Indent"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Enter indent header details and add one or multiple materials with quantity and estimated rate.
            </DialogDescription>
          </DialogHeader>

          {/* Header fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-muted/40 rounded-lg border">
            <div>
              <Label className="text-xs mb-1 block">Indent Number *</Label>
              <Input
                value={requestNumber}
                onChange={(e) => setRequestNumber(e.target.value)}
                required
                className="h-8 text-xs font-mono"
              />
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
              <Label className="text-xs mb-1 block">Request Date *</Label>
              <Input
                type="date"
                value={requestDate}
                onChange={(e) => setRequestDate(e.target.value)}
                required
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Required By Date</Label>
              <Input
                type="date"
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
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
                  {["draft", "submitted", "verified", "approved", "rejected", "closed"].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Remarks / Purpose</Label>
              <Input
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Slab casting phase 2"
                className="h-8 text-xs"
              />
            </div>
          </div>

          {/* Line items table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Materials List ({items.length} items)
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
                    <TableHead className="w-[12%] text-right">Rate (₹)</TableHead>
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
                          placeholder="e.g. Cement OPC 53"
                          required
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell className="p-1.5">
                        <Input
                          value={item.specification ?? ""}
                          onChange={(e) => updateItem(idx, "specification", e.target.value)}
                          placeholder="e.g. UltraTech 50kg"
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell className="p-1.5">
                        <Input
                          value={item.unit ?? ""}
                          onChange={(e) => updateItem(idx, "unit", e.target.value)}
                          placeholder="bag/kg/ton"
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
                  <span className="text-xs text-muted-foreground mr-3">Estimated Total:</span>
                  <span className="font-bold text-base font-mono text-foreground">{currency(totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          {editingIndent && (
            <div className="border border-red-200 dark:border-red-950 bg-red-500/5 p-3 rounded-lg space-y-1">
              <Label className="text-xs font-semibold text-destructive block">
                Reason for edit <span className="text-destructive">*</span>
              </Label>
              <Input
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Explain why this indent is being modified (notifies MD)..."
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
              {saving ? "Saving Indent…" : editingIndent ? "Save Changes" : "Create Indent"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
