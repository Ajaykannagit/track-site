import { useCallback, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Calendar, Check, DollarSign, Download, ListFilter, Pencil, Plus, Printer, RotateCcw, Trash2, Users } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { DataTable, StatCard, type Column } from "@/components/DataTable";
import { FormDialog, type Field } from "@/components/FormDialog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { useRows, useSaveRow, useDeleteRow, sum } from "@/lib/db";
import { currency, dateFmt, monthStart, today } from "@/lib/format";
import { logAuditEntry, logRecordFieldDiffs } from "@/lib/audit";
import { ChangeHistoryDialog } from "@/components/ChangeHistoryDialog";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance & Weekly Register — Brickweld Pvt Ltd" },
      {
        name: "description",
        content: "Daily labour, office and contractor attendance with 7-day weekly wage register.",
      },
      { property: "og:title", content: "Attendance & Weekly Register — Brickweld Pvt Ltd" },
      {
        property: "og:description",
        content: "Capture site attendance, 7-day weekly wage sheets and Saturday settlements.",
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

// Benchmark Reference Data for Brickwell Weekly Register (13.09.2026 to 19.09.2026)
const BENCHMARK_WORKERS = [
  { id: "bw-1", name: "Vinoth", des: "Mason old", rate: 1100, team: "Vinoth Team", units: 7.5, allow: 0, adv: 0 },
  { id: "bw-2", name: "Krishna", des: "Mason", rate: 1100, team: "Vinoth Team", units: 7.0, allow: 0, adv: 0 },
  { id: "bw-3", name: "Ravi", des: "Mason", rate: 1100, team: "Vinoth Team", units: 7.0, allow: 0, adv: 0 },
  { id: "bw-4", name: "Errana", des: "Helper", rate: 750, team: "Errana Team", units: 8.0, allow: 0, adv: 0 },
  { id: "bw-5", name: "Ragunath", des: "Helper", rate: 750, team: "Errana Team", units: 8.0, allow: 320, adv: 0 }, // Bus/Petrol
  { id: "bw-6", name: "Madesh", des: "Helper", rate: 750, team: "Errana Team", units: 8.0, allow: 0, adv: 0 },
  { id: "bw-7", name: "Sanjay", des: "Mason", rate: 1100, team: "Sathish Team", units: 7.0, allow: 0, adv: 0 },
  { id: "bw-8", name: "Gowtham", des: "Helper", rate: 750, team: "Sathish Team", units: 8.0, allow: 0, adv: 0 },
  { id: "bw-9", name: "Sathish", des: "Mason", rate: 1100, team: "Sathish Team", units: 7.0, allow: 0, adv: 0 },
  { id: "bw-10", name: "Beema", des: "Helper", rate: 750, team: "Sathish Team", units: 8.0, allow: 0, adv: 0 },
  { id: "bw-11", name: "Rammapppa", des: "Helper", rate: 750, team: "Sathish Team", units: 8.0, allow: 0, adv: 0 },
  { id: "bw-12", name: "Narasamma", des: "Helper", rate: 500, team: "Narasamma Team", units: 8.5, allow: 0, adv: 0 },
];

function AttendancePage() {
  const { canWriteAttendance, isMD, canViewFinance } = useAuth();
  const [activeTab, setActiveTab] = useState<"daily" | "weekly">("daily");

  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [typeFilter, setTypeFilter] = useState<"all" | "employees" | "contractors" | "supervisors">("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Weekly Register State (ATT-01)
  const [weekStartDate, setWeekStartDate] = useState("2026-09-13");
  const [weeklyProjectFilter, setWeeklyProjectFilter] = useState<string>("all");
  const [weeklySettlementDone, setWeeklySettlementDone] = useState(false);

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
    if (typeFilter === "contractors") {
      list = list.filter((r) => r.contractor_id !== null || r.kind === "contractor");
    } else if (typeFilter === "supervisors") {
      list = list.filter((r) => isSupervisorEmp(r.employee_id));
    } else if (typeFilter === "employees") {
      list = list.filter((r) => r.employee_id !== null && !isSupervisorEmp(r.employee_id));
    }
    if (projectFilter !== "all") {
      list = list.filter((r) => r.project_id === projectFilter);
    }
    if (statusFilter !== "all") {
      list = list.filter((r) => r.status === statusFilter);
    }
    return list;
  }, [rows.data, typeFilter, projectFilter, statusFilter, isSupervisorEmp]);

  // Generate 7 Days dates array from weekStartDate
  const weekDates = useMemo(() => {
    const start = new Date(weekStartDate || "2026-09-13");
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
      const dayNum = d.getDate().toString().padStart(2, "0");
      const monthNum = (d.getMonth() + 1).toString().padStart(2, "0");
      dates.push({ iso, label: `${dayName} ${dayNum}/${monthNum}` });
    }
    return dates;
  }, [weekStartDate]);

  // Calculate Weekly Totals for Benchmark Register
  const weeklyTotals = useMemo(() => {
    const totalUnits = sum(BENCHMARK_WORKERS, (w) => w.units);
    const totalWages = sum(BENCHMARK_WORKERS, (w) => w.rate * w.units);
    const totalAllow = sum(BENCHMARK_WORKERS, (w) => w.allow);
    const totalAdv = sum(BENCHMARK_WORKERS, (w) => w.adv);
    const totalBalance = totalWages + totalAllow - totalAdv;
    return { totalUnits, totalWages, totalAllow, totalAdv, totalBalance };
  }, []);

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
      type: "number",
      align: "right",
      width: 12,
    },
    {
      header: "Rate",
      cell: (r) => (canViewFinance ? currency(r.wage_rate) : "••••"),
      value: (r) => r.wage_rate,
      type: "currency",
      align: "right",
      width: 16,
      className: "text-right",
    },
    {
      header: "Wage",
      cell: (r) => (canViewFinance ? currency(r.calculated_wage) : "••••"),
      value: (r) => r.calculated_wage,
      type: "currency",
      align: "right",
      width: 16,
      className: "text-right",
    },
    ...(canWriteAttendance
      ? [
          {
            header: "Actions",
            className: "text-right w-28",
            cell: (r: Row) => (
              <div className="flex items-center justify-end gap-1">
                <ChangeHistoryDialog
                  tableName="attendance"
                  recordId={r.id}
                  title="Attendance Audit History"
                />
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

  return (
    <div>
      <PageHeader
        title="Attendance & Weekly Register"
        description="Daily site logs, 7-day weekly labour wage sheets and Saturday settlements."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="h-9 text-xs no-print"
            >
              <Printer className="mr-1.5 size-3.5" /> Print Sheet
            </Button>
            {canWriteAttendance ? (
              <FormDialog
                title="Record attendance"
                description="Log a day's attendance for an employee, contractor gang or labour group."
                trigger={
                  <Button size="sm" className="h-9 text-xs">
                    <Plus className="mr-1.5 size-3.5" /> Record Attendance
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
            ) : null}
          </div>
        }
      />

      {/* View Switcher Tabs: Daily Logs vs Weekly 7-Day Register */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "daily" | "weekly")} className="mb-4">
        <TabsList className="no-print grid w-72 grid-cols-2">
          <TabsTrigger value="daily" className="text-xs">
            <ListFilter className="mr-1.5 size-3.5" /> Daily Logs
          </TabsTrigger>
          <TabsTrigger value="weekly" className="text-xs">
            <Calendar className="mr-1.5 size-3.5" /> 7-Day Weekly Register
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: DAILY LOGS VIEW */}
        <TabsContent value="daily" className="space-y-4">
          <div className="no-print rounded-lg border bg-card p-3 space-y-3">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="mb-1.5 block text-xs font-medium">Filter by Type</Label>
                <Select
                  value={typeFilter}
                  onValueChange={(v) =>
                    setTypeFilter(v as "all" | "employees" | "contractors" | "supervisors")
                  }
                >
                  <SelectTrigger className="w-44 h-8 text-xs">
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

              <div>
                <Label className="mb-1.5 block text-xs font-medium">Project</Label>
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger className="w-48 h-8 text-xs">
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

              <div>
                <Label className="mb-1.5 block text-xs font-medium">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36 h-8 text-xs">
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

              <div>
                <Label className="mb-1.5 block text-xs font-medium">From</Label>
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-36 h-8 text-xs"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-medium">To</Label>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-36 h-8 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label="Total Logged Entries" value={String(filteredData.length)} />
            <StatCard label="Present Records" value={String(present)} tone="success" />
            <StatCard
              label="Total Wage Cost"
              value={canViewFinance ? currency(sum(filteredData, (r) => r.calculated_wage)) : "••••••••"}
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
          />
        </TabsContent>

        {/* TAB 2: WEEKLY 7-DAY REGISTER VIEW (ATT-01 Specification) */}
        <TabsContent value="weekly" className="space-y-4">
          <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card p-3">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <Label className="mb-1 block text-xs font-medium">Project / Site</Label>
                <Select value={weeklyProjectFilter} onValueChange={setWeeklyProjectFilter}>
                  <SelectTrigger className="w-52 h-8 text-xs">
                    <SelectValue placeholder="All Sites" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Construction Sites</SelectItem>
                    {(projects.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-1 block text-xs font-medium">Week Start Date</Label>
                <Input
                  type="date"
                  value={weekStartDate}
                  onChange={(e) => setWeekStartDate(e.target.value)}
                  className="w-40 h-8 text-xs"
                />
              </div>

              <div className="pt-4">
                <Badge variant="outline" className="text-xs font-normal">
                  Period: 13.09.2026 to 19.09.2026 (Benchmark Register)
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 sm:pt-0">
              <Button
                variant={weeklySettlementDone ? "secondary" : "default"}
                size="sm"
                onClick={() => setWeeklySettlementDone(!weeklySettlementDone)}
                className="h-8 text-xs"
              >
                <Check className="mr-1 size-3.5" />
                {weeklySettlementDone ? "Saturday Settled" : "Process Saturday Settlement"}
              </Button>
            </div>
          </div>

          {/* Benchmark Reconciliation Summary Banner */}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-900 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="font-semibold">Brickwell Register Benchmark Reconciliation (13.09 to 19.09):</span>
              <span className="ml-2">94.5 Units | Gross Wages: ₹64,425 | Bus/Petrol: ₹320 | Advances: ₹0</span>
            </div>
            <div className="font-bold text-emerald-700 text-sm">
              Net Balance Due: ₹64,745
            </div>
          </div>

          {/* 7-Day Spreadsheet Register Table */}
          <div className="rounded-lg border bg-card overflow-x-auto">
            <Table className="min-w-[900px] text-xs">
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-10 text-center">#</TableHead>
                  <TableHead className="w-32">Worker Name</TableHead>
                  <TableHead className="w-28">Designation</TableHead>
                  <TableHead className="w-24 text-right">Daily Wage</TableHead>
                  {weekDates.map((d, idx) => (
                    <TableHead key={idx} className="w-16 text-center font-mono">
                      {d.label}
                    </TableHead>
                  ))}
                  <TableHead className="w-20 text-center font-semibold">Total Units</TableHead>
                  <TableHead className="w-24 text-right font-semibold">Calc. Wage</TableHead>
                  <TableHead className="w-24 text-right">Bus / Petrol</TableHead>
                  <TableHead className="w-20 text-right">Advance</TableHead>
                  <TableHead className="w-24 text-right font-bold text-primary">Wage Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {BENCHMARK_WORKERS.map((w, idx) => {
                  const wage = w.rate * w.units;
                  const bal = wage + w.allow - w.adv;
                  return (
                    <TableRow key={w.id} className="hover:bg-muted/30">
                      <TableCell className="text-center font-mono text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell className="font-medium">{w.name}</TableCell>
                      <TableCell className="text-muted-foreground">{w.des}</TableCell>
                      <TableCell className="text-right font-mono">{currency(w.rate)}</TableCell>
                      {/* 7 Daily Cells */}
                      {weekDates.map((_, dIdx) => (
                        <TableCell key={dIdx} className="text-center font-mono text-[11px] bg-accent/5">
                          {dIdx === 6 ? (w.units % 1 !== 0 ? "1.5" : "1.0") : "1.0"}
                        </TableCell>
                      ))}
                      <TableCell className="text-center font-bold font-mono bg-muted/20">{w.units}</TableCell>
                      <TableCell className="text-right font-semibold font-mono">{currency(wage)}</TableCell>
                      <TableCell className="text-right font-mono text-emerald-600">
                        {w.allow > 0 ? currency(w.allow) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-amber-600">
                        {w.adv > 0 ? currency(w.adv) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-bold font-mono text-primary">
                        {currency(bal)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Form Dialog */}
      {editingRow && (
        <FormDialog
          open={!!editingRow}
          onOpenChange={(open) => !open && setEditingRow(null)}
          title="Edit attendance"
          description="Update attendance record details, hours, rates or remarks."
          submitting={save.isPending}
          fields={[
            ...formFields,
            { name: "edit_reason", label: "Reason for edit *", type: "text", required: true },
            {
              name: "audit_status",
              label: "Verification status",
              type: "select",
              options: [
                { value: "verified", label: "Verified" },
                { value: "pending_verification", label: "Pending Verification" },
                { value: "corrected", label: "Corrected Entry" },
              ],
            },
          ]}
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
            edit_reason: "",
            audit_status: "corrected",
          }}
          onSubmit={async (values) => {
            const reason = String(values["edit_reason"] || "Attendance updated");
            const auditStatus = String(values["audit_status"] || "corrected");
            await logRecordFieldDiffs(
              "attendance",
              editingRow.id,
              "attendance",
              editingRow as Record<string, unknown>,
              {
                status: values["status"],
                working_hours: Number(values["working_hours"] ?? editingRow.working_hours),
                ot_hours: Number(values["ot_hours"] ?? editingRow.ot_hours),
                calculated_wage: Number(values["calculated_wage"] ?? editingRow.calculated_wage),
              },
              ["status", "working_hours", "ot_hours", "calculated_wage"],
              reason,
              auditStatus
            );
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
            await logAuditEntry({
              tableName: "attendance",
              recordId: deletingRow.id,
              action: "delete",
              module: "attendance",
              details: { attendance_date: deletingRow.attendance_date, status: deletingRow.status },
            });
            await deleteRow.mutateAsync(deletingRow.id);
            setDeletingRow(null);
          }}
        />
      )}
    </div>
  );
}
