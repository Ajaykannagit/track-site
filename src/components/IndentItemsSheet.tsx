import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRows, useSaveRow, useDeleteRow } from "@/lib/db";
import { currency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { logAuditEntry, logRecordFieldDiffs } from "@/lib/audit";

// ── Types ────────────────────────────────────────────────────────────────────

type RequestItem = {
  id: string;
  request_id: string;
  material: string;
  specification: string | null;
  unit: string | null;
  quantity: number;
  rate: number;
  amount: number;
};

type IndentRow = {
  id: string;
  request_number: string;
  status: string;
};

interface Props {
  indent: IndentRow | null;
  canEdit: boolean;
  onClose: () => void;
}

// ── Inline item form (add / edit) ─────────────────────────────────────────────

function ItemForm({
  initial,
  onSave,
  onCancel,
  saving,
  isEditing = false,
}: {
  initial: Partial<RequestItem> & { edit_reason?: string; audit_status?: string };
  onSave: (v: Partial<RequestItem> & { edit_reason?: string; audit_status?: string }) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
  isEditing?: boolean;
}) {
  const [material, setMaterial] = useState(initial.material ?? "");
  const [spec, setSpec] = useState(initial.specification ?? "");
  const [unit, setUnit] = useState(initial.unit ?? "");
  const [qty, setQty] = useState(String(initial.quantity ?? ""));
  const [rate, setRate] = useState(String(initial.rate ?? ""));
  const [editReason, setEditReason] = useState(initial.edit_reason ?? "");
  const [auditStatus, setAuditStatus] = useState(initial.audit_status ?? "corrected");

  const amount = (Number(qty) || 0) * (Number(rate) || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      material: material.trim(),
      specification: spec.trim() || null,
      unit: unit.trim() || null,
      quantity: Number(qty) || 0,
      rate: Number(rate) || 0,
      amount,
      ...(isEditing ? { edit_reason: editReason.trim() || "Item modified", audit_status: auditStatus } : {}),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border bg-muted/40 p-3 space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Label className="text-xs mb-1 block">Material *</Label>
          <Input
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            placeholder="e.g. Cement OPC 53"
            required
            className="h-8 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <Label className="text-xs mb-1 block">Specification</Label>
          <Input
            value={spec}
            onChange={(e) => setSpec(e.target.value)}
            placeholder="e.g. 50 kg bags"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Unit</Label>
          <Input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="bag / kg / nos"
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Qty *</Label>
          <Input
            type="number"
            min={0}
            step="any"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            required
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Rate (₹)</Label>
          <Input
            type="number"
            min={0}
            step="any"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs mb-1 block">Amount</Label>
          <Input value={currency(amount)} readOnly className="h-8 text-sm bg-muted" />
        </div>

        {isEditing && (
          <>
            <div className="sm:col-span-3">
              <Label className="text-xs mb-1 block">Reason for edit *</Label>
              <Input
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Reason for modifying this line item"
                required
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Verification status</Label>
              <select
                value={auditStatus}
                onChange={(e) => setAuditStatus(e.target.value)}
                className="w-full h-8 text-xs border rounded px-2 bg-background"
              >
                <option value="verified">Verified</option>
                <option value="pending_verification">Pending Verification</option>
                <option value="corrected">Corrected</option>
              </select>
            </div>
          </>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving || !material.trim()}>
          {saving ? "Saving…" : "Save item"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ── Main Sheet ────────────────────────────────────────────────────────────────

export function IndentItemsSheet({
  indent,
  canEdit,
  onClose,
  onTotalUpdated,
}: Props & { onTotalUpdated?: (newTotal: number, materialSummary: string) => void }) {
  const [addingItem, setAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState<RequestItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<RequestItem | null>(null);

  const items = useRows<RequestItem>("material_request_items", {
    filters: indent ? [{ col: "request_id", op: "eq", value: indent.id }] : [],
    order: { col: "created_at" },
    enabled: !!indent,
  });

  const saveItem = useSaveRow("material_request_items", "Item");
  const deleteItem = useDeleteRow("material_request_items", "Item");
  const saveIndent = useSaveRow("material_requests", "Indent");

  const total = (items.data ?? []).reduce((s, i) => s + i.amount, 0);

  const syncParentIndent = async (itemList: RequestItem[]) => {
    if (!indent) return;
    const newTotal = itemList.reduce((s, i) => s + i.amount, 0);
    const summaryNames = Array.from(new Set(itemList.map((i) => i.material))).slice(0, 3).join(", ");
    await saveIndent.mutateAsync({
      id: indent.id,
      values: {
        total_amount: newTotal,
        material_name: summaryNames || null,
      },
    });
    onTotalUpdated?.(newTotal, summaryNames);
  };

  const handleAddItem = async (vals: Partial<RequestItem>) => {
    const { edit_reason, audit_status, ...itemVals } = vals as any;
    await saveItem.mutateAsync({
      values: { ...itemVals, request_id: indent!.id },
    });
    const updated = [...(items.data ?? []), { ...itemVals, id: "temp", request_id: indent!.id } as RequestItem];
    await syncParentIndent(updated);
    setAddingItem(false);
  };

  const handleEditItem = async (vals: Partial<RequestItem> & { edit_reason?: string; audit_status?: string }) => {
    if (!editingItem) return;
    const reason = vals.edit_reason || "Item modified";
    const auditStatus = vals.audit_status || "corrected";
    const { edit_reason, audit_status, ...itemVals } = vals;

    await logRecordFieldDiffs(
      "material_request_items",
      editingItem.id,
      "materials",
      editingItem as Record<string, unknown>,
      itemVals as Record<string, unknown>,
      ["material", "specification", "unit", "quantity", "rate", "amount"],
      reason,
      auditStatus
    );
    await saveItem.mutateAsync({ id: editingItem.id, values: itemVals });
    const updated = (items.data ?? []).map((i) => (i.id === editingItem.id ? { ...i, ...itemVals } : i));
    await syncParentIndent(updated);
    setEditingItem(null);
  };

  const handleDeleteItem = async () => {
    if (!deletingItem) return;
    await logAuditEntry({
      tableName: "material_request_items",
      recordId: deletingItem.id,
      action: "delete",
      module: "materials",
      details: { material: deletingItem.material },
    });
    await deleteItem.mutateAsync(deletingItem.id);
    const updated = (items.data ?? []).filter((i) => i.id !== deletingItem.id);
    await syncParentIndent(updated);
    setDeletingItem(null);
  };

  return (
    <>
      <Sheet open={!!indent} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="w-full max-w-2xl overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>
              Items — {indent?.request_number}
            </SheetTitle>
            <SheetDescription>
              Material line items for this indent. Status: {indent?.status?.toUpperCase()}
            </SheetDescription>
          </SheetHeader>

          {/* Add item button */}
          {canEdit && !addingItem && !editingItem && (
            <Button size="sm" className="mb-3" onClick={() => setAddingItem(true)}>
              <Plus className="mr-1 size-3.5" /> Add item
            </Button>
          )}

          {/* Add form */}
          {addingItem && (
            <div className="mb-4">
              <ItemForm
                initial={{}}
                onSave={handleAddItem}
                onCancel={() => setAddingItem(false)}
                saving={saveItem.isPending}
              />
            </div>
          )}

          {/* Items table */}
          {items.isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
          ) : (items.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No items yet. {canEdit ? "Add the first item above." : ""}
            </p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs">
                    <TableHead>Material</TableHead>
                    <TableHead>Spec / Unit</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    {canEdit && <TableHead className="w-16" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(items.data ?? []).map((item) =>
                    editingItem?.id === item.id ? (
                      <TableRow key={item.id}>
                        <TableCell colSpan={canEdit ? 6 : 5} className="p-2">
                          <ItemForm
                            initial={item}
                            onSave={handleEditItem}
                            onCancel={() => setEditingItem(null)}
                            saving={saveItem.isPending}
                            isEditing={true}
                          />
                        </TableCell>
                      </TableRow>
                    ) : (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium text-sm">{item.material}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {item.specification || "—"}
                          {item.unit ? ` / ${item.unit}` : ""}
                        </TableCell>
                        <TableCell className="text-right text-sm">{item.quantity}</TableCell>
                        <TableCell className="text-right text-sm">{currency(item.rate)}</TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {currency(item.amount)}
                        </TableCell>
                        {canEdit && (
                          <TableCell className="text-right p-1">
                            <div className="flex items-center justify-end gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-6"
                                onClick={() => { setEditingItem(item); setAddingItem(false); }}
                              >
                                <Pencil className="size-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-6 text-destructive hover:text-destructive"
                                onClick={() => setDeletingItem(item)}
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
              {/* Total row */}
              <div className="flex justify-end gap-4 px-4 py-2 border-t bg-muted/40 text-sm font-semibold">
                <span>Total</span>
                <span>{currency(total)}</span>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirm */}
      {deletingItem && (
        <ConfirmDeleteDialog
          open={!!deletingItem}
          onOpenChange={(open) => !open && setDeletingItem(null)}
          title="Delete item"
          description={`Remove "${deletingItem.material}" from this indent? This cannot be undone.`}
          onConfirm={handleDeleteItem}
        />
      )}
    </>
  );
}
