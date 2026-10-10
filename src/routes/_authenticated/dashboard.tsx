import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/AppShell";
import { StatCard } from "@/components/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { useRows, sum } from "@/lib/db";
import { currency, dateFmt, monthStart } from "@/lib/format";
import { Building2, ChevronRight, DollarSign, PackageCheck, Receipt, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Brickweld Pvt Ltd" },
      {
        name: "description",
        content: "Live view of project value, site spend, pending approvals and cash position.",
      },
      { property: "og:title", content: "Dashboard — Brickweld Pvt Ltd" },
      {
        property: "og:description",
        content: "Project value, spend, approvals and cash at a glance.",
      },
    ],
  }),
  component: Dashboard,
});

type Project = {
  id: string;
  name: string;
  project_code: string;
  status: string;
  quotation_amount: number;
  start_date: string | null;
  site_address?: string | null;
};

type ExpenseRow = {
  id: string;
  amount: number;
  expense_date: string;
  category: string;
  material_name?: string | null;
  description?: string | null;
  project_id: string | null;
};

type MaterialReceiptRow = {
  id: string;
  receipt_number: string;
  receipt_date: string;
  total_amount: number;
  material_name?: string | null;
  project_id: string | null;
  supplier_id?: string | null;
};

function Dashboard() {
  const { isMD, permissions, roles } = useAuth();
  const isViewer = roles.length === 1 && roles[0] === "viewer";
  const from = monthStart(-5);

  // Dialog States
  const [activeProjectsDialogOpen, setActiveProjectsDialogOpen] = useState(false);
  const [contractValueDialogOpen, setContractValueDialogOpen] = useState(false);
  const [materialSpendDialogOpen, setMaterialSpendDialogOpen] = useState(false);
  const [officeExpensesDialogOpen, setOfficeExpensesDialogOpen] = useState(false);

  // Projects query: visible to all authenticated users
  const projects = useRows<Project>("projects", {
    order: { col: "created_at" },
    enabled: permissions.canViewProjects,
  });

  // Financial queries: only enabled if user has company/project financial permission
  const expenses = useRows<ExpenseRow>("expenses", {
    filters: [{ col: "expense_date", op: "gte", value: from }],
    order: { col: "expense_date" },
    enabled: permissions.canViewCompanyFinancials,
  });
  const allExpenses = useRows<ExpenseRow>("expenses", {
    select: "id,amount,expense_date,category,material_name,description,project_id",
    enabled: permissions.canViewCompanyFinancials,
  });
  const attendance = useRows<{ calculated_wage: number; attendance_date: string }>("attendance", {
    select: "calculated_wage,attendance_date",
    filters: [{ col: "attendance_date", op: "gte", value: from }],
    enabled: permissions.canViewCompanyFinancials,
  });
  const bills = useRows<{
    id: string;
    net_amount: number;
    status: string;
    bill_number: string;
    bill_date: string;
  }>("contractor_bills", {
    select: "id,net_amount,status,bill_number,bill_date",
    order: { col: "bill_date" },
    limit: 8,
    enabled: permissions.canViewMaterialContractorCosts,
  });
  const requests = useRows<{
    id: string;
    request_number: string;
    status: string;
    total_amount: number;
  }>("material_requests", {
    select: "id,request_number,status,total_amount",
    order: { col: "request_date" },
    limit: 8,
    enabled: permissions.canViewMaterialsAndContractors,
  });
  const cash = useRows<{ closing_cash: number; closing_date: string }>("cash_closing", {
    select: "closing_cash,closing_date",
    order: { col: "closing_date" },
    limit: 1,
    enabled: permissions.canViewCompanyFinancials,
  });

  const allAttendance = useRows<{ project_id: string | null; calculated_wage: number }>(
    "attendance",
    {
      select: "project_id,calculated_wage",
      enabled: permissions.canViewProjectFinancials,
    },
  );
  const allReceipts = useRows<MaterialReceiptRow>("material_receipts", {
    select: "id,receipt_number,receipt_date,total_amount,material_name,project_id,supplier_id",
    enabled: permissions.canViewProjectFinancials,
  });
  const allBills = useRows<{ project_id: string | null; net_amount: number }>("contractor_bills", {
    select: "project_id,net_amount",
    enabled: permissions.canViewProjectFinancials,
  });
  const allQuotations = useRows<{ project_id: string; amount: number }>("project_quotations", {
    select: "project_id,amount",
    enabled: permissions.canViewProjectFinancials,
  });

  const getProjectContractValue = (p: Project) => {
    const extra = sum(
      (allQuotations.data ?? []).filter((q) => q.project_id === p.id),
      (q) => Number(q.amount || 0),
    );
    return Number(p.quotation_amount || 0) + extra;
  };

  const projectBreakdown = (projectId: string) => {
    if (!permissions.canViewProjectFinancials) {
      return { labour: 0, material: 0, contractor: 0, other: 0, cost: 0 };
    }
    const labour = sum(
      (allAttendance.data ?? []).filter((a) => a.project_id === projectId),
      (a) => a.calculated_wage,
    );
    const material = sum(
      (allReceipts.data ?? []).filter((r) => r.project_id === projectId),
      (r) => r.total_amount,
    );
    const contractor = sum(
      (allBills.data ?? []).filter((b) => b.project_id === projectId),
      (b) => b.net_amount,
    );
    const other = sum(
      (allExpenses.data ?? []).filter((e) => e.project_id === projectId),
      (e) => e.amount,
    );
    const cost = labour + material + contractor + other;
    return { labour, material, contractor, other, cost };
  };

  const active = (projects.data ?? []).filter((p) => p.status === "active");
  const contractValue = sum(projects.data ?? [], (p) => getProjectContractValue(p));
  const spend =
    sum(expenses.data ?? [], (e) => e.amount) +
    sum(attendance.data ?? [], (a) => a.calculated_wage);
  const pendingBills = (bills.data ?? []).filter(
    (b) => !["paid", "payment_approved", "closed", "rejected"].includes(b.status),
  );
  const pendingRequests = (requests.data ?? []).filter(
    (r) => !["approved", "ordered", "received", "closed", "rejected"].includes(r.status),
  );

  // Office Expenses: project_id === null or category is administrative overhead
  const officeExpensesList = (allExpenses.data ?? []).filter(
    (e) =>
      !e.project_id ||
      ["Stationery", "Telephone / Internet", "Travel", "Professional Fees", "Bank Charges"].includes(
        e.category,
      ),
  );
  const totalOfficeExpenses = sum(officeExpensesList, (e) => e.amount);

  // Material Expenditures
  const materialReceiptsList = allReceipts.data ?? [];
  const totalMaterialReceipts = sum(materialReceiptsList, (r) => r.total_amount);

  // Category breakdown for Material Spend
  const materialCategoryMap = new Map<string, number>();
  for (const r of materialReceiptsList) {
    const key = r.material_name || "General Material Supply";
    materialCategoryMap.set(key, (materialCategoryMap.get(key) ?? 0) + Number(r.total_amount ?? 0));
  }
  for (const e of allExpenses.data ?? []) {
    if (e.material_name) {
      materialCategoryMap.set(
        e.material_name,
        (materialCategoryMap.get(e.material_name) ?? 0) + Number(e.amount ?? 0),
      );
    }
  }
  const materialCategories = [...materialCategoryMap.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount);

  const byMonth = new Map<string, number>();
  for (const e of expenses.data ?? []) {
    const k = (e.expense_date ?? "").slice(0, 7);
    byMonth.set(k, (byMonth.get(k) ?? 0) + Number(e.amount ?? 0));
  }
  for (const a of attendance.data ?? []) {
    const k = (a.attendance_date ?? "").slice(0, 7);
    byMonth.set(k, (byMonth.get(k) ?? 0) + Number(a.calculated_wage ?? 0));
  }
  const trend = [...byMonth.entries()].sort().map(([month, value]) => ({ month, value }));

  const byCategory = new Map<string, number>();
  for (const e of expenses.data ?? []) {
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + Number(e.amount ?? 0));
  }
  const pie = [...byCategory.entries()].map(([name, value]) => ({ name, value })).slice(0, 6);
  const pieColors = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
    "var(--muted-foreground)",
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={
          isViewer
            ? "Overview of active and completed construction projects."
            : permissions.canViewCompanyFinancials
              ? "Live view of active projects, site spend, procurement approvals and corporate cash position."
              : "Live operational view of active construction projects and site status."
        }
        actions={
          permissions.canViewOfficeExpense ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOfficeExpensesDialogOpen(true)}
                className="h-9 text-xs"
              >
                <Receipt className="mr-1.5 size-3.5" /> Office Expenses
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* Role notice if non-MD */}
      {!permissions.canViewCompanyFinancials && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-muted bg-muted/30 p-3 text-xs text-muted-foreground">
          <ShieldAlert className="size-4 shrink-0 text-muted-foreground" />
          <span>
            <strong>Role-based View:</strong> Showing operational view according to your role permissions.
          </span>
        </div>
      )}

      {/* StatCards: Full cards for MD; Active projects only for Viewer & Supervisor */}
      {permissions.canViewCompanyFinancials ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div
            onClick={() => setActiveProjectsDialogOpen(true)}
            className="cursor-pointer transition-transform hover:scale-[1.01]"
            title="Click to view Active Projects summary"
          >
            <StatCard
              label="Active projects (Click)"
              value={String(active.length)}
              hint={`${(projects.data ?? []).length} total projects`}
            />
          </div>

          <div
            onClick={() => setContractValueDialogOpen(true)}
            className="cursor-pointer transition-transform hover:scale-[1.01]"
            title="Click for Project Financial Breakdown"
          >
            <StatCard
              label="Contract value (Click)"
              value={currency(contractValue)}
              hint="All active & completed projects"
            />
          </div>

          <div
            onClick={() => setMaterialSpendDialogOpen(true)}
            className="cursor-pointer transition-transform hover:scale-[1.01]"
            title="Click for Material Expenditure Breakdown"
          >
            <StatCard
              label="Spend 6M (Click)"
              value={currency(spend)}
              hint="Expenses + site wages"
              tone="warning"
            />
          </div>

          <StatCard
            label="Cash on hand"
            value={currency(cash.data?.[0]?.closing_cash ?? 0)}
            hint={
              cash.data?.[0]
                ? `As of ${dateFmt(cash.data[0].closing_date)}`
                : "No closing recorded"
            }
            tone="success"
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div
            onClick={() => setActiveProjectsDialogOpen(true)}
            className="cursor-pointer transition-transform hover:scale-[1.01]"
            title="Click to view Active Projects summary"
          >
            <StatCard
              label="Active projects"
              value={String(active.length)}
              hint={`${(projects.data ?? []).length} total projects`}
            />
          </div>
        </div>
      )}

      {/* Charts Section: MD Only */}
      {permissions.canViewCompanyFinancials && (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Monthly site cost trend</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} width={70} />
                  <Tooltip formatter={(v: number) => currency(v)} />
                  <Bar dataKey="value" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Expenses by category</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius={45} outerRadius={85}>
                    {pie.map((_, i) => (
                      <Cell key={i} fill={pieColors[i % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => currency(v)} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Lists Section */}
      <div className={`mt-4 grid gap-4 ${isViewer ? "grid-cols-1" : "lg:grid-cols-3"}`}>
        <Card className={isViewer ? "col-span-1" : "lg:col-span-2"}>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Active projects list</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveProjectsDialogOpen(true)}
              className="h-7 text-xs"
            >
              View Summary <ChevronRight className="ml-1 size-3" />
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {active.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active projects.</p>
            ) : (
              active.slice(0, 8).map((p) => {
                const breakdown = projectBreakdown(p.id);
                return (
                  <Link
                    key={p.id}
                    to="/projects/$projectId"
                    params={{ projectId: p.id }}
                    className="flex items-center justify-between rounded-md border p-3 transition-colors hover:bg-accent/10"
                  >
                    <div>
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.project_code} · started {dateFmt(p.start_date)}
                      </p>
                    </div>
                    {permissions.canViewProjectFinancials && (
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {currency(getProjectContractValue(p))}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Cost:{" "}
                          <span className="font-medium text-foreground">
                            {currency(breakdown.cost)}
                          </span>
                        </p>
                      </div>
                    )}
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Pending approvals: Only for operational / admin roles, not Viewer */}
        {!isViewer && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                <Link to="/payroll" className="hover:underline">
                  Pending approvals
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingBills.length === 0 && pendingRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing waiting on you.</p>
              ) : null}
              {pendingRequests.map((r) => (
                <Link
                  key={r.id}
                  to="/payroll"
                  className="flex items-center justify-between rounded-md border p-3 transition-colors hover:bg-accent/10"
                >
                  <div>
                    <p className="text-sm font-medium">{r.request_number}</p>
                    <p className="text-xs text-muted-foreground">Material request</p>
                  </div>
                  <Badge variant="secondary">{r.status}</Badge>
                </Link>
              ))}
              {permissions.canViewMaterialContractorCosts &&
                pendingBills.map((b) => (
                  <Link
                    key={b.bill_number}
                    to="/payroll"
                    className="flex items-center justify-between rounded-md border p-3 transition-colors hover:bg-accent/10"
                  >
                    <div>
                      <p className="text-sm font-medium">{b.bill_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {currency(b.net_amount)}
                      </p>
                    </div>
                    <Badge variant="secondary">{b.status}</Badge>
                  </Link>
                ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ========================================================================= */}
      {/* DIALOG 1: Active Projects Summary Modal */}
      {/* ========================================================================= */}
      <Dialog open={activeProjectsDialogOpen} onOpenChange={setActiveProjectsDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="size-5 text-primary" /> Active Projects Overview
            </DialogTitle>
            <DialogDescription>
              Summary of all currently active construction sites and project progress.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Project Name</TableHead>
                  <TableHead>Start Date</TableHead>
                  {permissions.canViewProjectFinancials && (
                    <>
                      <TableHead className="text-right">Contract Value</TableHead>
                      <TableHead className="text-right">Cost to Date</TableHead>
                    </>
                  )}
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {active.map((p) => {
                  const b = projectBreakdown(p.id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.project_code}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{dateFmt(p.start_date)}</TableCell>
                      {permissions.canViewProjectFinancials && (
                        <>
                          <TableCell className="text-right font-semibold font-mono">
                            {currency(getProjectContractValue(p))}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground font-mono">
                            {currency(b.cost)}
                          </TableCell>
                        </>
                      )}
                      <TableCell className="text-center">
                        <Link
                          to="/projects/$projectId"
                          params={{ projectId: p.id }}
                          onClick={() => setActiveProjectsDialogOpen(false)}
                          className="text-xs text-primary underline"
                        >
                          View Details
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* DIALOG 2: Contract Value & Financial Breakdown Drawer (MD Only) */}
      {/* ========================================================================= */}
      {permissions.canViewCompanyFinancials && (
        <Dialog open={contractValueDialogOpen} onOpenChange={setContractValueDialogOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="size-5 text-primary" /> Contract Value & Financial Breakdown
              </DialogTitle>
              <DialogDescription>
                Project-wise financial model breakdown: Quotation Value vs Labour, Materials, Contractor, Other site expenses and net profit margins.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2 space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead className="text-right">Quotation (Value)</TableHead>
                    <TableHead className="text-right">Labour Wage</TableHead>
                    <TableHead className="text-right">Materials (GRN)</TableHead>
                    <TableHead className="text-right">Contractors</TableHead>
                    <TableHead className="text-right">Other Exp.</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                    <TableHead className="text-right">Net Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(projects.data ?? []).map((p) => {
                    const b = projectBreakdown(p.id);
                    const totalVal = getProjectContractValue(p);
                    const margin = totalVal - b.cost;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          <div>{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.project_code}</div>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {currency(totalVal)}
                        </TableCell>
                        <TableCell className="text-right">{currency(b.labour)}</TableCell>
                        <TableCell className="text-right">{currency(b.material)}</TableCell>
                        <TableCell className="text-right">{currency(b.contractor)}</TableCell>
                        <TableCell className="text-right">{currency(b.other)}</TableCell>
                        <TableCell className="text-right font-medium">{currency(b.cost)}</TableCell>
                        <TableCell
                          className={`text-right font-bold ${
                            margin >= 0 ? "text-emerald-600" : "text-destructive"
                          }`}
                        >
                          {currency(margin)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ========================================================================= */}
      {/* DIALOG 3: Material Spend Breakdown Drawer (MD Only) */}
      {/* ========================================================================= */}
      {permissions.canViewCompanyFinancials && (
        <Dialog open={materialSpendDialogOpen} onOpenChange={setMaterialSpendDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PackageCheck className="size-5 text-amber-600" /> Material Expenditure Breakdown
              </DialogTitle>
              <DialogDescription>
                Detailed breakdown of material costs grouped by material type and category.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Total Material Receipts (GRN)</p>
                  <p className="text-lg font-bold">{currency(totalMaterialReceipts)}</p>
                </div>
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Unique Material Line-Items</p>
                  <p className="text-lg font-bold">{materialCategories.length} Categories</p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material / Item Name</TableHead>
                    <TableHead className="text-right">Total Expenditure</TableHead>
                    <TableHead className="text-right">% of Material Spend</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materialCategories.map((c, idx) => {
                    const pct = totalMaterialReceipts ? (c.amount / totalMaterialReceipts) * 100 : 0;
                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-right font-semibold">{currency(c.amount)}</TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {pct.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ========================================================================= */}
      {/* DIALOG 4: Office Expenses View (MD Only) */}
      {/* ========================================================================= */}
      {permissions.canViewOfficeExpense && (
        <Dialog open={officeExpensesDialogOpen} onOpenChange={setOfficeExpensesDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Receipt className="size-5 text-primary" /> Corporate Office Expenses Overview
              </DialogTitle>
              <DialogDescription>
                Non-site administrative overhead expenditures (Stationery, Internet, Travel, Bank Charges).
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2 space-y-4">
              <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total Office Overhead Spend</p>
                  <p className="text-xl font-bold">{currency(totalOfficeExpenses)}</p>
                </div>
                <Badge variant="outline">{officeExpensesList.length} Expenses Recorded</Badge>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {officeExpensesList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No unallocated office expenses recorded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    officeExpensesList.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-xs">{dateFmt(e.expense_date)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{e.category}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{e.description || e.material_name || "—"}</TableCell>
                        <TableCell className="text-right font-semibold">{currency(e.amount)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
