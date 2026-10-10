import { createFileRoute } from "@tanstack/react-router";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { Printer, Users, Package, HardHat, FileText } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { DataTable, StatCard } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useRows, sum } from "@/lib/db";
import { currency, dateFmt } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  head: () => ({
    meta: [
      { title: "Project detail — Brickweld Pvt Ltd" },
      {
        name: "description",
        content: "Budget, spend, attendance, materials and contractor activity for a project.",
      },
      { property: "og:title", content: "Project detail — Brickweld Pvt Ltd" },
      {
        property: "og:description",
        content: "Full financial and site picture for a single construction project.",
      },
    ],
  }),
  component: ProjectDetail,
});

function ProjectDetail() {
  const { projectId } = Route.useParams();
  const { permissions } = useAuth();
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

  const budgets = useRows<{
    id: string;
    category: string;
    budget_amount: number;
    notes: string | null;
  }>("project_budgets", { filters: f, enabled: permissions.canViewProjectFinancials });

  const expenses = useRows<{
    id: string;
    expense_date: string;
    category: string;
    amount: number;
    description: string | null;
  }>("expenses", {
    filters: f,
    order: { col: "expense_date" },
    enabled: permissions.canViewProjectFinancials,
  });

  const attendance = useRows<{
    id: string;
    attendance_date: string;
    kind: string;
    status: string;
    calculated_wage: number;
    workforce_count: number | null;
    remarks: string | null;
  }>("attendance", {
    filters: f,
    order: { col: "attendance_date" },
    limit: 300,
    enabled: permissions.canEnterAttendance,
  });

  const receipts = useRows<{
    id: string;
    receipt_number: string;
    receipt_date: string;
    total_amount: number;
    material_name: string | null;
    supplier_id: string | null;
  }>("material_receipts", {
    filters: f,
    order: { col: "receipt_date" },
    enabled: permissions.canViewMaterialsAndContractors,
  });

  const bills = useRows<{
    id: string;
    bill_number: string;
    bill_date: string;
    net_amount: number;
    status: string;
    contractor_id: string | null;
  }>("contractor_bills", {
    filters: f,
    order: { col: "bill_date" },
    enabled: permissions.canViewMaterialContractorCosts,
  });

  const p = project.data?.[0];
  const labourWage = sum(attendance.data ?? [], (a) => a.calculated_wage);
  const materialCost = sum(receipts.data ?? [], (r) => r.total_amount);
  const contractorCost = sum(bills.data ?? [], (b) => b.net_amount);
  const otherCost = sum(expenses.data ?? [], (e) => e.amount);
  const totalCost = labourWage + materialCost + contractorCost + otherCost;
  const contractValue = Number(p?.quotation_amount ?? 0);
  const profit = contractValue - totalCost;

  const totalHeadcount = sum(attendance.data ?? [], (a) => a.workforce_count ?? 1);

  const costBreakdown = [
    { name: "Labour & wages", value: labourWage, fill: "var(--chart-1)" },
    { name: "Materials", value: materialCost, fill: "var(--chart-2)" },
    { name: "Contractors", value: contractorCost, fill: "var(--chart-3)" },
    { name: "Other expenses", value: otherCost, fill: "var(--chart-4)" },
  ];
  const hasCost = totalCost > 0;

  return (
    <div>
      {/* Header with Print / PDF button */}
      <PageHeader
        title={p?.name ?? "Project"}
        description={p ? `${p.project_code} · ${p.site_address ?? "No site address"}` : "Loading…"}
        actions={
          <div className="flex items-center gap-2">
            {p ? <StatusBadge status={p.status} /> : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="no-print"
              title="Print / Save Project as PDF"
            >
              <Printer className="mr-2 size-4" /> Print / PDF
            </Button>
          </div>
        }
      />

      {/* ========================================================================= */}
      {/* PRINT-ONLY EXECUTIVE SUMMARY (Shows on window.print / PDF export) */}
      {/* ========================================================================= */}
      <div className="hidden print:block mb-6 p-4 border rounded-lg bg-white text-black">
        <div className="flex justify-between items-start border-b pb-4 mb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">BRICKWELD PRIVATE LIMITED</h1>
            <p className="text-xs text-gray-600 uppercase">Civil — Interior — Fabrication</p>
            <p className="text-sm font-semibold mt-2">{p?.name} ({p?.project_code})</p>
            <p className="text-xs text-gray-600">{p?.site_address ?? "No site address recorded"}</p>
          </div>
          <div className="text-right text-xs">
            <p className="font-semibold uppercase">Project Report</p>
            <p>Status: {p?.status.toUpperCase()}</p>
            <p>Start: {dateFmt(p?.start_date)}</p>
            <p>Target: {dateFmt(p?.expected_completion_date)}</p>
          </div>
        </div>

        {permissions.canViewProjectFinancials && (
          <div className="grid grid-cols-4 gap-3 border p-3 rounded mb-4 text-xs">
            <div>
              <span className="text-gray-500 block">Contract Value</span>
              <span className="font-bold text-sm">{currency(contractValue)}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Total Spend</span>
              <span className="font-bold text-sm">{currency(totalCost)}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Labour & Wages</span>
              <span className="font-bold">{currency(labourWage)}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Materials (GRN)</span>
              <span className="font-bold">{currency(materialCost)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Financial StatCards: only if role has financial permission */}
      {permissions.canViewProjectFinancials ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Contract value" value={currency(contractValue)} />
          <StatCard label="Total cost" value={currency(totalCost)} tone="warning" />
          <StatCard
            label="Profit"
            value={currency(profit)}
            tone={profit >= 0 ? "success" : "destructive"}
            hint={contractValue ? `${((profit / contractValue) * 100).toFixed(1)}% margin` : "No contract value"}
          />
          <StatCard
            label="Budget allotted"
            value={currency(sum(budgets.data ?? [], (b) => b.budget_amount))}
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Status" value={p?.status ?? "—"} />
          <StatCard label="Start date" value={dateFmt(p?.start_date)} />
          <StatCard label="Target completion" value={dateFmt(p?.expected_completion_date)} />
        </div>
      )}

      {/* Operational Highlights Cards */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {permissions.canEnterAttendance && (
          <Card className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-md bg-primary/10 text-primary">
                <Users className="size-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Labour & Attendance</p>
                <p className="text-sm font-semibold">{(attendance.data ?? []).length} Logs ({totalHeadcount} shifts)</p>
              </div>
            </div>
            {permissions.canViewWagesAndPayments && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Wages</p>
                <p className="text-sm font-bold">{currency(labourWage)}</p>
              </div>
            )}
          </Card>
        )}

        {permissions.canViewMaterialsAndContractors && (
          <Card className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-md bg-amber-500/10 text-amber-600">
                <Package className="size-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Material Receipts</p>
                <p className="text-sm font-semibold">{(receipts.data ?? []).length} GRNs</p>
              </div>
            </div>
            {permissions.canViewMaterialContractorCosts && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Value</p>
                <p className="text-sm font-bold">{currency(materialCost)}</p>
              </div>
            )}
          </Card>
        )}

        {permissions.canViewMaterialsAndContractors && (
          <Card className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-md bg-blue-500/10 text-blue-600">
                <HardHat className="size-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Contractors</p>
                <p className="text-sm font-semibold">{(bills.data ?? []).length} Bills</p>
              </div>
            </div>
            {permissions.canViewMaterialContractorCosts && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Bills Total</p>
                <p className="text-sm font-bold">{currency(contractorCost)}</p>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Cost Composition Chart: only for financial view */}
      {permissions.canViewProjectFinancials && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Cost composition</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
                <StatCard label="Labour & wages" value={currency(labourWage)} />
                <StatCard label="Materials" value={currency(materialCost)} />
                <StatCard label="Contractors" value={currency(contractorCost)} />
                <StatCard label="Other expenses" value={currency(otherCost)} />
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
      )}

      {/* Tabbed details */}
      <Tabs defaultValue="info" className="mt-4">
        <TabsList className="no-print flex-wrap">
          <TabsTrigger value="info">
            <FileText className="mr-1.5 size-3.5" /> Details
          </TabsTrigger>
          {permissions.canEnterAttendance && (
            <TabsTrigger value="attendance">
              <Users className="mr-1.5 size-3.5" /> Labour & Attendance
            </TabsTrigger>
          )}
          {permissions.canViewMaterialsAndContractors && (
            <TabsTrigger value="materials">
              <Package className="mr-1.5 size-3.5" /> Materials
            </TabsTrigger>
          )}
          {permissions.canViewMaterialContractorCosts && (
            <TabsTrigger value="contractors">
              <HardHat className="mr-1.5 size-3.5" /> Contractor Bills
            </TabsTrigger>
          )}
          {permissions.canViewProjectFinancials && (
            <TabsTrigger value="budget">Budget</TabsTrigger>
          )}
          {permissions.canViewProjectFinancials && (
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
          )}
        </TabsList>

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

        {permissions.canEnterAttendance && (
          <TabsContent value="attendance">
            <DataTable
              rows={attendance.data ?? []}
              loading={attendance.isLoading}
              exportName={`${p?.project_code ?? "project"}-attendance`}
              exportTitle={`${p?.name} — Labour & Attendance`}
              columns={[
                {
                  header: "Date",
                  cell: (r) => dateFmt(r.attendance_date),
                  value: (r) => r.attendance_date,
                },
                { header: "Kind", cell: (r) => r.kind, value: (r) => r.kind },
                {
                  header: "Status",
                  cell: (r) => <StatusBadge status={r.status} />,
                  value: (r) => r.status,
                },
                {
                  header: "Headcount",
                  cell: (r) => r.workforce_count ?? 1,
                  value: (r) => r.workforce_count ?? 1,
                },
                ...(permissions.canViewWagesAndPayments
                  ? [
                      {
                        header: "Wage",
                        cell: (r: { calculated_wage: number }) => currency(r.calculated_wage),
                        value: (r: { calculated_wage: number }) => r.calculated_wage,
                        className: "text-right",
                      },
                    ]
                  : []),
                {
                  header: "Remarks",
                  cell: (r) => r.remarks ?? "—",
                  value: (r) => r.remarks,
                },
              ]}
            />
          </TabsContent>
        )}

        {permissions.canViewMaterialsAndContractors && (
          <TabsContent value="materials">
            <DataTable
              rows={receipts.data ?? []}
              loading={receipts.isLoading}
              exportName={`${p?.project_code ?? "project"}-materials`}
              exportTitle={`${p?.name} — Material Receipts`}
              columns={[
                { header: "Receipt No", cell: (r) => r.receipt_number, value: (r) => r.receipt_number },
                {
                  header: "Date",
                  cell: (r) => dateFmt(r.receipt_date),
                  value: (r) => r.receipt_date,
                },
                {
                  header: "Material / Item",
                  cell: (r) => r.material_name ?? "General Material Supply",
                  value: (r) => r.material_name ?? "General Material Supply",
                },
                ...(permissions.canViewMaterialContractorCosts
                  ? [
                      {
                        header: "Amount",
                        cell: (r: { total_amount: number }) => currency(r.total_amount),
                        value: (r: { total_amount: number }) => r.total_amount,
                        className: "text-right",
                      },
                    ]
                  : []),
              ]}
            />
          </TabsContent>
        )}

        {permissions.canViewMaterialContractorCosts && (
          <TabsContent value="contractors">
            <DataTable
              rows={bills.data ?? []}
              loading={bills.isLoading}
              exportName={`${p?.project_code ?? "project"}-contractors`}
              exportTitle={`${p?.name} — Contractor Bills`}
              columns={[
                { header: "Bill No", cell: (r) => r.bill_number, value: (r) => r.bill_number },
                { header: "Date", cell: (r) => dateFmt(r.bill_date), value: (r) => r.bill_date },
                {
                  header: "Status",
                  cell: (r) => <StatusBadge status={r.status} />,
                  value: (r) => r.status,
                },
                {
                  header: "Net Amount",
                  cell: (r) => currency(r.net_amount),
                  value: (r) => r.net_amount,
                  className: "text-right",
                },
              ]}
            />
          </TabsContent>
        )}

        {permissions.canViewProjectFinancials && (
          <TabsContent value="budget">
            <DataTable
              rows={budgets.data ?? []}
              loading={budgets.isLoading}
              exportName={`${p?.project_code ?? "project"}-budget`}
              exportTitle={`${p?.name} — Budget Allotments`}
              columns={[
                { header: "Category", cell: (r) => r.category, value: (r) => r.category },
                {
                  header: "Budget",
                  cell: (r) => currency(r.budget_amount),
                  value: (r) => r.budget_amount,
                  className: "text-right",
                },
                { header: "Notes", cell: (r) => r.notes ?? "—", value: (r) => r.notes },
              ]}
            />
          </TabsContent>
        )}

        {permissions.canViewProjectFinancials && (
          <TabsContent value="expenses">
            <DataTable
              rows={expenses.data ?? []}
              loading={expenses.isLoading}
              exportName={`${p?.project_code ?? "project"}-expenses`}
              exportTitle={`${p?.name} — Site Expenses`}
              columns={[
                {
                  header: "Date",
                  cell: (r) => dateFmt(r.expense_date),
                  value: (r) => r.expense_date,
                },
                { header: "Category", cell: (r) => r.category, value: (r) => r.category },
                {
                  header: "Description",
                  cell: (r) => r.description ?? "—",
                  value: (r) => r.description,
                },
                {
                  header: "Amount",
                  cell: (r) => currency(r.amount),
                  value: (r) => r.amount,
                  className: "text-right",
                },
              ]}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
