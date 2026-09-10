import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { DataTable, StatCard, type Column } from "@/components/DataTable";
import { FormDialog } from "@/components/FormDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { useRows, useSaveRow, sum } from "@/lib/db";
import { currency, dateFmt, monthStart, today } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance — Brickweld" },
      { name: "description", content: "Daily labour, office and contractor attendance with wages and overtime." },
      { property: "og:title", content: "Attendance — Brickweld" },
      { property: "og:description", content: "Capture site attendance, overtime and wage cost per day." },
    ],
  }),
  component: AttendancePage,
});

type Row = {
  id: string;
  attendance_date: string;
  kind: string;
  status: string;
  project_id: string | null;
  employee_id: string | null;
  contractor_id: string | null;
  workforce_count: number | null;
  working_hours: number;
  ot_hours: number;
  wage_rate: number;
  calculated_wage: number;
  remarks: string | null;
};

function AttendancePage() {
  const { canWriteSite } = useAuth();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());

  const rows = useRows<Row>("attendance", {
    filters: [
      { col: "attendance_date", op: "gte", value: from },
      { col: "attendance_date", op: "lte", value: to },
    ],
    order: { col: "attendance_date" },
    limit: 500,
  });
  const projects = useRows<{ id: string; name: string }>("projects", { select: "id,name" });
  const employees = useRows<{ id: string; full_name: string; wage_rate: number }>("employees", {
    select: "id,full_name,wage_rate",
  });
  const contractors = useRows<{ id: string; name: string }>("contractors", { select: "id,name" });
  const save = useSaveRow("attendance", "Attendance");

  const name = (list: { id: string; name?: string; full_name?: string }[] | undefined, id: string | null) =>
    list?.find((x) => x.id === id)?.name ?? list?.find((x) => x.id === id)?.full_name ?? "—";

  const columns: Column<Row>[] = [
    { header: "Date", cell: (r) => dateFmt(r.attendance_date), value: (r) => r.attendance_date },
    { header: "Project", cell: (r) => name(projects.data, r.project_id), value: (r) => name(projects.data, r.project_id) },
    { header: "Kind", cell: (r) => r.kind, value: (r) => r.kind },
    {
      header: "Person / gang",
      cell: (r) =>
        r.employee_id
          ? name(employees.data, r.employee_id)
          : r.contractor_id
            ? name(contractors.data, r.contractor_id)
            : `${r.workforce_count ?? 0} workers`,
      value: (r) => (r.employee_id ? name(employees.data, r.employee_id) : name(contractors.data, r.contractor_id)),
    },
    { header: "Status", cell: (r) => <StatusBadge status={r.status} />, value: (r) => r.status },
    { header: "Hours", cell: (r) => `${r.working_hours} + ${r.ot_hours} OT`, value: (r) => r.working_hours },
    { header: "Rate", cell: (r) => currency(r.wage_rate), value: (r) => r.wage_rate, className: "text-right" },
    { header: "Wage", cell: (r) => currency(r.calculated_wage), value: (r) => r.calculated_wage, className: "text-right" },
  ];

  const data = rows.data ?? [];
  const present = data.filter((r) => r.status === "present").length;

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Daily labour, office staff and contractor gang attendance."
        actions={
          canWriteSite ? (
            <FormDialog
              title="Record attendance"
              description="Log a day's attendance for an employee, contractor gang or labour group."
              trigger={
                <Button>
                  <Plus className="mr-2 size-4" /> Record attendance
                </Button>
              }
              submitting={save.isPending}
              initial={{ attendance_date: today(), kind: "labour", status: "present", working_hours: 8, ot_hours: 0 }}
              fields={[
                { name: "attendance_date", label: "Date", type: "date", required: true },
                {
                  name: "project_id",
                  label: "Project",
                  type: "select",
                  options: (projects.data ?? []).map((p) => ({ value: p.id, label: p.name })),
                },
                {
                  name: "kind",
                  label: "Kind",
                  type: "select",
                  options: ["labour", "office", "contractor"].map((k) => ({ value: k, label: k })),
                },
                {
                  name: "status",
                  label: "Status",
                  type: "select",
                  options: ["present", "absent", "half_day", "leave", "holiday"].map((s) => ({
                    value: s,
                    label: s.replace("_", " "),
                  })),
                },
                {
                  name: "employee_id",
                  label: "Employee",
                  type: "select",
                  options: (employees.data ?? []).map((e) => ({ value: e.id, label: e.full_name })),
                },
                {
                  name: "contractor_id",
                  label: "Contractor",
                  type: "select",
                  options: (contractors.data ?? []).map((c) => ({ value: c.id, label: c.name })),
                },
                { name: "workforce_count", label: "Workforce count", type: "number" },
                { name: "working_hours", label: "Working hours", type: "number" },
                { name: "ot_hours", label: "OT hours", type: "number" },
                { name: "wage_rate", label: "Wage rate (₹/day)", type: "number" },
                { name: "calculated_wage", label: "Calculated wage (₹)", type: "number" },
                { name: "remarks", label: "Remarks", type: "textarea" },
              ]}
              onSubmit={async (values) => {
                const hours = Number(values["working_hours"] ?? 8);
                const ot = Number(values["ot_hours"] ?? 0);
                const rate = Number(values["wage_rate"] ?? 0);
                const count = Number(values["workforce_count"] ?? 1) || 1;
                const factor = values["status"] === "half_day" ? 0.5 : values["status"] === "present" ? 1 : 0;
                const wage =
                  Number(values["calculated_wage"] ?? 0) ||
                  count * (rate * factor + (rate / 8) * 1.5 * ot);
                await save.mutateAsync({
                  values: {
                    ...values,
                    employee_id: values["employee_id"] || null,
                    contractor_id: values["contractor_id"] || null,
                    project_id: values["project_id"] || null,
                    workforce_count: count,
                    working_hours: hours,
                    ot_hours: ot,
                    wage_rate: rate,
                    calculated_wage: Math.round(wage),
                  },
                });
              }}
            />
          ) : null
        }
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
        <StatCard label="Entries" value={String(data.length)} />
        <StatCard label="Present records" value={String(present)} tone="success" />
        <StatCard label="Wage cost" value={currency(sum(data, (r) => r.calculated_wage))} tone="warning" />
      </div>

      <DataTable rows={data} columns={columns} loading={rows.isLoading} exportName="attendance" />
    </div>
  );
}
