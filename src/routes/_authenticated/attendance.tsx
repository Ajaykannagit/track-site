import { useCallback, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { DataTable, StatCard, type Column } from "@/components/DataTable";
import { FormDialog, type Field } from "@/components/FormDialog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { currency, dateFmt, monthStart, today } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance — Brickweld Pvt Ltd" },
      {
        name: "description",
        content: "Daily labour, office and contractor attendance with wages and overtime.",
      },
      { property: "og:title", content: "Attendance — Brickweld Pvt Ltd" },
      {
        property: "og:description",
        content: "Capture site attendance, overtime and wage cost per day.",
      },
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

type Emp = {
  id: string;
  full_name: string;
  wage_rate: number;
  employee_type: string;
  designation: string | null;
};

function AttendancePage() {
  const { canWriteAttendance } = useAuth();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [typeFilter, setTypeFilter] = useState<"all" | "employees" | "contractors" | "supervisors">(
    "all",
  );
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [editingRow, setEditingRow] = useState<Row | null>(null);
  const [deletingRow, setDeletingRow] = useState<Row | null>(null);

  const rows = useRows<Row>("attendance", {
    filters: [
      { col: "attendance_date", op: "gte", value: from },
      { col: "attendance_date", op: "lte", value: to },
    ],
    order: { col: "attendance_date" },
    limit: 500,
  });
  const projects = useRows<{ id: string; name: string }>("projects", { select: "id,name" });
  const employees = useRows<Emp>("employees", {
    select: "id,full_name,wage_rate,employee_type,designation",
  });
  const contractors = useRows<{ id: string; name: string }>("contractors", { select: "id,name" });

  const save = useSaveRow("attendance", "Attendance");
  const deleteRow = useDeleteRow("attendance", "Attendance");

  const name = (
    list: { id: string; name?: string; full_name?: string }[] | undefined,
    id: string | null,
  ) => list?.find((x) => x.id === id)?.name ?? list?.find((x) => x.id === id)?.full_name ?? "—";

  const isSupervisorEmp = useCallback(
    (empId: string | null) => {
      if (!empId) return false;
      const emp = employees.data?.find((e) => e.id === empId);
      if (!emp) return false;
      const des = (emp.designation || "").toLowerCase();
      return des.includes("supervisor") || des.includes("engineer");
    },
    [employees.data],
  );

  const filteredData = useMemo(() => {
    let list = rows.data ?? [];

    // Filter by Type
    if (typeFilter === "contractors") {
      list = list.filter((r) => r.contractor_id !== null || r.kind === "contractor");
    } else if (typeFilter === "supervisors") {
      list = list.filter((r) => isSupervisorEmp(r.employee_id));
    } else if (typeFilter === "employees") {
      list = list.filter((r) => r.employee_id !== null && !isSupervisorEmp(r.employee_id));
    }

    // Filter by Project
    if (projectFilter !== "all") {
      list = list.filter((r) => r.project_id === projectFilter);
    }

    // Filter by Status
    if (statusFilter !== "all") {
      list = list.filter((r) => r.status === statusFilter);
    }

    return list;
  }, [rows.data, typeFilter, projectFilter, statusFilter, isSupervisorEmp]);

  const formFields: Field[] = [
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
      options: (employees.data ?? []).map((e) => ({
        value: e.id,
        label: `${e.full_name}${e.designation ? ` (${e.designation})` : ""}`,
      })),
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
  ];

  const handleFormSubmit = async (values: Record<string, unknown>, existingId?: string) => {
    const hours = Number(values["working_hours"] ?? 8);
    const ot = Number(values["ot_hours"] ?? 0);
    const rate = Number(values["wage_rate"] ?? 0);
    const count = Number(values["workforce_count"] ?? 1) || 1;
    const factor = values["status"] === "half_day" ? 0.5 : values["status"] === "present" ? 1 : 0;
    const wage =
      Number(values["calculated_wage"] ?? 0) || count * (rate * factor + (rate / 8) * 1.5 * ot);

    await save.mutateAsync({
      id: existingId,
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
  };

  const columns: Column<Row>[] = [
    {
      header: "Date",
      cell: (r) => dateFmt(r.attendance_date),
      value: (r) => r.attendance_date,
      excelValue: (r) => {
        if (!r.attendance_date) return null;
        const parts = String(r.attendance_date).split("-").map(Number);
        if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
          return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
        }
        return new Date(r.attendance_date);
      },
      type: "date",
      align: "center",
      width: 15,
    },
    {
      header: "Project",
      cell: (r) => name(projects.data, r.project_id),
      value: (r) => name(projects.data, r.project_id),
      type: "text",
      align: "left",
      width: 32,
    },
    {
      header: "Kind",
      cell: (r) => r.kind,
      value: (r) => r.kind,
      type: "text",
      align: "center",
      width: 14,
    },
    {
      header: "Person / gang",
      cell: (r) =>
        r.employee_id
          ? name(employees.data, r.employee_id)
          : r.contractor_id
            ? name(contractors.data, r.contractor_id)
            : `${r.workforce_count ?? 0} workers`,
      value: (r) =>
        r.employee_id
          ? name(employees.data, r.employee_id)
          : r.contractor_id
            ? name(contractors.data, r.contractor_id)
            : `${r.workforce_count ?? 0} workers`,
      type: "text",
      align: "left",
      width: 26,
    },
    {
      header: "Status",
      cell: (r) => <StatusBadge status={r.status} />,
      value: (r) => r.status,
      type: "text",
      align: "center",
      width: 14,
    },
    {
      header: "Hours",
      cell: (r) => `${r.working_hours} + ${r.ot_hours} OT`,
      value: (r) => r.working_hours,
      excelValue: (r) => Number(r.working_hours ?? 0),
      type: "number",
      align: "right",
      width: 12,
    },
    {
      header: "Rate",
      cell: (r) => currency(r.wage_rate),
      value: (r) => r.wage_rate,
      excelValue: (r) => Number(r.wage_rate ?? 0),
      type: "currency",
      align: "right",
      width: 16,
      className: "text-right",
    },
    {
      header: "Wage",
      cell: (r) => currency(r.calculated_wage),
      value: (r) => r.calculated_wage,
      excelValue: (r) => Number(r.calculated_wage ?? 0),
      type: "currency",
      align: "right",
      width: 16,
      className: "text-right",
    },
    ...(canWriteAttendance
      ? [
          {
            header: "Actions",
            className: "text-right w-24",
            cell: (r: Row) => (
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  title="Edit attendance"
                  onClick={() => setEditingRow(r)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  title="Delete attendance"
                  onClick={() => setDeletingRow(r)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  const present = filteredData.filter((r) => r.status === "present").length;

  const formatFilterDate = (val: string) => {
    if (!val) return "";
    const parts = val.split("-").map(Number);
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ];
      return `${String(parts[2]).padStart(2, "0")}-${monthNames[parts[1] - 1]}-${parts[0]}`;
    }
    return val;
  };

  const appliedFiltersMap: Record<string, string> = {
    ...(from && to
      ? { "Date Range": `${formatFilterDate(from)} to ${formatFilterDate(to)}` }
      : from
        ? { "From Date": formatFilterDate(from) }
        : to
          ? { "To Date": formatFilterDate(to) }
          : {}),
    ...(typeFilter !== "all"
      ? {
          Type:
            typeFilter === "supervisors"
              ? "Site Supervisors"
              : typeFilter.replace(/^./, (s) => s.toUpperCase()),
        }
      : {}),
    ...(projectFilter !== "all" ? { Project: name(projects.data, projectFilter) } : {}),
    ...(statusFilter !== "all" ? { Status: statusFilter.replace("_", " ") } : {}),
  };

  const resetFilters = () => {
    setFrom(monthStart());
    setTo(today());
    setTypeFilter("all");
    setProjectFilter("all");
    setStatusFilter("all");
  };

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Daily labour, office staff and contractor gang attendance."
        actions={
          canWriteAttendance ? (
            <FormDialog
              title="Record attendance"
              description="Log a day's attendance for an employee, contractor gang or labour group."
              trigger={
                <Button>
                  <Plus className="mr-2 size-4" /> Record attendance
                </Button>
              }
              submitting={save.isPending}
              initial={{
                attendance_date: today(),
                kind: "labour",
                status: "present",
                working_hours: 8,
                ot_hours: 0,
              }}
              fields={formFields}
              onSubmit={async (values) => {
                await handleFormSubmit(values);
              }}
            />
          ) : null
        }
      />

      {/* Edit Form Dialog */}
      {editingRow && (
        <FormDialog
          open={!!editingRow}
          onOpenChange={(open) => !open && setEditingRow(null)}
          title="Edit attendance"
          description="Update attendance record details, hours, rates or remarks."
          submitting={save.isPending}
          initial={{
            attendance_date: editingRow.attendance_date,
            project_id: editingRow.project_id ?? "",
            kind: editingRow.kind,
            status: editingRow.status,
            employee_id: editingRow.employee_id ?? "",
            contractor_id: editingRow.contractor_id ?? "",
            workforce_count: editingRow.workforce_count ?? 1,
            working_hours: editingRow.working_hours,
            ot_hours: editingRow.ot_hours,
            wage_rate: editingRow.wage_rate,
            calculated_wage: editingRow.calculated_wage,
            remarks: editingRow.remarks ?? "",
          }}
          fields={formFields}
          onSubmit={async (values) => {
            await handleFormSubmit(values, editingRow.id);
            setEditingRow(null);
          }}
        />
      )}

      {/* Confirm Delete Dialog */}
      {deletingRow && (
        <ConfirmDeleteDialog
          open={!!deletingRow}
          onOpenChange={(open) => !open && setDeletingRow(null)}
          title="Delete attendance record"
          description="Are you sure you want to delete this attendance entry? This action cannot be undone."
          onConfirm={async () => {
            await deleteRow.mutateAsync(deletingRow.id);
            setDeletingRow(null);
          }}
        />
      )}

      {/* Filters Bar */}
      <div className="no-print mb-4 rounded-lg border bg-card p-3 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          {/* Type Filter */}
          <div>
            <Label className="mb-1.5 block text-xs font-medium">Filter by Type</Label>
            <Select
              value={typeFilter}
              onValueChange={(v) =>
                setTypeFilter(v as "all" | "employees" | "contractors" | "supervisors")
              }
            >
              <SelectTrigger className="w-44">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="employees">Employees</SelectItem>
                <SelectItem value="contractors">Contractors</SelectItem>
                <SelectItem value="supervisors">Site Supervisors</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Project Filter */}
          <div>
            <Label className="mb-1.5 block text-xs font-medium">Project</Label>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {(projects.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div>
            <Label className="mb-1.5 block text-xs font-medium">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="present">Present</SelectItem>
                <SelectItem value="half_day">Half Day</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
                <SelectItem value="leave">Leave</SelectItem>
                <SelectItem value="holiday">Holiday</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date Range */}
          <div>
            <Label className="mb-1.5 block text-xs font-medium">From</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-36"
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs font-medium">To</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-36"
            />
          </div>

          {/* Reset Filters */}
          {(typeFilter !== "all" || projectFilter !== "all" || statusFilter !== "all") && (
            <Button variant="ghost" size="sm" onClick={resetFilters} className="h-9 px-2 text-xs">
              <RotateCcw className="mr-1 size-3.5" /> Reset
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="Entries" value={String(filteredData.length)} />
        <StatCard label="Present records" value={String(present)} tone="success" />
        <StatCard
          label="Wage cost"
          value={currency(sum(filteredData, (r) => r.calculated_wage))}
          tone="warning"
        />
      </div>

      <DataTable
        rows={filteredData}
        columns={columns}
        loading={rows.isLoading}
        exportName="brickweld-attendance"
        exportTitle="Attendance Report"
        exportDescription="Construction Project Control System — Attendance Report"
        appliedFilters={appliedFiltersMap}
      />
    </div>
  );
}
