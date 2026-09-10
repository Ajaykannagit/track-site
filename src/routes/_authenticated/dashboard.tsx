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
import { useRows, sum } from "@/lib/db";
import { currency, dateFmt, monthStart } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Brickweld" },
      {
        name: "description",
        content: "Live view of project value, site spend, pending approvals and cash position.",
      },
      { property: "og:title", content: "Dashboard — Brickweld" },
      { property: "og:description", content: "Project value, spend, approvals and cash at a glance." },
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
};

function Dashboard() {
  const from = monthStart(-5);
  const projects = useRows<Project>("projects", { order: { col: "created_at" } });
  const expenses = useRows<{ amount: number; expense_date: string; category: string; project_id: string | null }>(
    "expenses",
    { select: "amount,expense_date,category,project_id", filters: [{ col: "expense_date", op: "gte", value: from }] },
  );
  const attendance = useRows<{ calculated_wage: number; attendance_date: string }>("attendance", {
    select: "calculated_wage,attendance_date",
    filters: [{ col: "attendance_date", op: "gte", value: from }],
  });
  const bills = useRows<{ net_amount: number; status: string; bill_number: string; bill_date: string }>(
    "contractor_bills",
    { select: "id,net_amount,status,bill_number,bill_date", order: { col: "bill_date" }, limit: 8 },
  );
  const requests = useRows<{ id: string; request_number: string; status: string; total_amount: number }>(
    "material_requests",
    { select: "id,request_number,status,total_amount", order: { col: "request_date" }, limit: 8 },
  );
  const cash = useRows<{ closing_cash: number; closing_date: string }>("cash_closing", {
    select: "closing_cash,closing_date",
    order: { col: "closing_date" },
    limit: 1,
  });

  const allExpenses = useRows<{ project_id: string | null; amount: number }>("expenses", {
    select: "project_id,amount",
  });
  const allAttendance = useRows<{ project_id: string | null; calculated_wage: number }>("attendance", {
    select: "project_id,calculated_wage",
  });
  const allReceipts = useRows<{ project_id: string | null; total_amount: number }>("material_receipts", {
    select: "project_id,total_amount",
  });
  const allBills = useRows<{ project_id: string | null; net_amount: number }>("contractor_bills", {
    select: "project_id,net_amount",
  });

  const projectCost = (projectId: string) => {
    const labour = sum((allAttendance.data ?? []).filter((a) => a.project_id === projectId), (a) => a.calculated_wage);
    const material = sum((allReceipts.data ?? []).filter((r) => r.project_id === projectId), (r) => r.total_amount);
    const contractor = sum((allBills.data ?? []).filter((b) => b.project_id === projectId), (b) => b.net_amount);
    const other = sum((allExpenses.data ?? []).filter((e) => e.project_id === projectId), (e) => e.amount);
    return labour + material + contractor + other;
  };

  const active = (projects.data ?? []).filter((p) => p.status === "active");
  const contractValue = sum(projects.data ?? [], (p) => p.quotation_amount);
  const spend = sum(expenses.data ?? [], (e) => e.amount) + sum(attendance.data ?? [], (a) => a.calculated_wage);
  const pendingBills = (bills.data ?? []).filter(
    (b) => !["paid", "payment_approved", "closed", "rejected"].includes(b.status),
  );
  const pendingRequests = (requests.data ?? []).filter(
    (r) => !["approved", "ordered", "received", "closed", "rejected"].includes(r.status),
  );

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
  const pieColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--muted-foreground)"];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Live position across projects, site spend, approvals and cash."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active projects"
          value={String(active.length)}
          hint={`${(projects.data ?? []).length} total`}
        />
        <StatCard label="Contract value" value={currency(contractValue)} hint="All projects" />
        <StatCard label="Spend (6 months)" value={currency(spend)} hint="Expenses + site wages" tone="warning" />
        <StatCard
          label="Cash on hand"
          value={currency(cash.data?.[0]?.closing_cash ?? 0)}
          hint={cash.data?.[0] ? `As of ${dateFmt(cash.data[0].closing_date)}` : "No closing recorded"}
          tone="success"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Monthly site cost</CardTitle>
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

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Active projects</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {active.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active projects.</p>
            ) : (
              active.slice(0, 6).map((p) => {
                const costSoFar = projectCost(p.id);
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
                    <div className="text-right">
                      <p className="text-sm font-semibold">{currency(p.quotation_amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        Cost: <span className="font-medium text-foreground">{currency(costSoFar)}</span>
                      </p>
                    </div>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>

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
            {pendingBills.map((b) => (
              <Link
                key={b.bill_number}
                to="/payroll"
                className="flex items-center justify-between rounded-md border p-3 transition-colors hover:bg-accent/10"
              >
                <div>
                  <p className="text-sm font-medium">{b.bill_number}</p>
                  <p className="text-xs text-muted-foreground">{currency(b.net_amount)}</p>
                </div>
                <Badge variant="secondary">{b.status}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
