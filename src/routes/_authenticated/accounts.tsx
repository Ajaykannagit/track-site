import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { DataTable, StatCard, type Column } from "@/components/DataTable";
import { FormDialog, type Field } from "@/components/FormDialog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
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

export const Route = createFileRoute("/_authenticated/accounts")({
  head: () => ({
    meta: [
      { title: "Accounts & Cash — Brickweld" },
      {
        name: "description",
        content:
          "Site expenses, petty cash closing and daily cash position for every construction project.",
      },
      { property: "og:title", content: "Accounts & Cash — Brickweld" },
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
  description: string | null;
  amount: number;
  payment_method: string | null;
};

type Closing = {
  id: string;
  closing_date: string;
  project_id: string | null;
  opening_cash: number;
  cash_received: number;
  cash_expenses: number;
  other_transactions: number;
  closing_cash: number;
  remarks: string | null;
};

function AccountsPage() {
  const { canWriteFinance, isMD } = useAuth();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());

  // Edit / Delete states
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);

  const [editingClosing, setEditingClosing] = useState<Closing | null>(null);
  const [deletingClosing, setDeletingClosing] = useState<Closing | null>(null);

  // Filters
  const [expenseProjectFilter, setExpenseProjectFilter] = useState<string>("all");
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState<string>("all");
  const [closingProjectFilter, setClosingProjectFilter] = useState<string>("all");

  const projects = useRows<{ id: string; name: string }>("projects", { select: "id,name" });
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

  const saveExpense = useSaveRow("expenses", "Expense");
  const deleteExpense = useDeleteRow("expenses", "Expense");

  const saveClosing = useSaveRow("cash_closing", "Cash closing");
  const deleteClosing = useDeleteRow("cash_closing", "Cash closing");

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
    return list;
  }, [closings.data, closingProjectFilter]);

  const expenseColumns: Column<Expense>[] = [
    { header: "Date", cell: (r) => dateFmt(r.expense_date), value: (r) => r.expense_date },
    {
      header: "Project",
      cell: (r) => projectName(r.project_id),
      value: (r) => projectName(r.project_id),
    },
    { header: "Category", cell: (r) => r.category, value: (r) => r.category },
    { header: "Description", cell: (r) => r.description ?? "—", value: (r) => r.description },
    { header: "Method", cell: (r) => r.payment_method ?? "—", value: (r) => r.payment_method },
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
            className: "text-right w-24",
            cell: (r: Expense) => (
              <div className="flex items-center justify-end gap-1">
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
            className: "text-right w-24",
            cell: (r: Closing) => (
              <div className="flex items-center justify-end gap-1">
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

  const expenseFields: Field[] = [
    { name: "expense_date", label: "Date", type: "date", required: true },
    { name: "project_id", label: "Project", type: "select", options: projectOptions },
    {
      name: "category",
      label: "Category",
      type: "select",
      required: true,
      options: (categories.data ?? []).map((c) => ({ value: c.name, label: c.name })),
    },
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
    { name: "project_id", label: "Project", type: "select", options: projectOptions },
    { name: "opening_cash", label: "Opening cash (₹)", type: "number" },
    { name: "cash_received", label: "Cash received (₹)", type: "number" },
    { name: "cash_expenses", label: "Cash expenses (₹)", type: "number" },
    { name: "other_transactions", label: "Other transactions (₹)", type: "number" },
    { name: "remarks", label: "Remarks", type: "textarea" },
  ];

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

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Total expenses"
          value={currency(sum(filteredExpenses, (r) => r.amount))}
          tone="destructive"
        />
        <StatCard
          label="Cash received"
          value={currency(sum(filteredClosings, (r) => r.cash_received))}
          tone="success"
        />
        <StatCard
          label="Latest closing cash"
          value={currency(filteredClosings.length ? filteredClosings[0]!.closing_cash : 0)}
        />
      </div>

      <Tabs defaultValue="expenses">
        <TabsList className="no-print">
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="cash">Cash closing</TabsTrigger>
        </TabsList>

        {/* ================= EXPENSES ================= */}
        <TabsContent value="expenses" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {canModify && (
              <FormDialog
                title="Add expense"
                description="Record a site or office expense against a project."
                trigger={
                  <Button>
                    <Plus className="mr-2 size-4" /> Add expense
                  </Button>
                }
                submitting={saveExpense.isPending}
                initial={{ expense_date: today(), payment_method: "cash" }}
                fields={expenseFields}
                onSubmit={async (values) => {
                  await saveExpense.mutateAsync({
                    values: {
                      ...values,
                      project_id: values["project_id"] || null,
                      amount: Number(values["amount"] ?? 0),
                    },
                  });
                }}
              />
            )}

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
                    {(categories.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
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
              fields={expenseFields}
              submitting={saveExpense.isPending}
              initial={{
                expense_date: editingExpense.expense_date,
                project_id: editingExpense.project_id ?? "",
                category: editingExpense.category,
                payment_method: editingExpense.payment_method ?? "cash",
                amount: editingExpense.amount,
                description: editingExpense.description ?? "",
              }}
              onSubmit={async (values) => {
                await saveExpense.mutateAsync({
                  id: editingExpense.id,
                  values: {
                    ...values,
                    project_id: values["project_id"] || null,
                    amount: Number(values["amount"] ?? 0),
                  },
                });
                setEditingExpense(null);
              }}
            />
          )}

          {deletingExpense && (
            <ConfirmDeleteDialog
              open={!!deletingExpense}
              onOpenChange={(v) => !v && setDeletingExpense(null)}
              title="Delete expense"
              description={`Are you sure you want to delete expense of ${currency(deletingExpense.amount)} (${deletingExpense.category})? This action cannot be undone.`}
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

            {/* Closing Project Filter */}
            <div className="no-print flex items-center gap-2">
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
              {closingProjectFilter !== "all" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setClosingProjectFilter("all")}
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
              fields={closingFields}
              submitting={saveClosing.isPending}
              initial={{
                closing_date: editingClosing.closing_date,
                project_id: editingClosing.project_id ?? "",
                opening_cash: editingClosing.opening_cash,
                cash_received: editingClosing.cash_received,
                cash_expenses: editingClosing.cash_expenses,
                other_transactions: editingClosing.other_transactions,
                remarks: editingClosing.remarks ?? "",
              }}
              onSubmit={async (values) => {
                const opening = Number(values["opening_cash"] ?? 0);
                const received = Number(values["cash_received"] ?? 0);
                const spent = Number(values["cash_expenses"] ?? 0);
                const other = Number(values["other_transactions"] ?? 0);
                await saveClosing.mutateAsync({
                  id: editingClosing.id,
                  values: {
                    ...values,
                    project_id: values["project_id"] || null,
                    opening_cash: opening,
                    cash_received: received,
                    cash_expenses: spent,
                    other_transactions: other,
                    closing_cash: opening + received - spent + other,
                  },
                });
                setEditingClosing(null);
              }}
            />
          )}

          {deletingClosing && (
            <ConfirmDeleteDialog
              open={!!deletingClosing}
              onOpenChange={(v) => !v && setDeletingClosing(null)}
              title="Delete cash closing"
              description={`Are you sure you want to delete cash closing for ${dateFmt(deletingClosing.closing_date)}? This action cannot be undone.`}
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
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
