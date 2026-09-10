import { createFileRoute } from "@tanstack/react-router";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { PageHeader } from "@/components/AppShell";
import { DataTable, StatCard } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRows, sum } from "@/lib/db";
import { currency, dateFmt } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  head: () => ({
    meta: [
      { title: "Project detail — Brickweld" },
      { name: "description", content: "Budget, spend, attendance, materials and contractor activity for a project." },
      { property: "og:title", content: "Project detail — Brickweld" },
      { property: "og:description", content: "Full financial and site picture for a single construction project." },
    ],
  }),
  component: ProjectDetail,
});

function ProjectDetail() {
  const { projectId } = Route.useParams();
  const f = [{ col: "project_id", op: "eq" as const, value: projectId }];

  const project = useRows<{
    id: string;
    name: string;
    project_code: string;
    status: string;
    quotation_amount: number;
    site_address: string | null;
    house_number: string | null;
    start_date: string | null;
    expected_completion_date: string | null;
    agreement_details: string | null;
    details: string | null;
  }>("projects", { filters: [{ col: "id", op: "eq", value: projectId }] });

  const budgets = useRows<{ id: string; category: string; budget_amount: number; notes: string | null }>(
    "project_budgets",
    { filters: f },
  );
  const expenses = useRows<{ id: string; expense_date: string; category: string; amount: number; description: string | null }>(
    "expenses",
    { filters: f, order: { col: "expense_date" } },
  );
  const attendance = useRows<{ id: string; attendance_date: string; kind: string; status: string; calculated_wage: number; workforce_count: number | null }>(
    "attendance",
    { filters: f, order: { col: "attendance_date" }, limit: 200 },
  );
  const receipts = useRows<{ id: string; receipt_number: string; receipt_date: string; total_amount: number }>(
    "material_receipts",
    { filters: f, order: { col: "receipt_date" } },
  );
  const bills = useRows<{ id: string; bill_number: string; bill_date: string; net_amount: number; status: string }>(
    "contractor_bills",
    { filters: f, order: { col: "bill_date" } },
  );

  const p = project.data?.[0];
  const labour = sum(attendance.data ?? [], (a) => a.calculated_wage);
  const material = sum(receipts.data ?? [], (r) => r.total_amount);
  const contractor = sum(bills.data ?? [], (b) => b.net_amount);
  const other = sum(expenses.data ?? [], (e) => e.amount);
  const cost = labour + material + contractor + other;
  const value = Number(p?.quotation_amount ?? 0);
  const profit = value - cost;

  const costBreakdown = [
    { name: "Labour & wages", value: labour, fill: "var(--chart-1)" },
    { name: "Materials", value: material, fill: "var(--chart-2)" },
    { name: "Contractors", value: contractor, fill: "var(--chart-3)" },
    { name: "Other expenses", value: other, fill: "var(--chart-4)" },
  ];
  const hasCost = cost > 0;

  return (
    <div>
      <PageHeader
        title={p?.name ?? "Project"}
        description={p ? `${p.project_code} · ${p.site_address ?? "No site address"}` : "Loading…"}
        actions={p ? <StatusBadge status={p.status} /> : null}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Contract value" value={currency(value)} />
        <StatCard label="Total cost" value={currency(cost)} tone="warning" />
        <StatCard
          label="Profit"
          value={currency(profit)}
          tone={profit >= 0 ? "success" : "destructive"}
          hint={value ? `${((profit / value) * 100).toFixed(1)}% margin` : "No contract value"}
        />
        <StatCard label="Budget allotted" value={currency(sum(budgets.data ?? [], (b) => b.budget_amount))} />
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">Cost composition</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
              <StatCard label="Labour & wages" value={currency(labour)} />
              <StatCard label="Materials" value={currency(material)} />
              <StatCard label="Contractors" value={currency(contractor)} />
              <StatCard label="Other expenses" value={currency(other)} />
            </div>
            <div className="flex h-56 flex-col items-center justify-center rounded-lg border bg-card/50 p-2">
              {!hasCost ? (
                <p className="text-sm text-muted-foreground">No costs recorded yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={costBreakdown}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                    >
                      {costBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => currency(v)} />
                    <Legend
                      verticalAlign="bottom"
                      iconSize={8}
                      wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="budget" className="mt-4">
        <TabsList className="no-print flex-wrap">
          <TabsTrigger value="budget">Budget</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="contractors">Contractor bills</TabsTrigger>
          <TabsTrigger value="info">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="budget">
          <DataTable
            rows={budgets.data ?? []}
            loading={budgets.isLoading}
            exportName="project-budget"
            columns={[
              { header: "Category", cell: (r) => r.category, value: (r) => r.category },
              { header: "Budget", cell: (r) => currency(r.budget_amount), value: (r) => r.budget_amount, className: "text-right" },
              { header: "Notes", cell: (r) => r.notes ?? "—", value: (r) => r.notes },
            ]}
          />
        </TabsContent>

        <TabsContent value="expenses">
          <DataTable
            rows={expenses.data ?? []}
            loading={expenses.isLoading}
            exportName="project-expenses"
            columns={[
              { header: "Date", cell: (r) => dateFmt(r.expense_date), value: (r) => r.expense_date },
              { header: "Category", cell: (r) => r.category, value: (r) => r.category },
              { header: "Description", cell: (r) => r.description ?? "—", value: (r) => r.description },
              { header: "Amount", cell: (r) => currency(r.amount), value: (r) => r.amount, className: "text-right" },
            ]}
          />
        </TabsContent>

        <TabsContent value="attendance">
          <DataTable
            rows={attendance.data ?? []}
            loading={attendance.isLoading}
            exportName="project-attendance"
            columns={[
              { header: "Date", cell: (r) => dateFmt(r.attendance_date), value: (r) => r.attendance_date },
              { header: "Kind", cell: (r) => r.kind, value: (r) => r.kind },
              { header: "Status", cell: (r) => <StatusBadge status={r.status} />, value: (r) => r.status },
              { header: "Headcount", cell: (r) => r.workforce_count ?? 1, value: (r) => r.workforce_count ?? 1 },
              { header: "Wage", cell: (r) => currency(r.calculated_wage), value: (r) => r.calculated_wage, className: "text-right" },
            ]}
          />
        </TabsContent>

        <TabsContent value="materials">
          <DataTable
            rows={receipts.data ?? []}
            loading={receipts.isLoading}
            exportName="project-material-receipts"
            columns={[
              { header: "Receipt", cell: (r) => r.receipt_number, value: (r) => r.receipt_number },
              { header: "Date", cell: (r) => dateFmt(r.receipt_date), value: (r) => r.receipt_date },
              { header: "Amount", cell: (r) => currency(r.total_amount), value: (r) => r.total_amount, className: "text-right" },
            ]}
          />
        </TabsContent>

        <TabsContent value="contractors">
          <DataTable
            rows={bills.data ?? []}
            loading={bills.isLoading}
            exportName="project-contractor-bills"
            columns={[
              { header: "Bill", cell: (r) => r.bill_number, value: (r) => r.bill_number },
              { header: "Date", cell: (r) => dateFmt(r.bill_date), value: (r) => r.bill_date },
              { header: "Status", cell: (r) => <StatusBadge status={r.status} />, value: (r) => r.status },
              { header: "Net", cell: (r) => currency(r.net_amount), value: (r) => r.net_amount, className: "text-right" },
            ]}
          />
        </TabsContent>

        <TabsContent value="info">
          <Card>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
              <Detail label="House / plot" value={p?.house_number ?? "—"} />
              <Detail label="Site address" value={p?.site_address ?? "—"} />
              <Detail label="Start date" value={dateFmt(p?.start_date)} />
              <Detail label="Expected completion" value={dateFmt(p?.expected_completion_date)} />
              <Detail label="Agreement" value={p?.agreement_details ?? "—"} />
              <Detail label="Scope / notes" value={p?.details ?? "—"} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{value}</p>
    </div>
  );
}
