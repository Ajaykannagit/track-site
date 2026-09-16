import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { DataTable, StatCard, type Column } from "@/components/DataTable";
import { FormDialog, type Field } from "@/components/FormDialog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { useRows, useSaveRow, useDeleteRow, sum } from "@/lib/db";
import { currency } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/payroll")({
  head: () => ({
    meta: [
      { title: "Payroll — Brickweld" },
      {
        name: "description",
        content: "Monthly payroll runs with gross, deductions and net pay per employee.",
      },
      { property: "og:title", content: "Payroll — Brickweld" },
      {
        property: "og:description",
        content: "Run and approve monthly wages for site and office staff.",
      },
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
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function PayrollPage() {
  const { canWriteFinance, isMD } = useAuth();
  const [projectFilter, setProjectFilter] = useState<string>("all");

  const [editingRun, setEditingRun] = useState<Run | null>(null);
  const [deletingRun, setDeletingRun] = useState<Run | null>(null);

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
  const employees = useRows<{ id: string; full_name: string }>("employees", {
    select: "id,full_name",
  });

  const save = useSaveRow("payroll", "Payroll run");
  const deleteRun = useDeleteRow("payroll", "Payroll run");

  const now = new Date();
  const projectName = (id: string | null) =>
    projects.data?.find((p) => p.id === id)?.name ?? "All projects";
  const employeeName = (id: string | null) =>
    employees.data?.find((e) => e.id === id)?.full_name ?? "—";
  const projectOptions = (projects.data ?? []).map((p) => ({ value: p.id, label: p.name }));

  const canModify = canWriteFinance || isMD;

  const filteredRuns = useMemo(() => {
    let list = runs.data ?? [];
    if (projectFilter !== "all") {
      list = list.filter((r) => r.project_id === projectFilter);
    }
    return list;
  }, [runs.data, projectFilter]);

  const runFields: Field[] = [
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
      options: projectOptions,
    },
    { name: "total_gross", label: "Total gross (₹)", type: "number" },
    { name: "total_deductions", label: "Total deductions (₹)", type: "number" },
    { name: "remarks", label: "Remarks", type: "textarea" },
  ];

  const columns: Column<Run>[] = [
    {
      header: "Period",
      cell: (r) => `${MONTHS[r.period_month - 1]} ${r.period_year}`,
      value: (r) => `${r.period_year}-${String(r.period_month).padStart(2, "0")}`,
    },
    {
      header: "Project",
      cell: (r) => projectName(r.project_id),
      value: (r) => projectName(r.project_id),
    },
    { header: "Status", cell: (r) => <StatusBadge status={r.status} />, value: (r) => r.status },
    {
      header: "Gross",
      cell: (r) => currency(r.total_gross),
      value: (r) => r.total_gross,
      className: "text-right",
    },
    {
      header: "Deductions",
      cell: (r) => currency(r.total_deductions),
      value: (r) => r.total_deductions,
      className: "text-right",
    },
    {
      header: "Net",
      cell: (r) => currency(r.total_net),
      value: (r) => r.total_net,
      className: "text-right",
    },
    {
      header: "Actions",
      className: "text-right w-36",
      cell: (r: Run) => (
        <div className="flex items-center justify-end gap-1">
          {isMD && r.status !== "approved" && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs text-emerald-600 border-emerald-600/30 hover:bg-emerald-50"
              onClick={() => save.mutate({ id: r.id, values: { status: "approved" } })}
              title="Approve payroll run"
            >
              <Check className="mr-1 size-3" /> Approve
            </Button>
          )}
          {canModify && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                title="Edit payroll run"
                onClick={() => setEditingRun(r)}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-destructive hover:text-destructive"
                title="Delete payroll run"
                onClick={() => setDeletingRun(r)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Payroll"
        description="Monthly wage runs built from attendance, overtime and deductions."
        actions={
          canModify ? (
            <FormDialog
              title="New payroll run"
              description="Open a payroll period for a project or the whole company."
              trigger={
                <Button>
                  <Plus className="mr-2 size-4" /> New run
                </Button>
              }
              submitting={save.isPending}
              initial={{
                period_month: now.getMonth() + 1,
                period_year: now.getFullYear(),
                status: "draft",
              }}
              fields={runFields}
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

      {/* Edit Form Dialog */}
      {editingRun && (
        <FormDialog
          open={!!editingRun}
          onOpenChange={(v) => !v && setEditingRun(null)}
          title="Edit payroll run"
          fields={runFields}
          submitting={save.isPending}
          initial={{
            period_month: String(editingRun.period_month),
            period_year: editingRun.period_year,
            project_id: editingRun.project_id ?? "",
            total_gross: editingRun.total_gross,
            total_deductions: editingRun.total_deductions,
            remarks: editingRun.remarks ?? "",
          }}
          onSubmit={async (values) => {
            const gross = Number(values["total_gross"] ?? 0);
            const ded = Number(values["total_deductions"] ?? 0);
            await save.mutateAsync({
              id: editingRun.id,
              values: {
                ...values,
                period_month: Number(values["period_month"] ?? 1),
                period_year: Number(values["period_year"] ?? now.getFullYear()),
                project_id: values["project_id"] || null,
                total_gross: gross,
                total_deductions: ded,
                total_net: gross - ded,
              },
            });
            setEditingRun(null);
          }}
        />
      )}

      {/* Confirm Delete Dialog */}
      {deletingRun && (
        <ConfirmDeleteDialog
          open={!!deletingRun}
          onOpenChange={(v) => !v && setDeletingRun(null)}
          title="Delete payroll run"
          description={`Are you sure you want to delete payroll run for ${MONTHS[deletingRun.period_month - 1]} ${deletingRun.period_year}? This action cannot be undone.`}
          onConfirm={async () => {
            await deleteRun.mutateAsync(deletingRun.id);
            setDeletingRun(null);
          }}
        />
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="Runs" value={String(filteredRuns.length)} />
        <StatCard label="Gross payroll" value={currency(sum(filteredRuns, (r) => r.total_gross))} />
        <StatCard
          label="Net payable"
          value={currency(sum(filteredRuns, (r) => r.total_net))}
          tone="warning"
        />
      </div>

      {/* Project Filter */}
      <div className="no-print mb-4 flex items-center gap-2">
        <Label className="text-xs font-medium">Project</Label>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-48 h-8 text-xs">
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
        {projectFilter !== "all" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setProjectFilter("all")}
            className="h-8 px-2 text-xs"
          >
            <RotateCcw className="mr-1 size-3" /> Reset
          </Button>
        )}
      </div>

      <DataTable
        rows={filteredRuns}
        columns={columns}
        loading={runs.isLoading}
        exportName="brickweld-payroll-runs"
        exportTitle="Payroll Runs Report"
        exportDescription="Construction Project Control System — Payroll Runs Report"
        appliedFilters={
          projectFilter !== "all" ? { Project: projectName(projectFilter) } : undefined
        }
      />

      <h2 className="mt-8 mb-3 font-display text-lg font-semibold">Payslip lines</h2>
      <DataTable
        rows={items.data ?? []}
        loading={items.isLoading}
        exportName="brickweld-payslips"
        exportTitle="Payslip Lines Report"
        exportDescription="Construction Project Control System — Payslip Lines Report"
        columns={[
          {
            header: "Employee",
            cell: (r) => employeeName(r.employee_id),
            value: (r) => employeeName(r.employee_id),
          },
          {
            header: "Present / working",
            cell: (r) => `${r.present_days} / ${r.working_days}`,
            value: (r) => r.present_days,
          },
          { header: "OT hours", cell: (r) => r.ot_hours, value: (r) => r.ot_hours },
          {
            header: "Rate",
            cell: (r) => currency(r.wage_rate),
            value: (r) => r.wage_rate,
            className: "text-right",
          },
          {
            header: "Gross",
            cell: (r) => currency(r.gross_amount),
            value: (r) => r.gross_amount,
            className: "text-right",
          },
          {
            header: "Deductions",
            cell: (r) => currency(r.deductions),
            value: (r) => r.deductions,
            className: "text-right",
          },
          {
            header: "Net",
            cell: (r) => currency(r.net_amount),
            value: (r) => r.net_amount,
            className: "text-right",
          },
        ]}
      />
    </div>
  );
}
