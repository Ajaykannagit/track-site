import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { DataTable, StatCard, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRows, sum } from "@/lib/db";
import { currency, dateFmt, monthStart, today } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports & P&L — Brickweld" },
      {
        name: "description",
        content:
          "Project-wise profit and loss: contract value against labour, material, contractor and other site costs.",
      },
      { property: "og:title", content: "Reports & P&L — Brickweld" },
      {
        property: "og:description",
        content: "Company and project level profitability across a chosen date range.",
      },
    ],
  }),
  component: ReportsPage,
});

type Project = {
  id: string;
  name: string;
  project_code: string;
  status: string;
  quotation_amount: number;
};
type Dated = { id: string; project_id: string | null };
type Expense = Dated & { expense_date: string; category: string; amount: number };
type Attendance = Dated & { attendance_date: string; calculated_wage: number };
type Receipt = Dated & { receipt_date: string; total_amount: number };
type Bill = Dated & { bill_date: string; net_amount: number; status: string };

type Row = {
  id: string;
  code: string;
  name: string;
  status: string;
  value: number;
  labour: number;
  material: number;
  contractor: number;
  other: number;
  cost: number;
  profit: number;
  margin: number;
};

function ReportsPage() {
  const [from, setFrom] = useState(monthStart(-5));
  const [to, setTo] = useState(today());
  const [billStatus, setBillStatus] = useState<string>("all");

  const projects = useRows<Project>("projects", { order: { col: "name", asc: true } });
  const expenses = useRows<Expense>("expenses", {
    filters: [
      { col: "expense_date", op: "gte", value: from },
      { col: "expense_date", op: "lte", value: to },
    ],
  });
  const attendance = useRows<Attendance>("attendance", {
    filters: [
      { col: "attendance_date", op: "gte", value: from },
      { col: "attendance_date", op: "lte", value: to },
    ],
  });
  const receipts = useRows<Receipt>("material_receipts", {
    filters: [
      { col: "receipt_date", op: "gte", value: from },
      { col: "receipt_date", op: "lte", value: to },
    ],
  });
  const bills = useRows<Bill>("contractor_bills", {
    filters: [
      { col: "bill_date", op: "gte", value: from },
      { col: "bill_date", op: "lte", value: to },
      ...(billStatus !== "all" ? [{ col: "status", op: "eq" as const, value: billStatus }] : []),
    ],
  });

  const settings = useRows<{ key: string; value: unknown; description: string | null }>("app_settings", {
    order: { col: "key", asc: true },
  });

  const loading =
    projects.isLoading ||
    expenses.isLoading ||
    attendance.isLoading ||
    receipts.isLoading ||
    bills.isLoading;

  const rows: Row[] = useMemo(() => {
    const byProject = <T extends Dated>(list: T[] | undefined, id: string) =>
      (list ?? []).filter((r) => r.project_id === id);

    return (projects.data ?? []).map((p) => {
      const labour = sum(byProject(attendance.data, p.id), (a) => a.calculated_wage);
      const material = sum(byProject(receipts.data, p.id), (r) => r.total_amount);
      const contractor = sum(byProject(bills.data, p.id), (b) => b.net_amount);
      const other = sum(byProject(expenses.data, p.id), (e) => e.amount);
      const cost = labour + material + contractor + other;
      const value = Number(p.quotation_amount ?? 0);
      const profit = value - cost;
      return {
        id: p.id,
        code: p.project_code,
        name: p.name,
        status: p.status,
        value,
        labour,
        material,
        contractor,
        other,
        cost,
        profit,
        margin: value ? (profit / value) * 100 : 0,
      };
    });
  }, [projects.data, attendance.data, receipts.data, bills.data, expenses.data]);

  const totalValue = sum(rows, (r) => r.value);
  const totalCost = sum(rows, (r) => r.cost);
  const totalProfit = totalValue - totalCost;

  const unallocated =
    sum((expenses.data ?? []).filter((e) => !e.project_id), (e) => e.amount) +
    sum((attendance.data ?? []).filter((a) => !a.project_id), (a) => a.calculated_wage);

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expenses.data ?? []) {
      map.set(e.category, (map.get(e.category) ?? 0) + Number(e.amount ?? 0));
    }
    return [...map.entries()]
      .map(([category, amount], i) => ({ id: `${i}-${category}`, category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses.data]);

  const columns: Column<Row>[] = [
    {
      header: "Project",
      cell: (r) => (
        <Link
          to="/projects/$projectId"
          params={{ projectId: r.id }}
          className="font-medium text-primary hover:underline"
        >
          {r.name}
        </Link>
      ),
      value: (r) => r.name,
    },
    { header: "Code", cell: (r) => r.code, value: (r) => r.code },
    { header: "Status", cell: (r) => <StatusBadge status={r.status} />, value: (r) => r.status },
    {
      header: "Contract value",
      cell: (r) => currency(r.value),
      value: (r) => r.value,
      className: "text-right",
    },
    { header: "Labour", cell: (r) => currency(r.labour), value: (r) => r.labour, className: "text-right" },
    {
      header: "Materials",
      cell: (r) => currency(r.material),
      value: (r) => r.material,
      className: "text-right",
    },
    {
      header: "Contractors",
      cell: (r) => currency(r.contractor),
      value: (r) => r.contractor,
      className: "text-right",
    },
    { header: "Other", cell: (r) => currency(r.other), value: (r) => r.other, className: "text-right" },
    { header: "Total cost", cell: (r) => currency(r.cost), value: (r) => r.cost, className: "text-right" },
    {
      header: "Profit",
      cell: (r) => (
        <span className={r.profit >= 0 ? "font-medium text-success" : "font-medium text-destructive"}>
          {currency(r.profit)}
        </span>
      ),
      value: (r) => r.profit,
      className: "text-right",
    },
    {
      header: "Margin",
      cell: (r) => `${r.margin.toFixed(1)}%`,
      value: (r) => r.margin.toFixed(1),
      className: "text-right",
    },
  ];

  return (
    <div>
      <PageHeader
        title="Reports & P&L"
        description="Contract value against recorded labour, material, contractor and other site costs."
        actions={
          <Button variant="outline" onClick={() => window.print()}>
            Print
          </Button>
        }
      />

      <Card className="no-print mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div>
            <Label htmlFor="from">From</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="to">To</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="w-52">
            <Label htmlFor="bill-status">Contractor bill status</Label>
            <Select value={billStatus} onValueChange={setBillStatus}>
              <SelectTrigger id="bill-status" className="mt-1">
                <SelectValue placeholder="All bill statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="md_approved">MD approved</SelectItem>
                <SelectItem value="payment_approved">Payment approved</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            Costs are counted by document date inside this range. Contract value is the full project quotation.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Contract value" value={currency(totalValue)} />
        <StatCard label="Total cost" value={currency(totalCost)} tone="warning" />
        <StatCard
          label="Profit"
          value={currency(totalProfit)}
          tone={totalProfit >= 0 ? "success" : "destructive"}
          hint={totalValue ? `${((totalProfit / totalValue) * 100).toFixed(1)}% margin` : "No contract value"}
        />
        <StatCard
          label="Unallocated cost"
          value={currency(unallocated)}
          hint="Expenses and wages with no project"
        />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Project-wise P&amp;L</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            rows={rows}
            loading={loading}
            exportName={`pnl-${from}-to-${to}`}
            columns={columns}
            empty="No projects to report on."
          />
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expenses by category</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              rows={byCategory}
              loading={expenses.isLoading}
              searchable={false}
              exportName="expenses-by-category"
              empty="No expenses in this range."
              columns={[
                { header: "Category", cell: (r) => r.category, value: (r) => r.category },
                {
                  header: "Amount",
                  cell: (r) => currency(r.amount),
                  value: (r) => r.amount,
                  className: "text-right",
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuration used</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              rows={(settings.data ?? []).map((s) => ({ id: s.key, ...s }))}
              loading={settings.isLoading}
              searchable={false}
              empty="No configuration entries."
              columns={[
                { header: "Key", cell: (r) => r.key, value: (r) => r.key },
                { header: "Value", cell: (r) => JSON.stringify(r.value), value: (r) => JSON.stringify(r.value) },
                { header: "Description", cell: (r) => r.description ?? "—", value: (r) => r.description },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Report generated {dateFmt(today())}. Figures come only from recorded attendance wages, material
        receipts, contractor bills and expenses — no estimated or projected values are added.
      </p>
    </div>
  );
}
