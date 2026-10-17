import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { HandCoins, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { DataTable, StatCard, type Column } from "@/components/DataTable";
import { FormDialog, type Field } from "@/components/FormDialog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { useRows, useSaveRow, useDeleteRow, sum } from "@/lib/db";
import { currency, dateFmt, monthStart, today } from "@/lib/format";
import { ChangeHistoryDialog } from "@/components/ChangeHistoryDialog";
import { logAuditEntry, logRecordFieldDiffs } from "@/lib/audit";
import { MultiExpenseDialog } from "@/components/MultiExpenseDialog";

export const Route = createFileRoute("/_authenticated/accounts")({
  head: () => ({
    meta: [
      { title: "Accounts & Cash — Brickweld Pvt Ltd" },
      {
        name: "description",
        content:
          "Site expenses, petty cash closing and daily cash position for every construction project.",
      },
      { property: "og:title", content: "Accounts & Cash — Brickweld Pvt Ltd" },
      {
        property: "og:description",
        content: "Track site expenses and daily cash closing balances.",
      },
    ],
  }),
  component: AccountsPage,
});

type Expense = {
  id: string;
  expense_date: string;
  project_id: string | null;
  category: string;
  material_name?: string | null;
  description: string | null;
  amount: number;
  payment_method: string | null;
};

type Closing = {
  id: string;
  closing_date: string;
  project_id: string | null;
  account_type?: string | null;
  opening_cash: number;
  cash_received: number;
  cash_expenses: number;
  other_transactions: number;
  closing_cash: number;
  remarks: string | null;
};

type Transfer = {
  id: string;
  transfer_date: string;
  project_id: string | null;
  from_account: string;
  to_account: string;
  amount: number;
  reference_number: string | null;
  remarks: string | null;
};

type ClientPayment = {
  id: string;
  receipt_number: string;
  project_id: string;
  client_id: string | null;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_number: string | null;
  payment_category: string;
  invoice_reference: string | null;
  notes: string | null;
  status: string;
  account_type: string;
  created_at: string;
};

function AccountsPage() {
  const { canWriteFinance, isMD } = useAuth();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());

  // Edit / Delete states
  const [multiExpenseOpen, setMultiExpenseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);

  const [editingClosing, setEditingClosing] = useState<Closing | null>(null);
  const [deletingClosing, setDeletingClosing] = useState<Closing | null>(null);

  const [editingTransfer, setEditingTransfer] = useState<Transfer | null>(null);
  const [deletingTransfer, setDeletingTransfer] = useState<Transfer | null>(null);

  // Filters
  const [expenseProjectFilter, setExpenseProjectFilter] = useState<string>("all");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>("all");
  const [closingProjectFilter, setClosingProjectFilter] = useState<string>("all");
  const [closingAccountFilter, setClosingAccountFilter] = useState<string>("all");
  const [transferProjectFilter, setTransferProjectFilter] = useState<string>("all");
  const [paymentProjectFilter, setPaymentProjectFilter] = useState<string>("all");
  const [paymentCategoryFilter, setPaymentCategoryFilter] = useState<string>("all");

  const projects = useRows<{ id: string; name: string }>("projects_view", { select: "id,name" });
  const categories = useRows<{ id: string; name: string }>("expense_categories", {
    select: "id,name",
  });

  const expenses = useRows<Expense>("expenses", {
    filters: [
      { col: "expense_date", op: "gte", value: from },
      { col: "expense_date", op: "lte", value: to },
    ],
    order: { col: "expense_date" },
    limit: 500,
  });
  const closings = useRows<Closing>("cash_closing", {
    filters: [
      { col: "closing_date", op: "gte", value: from },
      { col: "closing_date", op: "lte", value: to },
    ],
    order: { col: "closing_date" },
    limit: 500,
  });
  const transfers = useRows<Transfer>("account_transfers", {
    filters: [
      { col: "transfer_date", op: "gte", value: from },
      { col: "transfer_date", op: "lte", value: to },
    ],
    order: { col: "transfer_date" },
    limit: 500,
  });
  const clientPayments = useRows<ClientPayment>("client_payments", {
    filters: [
      { col: "payment_date", op: "gte", value: from },
      { col: "payment_date", op: "lte", value: to },
    ],
    order: { col: "payment_date", asc: false },
    limit: 500,
  });

  const saveExpense = useSaveRow("expenses", "Expense");
  const deleteExpense = useDeleteRow("expenses", "Expense");

  const saveClosing = useSaveRow("cash_closing", "Cash closing");
  const deleteClosing = useDeleteRow("cash_closing", "Cash closing");

  const saveTransfer = useSaveRow("account_transfers", "Transfer");
  const deleteTransfer = useDeleteRow("account_transfers", "Transfer");

  const projectName = (id: string | null) => projects.data?.find((p) => p.id === id)?.name ?? "—";
  const projectOptions = (projects.data ?? []).map((p) => ({ value: p.id, label: p.name }));

  const canModify = canWriteFinance || isMD;

  // Filtered expenses
  const filteredExpenses = useMemo(() => {
    let list = expenses.data ?? [];
    if (expenseProjectFilter !== "all") {
      list = list.filter((e) => e.project_id === expenseProjectFilter);
    }
    if (expenseCategoryFilter !== "all") {
      list = list.filter((e) => e.category === expenseCategoryFilter);
    }
    return list;
  }, [expenses.data, expenseProjectFilter, expenseCategoryFilter]);

  // Filtered closings
  const filteredClosings = useMemo(() => {
    let list = closings.data ?? [];
    if (closingProjectFilter !== "all") {
      list = list.filter((c) => c.project_id === closingProjectFilter);
    }
    if (closingAccountFilter !== "all") {
      list = list.filter((c) => (c.account_type || "petty_cash") === closingAccountFilter);
    }
    return list;
  }, [closings.data, closingProjectFilter, closingAccountFilter]);

  // Filtered transfers
  const filteredTransfers = useMemo(() => {
    let list = transfers.data ?? [];
    if (transferProjectFilter !== "all") {
      list = list.filter((t) => t.project_id === transferProjectFilter);
    }
    return list;
  }, [transfers.data, transferProjectFilter]);

  // Filtered client payments
  const filteredClientPayments = useMemo(() => {
    let list = clientPayments.data ?? [];
    if (paymentProjectFilter !== "all") {
      list = list.filter((p) => p.project_id === paymentProjectFilter);
    }
    if (paymentCategoryFilter !== "all") {
      list = list.filter((p) => p.payment_category === paymentCategoryFilter);
    }
    return list;
  }, [clientPayments.data, paymentProjectFilter, paymentCategoryFilter]);

  const paymentColumns: Column<ClientPayment>[] = [
    {
      header: "Receipt #",
      cell: (r) => <span className="font-mono text-xs font-semibold">{r.receipt_number}</span>,
      value: (r) => r.receipt_number,
    },
    { header: "Date", cell: (r) => dateFmt(r.payment_date), value: (r) => r.payment_date },
    {
      header: "Project",
      cell: (r) => projectName(r.project_id),
      value: (r) => projectName(r.project_id),
    },
    {
      header: "Category",
      cell: (r) => {
        const isRev = r.payment_category === "reversal";
        return (
          <Badge variant={isRev ? "destructive" : "secondary"}>
            {r.payment_category}
          </Badge>
        );
      },
      value: (r) => r.payment_category,
    },
    {
      header: "Method / Ref",
      cell: (r) => (
        <div>
          <span className={r.payment_method ? "capitalize text-xs font-medium" : "text-muted-foreground italic text-xs"}>
            {r.payment_method || "Not recorded"}
          </span>
          {r.reference_number && (
            <span className="block text-[10px] font-mono text-muted-foreground">{r.reference_number}</span>
          )}
        </div>
      ),
      value: (r) => `${r.payment_method || "Not recorded"} ${r.reference_number || ""}`,
    },
    {
      header: "Account",
      cell: (r) => (
        <Badge variant="outline" className="text-[10px]">
          {r.account_type === "bank" ? "Bank Account" : "Petty Cash"}
        </Badge>
      ),
      value: (r) => r.account_type,
    },
    {
      header: "Amount",
      cell: (r) => {
        const isRev = r.payment_category === "reversal";
        return (
          <span className={`font-mono font-semibold ${isRev ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}>
            {isRev ? `-${currency(r.amount)}` : currency(r.amount)}
          </span>
        );
      },
      value: (r) => r.amount,
      className: "text-right",
    },
  ];

  const expenseColumns: Column<Expense>[] = [
    { header: "Date", cell: (r) => dateFmt(r.expense_date), value: (r) => r.expense_date },
    {
      header: "Project",
      cell: (r) => projectName(r.project_id),
      value: (r) => projectName(r.project_id),
    },
    { header: "Category", cell: (r) => r.category, value: (r) => r.category },
    {
      header: "Material",
      cell: (r) => r.material_name || "—",
      value: (r) => r.material_name,
    },
    {
      header: "Method",
      cell: (r) => (
        <span className={r.payment_method ? "capitalize" : "text-muted-foreground italic text-xs"}>
          {r.payment_method || "Not recorded"}
        </span>
      ),
      value: (r) => r.payment_method || "Not recorded",
    },
    {
      header: "Amount",
      cell: (r) => currency(r.amount),
      value: (r) => r.amount,
      className: "text-right",
    },
    ...(canModify
      ? [
          {
            header: "Actions",
            className: "text-right w-28",
            cell: (r: Expense) => (
              <div className="flex items-center justify-end gap-1">
                <ChangeHistoryDialog
                  tableName="expenses"
                  recordId={r.id}
                  title={`Expense Audit History — ${r.category}`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setEditingExpense(r)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  onClick={() => setDeletingExpense(r)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  const closingColumns: Column<Closing>[] = [
    { header: "Date", cell: (r) => dateFmt(r.closing_date), value: (r) => r.closing_date },
    {
      header: "Account",
      cell: (r) => (
        <Badge variant={r.account_type === "bank" ? "secondary" : "outline"}>
          {r.account_type === "bank" ? "Bank Account" : "Petty Cash"}
        </Badge>
      ),
      value: (r) => (r.account_type === "bank" ? "Bank Account" : "Petty Cash"),
    },
    {
      header: "Project",
      cell: (r) => projectName(r.project_id),
      value: (r) => projectName(r.project_id),
    },
    {
      header: "Opening",
      cell: (r) => currency(r.opening_cash),
      value: (r) => r.opening_cash,
      className: "text-right",
    },
    {
      header: "Received",
      cell: (r) => currency(r.cash_received),
      value: (r) => r.cash_received,
      className: "text-right",
    },
    {
      header: "Spent",
      cell: (r) => currency(r.cash_expenses),
      value: (r) => r.cash_expenses,
      className: "text-right",
    },
    {
      header: "Other",
      cell: (r) => currency(r.other_transactions),
      value: (r) => r.other_transactions,
      className: "text-right",
    },
    {
      header: "Closing",
      cell: (r) => currency(r.closing_cash),
      value: (r) => r.closing_cash,
      className: "text-right",
    },
    ...(canModify
      ? [
          {
            header: "Actions",
            className: "text-right w-28",
            cell: (r: Closing) => (
              <div className="flex items-center justify-end gap-1">
                <ChangeHistoryDialog
                  tableName="cash_closing"
                  recordId={r.id}
                  title="Cash Closing Audit History"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setEditingClosing(r)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  onClick={() => setDeletingClosing(r)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  const categoryOptions = useMemo(() => {
    const dbNames = (categories.data ?? []).map((c) => c.name);
    const defaults = [
      "Fuel",
      "Transport",
      "Site Consumables",
      "Food",
      "Tools",
      "Machinery Rent",
      "Miscellaneous",
    ];
    const merged = Array.from(new Set([...dbNames, ...defaults]));
    return merged.map((name) => ({ value: name, label: name }));
  }, [categories.data]);

  const expenseFields: Field[] = [
    { name: "expense_date", label: "Date", type: "date", required: true },
    { name: "project_id", label: "Project", type: "select", options: projectOptions },
    {
      name: "category",
      label: "Category",
      type: "select",
      required: true,
      options: categoryOptions,
    },
    { name: "material_name", label: "Material name / description (optional)", type: "text" },
    {
      name: "payment_method",
      label: "Payment method",
      type: "select",
      options: ["cash", "bank", "upi", "cheque"].map((m) => ({ value: m, label: m })),
    },
    { name: "amount", label: "Amount (₹)", type: "number", required: true },
    { name: "description", label: "Description", type: "textarea" },
  ];

  const closingFields: Field[] = [
    { name: "closing_date", label: "Date", type: "date", required: true },
    {
      name: "account_type",
      label: "Account",
      type: "select",
      required: true,
      options: [
        { value: "petty_cash", label: "Petty Cash" },
        { value: "bank", label: "Bank Account" },
      ],
    },
    { name: "project_id", label: "Project", type: "select", options: projectOptions },
    { name: "opening_cash", label: "Opening balance (₹)", type: "number" },
    { name: "cash_received", label: "Cash / money received (₹)", type: "number" },
    { name: "cash_expenses", label: "Expenses paid (₹)", type: "number" },
    { name: "other_transactions", label: "Other transactions (₹)", type: "number" },
    { name: "remarks", label: "Remarks", type: "textarea" },
  ];

  const transferColumns: Column<Transfer>[] = [
    { header: "Date", cell: (r) => dateFmt(r.transfer_date), value: (r) => r.transfer_date },
    {
      header: "Project",
      cell: (r) => projectName(r.project_id),
      value: (r) => projectName(r.project_id),
    },
    {
      header: "From Account",
      cell: (r) => (
        <Badge variant={r.from_account === "bank" ? "secondary" : "outline"}>
          {r.from_account === "bank" ? "Bank Account" : "Petty Cash"}
        </Badge>
      ),
      value: (r) => (r.from_account === "bank" ? "Bank Account" : "Petty Cash"),
    },
    {
      header: "To Account",
      cell: (r) => (
        <Badge variant={r.to_account === "bank" ? "secondary" : "outline"}>
          {r.to_account === "bank" ? "Bank Account" : "Petty Cash"}
        </Badge>
      ),
      value: (r) => (r.to_account === "bank" ? "Bank Account" : "Petty Cash"),
    },
    {
      header: "Amount",
      cell: (r) => currency(r.amount),
      value: (r) => r.amount,
      className: "text-right",
    },
    { header: "Ref #", cell: (r) => r.reference_number || "—", value: (r) => r.reference_number },
    { header: "Remarks", cell: (r) => r.remarks || "—", value: (r) => r.remarks },
    ...(canModify
      ? [
          {
            header: "Actions",
            className: "text-right w-28",
            cell: (r: Transfer) => (
              <div className="flex items-center justify-end gap-1">
                <ChangeHistoryDialog
                  tableName="account_transfers"
                  recordId={r.id}
                  title="Transfer Audit History"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setEditingTransfer(r)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  onClick={() => setDeletingTransfer(r)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  const transferFields: Field[] = [
    { name: "transfer_date", label: "Date", type: "date", required: true },
    { name: "project_id", label: "Project", type: "select", options: projectOptions },
    {
      name: "from_account",
      label: "From Account",
      type: "select",
      required: true,
      options: [
        { value: "bank", label: "Bank Account" },
        { value: "petty_cash", label: "Petty Cash" },
      ],
    },
    {
      name: "to_account",
      label: "To Account",
      type: "select",
      required: true,
      options: [
        { value: "petty_cash", label: "Petty Cash" },
        { value: "bank", label: "Bank Account" },
      ],
    },
    { name: "amount", label: "Transfer Amount (₹)", type: "number", required: true },
    { name: "reference_number", label: "Reference / Cheque / UTR #", type: "text" },
    { name: "remarks", label: "Remarks", type: "textarea" },
  ];

  const latestPettyClosing = closings.data?.find(
    (c) => (c.account_type || "petty_cash") === "petty_cash"
  );
  const latestBankClosing = closings.data?.find((c) => c.account_type === "bank");

  return (
    <div>
      <PageHeader
        title="Accounts & Cash"
        description="Site expenses, petty cash movement and daily closing balances."
      />

      <div className="no-print mb-4 flex flex-wrap items-end gap-3">
        <div>
          <Label className="mb-1.5 block text-xs">From</Label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-40"
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total expenses"
          value={currency(sum(filteredExpenses, (r) => r.amount))}
          tone="destructive"
        />
        <StatCard
          label="Money received"
          value={currency(sum(filteredClosings, (r) => r.cash_received))}
          tone="success"
        />
        <StatCard
          label="Petty cash balance"
          value={currency(latestPettyClosing ? latestPettyClosing.closing_cash : 0)}
        />
        <StatCard
          label="Bank account balance"
          value={currency(latestBankClosing ? latestBankClosing.closing_cash : 0)}
          tone="warning"
        />
      </div>

      <Tabs defaultValue="expenses">
        <TabsList className="no-print">
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="client_receipts">
            <HandCoins className="mr-1.5 size-3.5" /> Client Receipts ({(clientPayments.data ?? []).length})
          </TabsTrigger>
          <TabsTrigger value="cash">Cash closing</TabsTrigger>
          <TabsTrigger value="transfers">Transfers (Contra)</TabsTrigger>
        </TabsList>

        {/* ================= EXPENSES ================= */}
        <TabsContent value="expenses" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {canModify && (
              <div className="flex items-center gap-2">
                <Button onClick={() => setMultiExpenseOpen(true)} className="bg-primary hover:bg-primary/90">
                  <Plus className="mr-1.5 size-4" /> + Add More Expenses (Bulk)
                </Button>
                <FormDialog
                  title="Add Single Expense"
                  description="Record a site or office expense against a project."
                  trigger={
                    <Button variant="outline">
                      <Plus className="mr-1.5 size-4" /> Single Expense
                    </Button>
                  }
                  submitting={saveExpense.isPending}
                  initial={{ expense_date: today(), payment_method: "cash", material_name: "" }}
                  fields={expenseFields}
                  onSubmit={async (values) => {
                    await saveExpense.mutateAsync({
                      values: {
                        ...values,
                        project_id: values["project_id"] || null,
                        material_name: values["material_name"] || null,
                        amount: Number(values["amount"] ?? 0),
                      },
                    });
                  }}
                />
              </div>
            )}

            {/* Multi-expense Dialog */}
            <MultiExpenseDialog
              open={multiExpenseOpen}
              onOpenChange={setMultiExpenseOpen}
              projectOptions={projectOptions}
              categoryOptions={categoryOptions}
              onSuccess={() => expenses.refetch()}
            />

            {/* Expense Filters */}
            <div className="no-print flex flex-wrap items-end gap-2">
              <div>
                <Select value={expenseProjectFilter} onValueChange={setExpenseProjectFilter}>
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue placeholder="All Projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {projectOptions.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Select value={expenseCategoryFilter} onValueChange={setExpenseCategoryFilter}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categoryOptions.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(expenseProjectFilter !== "all" || expenseCategoryFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setExpenseProjectFilter("all");
                    setExpenseCategoryFilter("all");
                  }}
                  className="h-8 px-2 text-xs"
                >
                  <RotateCcw className="mr-1 size-3" /> Reset
                </Button>
              )}
            </div>
          </div>

          {editingExpense && (
            <FormDialog
              open={!!editingExpense}
              onOpenChange={(v) => !v && setEditingExpense(null)}
              title="Edit expense"
              fields={[
                ...expenseFields,
                { name: "edit_reason", label: "Reason for edit *", type: "text", required: true },
                {
                  name: "audit_status",
                  label: "Verification status",
                  type: "select",
                  options: [
                    { value: "verified", label: "Verified" },
                    { value: "pending_verification", label: "Pending Verification" },
                    { value: "corrected", label: "Corrected Entry" },
                  ],
                },
              ]}
              submitting={saveExpense.isPending}
              initial={{
                expense_date: editingExpense.expense_date,
                project_id: editingExpense.project_id ?? "",
                category: editingExpense.category,
                material_name: editingExpense.material_name ?? "",
                payment_method: editingExpense.payment_method ?? "cash",
                amount: editingExpense.amount,
                description: editingExpense.description ?? "",
                edit_reason: "",
                audit_status: "corrected",
              }}
              onSubmit={async (values) => {
                const reason = String(values["edit_reason"] || "Expense updated");
                const auditStatus = String(values["audit_status"] || "corrected");
                const newVals = {
                  ...values,
                  project_id: values["project_id"] || null,
                  material_name: values["material_name"] || null,
                  amount: Number(values["amount"] ?? 0),
                };
                delete (newVals as any)["edit_reason"];
                delete (newVals as any)["audit_status"];
                await logRecordFieldDiffs(
                  "expenses",
                  editingExpense.id,
                  "expenses",
                  editingExpense as any,
                  newVals,
                  ["amount", "category", "material_name", "payment_method", "description", "expense_date"],
                  reason,
                  auditStatus
                );
                await saveExpense.mutateAsync({
                  id: editingExpense.id,
                  values: newVals,
                });
                setEditingExpense(null);
              }}
            />
          )}

          {deletingExpense && (
            <ConfirmDeleteDialog
              open={!!deletingExpense}
              onOpenChange={(v) => !v && setDeletingExpense(null)}
              tableName="expenses"
              recordId={deletingExpense.id}
              recordTitle={`Expense: ${deletingExpense.category} (${currency(deletingExpense.amount)})`}
              recordData={deletingExpense}
              title="Delete Expense"
              description={`Delete expense of ${currency(deletingExpense.amount)} (${deletingExpense.category})? This action requires MD approval.`}
              onConfirm={async () => {
                await deleteExpense.mutateAsync(deletingExpense.id);
                setDeletingExpense(null);
              }}
            />
          )}

          <DataTable
            rows={filteredExpenses}
            columns={expenseColumns}
            loading={expenses.isLoading}
            exportName="brickweld-expenses"
            exportTitle="Expenses Report"
            exportDescription="Construction Project Control System — Expenses Report"
            appliedFilters={{
              "Date Range": `${from} to ${to}`,
              ...(expenseProjectFilter !== "all"
                ? { Project: projectName(expenseProjectFilter) }
                : {}),
              ...(expenseCategoryFilter !== "all" ? { Category: expenseCategoryFilter } : {}),
            }}
          />
        </TabsContent>

        {/* ================= CLIENT RECEIPTS ================= */}
        <TabsContent value="client_receipts" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <HandCoins className="size-4 text-emerald-600" /> Client Receipts &amp; Inward Payments
              </h3>
              <p className="text-xs text-muted-foreground">
                All client remittances across projects credited to company bank accounts or petty cash.
              </p>
            </div>

            <div className="no-print flex flex-wrap items-end gap-2">
              <div>
                <Select value={paymentProjectFilter} onValueChange={setPaymentProjectFilter}>
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue placeholder="All Projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {projectOptions.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Select value={paymentCategoryFilter} onValueChange={setPaymentCategoryFilter}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="advance">Advance</SelectItem>
                    <SelectItem value="progress">Progress Payment</SelectItem>
                    <SelectItem value="final">Final Settlement</SelectItem>
                    <SelectItem value="reversal">Reversals</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(paymentProjectFilter !== "all" || paymentCategoryFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPaymentProjectFilter("all");
                    setPaymentCategoryFilter("all");
                  }}
                  className="h-8 px-2 text-xs"
                >
                  <RotateCcw className="mr-1 size-3" /> Reset
                </Button>
              )}
            </div>
          </div>

          <DataTable
            rows={filteredClientPayments}
            columns={paymentColumns}
            loading={clientPayments.isLoading}
            exportName="brickweld-client-receipts"
            exportTitle="Client Receipts Report"
            exportDescription="Construction Project Control System — Client Receipts Report"
            empty="No client receipts found for the selected date range."
            appliedFilters={{
              "Date Range": `${from} to ${to}`,
              ...(paymentProjectFilter !== "all"
                ? { Project: projectName(paymentProjectFilter) }
                : {}),
              ...(paymentCategoryFilter !== "all" ? { Category: paymentCategoryFilter } : {}),
            }}
          />
        </TabsContent>

        {/* ================= CASH CLOSING ================= */}
        <TabsContent value="cash" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {canModify && (
              <FormDialog
                title="Cash closing"
                description="Close the day's cash position for a project site."
                trigger={
                  <Button>
                    <Plus className="mr-2 size-4" /> Close cash
                  </Button>
                }
                submitting={saveClosing.isPending}
                initial={{
                  closing_date: today(),
                  account_type: "petty_cash",
                  opening_cash: 0,
                  cash_received: 0,
                  cash_expenses: 0,
                  other_transactions: 0,
                }}
                fields={closingFields}
                onSubmit={async (values) => {
                  const opening = Number(values["opening_cash"] ?? 0);
                  const received = Number(values["cash_received"] ?? 0);
                  const spent = Number(values["cash_expenses"] ?? 0);
                  const other = Number(values["other_transactions"] ?? 0);
                  await saveClosing.mutateAsync({
                    values: {
                      ...values,
                      project_id: values["project_id"] || null,
                      account_type: values["account_type"] || "petty_cash",
                      opening_cash: opening,
                      cash_received: received,
                      cash_expenses: spent,
                      other_transactions: other,
                      closing_cash: opening + received - spent + other,
                    },
                  });
                }}
              />
            )}

            {/* Closing Filters */}
            <div className="no-print flex flex-wrap items-center gap-2">
              <div>
                <Select value={closingProjectFilter} onValueChange={setClosingProjectFilter}>
                  <SelectTrigger className="w-44 h-8 text-xs">
                    <SelectValue placeholder="All Projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {projectOptions.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Select value={closingAccountFilter} onValueChange={setClosingAccountFilter}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue placeholder="All Accounts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    <SelectItem value="petty_cash">Petty Cash</SelectItem>
                    <SelectItem value="bank">Bank Account</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(closingProjectFilter !== "all" || closingAccountFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setClosingProjectFilter("all");
                    setClosingAccountFilter("all");
                  }}
                  className="h-8 px-2 text-xs"
                >
                  <RotateCcw className="mr-1 size-3" /> Reset
                </Button>
              )}
            </div>
          </div>

          {editingClosing && (
            <FormDialog
              open={!!editingClosing}
              onOpenChange={(v) => !v && setEditingClosing(null)}
              title="Edit cash closing"
              fields={[
                ...closingFields,
                { name: "edit_reason", label: "Reason for edit *", type: "text", required: true },
                {
                  name: "audit_status",
                  label: "Verification status",
                  type: "select",
                  options: [
                    { value: "verified", label: "Verified" },
                    { value: "pending_verification", label: "Pending Verification" },
                    { value: "corrected", label: "Corrected Entry" },
                  ],
                },
              ]}
              submitting={saveClosing.isPending}
              initial={{
                closing_date: editingClosing.closing_date,
                project_id: editingClosing.project_id ?? "",
                account_type: editingClosing.account_type || "petty_cash",
                opening_cash: editingClosing.opening_cash,
                cash_received: editingClosing.cash_received,
                cash_expenses: editingClosing.cash_expenses,
                other_transactions: editingClosing.other_transactions,
                remarks: editingClosing.remarks ?? "",
                edit_reason: "",
                audit_status: "corrected",
              }}
              onSubmit={async (values) => {
                const reason = String(values["edit_reason"] || "Closing updated");
                const auditStatus = String(values["audit_status"] || "corrected");
                const opening = Number(values["opening_cash"] ?? 0);
                const received = Number(values["cash_received"] ?? 0);
                const spent = Number(values["cash_expenses"] ?? 0);
                const other = Number(values["other_transactions"] ?? 0);
                await logRecordFieldDiffs(
                  "cash_closing",
                  editingClosing.id,
                  "accounts",
                  editingClosing as Record<string, unknown>,
                  {
                    closing_date: values["closing_date"],
                    account_type: values["account_type"] || "petty_cash",
                    opening_cash: opening,
                    cash_received: received,
                    cash_expenses: spent,
                    other_transactions: other,
                  },
                  ["closing_date", "account_type", "opening_cash", "cash_received", "cash_expenses", "other_transactions"],
                  reason,
                  auditStatus
                );
                const saveVals = {
                  ...values,
                  project_id: values["project_id"] || null,
                  account_type: values["account_type"] || "petty_cash",
                  opening_cash: opening,
                  cash_received: received,
                  cash_expenses: spent,
                  other_transactions: other,
                  closing_cash: opening + received - spent + other,
                };
                delete (saveVals as any)["edit_reason"];
                delete (saveVals as any)["audit_status"];
                await saveClosing.mutateAsync({
                  id: editingClosing.id,
                  values: saveVals,
                });
                setEditingClosing(null);
              }}
            />
          )}

          {deletingClosing && (
            <ConfirmDeleteDialog
              open={!!deletingClosing}
              onOpenChange={(v) => !v && setDeletingClosing(null)}
              tableName="cash_closing"
              recordId={deletingClosing.id}
              recordTitle={`Cash Closing: ${dateFmt(deletingClosing.closing_date)} (${deletingClosing.account_type || "Petty Cash"})`}
              recordData={deletingClosing}
              title="Delete Cash Closing"
              description={`Delete cash closing for ${dateFmt(deletingClosing.closing_date)}? This action requires MD approval.`}
              onConfirm={async () => {
                await deleteClosing.mutateAsync(deletingClosing.id);
                setDeletingClosing(null);
              }}
            />
          )}

          <DataTable
            rows={filteredClosings}
            columns={closingColumns}
            loading={closings.isLoading}
            exportName="brickweld-cash-closing"
            exportTitle="Cash Closing Report"
            exportDescription="Construction Project Control System — Cash Closing Report"
            appliedFilters={{
              "Date Range": `${from} to ${to}`,
              ...(closingProjectFilter !== "all"
                ? { Project: projectName(closingProjectFilter) }
                : {}),
              ...(closingAccountFilter !== "all"
                ? { Account: closingAccountFilter === "bank" ? "Bank Account" : "Petty Cash" }
                : {}),
            }}
          />
        </TabsContent>

        {/* ================= TRANSFERS ================= */}
        <TabsContent value="transfers" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {canModify && (
              <FormDialog
                title="Transfer Funds (Contra)"
                description="Transfer funds between Bank Account and Petty Cash."
                trigger={
                  <Button>
                    <Plus className="mr-2 size-4" /> New Transfer
                  </Button>
                }
                submitting={saveTransfer.isPending}
                initial={{
                  transfer_date: today(),
                  from_account: "bank",
                  to_account: "petty_cash",
                  amount: 0,
                  reference_number: "",
                  remarks: "",
                }}
                fields={transferFields}
                onSubmit={async (values) => {
                  const amount = Number(values["amount"] ?? 0);
                  await saveTransfer.mutateAsync({
                    values: {
                      ...values,
                      project_id: values["project_id"] || null,
                      from_account: values["from_account"] || "bank",
                      to_account: values["to_account"] || "petty_cash",
                      amount,
                      reference_number: values["reference_number"] || null,
                      remarks: values["remarks"] || null,
                    },
                  });
                }}
              />
            )}

            {/* Transfer Filters */}
            <div className="no-print flex flex-wrap items-end gap-2">
              <div>
                <Select value={transferProjectFilter} onValueChange={setTransferProjectFilter}>
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue placeholder="All Projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {projectOptions.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {transferProjectFilter !== "all" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTransferProjectFilter("all")}
                  className="h-8 px-2 text-xs"
                >
                  <RotateCcw className="mr-1 size-3" /> Reset
                </Button>
              )}
            </div>
          </div>

          {editingTransfer && (
            <FormDialog
              open={!!editingTransfer}
              onOpenChange={(v) => !v && setEditingTransfer(null)}
              title="Edit Transfer"
              fields={transferFields}
              submitting={saveTransfer.isPending}
              initial={{
                transfer_date: editingTransfer.transfer_date,
                project_id: editingTransfer.project_id ?? "",
                from_account: editingTransfer.from_account,
                to_account: editingTransfer.to_account,
                amount: editingTransfer.amount,
                reference_number: editingTransfer.reference_number ?? "",
                remarks: editingTransfer.remarks ?? "",
              }}
              onSubmit={async (values) => {
                const amount = Number(values["amount"] ?? 0);
                await logRecordFieldDiffs(
                  "account_transfers",
                  editingTransfer.id,
                  "accounts",
                  editingTransfer as Record<string, unknown>,
                  {
                    transfer_date: values["transfer_date"],
                    from_account: values["from_account"],
                    to_account: values["to_account"],
                    amount,
                    reference_number: values["reference_number"] || null,
                    remarks: values["remarks"] || null,
                  },
                  ["transfer_date", "from_account", "to_account", "amount", "reference_number", "remarks"]
                );
                await saveTransfer.mutateAsync({
                  id: editingTransfer.id,
                  values: {
                    ...values,
                    project_id: values["project_id"] || null,
                    from_account: values["from_account"] || "bank",
                    to_account: values["to_account"] || "petty_cash",
                    amount,
                    reference_number: values["reference_number"] || null,
                    remarks: values["remarks"] || null,
                  },
                });
                setEditingTransfer(null);
              }}
            />
          )}

          {deletingTransfer && (
            <ConfirmDeleteDialog
              open={!!deletingTransfer}
              onOpenChange={(v) => !v && setDeletingTransfer(null)}
              tableName="account_transfers"
              recordId={deletingTransfer.id}
              recordTitle={`Transfer: ${currency(deletingTransfer.amount)} (${deletingTransfer.from_account} → ${deletingTransfer.to_account})`}
              recordData={deletingTransfer}
              title="Delete Transfer"
              description={`Delete transfer of ${currency(deletingTransfer.amount)} (${dateFmt(deletingTransfer.transfer_date)})? This action requires MD approval.`}
              onConfirm={async () => {
                await deleteTransfer.mutateAsync(deletingTransfer.id);
                setDeletingTransfer(null);
              }}
            />
          )}

          <DataTable
            rows={filteredTransfers}
            columns={transferColumns}
            loading={transfers.isLoading}
            exportName="brickweld-transfers"
            exportTitle="Account Transfers Report"
            exportDescription="Construction Project Control System — Account Transfers Report"
            appliedFilters={{
              "Date Range": `${from} to ${to}`,
              ...(transferProjectFilter !== "all"
                ? { Project: projectName(transferProjectFilter) }
                : {}),
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
