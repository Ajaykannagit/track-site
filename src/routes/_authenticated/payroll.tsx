import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { DataTable, StatCard, type Column } from "@/components/DataTable";
import { FormDialog } from "@/components/FormDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useRows, useSaveRow, sum } from "@/lib/db";
import { currency } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/payroll")({
  head: () => ({
    meta: [
      { title: "Payroll — Brickweld" },
      { name: "description", content: "Monthly payroll runs with gross, deductions and net pay per employee." },
      { property: "og:title", content: "Payroll — Brickweld" },
      { property: "og:description", content: "Run and approve monthly wages for site and office staff." },
    ],
  }),
  component: PayrollPage,
});

type Run = {
  id: string;
  period_month: number;
  period_year: number;
  project_id: string | null;
  status: string;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  remarks: string | null;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function PayrollPage() {
  const { canWriteFinance, isMD } = useAuth();
  const runs = useRows<Run>("payroll", { order: { col: "period_year" } });
  const projects = useRows<{ id: string; name: string }>("projects", { select: "id,name" });
  const items = useRows<{
    id: string;
    payroll_id: string;
    employee_id: string | null;
    present_days: number;
    working_days: number;
    ot_hours: number;
    wage_rate: number;
    gross_amount: number;
    deductions: number;
    net_amount: number;
  }>("payroll_items", { order: { col: "created_at" }, limit: 500 });
  const employees = useRows<{ id: string; full_name: string }>("employees", { select: "id,full_name" });
  const save = useSaveRow("payroll", "Payroll run");

  const now = new Date();
  const projectName = (id: string | null) => projects.data?.find((p) => p.id === id)?.name ?? "All projects";
  const employeeName = (id: string | null) => employees.data?.find((e) => e.id === id)?.full_name ?? "—";

  const columns: Column<Run>[] = [
    {
      header: "Period",
      cell: (r) => `${MONTHS[r.period_month - 1]} ${r.period_year}`,
      value: (r) => `${r.period_year}-${String(r.period_month).padStart(2, "0")}`,
    },
    { header: "Project", cell: (r) => projectName(r.project_id), value: (r) => projectName(r.project_id) },
    { header: "Status", cell: (r) => <StatusBadge status={r.status} />, value: (r) => r.status },
    { header: "Gross", cell: (r) => currency(r.total_gross), value: (r) => r.total_gross, className: "text-right" },
    { header: "Deductions", cell: (r) => currency(r.total_deductions), value: (r) => r.total_deductions, className: "text-right" },
    { header: "Net", cell: (r) => currency(r.total_net), value: (r) => r.total_net, className: "text-right" },
    {
      header: "",
      cell: (r) =>
        isMD && r.status !== "approved" ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => save.mutate({ id: r.id, values: { status: "approved" } })}
          >
            Approve
          </Button>
        ) : null,
    },
  ];

  const data = runs.data ?? [];

  return (
    <div>
      <PageHeader
        title="Payroll"
        description="Monthly wage runs built from attendance, overtime and deductions."
        actions={
          canWriteFinance ? (
            <FormDialog
              title="New payroll run"
              description="Open a payroll period for a project or the whole company."
              trigger={
                <Button>
                  <Plus className="mr-2 size-4" /> New run
                </Button>
              }
              submitting={save.isPending}
              initial={{ period_month: now.getMonth() + 1, period_year: now.getFullYear(), status: "draft" }}
              fields={[
                {
                  name: "period_month",
                  label: "Month",
                  type: "select",
                  required: true,
                  options: MONTHS.map((m, i) => ({ value: String(i + 1), label: m })),
                },
                { name: "period_year", label: "Year", type: "number", required: true },
                {
                  name: "project_id",
                  label: "Project",
                  type: "select",
                  options: (projects.data ?? []).map((p) => ({ value: p.id, label: p.name })),
                },
                { name: "total_gross", label: "Total gross (₹)", type: "number" },
                { name: "total_deductions", label: "Total deductions (₹)", type: "number" },
                { name: "remarks", label: "Remarks", type: "textarea" },
              ]}
              onSubmit={async (values) => {
                const gross = Number(values["total_gross"] ?? 0);
                const ded = Number(values["total_deductions"] ?? 0);
                await save.mutateAsync({
                  values: {
                    ...values,
                    period_month: Number(values["period_month"] ?? 1),
                    period_year: Number(values["period_year"] ?? now.getFullYear()),
                    project_id: values["project_id"] || null,
                    total_gross: gross,
                    total_deductions: ded,
                    total_net: gross - ded,
                    status: "draft",
                  },
                });
              }}
            />
          ) : null
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="Runs" value={String(data.length)} />
        <StatCard label="Gross payroll" value={currency(sum(data, (r) => r.total_gross))} />
        <StatCard label="Net payable" value={currency(sum(data, (r) => r.total_net))} tone="warning" />
      </div>

      <DataTable rows={data} columns={columns} loading={runs.isLoading} exportName="payroll-runs" />

      <h2 className="mt-8 mb-3 font-display text-lg font-semibold">Payslip lines</h2>
      <DataTable
        rows={items.data ?? []}
        loading={items.isLoading}
        exportName="payslips"
        columns={[
          { header: "Employee", cell: (r) => employeeName(r.employee_id), value: (r) => employeeName(r.employee_id) },
          { header: "Present / working", cell: (r) => `${r.present_days} / ${r.working_days}`, value: (r) => r.present_days },
          { header: "OT hours", cell: (r) => r.ot_hours, value: (r) => r.ot_hours },
          { header: "Rate", cell: (r) => currency(r.wage_rate), value: (r) => r.wage_rate, className: "text-right" },
          { header: "Gross", cell: (r) => currency(r.gross_amount), value: (r) => r.gross_amount, className: "text-right" },
          { header: "Deductions", cell: (r) => currency(r.deductions), value: (r) => r.deductions, className: "text-right" },
          { header: "Net", cell: (r) => currency(r.net_amount), value: (r) => r.net_amount, className: "text-right" },
        ]}
      />
    </div>
  );
}
