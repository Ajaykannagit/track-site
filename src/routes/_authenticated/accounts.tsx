import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { DataTable, StatCard, type Column } from "@/components/DataTable";
import { FormDialog } from "@/components/FormDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { useRows, useSaveRow, sum } from "@/lib/db";
import { currency, dateFmt, monthStart, today } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/accounts")({
  head: () => ({
    meta: [
      { title: "Accounts & Cash — Brickweld" },
      {
        name: "description",
        content: "Site expenses, petty cash closing and daily cash position for every construction project.",
      },
      { property: "og:title", content: "Accounts & Cash — Brickweld" },
      { property: "og:description", content: "Track site expenses and daily cash closing balances." },
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
  const { canWriteFinance } = useAuth();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());

  const projects = useRows<{ id: string; name: string }>("projects", { select: "id,name" });
  const categories = useRows<{ id: string; name: string }>("expense_categories", { select: "id,name" });

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
  const saveClosing = useSaveRow("cash_closing", "Cash closing");

  const projectName = (id: string | null) => projects.data?.find((p) => p.id === id)?.name ?? "—";
  const projectOptions = (projects.data ?? []).map((p) => ({ value: p.id, label: p.name }));

  const expenseColumns: Column<Expense>[] = [
    { header: "Date", cell: (r) => dateFmt(r.expense_date), value: (r) => r.expense_date },
    { header: "Project", cell: (r) => projectName(r.project_id), value: (r) => projectName(r.project_id) },
    { header: "Category", cell: (r) => r.category, value: (r) => r.category },
    { header: "Description", cell: (r) => r.description ?? "—", value: (r) => r.description },
    { header: "Method", cell: (r) => r.payment_method ?? "—", value: (r) => r.payment_method },
    {
      header: "Amount",
      cell: (r) => currency(r.amount),
      value: (r) => r.amount,
      className: "text-right",
    },
  ];

  const closingColumns: Column<Closing>[] = [
    { header: "Date", cell: (r) => dateFmt(r.closing_date), value: (r) => r.closing_date },
    { header: "Project", cell: (r) => projectName(r.project_id), value: (r) => projectName(r.project_id) },
    { header: "Opening", cell: (r) => currency(r.opening_cash), value: (r) => r.opening_cash, className: "text-right" },
    { header: "Received", cell: (r) => currency(r.cash_received), value: (r) => r.cash_received, className: "text-right" },
    { header: "Spent", cell: (r) => currency(r.cash_expenses), value: (r) => r.cash_expenses, className: "text-right" },
    { header: "Other", cell: (r) => currency(r.other_transactions), value: (r) => r.other_transactions, className: "text-right" },
    { header: "Closing", cell: (r) => currency(r.closing_cash), value: (r) => r.closing_cash, className: "text-right" },
  ];

  const expenseRows = expenses.data ?? [];
  const closingRows = closings.data ?? [];

  return (
    <div>
      <PageHeader
        title="Accounts & Cash"
        description="Site expenses, petty cash movement and daily closing balances."
      />

      <div className="no-print mb-4 flex flex-wrap items-end gap-3">
        <div>
          <Label className="mb-1.5 block text-xs">From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs">To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="Total expenses" value={currency(sum(expenseRows, (r) => r.amount))} tone="destructive" />
        <StatCard label="Cash received" value={currency(sum(closingRows, (r) => r.cash_received))} tone="success" />
        <StatCard
          label="Latest closing cash"
          value={currency(closingRows.length ? closingRows[0]!.closing_cash : 0)}
        />
      </div>

      <Tabs defaultValue="expenses">
        <TabsList className="no-print">
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="cash">Cash closing</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses" className="mt-4 space-y-3">
          {canWriteFinance ? (
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
              fields={[
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
              ]}
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
          ) : null}
          <DataTable
            rows={expenseRows}
            columns={expenseColumns}
            loading={expenses.isLoading}
            exportName="expenses"
          />
        </TabsContent>

        <TabsContent value="cash" className="mt-4 space-y-3">
          {canWriteFinance ? (
            <FormDialog
              title="Cash closing"
              description="Close the day's cash position for a project site."
              trigger={
                <Button>
                  <Plus className="mr-2 size-4" /> Close cash
                </Button>
              }
              submitting={saveClosing.isPending}
              initial={{ closing_date: today(), opening_cash: 0, cash_received: 0, cash_expenses: 0, other_transactions: 0 }}
              fields={[
                { name: "closing_date", label: "Date", type: "date", required: true },
                { name: "project_id", label: "Project", type: "select", options: projectOptions },
                { name: "opening_cash", label: "Opening cash (₹)", type: "number" },
                { name: "cash_received", label: "Cash received (₹)", type: "number" },
                { name: "cash_expenses", label: "Cash expenses (₹)", type: "number" },
                { name: "other_transactions", label: "Other transactions (₹)", type: "number" },
                { name: "remarks", label: "Remarks", type: "textarea" },
              ]}
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
          ) : null}
          <DataTable
            rows={closingRows}
            columns={closingColumns}
            loading={closings.isLoading}
            exportName="cash-closing"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
