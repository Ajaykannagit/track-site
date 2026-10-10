import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  HardHat,
  Info,
  Pencil,
  Phone,
  Printer,
  Plus,
  RefreshCw,
  Save,
  ShieldAlert,
  User,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { useRows, useSaveRow, sum } from "@/lib/db";
import { currency, dateFmt } from "@/lib/format";
import { exportToExcel } from "@/lib/excel";
import { calculateSuggestedDayValue, calculateWorkerWeeklyWage } from "@/lib/wageRules";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({
    meta: [
      { title: "Weekly Attendance Register — Brickweld Pvt Ltd" },
      {
        name: "description",
        content: "Weekly construction site attendance register and team wage payment calculation sheet.",
      },
      { property: "og:title", content: "Weekly Attendance Register — Brickweld Pvt Ltd" },
      {
        property: "og:description",
        content: "7-Day weekly attendance grid, day values, sites and team wage settlements.",
      },
    ],
  }),
  component: AttendanceWeeklySheetPage,
});

type Employee = {
  id: string;
  employee_code: string;
  full_name: string;
  designation: string | null;
  wage_rate: number;
  team_id: string | null;
  phone: string | null;
  address: string | null;
  photo_url?: string | null;
  emergency_contact?: string | null;
};

type Team = {
  id: string;
  name: string;
  leader_name?: string | null;
};

type Site = {
  id: string;
  name: string;
  code?: string | null;
  is_active?: boolean;
};

type AttendanceRecord = {
  id: string;
  attendance_date: string;
  employee_id: string | null;
  kind: string;
  status: string;
  in_time?: string | null;
  out_time?: string | null;
  site_id?: string | null;
  site_name?: string | null;
  day_value?: number | null;
  is_leave?: boolean | null;
  calculated_wage: number;
  remarks?: string | null;
};

type WeeklyAdjustment = {
  id?: string;
  employee_id: string;
  week_start_date: string;
  bus_petrol: number;
  advance_paid: number;
  remarks?: string | null;
};

// Helper to get standard 7 dates of the week starting from given Sunday
function getWeekDates(weekStart: Date) {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function formatDateISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function formatDayHeader(d: Date): { dayName: string; formatted: string; iso: string } {
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return {
    dayName: days[d.getDay()],
    formatted: `${d.getDate()}/${months[d.getMonth()]}`,
    iso: formatDateISO(d),
  };
}

// Default to week of benchmark data (13.09.2026)
function getInitialWeekStart(): Date {
  const initial = new Date(2026, 8, 13); // 13 Sep 2026 (Sunday)
  return initial;
}

function AttendanceWeeklySheetPage() {
  const { isMD, permissions } = useAuth();

  // Current Week Start State (Sunday)
  const [weekStartDate, setWeekStartDate] = useState<Date>(getInitialWeekStart);

  // Selected Worker for Profile Drawer
  const [profileWorker, setProfileWorker] = useState<Employee | null>(null);

  // Selected Attendance Cell for Quick Day Edit Dialog
  const [editCell, setEditCell] = useState<{
    employee: Employee;
    date: Date;
    existing?: AttendanceRecord | null;
  } | null>(null);

  // Cell Edit Form States
  const [inTimeInput, setInTimeInput] = useState("6");
  const [outTimeInput, setOutTimeInput] = useState("6");
  const [siteInput, setSiteInput] = useState("Site 637");
  const [isLeaveInput, setIsLeaveInput] = useState(false);
  const [dayValueInput, setDayValueInput] = useState("1.5");

  // Local state for weekly adjustments (bus/petrol and advance) to support instant edits
  const [adjustmentsOverride, setAdjustmentsOverride] = useState<Record<string, { busPetrol: number; advance: number }>>({});

  // Query Data
  const weekStartISO = formatDateISO(weekStartDate);
  const weekDates = useMemo(() => getWeekDates(weekStartDate), [weekStartDate]);
  const weekEndISO = formatDateISO(weekDates[6]);

  const employees = useRows<Employee>("employees", {
    order: { col: "full_name", asc: true },
  });

  const teams = useRows<Team>("teams", {
    order: { col: "name", asc: true },
  });

  const sites = useRows<Site>("sites", {
    order: { col: "name", asc: true },
  });

  const attendance = useRows<AttendanceRecord>("attendance", {
    filters: [
      { col: "attendance_date", op: "gte", value: weekStartISO },
      { col: "attendance_date", op: "lte", value: weekEndISO },
    ],
  });

  const weeklyAdjustments = useRows<WeeklyAdjustment>("weekly_wage_adjustments", {
    filters: [{ col: "week_start_date", op: "eq", value: weekStartISO }],
    enabled: permissions.canViewWagesAndPayments,
  });

  const saveAttendance = useSaveRow("attendance", "Attendance");
  const saveAdjustment = useSaveRow("weekly_wage_adjustments", "Weekly Adjustment");
  const saveEmployee = useSaveRow("employees", "Worker");

  // Navigation handlers
  const handlePrevWeek = () => {
    setWeekStartDate((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() - 7);
      return next;
    });
  };

  const handleNextWeek = () => {
    setWeekStartDate((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + 7);
      return next;
    });
  };

  // Open Cell Edit Modal
  const handleOpenCellEdit = (emp: Employee, date: Date) => {
    if (!permissions.canEnterAttendance) return;
    const iso = formatDateISO(date);
    const rec = (attendance.data ?? []).find(
      (a) => a.employee_id === emp.id && a.attendance_date === iso,
    );

    setEditCell({ employee: emp, date, existing: rec });
    if (rec) {
      setInTimeInput(rec.in_time ?? "6");
      setOutTimeInput(rec.out_time ?? "6");
      setSiteInput(rec.site_name ?? "Site 637");
      setIsLeaveInput(Boolean(rec.is_leave));
      setDayValueInput(String(rec.day_value ?? 1.0));
    } else {
      setInTimeInput("6");
      setOutTimeInput("6");
      setSiteInput("Site 637");
      setIsLeaveInput(false);
      setDayValueInput("1.5");
    }
  };

  // Auto-update suggested day value when in/out time changes in edit modal
  const handleTimesChange = (inT: string, outT: string, leave: boolean) => {
    setInTimeInput(inT);
    setOutTimeInput(outT);
    setIsLeaveInput(leave);
    const suggested = calculateSuggestedDayValue(inT, outT, leave);
    setDayValueInput(String(suggested));
  };

  // Save Day Attendance
  const handleSaveDayAttendance = async () => {
    if (!editCell) return;
    const { employee, date, existing } = editCell;
    const iso = formatDateISO(date);
    const dayVal = parseFloat(dayValueInput) || 0;
    const calcWage = Math.round(dayVal * (employee.wage_rate || 0));

    await saveAttendance.mutateAsync({
      id: existing?.id,
      values: {
        employee_id: employee.id,
        attendance_date: iso,
        kind: "labour",
        status: isLeaveInput ? "leave" : dayVal === 0 ? "absent" : "present",
        in_time: inTimeInput,
        out_time: outTimeInput,
        site_name: isLeaveInput ? "Leave" : siteInput,
        is_leave: isLeaveInput,
        day_value: dayVal,
        wage_rate: employee.wage_rate || 0,
        calculated_wage: calcWage,
        working_hours: dayVal * 8,
        ot_hours: dayVal > 1.0 ? (dayVal - 1.0) * 8 : 0,
      },
    });

    setEditCell(null);
  };

  // Save Weekly Adjustment (Bus/Petrol or Advance)
  const handleSaveAdjustment = async (empId: string, busPetrol: number, advance: number) => {
    const existing = (weeklyAdjustments.data ?? []).find(
      (adj) => adj.employee_id === empId && adj.week_start_date === weekStartISO,
    );

    setAdjustmentsOverride((prev) => ({
      ...prev,
      [empId]: { busPetrol, advance },
    }));

    await saveAdjustment.mutateAsync({
      id: existing?.id,
      values: {
        employee_id: empId,
        week_start_date: weekStartISO,
        bus_petrol: busPetrol,
        advance_paid: advance,
      },
    });
  };

  // Computed Main Grid Rows
  const workerRows = useMemo(() => {
    const empList = employees.data ?? [];
    const attList = attendance.data ?? [];
    const adjList = weeklyAdjustments.data ?? [];

    return empList.map((emp, idx) => {
      // 7 days attendance mapping
      const dailyMap: Record<string, AttendanceRecord | undefined> = {};
      let totalDays = 0;

      for (const d of weekDates) {
        const iso = formatDateISO(d);
        const rec = attList.find((a) => a.employee_id === emp.id && a.attendance_date === iso);
        dailyMap[iso] = rec;
        if (rec && !rec.is_leave) {
          totalDays += Number(rec.day_value ?? 0);
        }
      }

      // Adjustments (Bus/Petrol & Advance)
      const existingAdj = adjList.find(
        (a) => a.employee_id === emp.id && a.week_start_date === weekStartISO,
      );
      const localOverride = adjustmentsOverride[emp.id];

      const busPetrol = localOverride?.busPetrol ?? Number(existingAdj?.bus_petrol ?? 0);
      const advance = localOverride?.advance ?? Number(existingAdj?.advance_paid ?? 0);

      const { wage, wageBalance } = calculateWorkerWeeklyWage(
        totalDays,
        emp.wage_rate || 0,
        busPetrol,
        advance,
      );

      const team = (teams.data ?? []).find((t) => t.id === emp.team_id)?.name ?? "Unassigned Team";

      return {
        sno: idx + 1,
        employee: emp,
        team,
        dailyMap,
        totalDays,
        wageRate: emp.wage_rate || 0,
        wage,
        busPetrol,
        advance,
        wageBalance,
      };
    });
  }, [employees.data, attendance.data, weeklyAdjustments.data, weekDates, weekStartISO, teams.data, adjustmentsOverride]);

  // Grand Totals
  const grandTotalDays = sum(workerRows, (r) => r.totalDays);
  const grandTotalWage = sum(workerRows, (r) => r.wage);
  const grandTotalBusPetrol = sum(workerRows, (r) => r.busPetrol);
  const grandTotalAdvance = sum(workerRows, (r) => r.advance);
  const grandTotalBalance = sum(workerRows, (r) => r.wageBalance);

  // Team-wise payment groupings
  const teamPaymentGroups = useMemo(() => {
    const map = new Map<string, { teamName: string; members: typeof workerRows; teamTotal: number }>();

    for (const r of workerRows) {
      const tName = r.team;
      if (!map.has(tName)) {
        map.set(tName, { teamName: tName, members: [], teamTotal: 0 });
      }
      const group = map.get(tName)!;
      group.members.push(r);
      group.teamTotal += r.wageBalance;
    }

    return [...map.values()];
  }, [workerRows]);

  // Excel Export Handler
  const handleExportExcel = async () => {
    const filename = `Brickweld-Attendance-${weekStartISO}-to-${weekEndISO}`;
    const columns = [
      { header: "S.No", value: (r: (typeof workerRows)[0]) => r.sno },
      { header: "Name", value: (r: (typeof workerRows)[0]) => r.employee.full_name },
      { header: "Designation", value: (r: (typeof workerRows)[0]) => r.employee.designation ?? "—" },
      { header: "Wage / Day", value: (r: (typeof workerRows)[0]) => r.wageRate },
      ...weekDates.map((d) => ({
        header: formatDayHeader(d).formatted,
        value: (r: (typeof workerRows)[0]) => {
          const rec = r.dailyMap[formatDateISO(d)];
          if (!rec) return "—";
          if (rec.is_leave) return "Leave";
          return `${rec.in_time ?? 6}-${rec.out_time ?? 6} (${rec.site_name ?? "Site"}) [${rec.day_value ?? 1}]`;
        },
      })),
      { header: "Total Days", value: (r: (typeof workerRows)[0]) => r.totalDays },
      { header: "Wage", value: (r: (typeof workerRows)[0]) => r.wage },
      { header: "Bus/Petrol", value: (r: (typeof workerRows)[0]) => r.busPetrol },
      { header: "Advance", value: (r: (typeof workerRows)[0]) => r.advance },
      { header: "Wage Balance", value: (r: (typeof workerRows)[0]) => r.wageBalance },
    ];

    await exportToExcel({
      filename,
      title: `Brickweld Pvt Ltd — Attendance Register (${formatDateDisplay(weekStartDate)} to ${formatDateDisplay(weekDates[6])})`,
      description: "Weekly site attendance, day values and team payment calculation",
      rows: workerRows,
      columns,
    });
  };

  return (
    <div className="space-y-6">
      {/* Title & Navigation Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">
              Brickweld Pvt Ltd &nbsp;
              <span className="text-primary font-mono">
                {formatDateDisplay(weekStartDate)} to {formatDateDisplay(weekDates[6])}
              </span>
            </h1>
            <Badge variant="outline" className="hidden sm:inline-flex">
              7-Day Weekly Sheet
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Weekly worker attendance, site allocations, day values, and team settlement ledger.
          </p>
        </div>

        {/* Action Controls */}
        <div className="no-print flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-md border bg-card p-1 shadow-xs">
            <Button variant="ghost" size="icon" onClick={handlePrevWeek} className="size-8" title="Previous Week">
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setWeekStartDate(getInitialWeekStart())}
              className="h-8 px-2.5 text-xs font-mono"
            >
              13.09.2026
            </Button>
            <Button variant="ghost" size="icon" onClick={handleNextWeek} className="size-8" title="Next Week">
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <Button variant="outline" size="sm" onClick={handleExportExcel} className="h-9 text-xs">
            <FileSpreadsheet className="mr-1.5 size-3.5 text-emerald-600" /> Export Excel
          </Button>

          <Button variant="outline" size="sm" onClick={() => window.print()} className="h-9 text-xs">
            <Printer className="mr-1.5 size-3.5" /> Print / PDF (Landscape)
          </Button>
        </div>
      </div>

      {/* Role Notice */}
      {!permissions.canViewWagesAndPayments && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <ShieldAlert className="size-4 shrink-0 text-amber-600" />
          <span>
            <strong>Supervisor View:</strong> Showing site in/out times and day attendance entry. Wage balances, advances and team totals are restricted.
          </span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3A. MAIN WEEKLY ATTENDANCE GRID */}
      {/* ========================================================================= */}
      <Card className="overflow-hidden border shadow-xs">
        <div className="overflow-x-auto">
          <Table className="text-xs">
            <TableHeader className="bg-muted/60">
              <TableRow>
                <TableHead className="w-10 text-center font-bold">SNO</TableHead>
                <TableHead className="min-w-32 font-bold">NAME</TableHead>
                <TableHead className="min-w-24 font-bold">DESIGNATION</TableHead>
                {permissions.canViewWagesAndPayments && (
                  <TableHead className="min-w-20 text-right font-bold">WAGE / DAY</TableHead>
                )}

                {/* 7 Days of the Week Columns */}
                {weekDates.map((d) => {
                  const h = formatDayHeader(d);
                  return (
                    <TableHead key={h.iso} className="min-w-28 text-center border-l bg-muted/40 p-2">
                      <div className="font-bold text-foreground">{h.dayName}</div>
                      <div className="text-[11px] font-mono text-muted-foreground">{h.formatted}</div>
                    </TableHead>
                  );
                })}

                {/* Summary End Columns */}
                <TableHead className="min-w-16 text-center font-bold border-l bg-muted/80">TOTAL DAYS</TableHead>
                {permissions.canViewWagesAndPayments && (
                  <>
                    <TableHead className="min-w-20 text-right font-bold bg-muted/80">WAGE (₹)</TableHead>
                    <TableHead className="min-w-24 text-right font-bold bg-muted/80">BUS / PETROL</TableHead>
                    <TableHead className="min-w-20 text-right font-bold bg-muted/80">ADVANCE</TableHead>
                    <TableHead className="min-w-24 text-right font-bold bg-muted/80 text-primary">WAGE BALANCE</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>

            <TableBody>
              {workerRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={permissions.canViewWagesAndPayments ? 16 : 11} className="py-12 text-center text-muted-foreground">
                    No active workers found in database. Add workers in Masters section.
                  </TableCell>
                </TableRow>
              ) : (
                workerRows.map((r) => (
                  <TableRow key={r.employee.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="text-center font-mono text-muted-foreground">{r.sno}</TableCell>
                    
                    {/* Worker Name with Profile click */}
                    <TableCell className="font-medium">
                      <button
                        type="button"
                        onClick={() => setProfileWorker(r.employee)}
                        className="text-left font-semibold text-primary hover:underline cursor-pointer flex items-center gap-1.5"
                        title="Click to view full worker profile & ledger"
                      >
                        <User className="size-3.5 text-muted-foreground" />
                        {r.employee.full_name}
                      </button>
                    </TableCell>

                    <TableCell className="text-muted-foreground">
                      <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0">
                        {r.employee.designation || "Helper"}
                      </Badge>
                    </TableCell>

                    {permissions.canViewWagesAndPayments && (
                      <TableCell className="text-right font-mono font-medium">
                        {currency(r.wageRate).replace("₹", "")}
                      </TableCell>
                    )}

                    {/* 7 Daily Cells */}
                    {weekDates.map((d) => {
                      const iso = formatDateISO(d);
                      const rec = r.dailyMap[iso];

                      return (
                        <TableCell
                          key={iso}
                          onClick={() => handleOpenCellEdit(r.employee, d)}
                          className="border-l p-1.5 text-center cursor-pointer hover:bg-primary/5 transition-colors align-top"
                          title="Click to record or edit site, times & day value"
                        >
                          {rec ? (
                            rec.is_leave ? (
                              <div className="rounded bg-rose-50 border border-rose-200 p-1 text-rose-700">
                                <div className="text-[10px] font-bold uppercase">Leave</div>
                                <div className="text-[10px] font-mono">0.0</div>
                              </div>
                            ) : (
                              <div className="rounded bg-card border p-1 shadow-2xs space-y-0.5">
                                <div className="text-[10px] font-mono font-semibold text-foreground">
                                  {rec.in_time ?? "6"} - {rec.out_time ?? "6"}
                                </div>
                                <div className="text-[10px] truncate text-muted-foreground max-w-[90px] mx-auto" title={rec.site_name ?? "Site"}>
                                  {rec.site_name ?? "Site 637"}
                                </div>
                                <div className="inline-block px-1 rounded text-[10px] font-bold bg-primary/10 text-primary">
                                  {Number(rec.day_value ?? 1.0).toFixed(1)}
                                </div>
                              </div>
                            )
                          ) : (
                            <div className="py-2 text-[11px] text-muted-foreground/50 hover:text-primary">
                              + Log
                            </div>
                          )}
                        </TableCell>
                      );
                    })}

                    {/* Total Days */}
                    <TableCell className="border-l text-center font-bold font-mono bg-muted/20">
                      {r.totalDays.toFixed(1)}
                    </TableCell>

                    {/* Wage Calculations (MD / Accountant) */}
                    {permissions.canViewWagesAndPayments && (
                      <>
                        <TableCell className="text-right font-mono font-semibold bg-muted/20">
                          {currency(r.wage).replace("₹", "")}
                        </TableCell>

                        {/* Bus / Petrol (Editable inline) */}
                        <TableCell className="text-right bg-muted/20 p-1">
                          <Input
                            type="number"
                            defaultValue={r.busPetrol || ""}
                            placeholder="0"
                            onBlur={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              if (val !== r.busPetrol) {
                                void handleSaveAdjustment(r.employee.id, val, r.advance);
                              }
                            }}
                            className="h-7 w-20 text-right text-xs font-mono ml-auto"
                          />
                        </TableCell>

                        {/* Advance (Editable inline) */}
                        <TableCell className="text-right bg-muted/20 p-1">
                          <Input
                            type="number"
                            defaultValue={r.advance || ""}
                            placeholder="0"
                            onBlur={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              if (val !== r.advance) {
                                void handleSaveAdjustment(r.employee.id, r.busPetrol, val);
                              }
                            }}
                            className="h-7 w-20 text-right text-xs font-mono ml-auto"
                          />
                        </TableCell>

                        {/* Wage Balance */}
                        <TableCell className="text-right font-mono font-bold text-primary bg-muted/30">
                          {currency(r.wageBalance).replace("₹", "")}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>

            {/* Grand Totals Bottom Row */}
            <TableRow className="border-t-2 bg-muted font-bold text-xs">
              <TableCell colSpan={permissions.canViewWagesAndPayments ? 11 : 10} className="text-right uppercase tracking-wider py-3">
                Grand Totals:
              </TableCell>
              <TableCell className="text-center font-mono text-sm py-3 border-l">
                {grandTotalDays.toFixed(1)}
              </TableCell>
              {permissions.canViewWagesAndPayments && (
                <>
                  <TableCell className="text-right font-mono text-sm py-3">
                    {currency(grandTotalWage)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm py-3">
                    {currency(grandTotalBusPetrol)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm py-3">
                    {currency(grandTotalAdvance)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-base font-bold text-primary py-3">
                    {currency(grandTotalBalance)}
                  </TableCell>
                </>
              )}
            </TableRow>
          </Table>
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* 3C. TEAM-WISE PAYMENT TABLES & 3D. OTHER PAYMENTS PLACEHOLDER */}
      {/* ========================================================================= */}
      {permissions.canViewWagesAndPayments && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold flex items-center gap-2">
                  <Users className="size-4 text-primary" /> Team-Wise Weekly Wage Settlements
                </h2>
                <p className="text-xs text-muted-foreground">
                  Aggregated payments per team for group cash distribution.
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {teamPaymentGroups.map((grp) => (
                <Card key={grp.teamName} className="border shadow-2xs">
                  <CardHeader className="py-2.5 px-3.5 bg-muted/40 border-b flex flex-row items-center justify-between">
                    <CardTitle className="text-xs font-bold uppercase tracking-wide">
                      {grp.teamName}
                    </CardTitle>
                    <Badge variant="outline" className="font-mono text-xs font-bold text-primary">
                      {currency(grp.teamTotal)}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table className="text-xs">
                      <TableHeader>
                        <TableRow className="bg-muted/10">
                          <TableHead className="h-7 text-[11px]">Name</TableHead>
                          <TableHead className="h-7 text-right text-[11px]">Total (₹)</TableHead>
                          <TableHead className="h-7 text-right text-[11px]">Adv.</TableHead>
                          <TableHead className="h-7 text-right text-[11px] font-bold">Payment</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {grp.members.map((m) => (
                          <TableRow key={m.employee.id} className="h-8">
                            <TableCell className="font-medium py-1">{m.employee.full_name}</TableCell>
                            <TableCell className="text-right font-mono py-1">{m.wage + m.busPetrol}</TableCell>
                            <TableCell className="text-right font-mono py-1 text-muted-foreground">{m.advance || "—"}</TableCell>
                            <TableCell className="text-right font-mono font-bold py-1 text-primary">{m.wageBalance}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* 3D. Other Payments Placeholder (Subcontractor weekly payments - Update 6) */}
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <HardHat className="size-4 text-amber-600" /> Other Separate Payments
              </h2>
              <p className="text-xs text-muted-foreground">
                Painters, electricians and site-specific vendor vouchers for this week.
              </p>
            </div>

            <Card className="border p-4 bg-muted/20">
              <div className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b text-xs">
                  <div>
                    <p className="font-semibold">Painter Sirenjeev + Arun + Paneer</p>
                    <p className="text-[11px] text-muted-foreground">Painting Contractor Voucher</p>
                  </div>
                  <span className="font-mono font-bold">₹12,000</span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b text-xs">
                  <div>
                    <p className="font-semibold">Tamil Electrician</p>
                    <p className="text-[11px] text-muted-foreground">Electrical work settlement</p>
                  </div>
                  <span className="font-mono font-bold">₹1,475</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold">Kelamangalam Site Petty Cash</p>
                    <p className="text-[11px] text-muted-foreground">Site operational disbursement</p>
                  </div>
                  <span className="font-mono font-bold">₹2,200</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Info className="size-3.5 shrink-0" />
                <span>Linked to Subcontractor & Vendor settlements ledger (Update 6).</span>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* QUICK DAY ATTENDANCE EDIT MODAL */}
      {/* ========================================================================= */}
      <Dialog open={!!editCell} onOpenChange={(open) => !open && setEditCell(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-4 text-primary" /> Record Day Attendance
            </DialogTitle>
            <DialogDescription>
              {editCell?.employee.full_name} ({editCell?.employee.designation || "Worker"}) — {editCell ? dateFmt(formatDateISO(editCell.date)) : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">In Time (AM)</Label>
                <Input
                  value={inTimeInput}
                  onChange={(e) => handleTimesChange(e.target.value, outTimeInput, isLeaveInput)}
                  placeholder="e.g. 6 or 9"
                  className="mt-1 font-mono text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Out Time (PM)</Label>
                <Input
                  value={outTimeInput}
                  onChange={(e) => handleTimesChange(inTimeInput, e.target.value, isLeaveInput)}
                  placeholder="e.g. 6 or 2"
                  className="mt-1 font-mono text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Work Site Location</Label>
              <Select value={siteInput} onValueChange={(val) => setSiteInput(val)} disabled={isLeaveInput}>
                <SelectTrigger className="w-full text-xs">
                  <SelectValue placeholder="Select site" />
                </SelectTrigger>
                <SelectContent>
                  {(sites.data ?? [
                    { id: "1", name: "Site 637" },
                    { id: "2", name: "Site 3033" },
                    { id: "3", name: "Kelamangalam" },
                    { id: "4", name: "Kolar" },
                    { id: "5", name: "Head Office" },
                  ]).map((s) => (
                    <SelectItem key={s.id} value={s.name}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
              <div>
                <p className="text-xs font-semibold">Mark as Leave</p>
                <p className="text-[11px] text-muted-foreground">Zero day value & wage</p>
              </div>
              <Button
                type="button"
                variant={isLeaveInput ? "destructive" : "outline"}
                size="sm"
                onClick={() => handleTimesChange(inTimeInput, outTimeInput, !isLeaveInput)}
                className="h-8 text-xs"
              >
                {isLeaveInput ? "Marked as Leave" : "Mark Leave"}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 items-center rounded-lg border p-3 bg-primary/5">
              <div>
                <Label className="text-xs font-semibold">Day Value (Units)</Label>
                <p className="text-[10px] text-muted-foreground">Auto-suggested or manual override</p>
              </div>
              <Input
                type="number"
                step="0.5"
                min="0"
                max="2.5"
                value={dayValueInput}
                onChange={(e) => setDayValueInput(e.target.value)}
                className="font-mono text-base font-bold text-primary text-right"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setEditCell(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSaveDayAttendance} disabled={saveAttendance.isPending}>
                <Save className="mr-1.5 size-3.5" /> Save Attendance
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 3E. WORKER PROFILE DRAWER */}
      {/* ========================================================================= */}
      <Sheet open={!!profileWorker} onOpenChange={(open) => !open && setProfileWorker(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <User className="size-5 text-primary" /> Worker Profile & Ledger
            </SheetTitle>
            <SheetDescription>
              Complete labor profile, site deployments, and historical wage summary.
            </SheetDescription>
          </SheetHeader>

          {profileWorker && (
            <div className="mt-6 space-y-6 text-xs">
              {/* Profile Card */}
              <div className="flex items-center gap-4 rounded-lg border p-4 bg-muted/20">
                <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                  {profileWorker.full_name.charAt(0)}
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold">{profileWorker.full_name}</h3>
                  <Badge variant="secondary">{profileWorker.designation || "Helper"}</Badge>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Phone className="size-3" /> {profileWorker.phone || "No phone recorded"}
                  </p>
                </div>
              </div>

              {/* Basic Details */}
              <div className="grid grid-cols-2 gap-3 border rounded-lg p-3 bg-card">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Employee Code</span>
                  <span className="font-mono font-semibold">{profileWorker.employee_code}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Assigned Team</span>
                  <span className="font-semibold">
                    {(teams.data ?? []).find((t) => t.id === profileWorker.team_id)?.name ?? "Unassigned"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Emergency Contact</span>
                  <span>{profileWorker.emergency_contact || "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase">Address</span>
                  <span className="truncate block">{profileWorker.address || "—"}</span>
                </div>
              </div>

              {/* Financial Metrics (MD / Accountant only) */}
              {permissions.canViewWagesAndPayments && (
                <div className="space-y-3">
                  <h4 className="font-bold text-sm">Wage & Compensation</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg border p-3 bg-muted/40">
                      <p className="text-[10px] uppercase text-muted-foreground">Daily Wage Rate</p>
                      <p className="text-lg font-bold">{currency(profileWorker.wage_rate || 0)}</p>
                    </div>
                    <div className="rounded-lg border p-3 bg-primary/5">
                      <p className="text-[10px] uppercase text-muted-foreground">Current Week Balance</p>
                      <p className="text-lg font-bold text-primary">
                        {currency(workerRows.find((w) => w.employee.id === profileWorker.id)?.wageBalance ?? 0)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Reassign Team */}
              <div className="space-y-2 border-t pt-4">
                <Label className="text-xs font-semibold">Change Team Assignment</Label>
                <div className="flex gap-2">
                  <Select
                    defaultValue={profileWorker.team_id ?? "none"}
                    onValueChange={async (val) => {
                      const newTeamId = val === "none" ? null : val;
                      await saveEmployee.mutateAsync({
                        id: profileWorker.id,
                        values: { team_id: newTeamId },
                      });
                      toast.success("Team assignment updated");
                    }}
                  >
                    <SelectTrigger className="w-full text-xs">
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Team Assigned</SelectItem>
                      {(teams.data ?? []).map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
