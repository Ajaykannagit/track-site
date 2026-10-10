import { useState } from "react";
import { Plus, Trash2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = typedSupabase as any;

export type ExpenseLineItem = {
  expense_date: string;
  project_id: string;
  category: string;
  material_name: string;
  payment_method: string;
  amount: number;
  description: string;
};

interface Props {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  projectOptions: { value: string; label: string }[];
  categoryOptions: { value: string; label: string }[];
  onSuccess?: () => void;
}

const emptyExpense = (defaultDate: string, defaultProj: string, defaultCat: string, defaultMethod: string): ExpenseLineItem => ({
  expense_date: defaultDate,
  project_id: defaultProj,
  category: defaultCat,
  material_name: "",
  payment_method: defaultMethod,
  amount: 0,
  description: "",
});

export function MultiExpenseDialog({
  trigger,
  open: controlledOpen,
  onOpenChange,
  projectOptions,
  categoryOptions,
  onSuccess,
}: Props) {
  const qc = useQueryClient();
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = controlledOpen ?? uncontrolled;
  const setOpen = onOpenChange ?? setUncontrolled;

  // Batch header defaults
  const [defaultDate, setDefaultDate] = useState(today());
  const [defaultProject, setDefaultProject] = useState("");
  const [defaultMethod, setDefaultMethod] = useState("cash");
  const [saving, setSaving] = useState(false);

  const [expenses, setExpenses] = useState<ExpenseLineItem[]>([
    emptyExpense(today(), "", categoryOptions[0]?.value ?? "Fuel", "cash"),
    emptyExpense(today(), "", categoryOptions[1]?.value ?? "Site Consumables", "cash"),
  ]);

  const updateRow = (index: number, field: keyof ExpenseLineItem, value: any) => {
    setExpenses((prev) => {
      const next = [...prev];
      if (next[index]) {
        next[index] = { ...next[index], [field]: value } as ExpenseLineItem;
      }
      return next;
    });
  };

  const addRow = () => {
    setExpenses((prev) => [
      ...prev,
      emptyExpense(defaultDate, defaultProject, categoryOptions[0]?.value ?? "Fuel", defaultMethod),
    ]);
  };

  const removeRow = (index: number) => {
    if (expenses.length <= 1) {
      toast.error("You must have at least one expense entry.");
      return;
    }
    setExpenses((prev) => prev.filter((_, i) => i !== index));
  };

  const applyDefaultsToAll = () => {
    setExpenses((prev) =>
      prev.map((e) => ({
        ...e,
        expense_date: defaultDate,
        project_id: defaultProject || e.project_id,
        payment_method: defaultMethod,
      }))
    );
    toast.info("Applied default date, project & method to all rows.");
  };

  const totalAmount = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const valid = expenses.filter((e) => Number(e.amount) > 0);
    if (valid.length === 0) {
      toast.error("Please enter a valid amount for at least one expense.");
      return;
    }

    try {
      setSaving(true);
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id ?? null;

      const recordsToInsert = valid.map((exp) => ({
        expense_date: exp.expense_date || defaultDate,
        project_id: exp.project_id || null,
        category: exp.category || "Miscellaneous",
        material_name: exp.material_name?.trim() || null,
        payment_method: exp.payment_method || defaultMethod,
        amount: Number(exp.amount) || 0,
        description: exp.description?.trim() || null,
        created_by: userId,
      }));

      const { error } = await supabase.from("expenses").insert(recordsToInsert);
      if (error) throw error;

      toast.success(`${recordsToInsert.length} expenses saved successfully (Total: ${currency(totalAmount)})`);
      qc.invalidateQueries({ queryKey: ["expenses"] });
      setOpen(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save expenses.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Receipt className="size-5 text-primary" />
              Add Multiple Cash / Account Expenses
            </DialogTitle>
            <DialogDescription className="text-xs">
              Enter multiple separate expenses (e.g. 10 site purchases) in one screen using "+ Add More" and save all entries at once.
            </DialogDescription>
          </DialogHeader>

          {/* Quick autofill bar */}
          <div className="p-3 bg-muted/40 rounded-lg border flex flex-wrap items-end gap-3 text-xs">
            <div>
              <Label className="text-[11px] text-muted-foreground mb-1 block">Default Date</Label>
              <Input
                type="date"
                value={defaultDate}
                onChange={(e) => setDefaultDate(e.target.value)}
                className="h-8 text-xs w-36"
              />
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground mb-1 block">Default Project</Label>
              <Select value={defaultProject || "none"} onValueChange={(v) => setDefaultProject(v === "none" ? "" : v)}>
                <SelectTrigger className="h-8 text-xs w-44">
                  <SelectValue placeholder="Select default project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (General)</SelectItem>
                  {projectOptions.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px] text-muted-foreground mb-1 block">Default Payment</Label>
              <Select value={defaultMethod} onValueChange={setDefaultMethod}>
                <SelectTrigger className="h-8 text-xs w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["cash", "bank", "upi", "cheque"].map((m) => (
                    <SelectItem key={m} value={m}>
                      {m.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={applyDefaultsToAll}
              className="h-8 text-xs"
            >
              Apply Defaults to All Rows
            </Button>
          </div>

          {/* Table of expenses */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Expense Entries ({expenses.length} rows)
              </Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRow}
                className="h-7 text-xs border-primary/40 text-primary hover:bg-primary/10"
              >
                <Plus className="mr-1 size-3.5" /> + Add More Expense
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs bg-muted/60">
                    <TableHead className="w-[14%]">Date *</TableHead>
                    <TableHead className="w-[18%]">Project</TableHead>
                    <TableHead className="w-[16%]">Category *</TableHead>
                    <TableHead className="w-[18%]">Material / Item (optional)</TableHead>
                    <TableHead className="w-[12%]">Method</TableHead>
                    <TableHead className="w-[12%] text-right">Amount (₹) *</TableHead>
                    <TableHead className="w-[16%]">Description</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((exp, idx) => (
                    <TableRow key={idx} className="hover:bg-muted/30">
                      <TableCell className="p-1">
                        <Input
                          type="date"
                          value={exp.expense_date}
                          onChange={(e) => updateRow(idx, "expense_date", e.target.value)}
                          required
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Select
                          value={exp.project_id || "none"}
                          onValueChange={(v) => updateRow(idx, "project_id", v === "none" ? "" : v)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Project..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">General</SelectItem>
                            {projectOptions.map((p) => (
                              <SelectItem key={p.value} value={p.value}>
                                {p.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="p-1">
                        <Select
                          value={exp.category}
                          onValueChange={(v) => updateRow(idx, "category", v)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {categoryOptions.map((c) => (
                              <SelectItem key={c.value} value={c.value}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          value={exp.material_name}
                          onChange={(e) => updateRow(idx, "material_name", e.target.value)}
                          placeholder="e.g. Nails / PVC"
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Select
                          value={exp.payment_method}
                          onValueChange={(v) => updateRow(idx, "payment_method", v)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["cash", "bank", "upi", "cheque"].map((m) => (
                              <SelectItem key={m} value={m}>
                                {m.toUpperCase()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          value={exp.amount || ""}
                          onChange={(e) => updateRow(idx, "amount", e.target.value)}
                          placeholder="0.00"
                          required
                          className="h-8 text-xs text-right font-mono"
                        />
                      </TableCell>
                      <TableCell className="p-1">
                        <Input
                          value={exp.description}
                          onChange={(e) => updateRow(idx, "description", e.target.value)}
                          placeholder="Notes..."
                          className="h-8 text-xs"
                        />
                      </TableCell>
                      <TableCell className="p-1 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:bg-destructive/10"
                          onClick={() => removeRow(idx)}
                          disabled={expenses.length <= 1}
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
                  onClick={addRow}
                  className="h-7 text-xs text-primary"
                >
                  <Plus className="mr-1 size-3.5" /> + Add More Expense
                </Button>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground mr-3">
                    Total Amount ({expenses.filter((e) => Number(e.amount) > 0).length} valid entries):
                  </span>
                  <span className="font-bold text-base font-mono text-destructive">{currency(totalAmount)}</span>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving || totalAmount <= 0}>
              {saving ? "Saving Expenses…" : `Save ${expenses.length} Expenses`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
