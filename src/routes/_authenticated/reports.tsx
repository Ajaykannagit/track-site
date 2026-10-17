import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { DataTable, StatCard, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRows, sum } from "@/lib/db";
import { currency, dateFmt, monthStart, today } from "@/lib/format";
import { Printer, RotateCcw, Building2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports & P&L — Brickweld Pvt Ltd" },
      {
        name: "description",
        content:
          "Project-wise profit and loss: contract value against labour, material, contractor and other site costs.",
      },
      { property: "og:title", content: "Reports & P&L — Brickweld Pvt Ltd" },
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
  site_address: string | null;
  start_date: string | null;
  expected_completion_date: string | null;
};
type Dated = { id: string; project_id: string | null };
type Expense = Dated & { expense_date: string; category: string; amount: number; payment_method?: string | null; description?: string | null };
type Attendance = Dated & { attendance_date: string; calculated_wage: number };
type Receipt = Dated & { receipt_date: string; total_amount: number; receipt_number: string };
type Bill = Dated & { bill_date: string; net_amount: number; status: string; bill_number: string };

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
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");

  const projects = useRows<Project>("projects_view", { order: { col: "name", asc: true } });
  const expenses = useRows<Expense>("expenses", {
    filters: [
      { col: "expense_date", op: "gte", value: from },
      { col: "expense_date", op: "lte", value: to },
    ],
  });
  const attendance = useRows<Attendance>("attendance_view", {
    filters: [
      { col: "attendance_date", op: "gte", value: from },
      { col: "attendance_date", op: "lte", value: to },
    ],
  });
  const receipts = useRows<Receipt>("material_receipts_view", {
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

  const settings = useRows<{ key: string; value: unknown; description: string | null }>(
    "app_settings",
    {
      order: { col: "key", asc: true },
    },
  );

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

  const selectedProjectObj = useMemo(() => {
    if (selectedProjectId === "all") return null;
    return (projects.data ?? []).find((p) => p.id === selectedProjectId) ?? null;
  }, [projects.data, selectedProjectId]);

  const selectedProjectRow = useMemo(() => {
    if (selectedProjectId === "all") return null;
    return rows.find((r) => r.id === selectedProjectId) ?? null;
  }, [rows, selectedProjectId]);

  // Project-specific sub-items
  const selectedProjectExpenses = useMemo(() => {
    if (selectedProjectId === "all") return [];
    return (expenses.data ?? []).filter((e) => e.project_id === selectedProjectId);
  }, [expenses.data, selectedProjectId]);

  const selectedProjectBills = useMemo(() => {
    if (selectedProjectId === "all") return [];
    return (bills.data ?? []).filter((b) => b.project_id === selectedProjectId);
  }, [bills.data, selectedProjectId]);

  const totalValue = selectedProjectRow ? selectedProjectRow.value : sum(rows, (r) => r.value);
  const totalCost = selectedProjectRow ? selectedProjectRow.cost : sum(rows, (r) => r.cost);
  const totalProfit = selectedProjectRow ? selectedProjectRow.profit : totalValue - totalCost;

  const unallocated =
    sum(
      (expenses.data ?? []).filter((e) => !e.project_id),
      (e) => e.amount,
    ) +
    sum(
      (attendance.data ?? []).filter((a) => !a.project_id),
      (a) => a.calculated_wage,
    );

  const byCategory = useMemo(() => {
    const list = selectedProjectId === "all"
      ? (expenses.data ?? [])
      : (expenses.data ?? []).filter((e) => e.project_id === selectedProjectId);

    const map = new Map<string, number>();
    for (const e of list) {
      map.set(e.category, (map.get(e.category) ?? 0) + Number(e.amount ?? 0));
    }
    return [...map.entries()]
      .map(([category, amount], i) => ({ id: `${i}-${category}`, category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses.data, selectedProjectId]);

  const byPaymentMethod = useMemo(() => {
    const list = selectedProjectId === "all"
      ? (expenses.data ?? [])
      : (expenses.data ?? []).filter((e) => e.project_id === selectedProjectId);

    const map = new Map<string, number>();
    for (const e of list) {
      const method = e.payment_method ? e.payment_method.toUpperCase() : "Not recorded";
      map.set(method, (map.get(method) ?? 0) + Number(e.amount ?? 0));
    }
    return [...map.entries()]
      .map(([method, amount], i) => ({ id: `${i}-${method}`, method, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses.data, selectedProjectId]);

  const handlePrint = (projectId?: string) => {
    if (projectId && projectId !== selectedProjectId) {
      setSelectedProjectId(projectId);
      setTimeout(() => {
        window.print();
      }, 200);
    } else {
      window.print();
    }
  };

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
    {
      header: "Labour",
      cell: (r) => currency(r.labour),
      value: (r) => r.labour,
      className: "text-right",
    },
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
    {
      header: "Other",
      cell: (r) => currency(r.other),
      value: (r) => r.other,
      className: "text-right",
    },
    {
      header: "Total cost",
      cell: (r) => currency(r.cost),
      value: (r) => r.cost,
      className: "text-right",
    },
    {
      header: "Profit",
      cell: (r) => (
        <span
          className={r.profit >= 0 ? "font-medium text-success" : "font-medium text-destructive"}
        >
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
    {
      header: "Print",
      className: "text-center no-print w-20",
      cell: (r: Row) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-primary hover:bg-primary/10"
          title={`Print P&L for ${r.name}`}
          onClick={() => handlePrint(r.id)}
        >
          <Printer className="mr-1 size-3.5" /> Print
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={
          selectedProjectObj
            ? `P&L Report — ${selectedProjectObj.name} (${selectedProjectObj.project_code})`
            : "Reports & P&L"
        }
        description={
          selectedProjectObj
            ? `Single-project statement: contract quotation against recorded labour, materials, bills & expenses.`
            : "Project-wise and company level profit & loss report across chosen date range."
        }
        actions={
          <div className="flex items-center gap-2">
            {selectedProjectId !== "all" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedProjectId("all")}
                className="text-xs"
              >
                <RotateCcw className="mr-1 size-3" /> View All Projects
              </Button>
            )}
            <Button variant="outline" onClick={() => handlePrint()}>
              <Printer className="mr-1.5 size-4" />
              {selectedProjectId === "all" ? "Print Complete P&L" : `Print ${selectedProjectObj?.project_code} P&L`}
            </Button>
          </div>
        }
      />

      {/* Filter Card */}
      <Card className="no-print mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="w-56">
            <Label htmlFor="project-select">Report Scope / Project</Label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger id="project-select" className="mt-1">
                <SelectValue placeholder="All Projects (Complete Report)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects (Complete Report)</SelectItem>
                {(projects.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.project_code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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

      {/* Printable Header (Visible during Print) */}
      <div className="hidden print:block mb-6 border-b pb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold font-display">BRICKWELD PRIVATE LIMITED</h1>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Civil - Interior - Fabrication</p>
            <h2 className="text-lg font-semibold mt-2">
              {selectedProjectObj
                ? `Project Profit & Loss (P&L) Statement: ${selectedProjectObj.name} (${selectedProjectObj.project_code})`
                : "Company Project-wise Profit & Loss (P&L) Statement"}
            </h2>
          </div>
          <div className="text-right text-xs">
            <p><strong>Period:</strong> {dateFmt(from)} to {dateFmt(to)}</p>
            <p><strong>Generated on:</strong> {dateFmt(today())}</p>
            {selectedProjectObj?.site_address && <p><strong>Site:</strong> {selectedProjectObj.site_address}</p>}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={selectedProjectObj ? `${selectedProjectObj.project_code} Contract value` : "Contract value"}
          value={currency(totalValue)}
        />
        <StatCard
          label={selectedProjectObj ? `${selectedProjectObj.project_code} Total cost` : "Total cost"}
          value={currency(totalCost)}
          tone="warning"
        />
        <StatCard
          label="Net Profit"
          value={currency(totalProfit)}
          tone={totalProfit >= 0 ? "success" : "destructive"}
          hint={
            totalValue
              ? `${((totalProfit / totalValue) * 100).toFixed(1)}% profit margin`
              : "No contract value"
          }
        />
        {selectedProjectId === "all" ? (
          <StatCard
            label="Unallocated cost"
            value={currency(unallocated)}
            hint="Expenses and wages with no project"
          />
        ) : (
          <StatCard
            label="Project Status"
            value={selectedProjectObj?.status?.toUpperCase() ?? "ACTIVE"}
            hint={selectedProjectObj?.site_address || "Site project"}
            tone="default"
          />
        )}
      </div>

      {/* SINGLE PROJECT DETAILED BREAKDOWN (When a single project is selected) */}
      {selectedProjectObj && selectedProjectRow && (
        <Card className="mt-4 border-primary/30">
          <CardHeader className="bg-muted/40">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="size-4 text-primary" />
                  Detailed Cost Breakdown — {selectedProjectObj.name} ({selectedProjectObj.project_code})
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Site: {selectedProjectObj.site_address ?? "Not specified"} | Status: {selectedProjectObj.status.toUpperCase()}
                </p>
              </div>
              <Button size="sm" variant="outline" className="no-print" onClick={() => window.print()}>
                <Printer className="mr-1.5 size-3.5" /> Print Single Project P&L
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border">
                <thead className="bg-muted/60 text-xs">
                  <tr>
                    <th className="p-2.5 text-left border">Financial Head / Cost Category</th>
                    <th className="p-2.5 text-right border">Amount (₹)</th>
                    <th className="p-2.5 text-right border">% of Contract Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="p-2.5 font-bold border">1. Total Contract / Quotation Value</td>
                    <td className="p-2.5 text-right font-bold border font-mono">{currency(selectedProjectRow.value)}</td>
                    <td className="p-2.5 text-right border font-mono">100.0%</td>
                  </tr>
                  <tr className="bg-muted/10">
                    <td className="p-2.5 pl-6 border">Labour & Wages Cost</td>
                    <td className="p-2.5 text-right border font-mono">{currency(selectedProjectRow.labour)}</td>
                    <td className="p-2.5 text-right border font-mono text-xs text-muted-foreground">
                      {selectedProjectRow.value ? `${((selectedProjectRow.labour / selectedProjectRow.value) * 100).toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                  <tr className="bg-muted/10">
                    <td className="p-2.5 pl-6 border">Material Goods Received Cost</td>
                    <td className="p-2.5 text-right border font-mono">{currency(selectedProjectRow.material)}</td>
                    <td className="p-2.5 text-right border font-mono text-xs text-muted-foreground">
                      {selectedProjectRow.value ? `${((selectedProjectRow.material / selectedProjectRow.value) * 100).toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                  <tr className="bg-muted/10">
                    <td className="p-2.5 pl-6 border">Contractor Works Net Billed</td>
                    <td className="p-2.5 text-right border font-mono">{currency(selectedProjectRow.contractor)}</td>
                    <td className="p-2.5 text-right border font-mono text-xs text-muted-foreground">
                      {selectedProjectRow.value ? `${((selectedProjectRow.contractor / selectedProjectRow.value) * 100).toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                  <tr className="bg-muted/10">
                    <td className="p-2.5 pl-6 border">Other Site & Fuel Expenses</td>
                    <td className="p-2.5 text-right border font-mono">{currency(selectedProjectRow.other)}</td>
                    <td className="p-2.5 text-right border font-mono text-xs text-muted-foreground">
                      {selectedProjectRow.value ? `${((selectedProjectRow.other / selectedProjectRow.value) * 100).toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                  <tr className="bg-warning/10 font-semibold">
                    <td className="p-2.5 font-bold border">2. Total Project Cost Incurred</td>
                    <td className="p-2.5 text-right font-bold text-warning-foreground border font-mono">
                      {currency(selectedProjectRow.cost)}
                    </td>
                    <td className="p-2.5 text-right border font-mono">
                      {selectedProjectRow.value ? `${((selectedProjectRow.cost / selectedProjectRow.value) * 100).toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                  <tr className={selectedProjectRow.profit >= 0 ? "bg-emerald-500/10 font-bold" : "bg-destructive/10 font-bold"}>
                    <td className="p-2.5 font-bold border text-base">3. Net Profit / (Loss)</td>
                    <td className={`p-2.5 text-right font-bold border font-mono text-base ${selectedProjectRow.profit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}`}>
                      {currency(selectedProjectRow.profit)}
                    </td>
                    <td className="p-2.5 text-right border font-mono font-bold text-base">
                      {selectedProjectRow.margin.toFixed(1)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ALL PROJECTS P&L TABLE (or filtered single project row) */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">
            {selectedProjectId === "all" ? "All Projects P&L Table" : `Project Summary: ${selectedProjectObj?.name}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            rows={selectedProjectId === "all" ? rows : rows.filter((r) => r.id === selectedProjectId)}
            loading={loading}
            exportName="brickweld-project-pnl"
            exportTitle={selectedProjectObj ? `P&L Report: ${selectedProjectObj.name}` : "Project Profit & Loss (P&L) Report"}
            exportDescription="Construction Project Control System — Project-wise Profit & Loss Report"
            appliedFilters={{
              "Scope": selectedProjectObj ? selectedProjectObj.name : "All Projects",
              "Date Range": `${from} to ${to}`,
              ...(billStatus !== "all"
                ? { "Contractor Bill Status": billStatus.replace(/_/g, " ") }
                : {}),
            }}
            columns={columns}
            empty="No projects found."
          />
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedProjectObj ? `Expenses for ${selectedProjectObj.project_code} by Category` : "Expenses by category"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              rows={byCategory}
              loading={expenses.isLoading}
              searchable={false}
              exportName="brickweld-expenses-by-category"
              exportTitle="Expenses by Category Report"
              exportDescription="Construction Project Control System — Expenses by Category"
              appliedFilters={{ "Date Range": `${from} to ${to}` }}
              empty="No expenses recorded in this range."
              columns={[
                { header: "Category", cell: (r) => r.category, value: (r) => r.category },
                {
                  header: "Amount",
                  cell: (r) => currency(r.amount),
                  value: (r) => r.amount,
                  className: "text-right font-mono",
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedProjectObj ? `Expenses by Payment Method` : "Expenses by payment method"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              rows={byPaymentMethod}
              loading={expenses.isLoading}
              searchable={false}
              exportName="brickweld-expenses-by-payment-method"
              exportTitle="Expenses by Payment Method Report"
              exportDescription="Construction Project Control System — Expenses by Payment Method"
              appliedFilters={{ "Date Range": `${from} to ${to}` }}
              empty="No expenses recorded in this range."
              columns={[
                { header: "Payment Method", cell: (r) => r.method, value: (r) => r.method },
                {
                  header: "Amount",
                  cell: (r) => currency(r.amount),
                  value: (r) => r.amount,
                  className: "text-right font-mono",
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
                {
                  header: "Value",
                  cell: (r) => JSON.stringify(r.value),
                  value: (r) => JSON.stringify(r.value),
                },
                {
                  header: "Description",
                  cell: (r) => r.description ?? "—",
                  value: (r) => r.description,
                },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Report generated {dateFmt(today())}. Figures come strictly from recorded attendance wages,
        material receipts, contractor bills and expenses — no estimated or projected values are
        added.
      </p>
    </div>
  );
}
