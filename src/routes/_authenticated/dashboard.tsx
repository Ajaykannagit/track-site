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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FormDialog, type Field, type FormValues } from "@/components/FormDialog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { useAuth } from "@/lib/auth";
import { useRows, useSaveRow, useDeleteRow, sum } from "@/lib/db";
import { currency, dateFmt, monthStart } from "@/lib/format";
import {
  Building2,
  ChevronRight,
  DollarSign,
  HandCoins,
  PackageCheck,
  Pencil,
  Plus,
  Receipt,
  ShieldAlert,
  Trash2,
  Wallet,
} from "lucide-react";

type ClientPaymentRow = {
  id: string;
  project_id: string;
  amount: number;
  payment_date: string;
  payment_category: string;
  payment_method: string;
  receipt_number: string;
  reference_number: string | null;
  status: string;
};

/** Unified spend-line type used in the full-spend dialog */
type SpendLine = {
  date: string;
  category: string;
  description: string;
  amount: number;
};

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
  payment_method?: string | null;
  receipt_path?: string | null;
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
  const { isMD, permissions, roles, canWriteFinance } = useAuth();
  const isViewer = roles.length === 1 && roles[0] === "viewer";
  const canManageOfficeExpense = isMD || canWriteFinance;
  const from = monthStart(-5);

  // Dialog States
  const [activeProjectsDialogOpen, setActiveProjectsDialogOpen] = useState(false);
  const [contractValueDialogOpen, setContractValueDialogOpen] = useState(false);
  const [spendDialogOpen, setSpendDialogOpen] = useState(false);
  const [cashDialogOpen, setCashDialogOpen] = useState(false);
  const [officeExpensesDialogOpen, setOfficeExpensesDialogOpen] = useState(false);

  // Office Expense CRUD state & mutations
  const [expenseFormOpen, setExpenseFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRow | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<ExpenseRow | null>(null);

  const saveExpense = useSaveRow("expenses", "Office Expense");
  const deleteExpense = useDeleteRow("expenses", "Office Expense");

  // Expense categories query for dropdown
  const expenseCategories = useRows<{ id: string; name: string }>("expense_categories", {
    order: { col: "name", asc: true },
    enabled: permissions.canViewOfficeExpense,
  });

  // Projects query: visible to all authenticated users
  const projects = useRows<Project>("projects_view", {
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
    select: "id,amount,expense_date,category,material_name,description,project_id,payment_method,receipt_path",
    order: { col: "expense_date", asc: false },
    enabled: permissions.canViewCompanyFinancials,
  });
  const attendance = useRows<{ calculated_wage: number; attendance_date: string }>("attendance_view", {
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
  }>("material_requests_view", {
    select: "id,request_number,status,total_amount",
    order: { col: "request_date" },
    limit: 8,
    enabled: permissions.canViewMaterialsAndContractors,
  });
  // Latest cash closing for the stat card (1 record) - strictly MD only
  const cash = useRows<{ closing_cash: number; closing_date: string }>("cash_closing", {
    select: "closing_cash,closing_date",
    order: { col: "closing_date" },
    limit: 1,
    enabled: permissions.canViewCompanyCashOnHand,
  });

  // Full cash closing history for the cash dialog - strictly MD only
  const cashHistory = useRows<{ closing_cash: number; closing_date: string; notes?: string }>(
    "cash_closing",
    {
      select: "closing_cash,closing_date,notes",
      order: { col: "closing_date" },
      enabled: permissions.canViewCompanyCashOnHand,
    },
  );

  // Labour wages for the past 6M (for spend dialog)
  const labourWages = useRows<{
    calculated_wage: number;
    attendance_date: string;
    employee_id: string | null;
  }>("attendance_view", {
    select: "calculated_wage,attendance_date,employee_id",
    filters: [{ col: "attendance_date", op: "gte", value: from }],
    order: { col: "attendance_date" },
    enabled: permissions.canViewCompanyFinancials,
  });

  const allAttendance = useRows<{ project_id: string | null; calculated_wage: number }>(
    "attendance_view",
    {
      select: "project_id,calculated_wage",
      enabled: permissions.canViewProjectFinancials,
    },
  );
  const allReceipts = useRows<MaterialReceiptRow>("material_receipts_view", {
    select: "id,receipt_number,receipt_date,total_amount,project_id,supplier_id",
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
  const allClientPayments = useRows<ClientPaymentRow>("client_payments", {
    select: "id,project_id,amount,payment_date,payment_category,payment_method,receipt_number,reference_number,status",
    enabled: permissions.canViewCompanyFinancials,
  });

  const [receivedDialogOpen, setReceivedDialogOpen] = useState(false);

  const getProjectContractValue = (p: Project) => {
    const extra = sum(
      (allQuotations.data ?? []).filter((q) => q.project_id === p.id),
      (q) => Number(q.amount || 0),
    );
    return Number(p.quotation_amount || 0) + extra;
  };

  const getProjectReceivedAmount = (projectId: string) => {
    return sum(
      (allClientPayments.data ?? []).filter(
        (cp) => cp.project_id === projectId && cp.status === "received",
      ),
      (cp) => {
        if (cp.payment_category === "reversal") return -Number(cp.amount || 0);
        return Number(cp.amount || 0);
      },
    );
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
  const totalReceived = sum(
    (allClientPayments.data ?? []).filter((cp) => cp.status === "received"),
    (cp) => {
      if (cp.payment_category === "reversal") return -Number(cp.amount || 0);
      return Number(cp.amount || 0);
    },
  );
  const pendingReceivables = Math.max(0, contractValue - totalReceived);
  const spend =
    sum(expenses.data ?? [], (e) => e.amount) +
    sum(attendance.data ?? [], (a) => a.calculated_wage);
  const pendingBills = (bills.data ?? []).filter(
    (b) => !["paid", "payment_approved", "closed", "rejected"].includes(b.status),
  );
  const pendingRequests = (requests.data ?? []).filter(
    (r) => !["approved", "ordered", "received", "closed", "rejected"].includes(r.status),
  );

  // Office Expenses: have no project (project_id is null)
  const officeExpensesList = (allExpenses.data ?? []).filter((e) => !e.project_id);
  const totalOfficeExpenses = sum(officeExpensesList, (e) => e.amount);

  const defaultOfficeCategories = [
    "Stationery",
    "Telephone / Internet",
    "Travel",
    "Professional Fees",
    "Bank Charges",
    "Office Rent",
    "Electricity",
    "Food / Refreshments",
    "Pooja / Misc",
    "Miscellaneous",
  ];
  const officeCategoryOptions = Array.from(
    new Set([
      ...defaultOfficeCategories,
      ...(expenseCategories.data ?? []).map((c) => c.name),
    ]),
  ).map((c) => ({ value: c, label: c }));

  const officeExpenseFields: Field[] = [
    { name: "expense_date", label: "Date", type: "date", required: true },
    {
      name: "category",
      label: "Category",
      type: "select",
      required: true,
      options: officeCategoryOptions,
    },
    {
      name: "amount",
      label: "Amount (₹)",
      type: "number",
      required: true,
      placeholder: "0.00",
    },
    {
      name: "payment_method",
      label: "Payment method",
      type: "select",
      options: [
        { value: "cash", label: "Cash" },
        { value: "bank", label: "Bank Transfer" },
        { value: "upi", label: "UPI" },
        { value: "cheque", label: "Cheque" },
        { value: "card", label: "Card" },
      ],
    },
    {
      name: "receipt_path",
      label: "Receipt reference",
      type: "text",
      placeholder: "Invoice / Bill # / Receipt ref",
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      placeholder: "Details or purpose of expense",
      full: true,
    },
  ];

  const initialExpenseValues: FormValues | undefined = editingExpense
    ? {
        expense_date: editingExpense.expense_date,
        category: editingExpense.category,
        amount: editingExpense.amount,
        payment_method: editingExpense.payment_method ?? "cash",
        receipt_path: editingExpense.receipt_path ?? "",
        description: editingExpense.description ?? "",
      }
    : {
        expense_date: new Date().toISOString().slice(0, 10),
        payment_method: "cash",
      };

  const handleOpenAddExpense = () => {
    setEditingExpense(null);
    setExpenseFormOpen(true);
  };

  const handleOpenEditExpense = (item: ExpenseRow) => {
    setEditingExpense(item);
    setExpenseFormOpen(true);
  };

  const handleSaveExpense = async (values: FormValues) => {
    await saveExpense.mutateAsync({
      id: editingExpense?.id,
      values: {
        expense_date: values["expense_date"],
        category: values["category"],
        amount: Number(values["amount"]),
        payment_method: values["payment_method"] || null,
        receipt_path: values["receipt_path"] ? String(values["receipt_path"]).trim() : null,
        description: values["description"] ? String(values["description"]).trim() : null,
        project_id: null,
      },
    });
    setExpenseFormOpen(false);
  };

  const handleDeleteExpense = async () => {
    if (!deletingExpense) return;
    await deleteExpense.mutateAsync(deletingExpense.id);
    setDeletingExpense(null);
  };

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

  // Unified spend lines for the full-spend dialog (6M window)
  const spendLines: SpendLine[] = [
    ...(labourWages.data ?? [])
      .filter((a) => Number(a.calculated_wage ?? 0) > 0)
      .map((a) => ({
        date: a.attendance_date ?? "",
        category: "Labour / Wages",
        description: a.employee_id ? `Worker attendance (ID: ${a.employee_id.slice(0, 8)}…)` : "Worker attendance",
        amount: Number(a.calculated_wage ?? 0),
      })),
    ...(expenses.data ?? []).map((e) => ({
      date: e.expense_date ?? "",
      category: e.category ?? "Expense",
      description: e.description || e.material_name || "—",
      amount: Number(e.amount ?? 0),
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const totalSpend6M = sum(spendLines, (s) => s.amount);


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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div
            onClick={() => setActiveProjectsDialogOpen(true)}
            className="cursor-pointer transition-transform hover:scale-[1.01]"
            title="View active projects summary"
          >
            <StatCard
              label="Active projects"
              value={String(active.length)}
              hint={`${(projects.data ?? []).length} total projects`}
            />
          </div>

          <div
            onClick={() => setContractValueDialogOpen(true)}
            className="cursor-pointer transition-transform hover:scale-[1.01]"
            title="View project financial breakdown"
          >
            <StatCard
              label="Contract value"
              value={currency(contractValue)}
              hint="All active & completed projects"
            />
          </div>

          <div
            onClick={() => setReceivedDialogOpen(true)}
            className="cursor-pointer transition-transform hover:scale-[1.01]"
            title="View client payment receipts breakdown"
          >
            <StatCard
              label="Received amount"
              value={currency(totalReceived)}
              hint="Total client receipts"
              tone="success"
            />
          </div>

          <div
            onClick={() => setReceivedDialogOpen(true)}
            className="cursor-pointer transition-transform hover:scale-[1.01]"
            title="View pending receivables breakdown"
          >
            <StatCard
              label="Pending receivables"
              value={currency(pendingReceivables)}
              hint="Contract value - received"
              tone={pendingReceivables > 0 ? "warning" : "default"}
            />
          </div>

          <div
            onClick={() => setSpendDialogOpen(true)}
            className="cursor-pointer transition-transform hover:scale-[1.01]"
            title="View full spend breakdown"
          >
            <StatCard
              label="Spend (6 months)"
              value={currency(spend)}
              hint="Labour wages + site expenses"
              tone="warning"
            />
          </div>

          <div
            onClick={() => setCashDialogOpen(true)}
            className="cursor-pointer transition-transform hover:scale-[1.01]"
            title="View cash closing history"
          >
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
              <CardTitle className="text-base">Pending approvals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingBills.length === 0 && pendingRequests.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing waiting on you.</p>
              ) : null}
              {pendingRequests.map((r) => (
                <Link
                  key={r.id}
                  to="/materials"
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
                    to="/contractors"
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
        <DialogContent className="w-full max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="size-5 text-primary" /> Active Projects Overview
            </DialogTitle>
            <DialogDescription>
              Summary of all currently active construction sites and project progress.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-2 space-y-3 overflow-x-auto">
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
      {permissions.canViewProfitAndLoss && (
        <Dialog open={contractValueDialogOpen} onOpenChange={setContractValueDialogOpen}>
          <DialogContent className="w-full max-h-[90vh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <DollarSign className="size-5 text-primary" /> Contract Value & Financial Breakdown
              </DialogTitle>
              <DialogDescription>
                Project-wise financial model breakdown: Quotation Value vs Labour, Materials, Contractor, Other site expenses and net profit margins.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2 space-y-4 overflow-x-auto">
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
      {/* DIALOG 2B: Received Amount & Pending Receivables Breakdown (MD & Accounts) */}
      {/* ========================================================================= */}
      {permissions.canViewCompanyFinancials && (
        <Dialog open={receivedDialogOpen} onOpenChange={setReceivedDialogOpen}>
          <DialogContent className="w-full max-h-[90vh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <HandCoins className="size-5 text-emerald-600" /> Client Receipts & Receivables Breakdown
              </DialogTitle>
              <DialogDescription>
                Project-wise tracking: Revised Contract Value vs. Net Receipts Received and Remaining Outstanding Balance.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2 space-y-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead className="text-right">Revised Contract Value</TableHead>
                    <TableHead className="text-right">Total Received</TableHead>
                    <TableHead className="text-right">Pending Receivables</TableHead>
                    <TableHead className="text-right">Recovery %</TableHead>
                    <TableHead className="text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(projects.data ?? []).map((p) => {
                    const totalVal = getProjectContractValue(p);
                    const rec = getProjectReceivedAmount(p.id);
                    const pend = Math.max(0, totalVal - rec);
                    const pct = totalVal > 0 ? Math.min(100, Math.round((rec / totalVal) * 100)) : 0;
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          <div>{p.name}</div>
                          <div className="text-xs text-muted-foreground">{p.project_code}</div>
                        </TableCell>
                        <TableCell className="text-right font-semibold font-mono">
                          {currency(totalVal)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-emerald-600 font-semibold">
                          {currency(rec)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono font-bold ${
                            pend > 0 ? "text-amber-600" : "text-muted-foreground"
                          }`}
                        >
                          {currency(pend)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {pct}%
                        </TableCell>
                        <TableCell className="text-center">
                          <Link
                            to="/projects/$projectId"
                            params={{ projectId: p.id }}
                            onClick={() => setReceivedDialogOpen(false)}
                            className="text-xs text-primary underline"
                          >
                            View Project
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-bold">Total Across Projects</TableCell>
                    <TableCell className="text-right font-bold font-mono">
                      {currency(contractValue)}
                    </TableCell>
                    <TableCell className="text-right font-bold font-mono text-emerald-600">
                      {currency(totalReceived)}
                    </TableCell>
                    <TableCell className="text-right font-bold font-mono text-amber-600">
                      {currency(pendingReceivables)}
                    </TableCell>
                    <TableCell className="text-right font-bold font-mono text-xs">
                      {contractValue > 0
                        ? `${Math.min(100, Math.round((totalReceived / contractValue) * 100))}%`
                        : "0%"}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ========================================================================= */}
      {/* DIALOG 3: Full Spend Breakdown (MD Only) */}
      {/* ========================================================================= */}
      {permissions.canViewCompanyFinancials && (
        <Dialog open={spendDialogOpen} onOpenChange={setSpendDialogOpen}>
          <DialogContent className="w-full max-w-4xl max-h-[85vh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PackageCheck className="size-5 text-amber-600" /> Full Spend — Last 6 Months
              </DialogTitle>
              <DialogDescription>
                All labour wages and site expenses in the last 6 months, newest first.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2 space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Total Spend (6M)</p>
                  <p className="text-lg font-bold">{currency(totalSpend6M)}</p>
                </div>
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Labour / Wages</p>
                  <p className="text-lg font-bold">
                    {currency(sum(spendLines.filter((s) => s.category === "Labour / Wages"), (s) => s.amount))}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-xs font-medium text-muted-foreground">Site Expenses</p>
                  <p className="text-lg font-bold">
                    {currency(sum(spendLines.filter((s) => s.category !== "Labour / Wages"), (s) => s.amount))}
                  </p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description / Details</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {spendLines.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No spend recorded in the last 6 months.
                      </TableCell>
                    </TableRow>
                  ) : (
                    spendLines.map((s, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs whitespace-nowrap">{dateFmt(s.date)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={s.category === "Labour / Wages" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {s.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{s.description}</TableCell>
                        <TableCell className="text-right font-semibold">{currency(s.amount)}</TableCell>
                      </TableRow>
                    ))
                  )}
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
          <DialogContent className="w-full max-w-4xl max-h-[85vh] overflow-y-auto sm:max-w-4xl">
            <DialogHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <Receipt className="size-5 text-primary" /> Corporate Office Expenses Overview
                </DialogTitle>
                <DialogDescription>
                  Non-site administrative overhead expenditures (Stationery, Internet, Travel, Bank Charges).
                </DialogDescription>
              </div>
              {canManageOfficeExpense && (
                <Button size="sm" onClick={handleOpenAddExpense} className="gap-1.5 shrink-0">
                  <Plus className="size-4" /> Add Expense
                </Button>
              )}
            </DialogHeader>
            <div className="mt-2 space-y-4">
              <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Total Office Overhead Spend</p>
                  <p className="text-xl font-bold">{currency(totalOfficeExpenses)}</p>
                </div>
                <Badge variant="outline">{officeExpensesList.length} Expenses Recorded</Badge>
              </div>

              <div className="rounded-md border overflow-x-auto max-h-[50vh] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead>Receipt Ref</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      {canManageOfficeExpense && <TableHead className="text-center w-24">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {officeExpensesList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={canManageOfficeExpense ? 7 : 6} className="text-center py-6 text-muted-foreground">
                          No office expenses recorded yet. Click &quot;Add Expense&quot; above to create one.
                        </TableCell>
                      </TableRow>
                    ) : (
                      officeExpensesList.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="text-xs whitespace-nowrap">{dateFmt(e.expense_date)}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{e.category}</Badge>
                          </TableCell>
                          <TableCell className="text-xs max-w-[200px] truncate" title={e.description || ""}>
                            {e.description || e.material_name || "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className={e.payment_method ? "capitalize" : "text-muted-foreground italic"}>
                              {e.payment_method || "Not recorded"}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs font-mono">{e.receipt_path || "—"}</TableCell>
                          <TableCell className="text-right font-semibold font-mono">{currency(e.amount)}</TableCell>
                          {canManageOfficeExpense && (
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7"
                                  title="Edit Expense"
                                  onClick={() => handleOpenEditExpense(e)}
                                >
                                  <Pencil className="size-3.5 text-muted-foreground hover:text-foreground" />
                                </Button>
                                {isMD && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 text-destructive hover:text-destructive"
                                    title="Delete Expense"
                                    onClick={() => setDeletingExpense(e)}
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                  {officeExpensesList.length > 0 && (
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={5} className="font-semibold text-right">
                          Total:
                        </TableCell>
                        <TableCell className="text-right font-bold font-mono">
                          {currency(totalOfficeExpenses)}
                        </TableCell>
                        {canManageOfficeExpense && <TableCell />}
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Office Expense Add / Edit FormDialog */}
      <FormDialog
        title={editingExpense ? "Edit Office Expense" : "Add Office Expense"}
        description="Record non-project corporate office overhead expenditure."
        fields={officeExpenseFields}
        initial={initialExpenseValues}
        open={expenseFormOpen}
        onOpenChange={setExpenseFormOpen}
        submitting={saveExpense.isPending}
        onSubmit={handleSaveExpense}
      />

      {/* Confirm Delete Dialog */}
      {deletingExpense && (
        <ConfirmDeleteDialog
          open={!!deletingExpense}
          onOpenChange={(open) => {
            if (!open) setDeletingExpense(null);
          }}
          title="Delete Office Expense"
          description={`Are you sure you want to delete this office expense of ${currency(deletingExpense.amount)} (${deletingExpense.category})?`}
          tableName="expenses"
          recordId={deletingExpense.id}
          recordTitle={`${deletingExpense.category}: ${currency(deletingExpense.amount)}`}
          onConfirm={handleDeleteExpense}
        />
      )}

      {/* ========================================================================= */}
      {/* DIALOG 5: Cash on Hand History (MD Only) */}
      {/* ========================================================================= */}
      {permissions.canViewCompanyFinancials && (
        <Dialog open={cashDialogOpen} onOpenChange={setCashDialogOpen}>
          <DialogContent className="w-full max-w-2xl max-h-[80vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wallet className="size-5 text-emerald-600" /> Cash on Hand — Closing History
              </DialogTitle>
              <DialogDescription>
                All recorded cash closing entries, newest first. Latest entry is shown on the dashboard card.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2 space-y-4">
              {cash.data?.[0] && (
                <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Current Cash on Hand</p>
                    <p className="text-2xl font-bold text-emerald-700">
                      {currency(cash.data[0].closing_cash)}
                    </p>
                  </div>
                  <Badge variant="outline" className="border-emerald-300 text-emerald-700">
                    As of {dateFmt(cash.data[0].closing_date)}
                  </Badge>
                </div>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Closing Cash</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(cashHistory.data ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No cash closing records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (cashHistory.data ?? []).map((c, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs whitespace-nowrap">{dateFmt(c.closing_date)}</TableCell>
                        <TableCell className="text-right font-semibold font-mono">
                          {currency(c.closing_cash)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.notes || "—"}
                        </TableCell>
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
