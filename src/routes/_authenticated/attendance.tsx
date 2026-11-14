import { useQueryClient } from "@tanstack/react-query";
import { supabase as typedSupabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Calendar,
  Banknote,
  CalendarDays,
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
  Wallet,
  UserCheck,
  Trash2,
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
  DialogFooter,
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
import { RequirePermission } from "@/components/RequirePermission";
import { TeamManagementDialog } from "@/components/TeamManagementDialog";
import { useRows, useSaveRow, useDeleteRow, sum } from "@/lib/db";
import { currency, dateFmt, today } from "@/lib/format";
import { exportToExcel } from "@/lib/excel";
import { calculateSuggestedDayValue, calculateWorkerWeeklyWage } from "@/lib/wageRules";
import { PrintableWageSheet, type PrintableWorkerRow } from "@/components/PrintableWageSheet";
import { PayTeamWageDialog, type TeamWagePayTarget } from "@/components/PayTeamWageDialog";
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
  working_hours?: number | null;
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
  payment_method?: string | null;
  reference_number?: string | null;
  remarks?: string | null;
};

type LabourWagePayment = {
  id?: string;
  employee_id: string;
  week_start_date: string;
  payment_date: string;
  amount_paid: number;
  payment_method: string;
  reference_number?: string | null;
  remarks?: string | null;
  is_void?: boolean;
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
    dayName: days[d.getDay()] ?? "",
    formatted: `${d.getDate()}/${months[d.getMonth()]}`,
    iso: formatDateISO(d),
  };
}

// Helpers for Monthly View
function getMonthDates(year: number, monthIndex: number): Date[] {
  const dates: Date[] = [];
  const totalDays = new Date(year, monthIndex + 1, 0).getDate();
  for (let d = 1; d <= totalDays; d++) {
    dates.push(new Date(year, monthIndex, d));
  }
  return dates;
}

function getMonthDisplayName(year: number, monthIndex: number): string {
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${monthNames[monthIndex] ?? ""} ${year}`;
}

// Default to week of benchmark data (13.09.2026)
function getInitialWeekStart(): Date {
  const initial = new Date(2026, 8, 13); // 13 Sep 2026 (Sunday)
  return initial;
}

function AttendanceWeeklySheetPage() {
  const { isMD, permissions } = useAuth();

  // View Mode: 'weekly' or 'monthly'
  const [viewMode, setViewMode] = useState<"weekly" | "monthly">("weekly");
  // Current Month State (default to September 2026 for benchmark data)
  const [selectedMonth, setSelectedMonth] = useState<{ year: number; month: number }>({
    year: 2026,
    month: 8, // September (0-indexed)
  });
  // Selected Worker for Month day-by-day drilldown dialog
  const [drilldownWorker, setDrilldownWorker] = useState<Employee | null>(null);

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
  const [siteInput, setSiteInput] = useState("");
  const [isLeaveInput, setIsLeaveInput] = useState(false);
  const [dayValueInput, setDayValueInput] = useState("1.5");
  const [saveStatus, setSaveStatus] = useState<Record<string, "success" | "error">>({});

  // Local state for weekly adjustments (bus/petrol and advance) to support instant edits
  const [adjustmentsOverride, setAdjustmentsOverride] = useState<Record<string, { busPetrol: number; advance: number }>>({});

  // Advance Payment Method Dialog state
  const [advanceModal, setAdvanceModal] = useState<{
    employeeId: string;
    employeeName: string;
    busPetrol: number;
    advance: number;
    paymentMethod: string;
    referenceNumber: string;
  } | null>(null);

  // Pay-wage modal state: open per worker from weekly row
  const [teamWagePayTarget, setTeamWagePayTarget] = useState<TeamWagePayTarget | null>(null);
  const [wagePrintModal, setWagePrintModal] = useState<"weekly" | "monthly" | null>(null);
  const [wagePayModal, setWagePayModal] = useState<{
    employeeId: string;
    employeeName: string;
    weekStart: string;
    totalWage: number;
    totalPaid: number;
    wageBalance: number;
    paymentDate: string;
    amount: string;
    paymentMethod: string;
    referenceNumber: string;
    remarks: string;
  } | null>(null);

  // Monthly view: show week-by-week wage breakdown toggle
  const [showWeeklyBreakdown, setShowWeeklyBreakdown] = useState(false);

  // Query Data (Weekly)
  const weekStartISO = formatDateISO(weekStartDate);
  const weekDates = useMemo(() => getWeekDates(weekStartDate), [weekStartDate]);
  const weekEndISO = formatDateISO(weekDates[6] || weekStartDate);

  // Query Data (Monthly)
  const monthStartISO = useMemo(() => {
    const d = new Date(selectedMonth.year, selectedMonth.month, 1);
    return formatDateISO(d);
  }, [selectedMonth]);
  const monthEndISO = useMemo(() => {
    const d = new Date(selectedMonth.year, selectedMonth.month + 1, 0);
    return formatDateISO(d);
  }, [selectedMonth]);
  const monthDates = useMemo(() => {
    return getMonthDates(selectedMonth.year, selectedMonth.month);
  }, [selectedMonth]);

  const employees = useRows<Employee>("employees_view", {
    order: { col: "full_name", asc: true },
  });

  const teams = useRows<Team>("teams", {
    order: { col: "name", asc: true },
  });

  const teamMembers = useRows<any>("team_members", {
    order: { col: "effective_from", asc: false },
  });

  const sites = useRows<Site>("sites", {
    order: { col: "name", asc: true },
  });

  // Weekly Attendance Query
  const attendance = useRows<AttendanceRecord>("attendance_view", {
    filters: [
      { col: "attendance_date", op: "gte", value: weekStartISO },
      { col: "attendance_date", op: "lte", value: weekEndISO },
    ],
    enabled: viewMode === "weekly",
  });

  // Monthly Attendance Query
  const monthlyAttendance = useRows<AttendanceRecord>("attendance_view", {
    filters: [
      { col: "attendance_date", op: "gte", value: monthStartISO },
      { col: "attendance_date", op: "lte", value: monthEndISO },
    ],
    enabled: viewMode === "monthly",
  });

  // Weekly adjustments for weekly view
  const weeklyAdjustments = useRows<WeeklyAdjustment>("weekly_wage_adjustments", {
    filters: [{ col: "week_start_date", op: "eq", value: weekStartISO }],
    enabled: permissions.canViewWagesAndPayments && viewMode === "weekly",
  });

  // Monthly adjustments query (all weekly adjustments within the month)
  const monthlyAdjustments = useRows<WeeklyAdjustment>("weekly_wage_adjustments", {
    filters: [
      { col: "week_start_date", op: "gte", value: monthStartISO },
      { col: "week_start_date", op: "lte", value: monthEndISO },
    ],
    enabled: permissions.canViewWagesAndPayments && viewMode === "monthly",
  });

  // Subcontractor / other payments for this week (from Update 6 table)
  const subPayments = useRows<{
    id: string;
    name: string;
    work_description: string | null;
    amount: number;
    status: string;
    project_id: string | null;
  }>("subcontractor_payments", {
    select: "id,name,work_description,amount,status,project_id",
    filters: [{ col: "week_start_date", op: "eq", value: weekStartISO }],
    enabled: permissions.canViewWagesAndPayments && viewMode === "weekly",
  });

  const saveAttendance = useSaveRow("attendance", "Attendance");
  const deleteAttendance = useDeleteRow("attendance", "Attendance");
  const saveAdjustment = useSaveRow("weekly_wage_adjustments", "Weekly Adjustment");
  const saveEmployee = useSaveRow("employees", "Worker");
  const saveWagePayment = useSaveRow("labour_wage_payments", "Wage Payment");

  // Labour wage payments: cumulative paid amounts per employee per week (and cross-week carry)
  const wagePayments = useRows<LabourWagePayment>("labour_wage_payments", {
    filters: [
      { col: "is_void", op: "eq", value: "false" },
      { col: "week_start_date", op: "gte", value: weekStartISO },
    ],
    enabled: permissions.canViewWagesAndPayments,
  });

  // All-time labour wage payments for cumulative balance (all weeks up to current)
  const allWagePayments = useRows<LabourWagePayment>("labour_wage_payments", {
    filters: [{ col: "is_void", op: "eq", value: "false" }],
    enabled: permissions.canViewWagesAndPayments,
  });

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

    setEditCell({ employee: emp, date, existing: rec ?? null });
    if (rec) {
      setInTimeInput(rec.in_time ?? "6");
      setOutTimeInput(rec.out_time ?? "6");
      setSiteInput(rec.site_name ?? sites.data?.[0]?.name ?? "Site 637");
      setIsLeaveInput(Boolean(rec.is_leave));
      setDayValueInput(String(rec.day_value ?? 1.0));
    } else {
      setInTimeInput("6");
      setOutTimeInput("6");
      setSiteInput(sites.data?.[0]?.name ?? "Site 637");
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

  // Save Weekly Adjustment (Bus/Petrol or Advance with Payment Method)
  const handleSaveAdjustment = async (
    empId: string,
    busPetrol: number,
    advance: number,
    paymentMethod?: string | null,
    referenceNumber?: string | null,
    fieldKey?: string,
  ) => {
    const existing = (weeklyAdjustments.data ?? []).find(
      (adj) => adj.employee_id === empId && adj.week_start_date === weekStartISO,
    );

    setAdjustmentsOverride((prev) => ({
      ...prev,
      [empId]: { busPetrol, advance },
    }));

    try {
      await saveAdjustment.mutateAsync({
        id: existing?.id,
        values: {
          employee_id: empId,
          week_start_date: weekStartISO,
          bus_petrol: busPetrol,
          advance_paid: advance,
          payment_method: paymentMethod !== undefined ? paymentMethod : (existing?.payment_method || (advance > 0 ? "cash" : null)),
          reference_number: referenceNumber !== undefined ? referenceNumber : existing?.reference_number,
        },
      });
      if (fieldKey) {
        setSaveStatus((prev) => ({ ...prev, [fieldKey]: "success" }));
        setTimeout(() => {
          setSaveStatus((prev) => {
            const next = { ...prev };
            delete next[fieldKey];
            return next;
          });
        }, 1500);
      }
    } catch (err: any) {
      if (fieldKey) {
        setSaveStatus((prev) => ({ ...prev, [fieldKey]: "error" }));
      }
      toast.error(`Failed to save adjustment: ${err?.message || "Unknown error"}`);
    }
  };

  // Handle recording a wage payment instalment
  const handleSaveWagePayment = async () => {
    if (!wagePayModal) return;
    const amount = parseFloat(wagePayModal.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid payment amount.");
      return;
    }
    if (amount > wagePayModal.wageBalance) {
      toast.error(`Amount (${currency(amount)}) exceeds outstanding balance (${currency(wagePayModal.wageBalance)}). Please enter a lesser amount.`);
      return;
    }
    try {
      await saveWagePayment.mutateAsync({
        values: {
          employee_id: wagePayModal.employeeId,
          week_start_date: wagePayModal.weekStart,
          payment_date: wagePayModal.paymentDate,
          amount_paid: amount,
          payment_method: wagePayModal.paymentMethod,
          reference_number: wagePayModal.referenceNumber.trim() || null,
          remarks: wagePayModal.remarks.trim() || null,
        },
      });
      toast.success(`${currency(amount)} recorded as wage payment for ${wagePayModal.employeeName}.`);
      setWagePayModal(null);
    } catch (err: any) {
      toast.error(`Failed to save wage payment: ${err?.message || "Unknown error"}`);
    }
  };
  const qc = useQueryClient();
  const [markAllOpen, setMarkAllOpen] = useState(false);
  const [markAllTarget, setMarkAllTarget] = useState<"week" | string>("week"); // "week" or specific ISO date
  const [markAllOverwrite, setMarkAllOverwrite] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  // Active workers count
  const activeWorkers = useMemo(() => {
    return (employees.data ?? []).filter((e) => (e as any).active !== false);
  }, [employees.data]);

  // Target dates for Mark All Present
  const targetDatesList = useMemo(() => {
    if (markAllTarget === "week") {
      return weekDates.map((d) => formatDateISO(d));
    }
    return [markAllTarget];
  }, [markAllTarget, weekDates]);

  // Calculate how many cells will be filled
  const markAllStats = useMemo(() => {
    const attList = attendance.data ?? [];
    let toFill = 0;
    for (const emp of activeWorkers) {
      for (const iso of targetDatesList) {
        const existing = attList.find((a) => a.employee_id === emp.id && a.attendance_date === iso);
        if (markAllOverwrite || !existing || existing.day_value === 0 || existing.status === "absent") {
          toFill++;
        }
      }
    }
    return { workerCount: activeWorkers.length, totalCells: toFill };
  }, [activeWorkers, targetDatesList, attendance.data, markAllOverwrite]);

  const handleExecuteMarkAllPresent = async () => {
    if (activeWorkers.length === 0) {
      toast.error("No active workers found to mark present.");
      return;
    }

    setMarkingAll(true);
    try {
      const attList = attendance.data ?? [];
      const defaultSiteName = sites.data?.[0]?.name ?? "Site 637";
      const recordsToUpsert: any[] = [];

      for (const emp of activeWorkers) {
        const dailyWage = Math.round(1.0 * (emp.wage_rate || 0));
        for (const iso of targetDatesList) {
          const existing = attList.find((a) => a.employee_id === emp.id && a.attendance_date === iso);
          if (!markAllOverwrite && existing && existing.day_value && existing.day_value > 0) {
            continue; // Skip already marked cells unless overwrite is checked
          }

          recordsToUpsert.push({
            ...(existing?.id ? { id: existing.id } : {}),
            employee_id: emp.id,
            attendance_date: iso,
            kind: "labour",
            status: "present",
            in_time: "08:00",
            out_time: "17:00",
            site_name: existing?.site_name || defaultSiteName,
            is_leave: false,
            day_value: 1.0,
            wage_rate: emp.wage_rate || 0,
            calculated_wage: dailyWage,
            working_hours: 8,
            ot_hours: 0,
          });
        }
      }

      if (recordsToUpsert.length === 0) {
        toast.info("All target cells already have attendance recorded. Tick 'Overwrite existing' to update them.");
        setMarkAllOpen(false);
        setMarkingAll(false);
        return;
      }

      // Single batched upsert
      const supabase = typedSupabase as any;
      const { error } = await supabase.from("attendance").upsert(recordsToUpsert, {
        onConflict: "employee_id,attendance_date",
      });

      if (error) {
        // Fallback: save individually if onConflict composite unique index differs
        for (const row of recordsToUpsert) {
          if (row.id) {
            await supabase.from("attendance").update(row).eq("id", row.id);
          } else {
            await supabase.from("attendance").insert(row);
          }
        }
      }

      // Invalidate queries so grid and wage totals refresh immediately
      qc.invalidateQueries({ queryKey: ["attendance"] });
      qc.invalidateQueries({ queryKey: ["attendance_view"] });

      toast.success(`Successfully marked ${recordsToUpsert.length} attendance records as Present (1.0 Day).`);
      setMarkAllOpen(false);
    } catch (err: any) {
      toast.error(`Error marking attendance: ${err?.message || "Failed to mark all present."}`);
    } finally {
      setMarkingAll(false);
    }
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

      const paymentMethod = existingAdj?.payment_method ?? null;
      const referenceNumber = existingAdj?.reference_number ?? null;

      // Labour wage payments recorded for this week for this employee
      const weekWagePayments = (allWagePayments.data ?? []).filter(
        (p) => p.employee_id === emp.id && p.week_start_date === weekStartISO,
      );
      const totalPaidThisWeek = weekWagePayments.reduce((s, p) => s + Number(p.amount_paid), 0);

      // Cumulative: all weeks' wage balance minus all payments ever made
      // wageBalance already reflects advance; additionally subtract direct wage payments this week
      const finalBalance = Math.round(wageBalance - totalPaidThisWeek);

      // Check team membership window for this specific week (Request 3)
      const empMemberships = (teamMembers.data ?? []).filter((tm: any) => tm.employee_id === emp.id);
      const activeMembershipForWeek = empMemberships.find((tm: any) => {
        const startOk = tm.effective_from <= weekEndISO;
        const endOk = !tm.left_on || tm.left_on >= weekStartISO;
        return startOk && endOk;
      });
      const effectiveTeamId = activeMembershipForWeek ? activeMembershipForWeek.team_id : emp.team_id;
      const team = (teams.data ?? []).find((t) => t.id === effectiveTeamId)?.name ?? "Unassigned Team";

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
        paymentMethod,
        referenceNumber,
        wageBalance,
        totalPaidThisWeek,
        finalBalance,
        weekWagePayments,
      };
    });
  }, [employees.data, attendance.data, weeklyAdjustments.data, allWagePayments.data, weekDates, weekStartISO, weekEndISO, teams.data, teamMembers.data, adjustmentsOverride]);

  // Grand Totals (Weekly)
  const grandTotalDays = sum(workerRows, (r) => r.totalDays);
  const grandTotalWage = sum(workerRows, (r) => r.wage);
  const grandTotalBusPetrol = sum(workerRows, (r) => r.busPetrol);
  const grandTotalAdvance = sum(workerRows, (r) => r.advance);
  const grandTotalBalance = sum(workerRows, (r) => r.finalBalance);

  // Team-wise payment groupings (Weekly)
  const teamPaymentGroups = useMemo(() => {
    const map = new Map<string, { teamName: string; members: typeof workerRows; teamTotal: number }>();

    for (const r of workerRows) {
      const tName = r.team;
      if (!map.has(tName)) {
        map.set(tName, { teamName: tName, members: [], teamTotal: 0 });
      }
      const group = map.get(tName)!;
      group.members.push(r);
      group.teamTotal += (r as any).finalBalance !== undefined ? (r as any).finalBalance : r.wageBalance;
    }

    return [...map.values()];
  }, [workerRows]);

  // Computed Monthly Grid Rows
  const monthlyWorkerRows = useMemo(() => {
    const empList = employees.data ?? [];
    const attList = monthlyAttendance.data ?? [];
    const adjList = monthlyAdjustments.data ?? [];

    return empList.map((emp, idx) => {
      const workerRecords = attList.filter((a) => a.employee_id === emp.id);

      let daysPresent = 0;
      let halfDays = 0;
      let leaveDays = 0;
      let totalDays = 0;
      let totalHours = 0;

      for (const rec of workerRecords) {
        if (rec.is_leave) {
          leaveDays += 1;
        } else {
          // Use Day-Value from single config function / record
          const val = Number(rec.day_value ?? 0);
          totalDays += val;
          if (val === 0.5) {
            halfDays += 1;
          } else if (val > 0) {
            daysPresent += 1;
          }
          const hours = Number(rec.working_hours ?? val * 8);
          totalHours += hours;
        }
      }

      // Sum all adjustments within the month for this worker
      const workerAdjustments = adjList.filter((a) => a.employee_id === emp.id);
      const busPetrol = sum(workerAdjustments, (a) => a.bus_petrol);
      const advance = sum(workerAdjustments, (a) => a.advance_paid);

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
        daysPresent,
        halfDays,
        leaveDays,
        totalDays,
        totalHours,
        wageRate: emp.wage_rate || 0,
        wage,
        busPetrol,
        advance,
        wageBalance,
        records: workerRecords,
      };
    });
  }, [employees.data, monthlyAttendance.data, monthlyAdjustments.data, teams.data]);

  // Grand Totals (Monthly)
  const monthlyGrandTotalPresent = sum(monthlyWorkerRows, (r) => r.daysPresent);
  const monthlyGrandTotalHalfDays = sum(monthlyWorkerRows, (r) => r.halfDays);
  const monthlyGrandTotalLeaveDays = sum(monthlyWorkerRows, (r) => r.leaveDays);
  const monthlyGrandTotalDays = sum(monthlyWorkerRows, (r) => r.totalDays);
  const monthlyGrandTotalHours = sum(monthlyWorkerRows, (r) => r.totalHours);
  const monthlyGrandTotalWage = sum(monthlyWorkerRows, (r) => r.wage);
  const monthlyGrandTotalBusPetrol = sum(monthlyWorkerRows, (r) => r.busPetrol);
  const monthlyGrandTotalAdvance = sum(monthlyWorkerRows, (r) => r.advance);
  const monthlyGrandTotalBalance = sum(monthlyWorkerRows, (r) => r.wageBalance);

  // Team-wise payment groupings (Monthly)
  const monthlyTeamPaymentGroups = useMemo(() => {
    const map = new Map<string, { teamName: string; members: typeof monthlyWorkerRows; teamTotal: number }>();

    for (const r of monthlyWorkerRows) {
      const tName = r.team;
      if (!map.has(tName)) {
        map.set(tName, { teamName: tName, members: [], teamTotal: 0 });
      }
      const group = map.get(tName)!;
      group.members.push(r);
      group.teamTotal += (r as any).finalBalance !== undefined ? (r as any).finalBalance : r.wageBalance;
    }

    return [...map.values()];
  }, [monthlyWorkerRows]);

  // Weekly breakdown for monthly view: get all Sundays in the selected month that also have attendance
  const monthWeeklyBreakdown = useMemo(() => {
    const empList = employees.data ?? [];
    const attList = monthlyAttendance.data ?? [];
    const adjList = monthlyAdjustments.data ?? [];
    // Find all week start Sundays that overlap with this month
    const weeks: string[] = [];
    // Start from first Sunday on or before monthStartISO
    const monthStart = new Date(selectedMonth.year, selectedMonth.month, 1);
    const monthEnd = new Date(selectedMonth.year, selectedMonth.month + 1, 0);
    // Go back to previous Sunday from monthStart
    const firstSunday = new Date(monthStart);
    firstSunday.setDate(monthStart.getDate() - monthStart.getDay());
    let cur = new Date(firstSunday);
    while (cur <= monthEnd) {
      weeks.push(formatDateISO(cur));
      cur = new Date(cur);
      cur.setDate(cur.getDate() + 7);
    }

    return weeks.map((ws) => {
      const we_date = new Date(ws);
      we_date.setDate(we_date.getDate() + 6);
      const weISO = formatDateISO(we_date);
      const rows = empList.map((emp) => {
        // Days worked this week
        let totalDays = 0;
        for (let di = 0; di < 7; di++) {
          const d = new Date(ws);
          d.setDate(d.getDate() + di);
          const iso = formatDateISO(d);
          const rec = attList.find((a) => a.employee_id === emp.id && a.attendance_date === iso);
          if (rec && !rec.is_leave) totalDays += Number(rec.day_value ?? 0);
        }
        const adj = adjList.find((a) => a.employee_id === emp.id && a.week_start_date === ws);
        const busPetrol = Number(adj?.bus_petrol ?? 0);
        const advance = Number(adj?.advance_paid ?? 0);
        const { wage, wageBalance } = calculateWorkerWeeklyWage(totalDays, emp.wage_rate || 0, busPetrol, advance);
        return { emp, totalDays, wage, busPetrol, advance, wageBalance };
      }).filter((r) => r.totalDays > 0);
      return { weekStart: ws, weekEnd: weISO, rows, weekTotal: rows.reduce((s, r) => s + r.wageBalance, 0) };
    }).filter((w) => w.rows.length > 0);
  }, [employees.data, monthlyAttendance.data, monthlyAdjustments.data, selectedMonth]);

  // Excel Export Handler (Weekly)
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
      {
        header: "Advance Method",
        value: (r: (typeof workerRows)[0]) => (r.advance > 0 ? (r.paymentMethod || "Not recorded") : "—"),
      },
      {
        header: "Advance Reference",
        value: (r: (typeof workerRows)[0]) => (r.advance > 0 ? (r.referenceNumber || "—") : "—"),
      },
      { header: "Wage Balance", value: (r: (typeof workerRows)[0]) => r.wageBalance },
    ];

    const lastDay = weekDates[6] ?? weekStartDate;
    await exportToExcel({
      filename,
      title: `Brickweld Pvt Ltd — Attendance Register (${formatDateDisplay(weekStartDate)} to ${formatDateDisplay(lastDay)})`,
      description: "Weekly site attendance, day values and team payment calculation",
      rows: workerRows,
      columns,
    });
  };

  // Excel Export Handler (Monthly)
  const handleExportMonthlyExcel = async () => {
    const monthTitle = getMonthDisplayName(selectedMonth.year, selectedMonth.month);
    const filename = `Brickweld-Monthly-Attendance-${selectedMonth.year}-${String(selectedMonth.month + 1).padStart(2, "0")}`;
    const columns = [
      { header: "S.No", value: (r: (typeof monthlyWorkerRows)[0]) => r.sno },
      { header: "Name", value: (r: (typeof monthlyWorkerRows)[0]) => r.employee.full_name },
      { header: "Designation", value: (r: (typeof monthlyWorkerRows)[0]) => r.employee.designation ?? "—" },
      { header: "Days Present", value: (r: (typeof monthlyWorkerRows)[0]) => r.daysPresent },
      { header: "Half Days", value: (r: (typeof monthlyWorkerRows)[0]) => r.halfDays },
      { header: "Leave Days", value: (r: (typeof monthlyWorkerRows)[0]) => r.leaveDays },
      { header: "Total Days", value: (r: (typeof monthlyWorkerRows)[0]) => r.totalDays },
      { header: "Total Hours", value: (r: (typeof monthlyWorkerRows)[0]) => r.totalHours },
      ...(permissions.canViewWagesAndPayments
        ? [
            { header: "Wage / Day (₹)", value: (r: (typeof monthlyWorkerRows)[0]) => r.wageRate },
            { header: "Monthly Wage (₹)", value: (r: (typeof monthlyWorkerRows)[0]) => r.wage },
            { header: "Bus/Petrol (₹)", value: (r: (typeof monthlyWorkerRows)[0]) => r.busPetrol },
            { header: "Advance (₹)", value: (r: (typeof monthlyWorkerRows)[0]) => r.advance },
            { header: "Wage Balance (₹)", value: (r: (typeof monthlyWorkerRows)[0]) => r.wageBalance },
          ]
        : []),
    ];

    await exportToExcel({
      filename,
      title: `Brickweld Pvt Ltd — Monthly Attendance Register (${monthTitle})`,
      description: "Monthly worker days present, half days, leave, hours, wages and settlements",
      rows: monthlyWorkerRows,
      columns,
    });
  };

  return (
    <RequirePermission permission="canEnterAttendance" label="Attendance">
    <div className="space-y-6">
      {/* Title & Navigation Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">
              Brickweld Pvt Ltd &nbsp;
              <span className="text-primary font-mono">
                {viewMode === "weekly"
                  ? `${formatDateDisplay(weekStartDate)} to ${formatDateDisplay(weekDates[6] ?? weekStartDate)}`
                  : getMonthDisplayName(selectedMonth.year, selectedMonth.month)}
              </span>
            </h1>
            <Badge variant="outline" className="hidden sm:inline-flex">
              {viewMode === "weekly" ? "7-Day Weekly Sheet" : "Monthly Summary Register"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {viewMode === "weekly"
              ? "Weekly worker attendance, site allocations, day values, and team settlement ledger."
              : "Monthly attendance breakdown, day values, work hours, and cumulative team wage balances."}
          </p>
        </div>

        {/* Action Controls */}
        <div className="no-print flex flex-wrap items-center gap-2">
          {/* Weekly / Monthly Toggle */}
          <div className="flex items-center rounded-lg border bg-muted p-1">
            <Button
              variant={viewMode === "weekly" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("weekly")}
              className="h-7 text-xs font-medium"
            >
              Weekly
            </Button>
            <Button
              variant={viewMode === "monthly" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("monthly")}
              className="h-7 text-xs font-medium"
            >
              Monthly
            </Button>
          </div>

          {/* Date / Month Picker Navigation */}
          {viewMode === "weekly" ? (
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
          ) : (
            <div className="flex items-center gap-1.5 rounded-md border bg-card p-1 shadow-xs">
              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setSelectedMonth((prev) => {
                    const nextM = prev.month - 1;
                    if (nextM < 0) return { year: prev.year - 1, month: 11 };
                    return { year: prev.year, month: nextM };
                  })
                }
                className="size-8"
                title="Previous Month"
              >
                <ChevronLeft className="size-4" />
              </Button>

              <Select
                value={String(selectedMonth.month)}
                onValueChange={(val) =>
                  setSelectedMonth((prev) => ({ ...prev, month: parseInt(val, 10) }))
                }
              >
                <SelectTrigger className="h-8 w-28 text-xs font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December",
                  ].map((m, idx) => (
                    <SelectItem key={idx} value={String(idx)} className="text-xs">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={String(selectedMonth.year)}
                onValueChange={(val) =>
                  setSelectedMonth((prev) => ({ ...prev, year: parseInt(val, 10) }))
                }
              >
                <SelectTrigger className="h-8 w-20 text-xs font-medium font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027, 2028].map((y) => (
                    <SelectItem key={y} value={String(y)} className="text-xs font-mono">
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="ghost"
                size="icon"
                onClick={() =>
                  setSelectedMonth((prev) => {
                    const nextM = prev.month + 1;
                    if (nextM > 11) return { year: prev.year + 1, month: 0 };
                    return { year: prev.year, month: nextM };
                  })
                }
                className="size-8"
                title="Next Month"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}

          {/* Mark All Present (Weekly mode only, for Accounts & MD) */}
          {viewMode === "weekly" && permissions.canEnterAttendance && (
            <Button
              size="sm"
              onClick={() => {
                setMarkAllTarget("week");
                setMarkAllOverwrite(false);
                setMarkAllOpen(true);
              }}
              className="h-9 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-xs"
            >
              <UserCheck className="size-3.5" /> Mark All Present
            </Button>
          )}

          {/* Export & Print */}
          <Button
            variant="outline"
            size="sm"
            onClick={viewMode === "weekly" ? handleExportExcel : handleExportMonthlyExcel}
            className="h-9 text-xs"
          >
            <FileSpreadsheet className="mr-1.5 size-3.5 text-emerald-600" /> Export Excel
          </Button>

          {viewMode === "monthly" && (
            <Button
              variant={showWeeklyBreakdown ? "default" : "outline"}
              size="sm"
              onClick={() => setShowWeeklyBreakdown((v) => !v)}
              className="h-9 text-xs"
              title="Toggle week-by-week wage breakdown within monthly view"
            >
              <CalendarDays className="mr-1.5 size-3.5" />
              {showWeeklyBreakdown ? "Hide Weekly Wages" : "Show Weekly Wages"}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setWagePrintModal("weekly")}
            className="h-9 text-xs"
            title="Weekly Wage Print (Labour Only: excludes supervisors and officers)"
          >
            <Printer className="mr-1.5 size-3.5" /> Weekly Wage PDF (Labour Only)
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWagePrintModal("monthly")}
            className="h-9 text-xs"
            title="Monthly Wage Print (All Staff: labour, supervisors and officers)"
          >
            <Printer className="mr-1.5 size-3.5" /> Monthly Wage PDF (All Staff)
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
      {/* 3A. MAIN ATTENDANCE GRID: WEEKLY VIEW */}
      {/* ========================================================================= */}
      {viewMode === "weekly" ? (
        <>
        {/* Attendance help note for data-entry operator */}
        <div className="no-print rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-3 flex gap-2">
          <Info className="size-4 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="text-xs text-blue-800 dark:text-blue-300 space-y-0.5">
            <p><span className="font-semibold">How to enter weekly attendance:</span> Click any cell in the grid to log that worker's attendance for that day.</p>
            <p>Enter <strong>In-time</strong>, <strong>Out-time</strong>, <strong>Site</strong>, and <strong>Day value</strong> (1.0 = full day, 0.5 = half day, 0 = absent). The wage is auto-calculated.</p>
            <p>For <strong>Bus/Petrol</strong> and <strong>Advance</strong> deductions, type the amount in the column and press <kbd className="rounded border px-1 font-mono">Tab</kbd> or <kbd className="rounded border px-1 font-mono">Enter</kbd> to save.</p>
          </div>
        </div>
        <Card className="overflow-hidden border shadow-xs">
          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader className="bg-muted/60">
                <TableRow>
                  <TableHead className="w-10 text-center font-bold print:w-8 print:p-1">SNO</TableHead>
                  <TableHead className="min-w-32 font-bold print:min-w-0 print:w-32 print:p-1">NAME</TableHead>
                  <TableHead className="min-w-24 font-bold print:min-w-0 print:w-20 print:p-1">DESIGNATION</TableHead>
                  {permissions.canViewWagesAndPayments && (
                    <TableHead className="min-w-20 text-right font-bold print:min-w-0 print:w-16 print:p-1">WAGE / DAY</TableHead>
                  )}

                  {/* 7 Days of the Week Columns */}
                  {weekDates.map((d) => {
                    const h = formatDayHeader(d);
                    return (
                      <TableHead key={h.iso} className="min-w-28 text-center border-l bg-muted/40 p-2 print:min-w-0 print:w-20 print:p-1">
                        <div className="font-bold text-foreground print:text-[10px]">{h.dayName}</div>
                        <div className="text-[11px] font-mono text-muted-foreground print:text-[9px]">{h.formatted}</div>
                      </TableHead>
                    );
                  })}

                  {/* Summary End Columns */}
                  <TableHead className="min-w-16 text-center font-bold border-l bg-muted/80 print:min-w-0 print:w-14 print:p-1">TOTAL DAYS</TableHead>
                  {permissions.canViewWagesAndPayments && (
                    <>
                      <TableHead className="min-w-20 text-right font-bold bg-muted/80 print:min-w-0 print:w-16 print:p-1">WAGE (₹)</TableHead>
                      <TableHead className="min-w-24 text-right font-bold bg-muted/80 print:min-w-0 print:w-16 print:p-1">BUS / PETROL</TableHead>
                      <TableHead className="min-w-20 text-right font-bold bg-muted/80 print:min-w-0 print:w-16 print:p-1">ADVANCE</TableHead>
                      <TableHead className="min-w-24 text-right font-bold bg-muted/80 text-primary print:min-w-0 print:w-20 print:p-1">WAGE BALANCE</TableHead>
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

                          {/* Bus / Petrol (Editable inline on screen, formatted text on print) */}
                          <TableCell className="text-right bg-muted/20 p-1">
                            <span className="hidden print:inline font-mono">
                              {r.busPetrol ? r.busPetrol : "0"}
                            </span>
                            {(() => {
                              const key = `${r.employee.id}_bus`;
                              const status = saveStatus[key];
                              return (
                                <div className="relative inline-flex items-center ml-auto">
                                  <Input
                                    type="number"
                                    defaultValue={r.busPetrol || ""}
                                    placeholder="0"
                                    onFocus={(e) => e.target.select()}
                                    onBlur={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      if (val !== r.busPetrol) {
                                        void handleSaveAdjustment(r.employee.id, val, r.advance, undefined, undefined, key);
                                      }
                                    }}
                                    className={`no-print h-7 w-20 text-right text-xs font-mono transition-all duration-300 ${
                                      status === "success"
                                        ? "border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/30"
                                        : status === "error"
                                        ? "border-destructive ring-2 ring-destructive/30 bg-destructive/10"
                                        : ""
                                    }`}
                                  />
                                </div>
                              );
                            })()}
                          </TableCell>

                          {/* Advance (Editable inline on screen, formatted text on print, with Payment Method trigger) */}
                          <TableCell className="text-right bg-muted/20 p-1">
                            <span className="hidden print:inline font-mono">
                              {r.advance ? r.advance : "0"}
                            </span>
                            <div className="no-print flex items-center justify-end gap-1">
                              {(() => {
                                const key = `${r.employee.id}_adv`;
                                const status = saveStatus[key];
                                return (
                                  <Input
                                    type="number"
                                    defaultValue={r.advance || ""}
                                    placeholder="0"
                                    onFocus={(e) => e.target.select()}
                                    onBlur={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      if (val !== r.advance) {
                                        void handleSaveAdjustment(r.employee.id, r.busPetrol, val, undefined, undefined, key);
                                      }
                                    }}
                                    className={`h-7 w-20 text-right text-xs font-mono transition-all duration-300 ${
                                      status === "success"
                                        ? "border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/30"
                                        : status === "error"
                                        ? "border-destructive ring-2 ring-destructive/30 bg-destructive/10"
                                        : ""
                                    }`}
                                  />
                                );
                              })()}
                              {r.advance > 0 && (
                                <button
                                  type="button"
                                  title={`Payment Method: ${r.paymentMethod || "Not recorded"}${r.referenceNumber ? ` (${r.referenceNumber})` : ""}. Click to edit.`}
                                  onClick={() =>
                                    setAdvanceModal({
                                      employeeId: r.employee.id,
                                      employeeName: r.employee.full_name,
                                      busPetrol: r.busPetrol,
                                      advance: r.advance,
                                      paymentMethod: r.paymentMethod || "cash",
                                      referenceNumber: r.referenceNumber || "",
                                    })
                                  }
                                  className="text-[10px] px-1 py-0.5 rounded border border-muted-foreground/30 bg-background text-muted-foreground hover:bg-muted font-sans uppercase shrink-0"
                                >
                                  {r.paymentMethod ? r.paymentMethod.slice(0, 3) : "—"}
                                </button>
                              )}
                            </div>
                          </TableCell>

                          {/* Wage Balance */}
                          <TableCell
                            className={`text-right font-mono font-bold bg-muted/30 ${
                              r.wageBalance > 0
                                ? "text-destructive"
                                : "text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
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
        </>
      ) : (
        /* ========================================================================= */
        /* 3B. MAIN ATTENDANCE GRID: MONTHLY VIEW */
        /* ========================================================================= */
        <Card className="overflow-hidden border shadow-xs">
          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader className="bg-muted/60">
                <TableRow>
                  <TableHead className="w-10 text-center font-bold print:w-8 print:p-1">SNO</TableHead>
                  <TableHead className="min-w-32 font-bold print:min-w-0 print:w-32 print:p-1">WORKER NAME</TableHead>
                  <TableHead className="min-w-24 font-bold print:min-w-0 print:w-20 print:p-1">DESIGNATION</TableHead>
                  <TableHead className="min-w-20 text-center font-bold print:min-w-0 print:w-16 print:p-1">DAYS PRESENT</TableHead>
                  <TableHead className="min-w-16 text-center font-bold print:min-w-0 print:w-14 print:p-1">HALF DAYS</TableHead>
                  <TableHead className="min-w-16 text-center font-bold print:min-w-0 print:w-14 print:p-1">LEAVE DAYS</TableHead>
                  <TableHead className="min-w-20 text-center font-bold bg-muted/80 border-l print:min-w-0 print:w-16 print:p-1">TOTAL DAYS</TableHead>
                  <TableHead className="min-w-20 text-center font-bold bg-muted/80 print:min-w-0 print:w-16 print:p-1">TOTAL HOURS</TableHead>
                  {permissions.canViewWagesAndPayments && (
                    <>
                      <TableHead className="min-w-20 text-right font-bold print:min-w-0 print:w-16 print:p-1">WAGE / DAY</TableHead>
                      <TableHead className="min-w-24 text-right font-bold bg-muted/80 print:min-w-0 print:w-20 print:p-1">MONTHLY WAGE</TableHead>
                      <TableHead className="min-w-20 text-right font-bold bg-muted/80 print:min-w-0 print:w-16 print:p-1">BUS / PETROL</TableHead>
                      <TableHead className="min-w-20 text-right font-bold bg-muted/80 print:min-w-0 print:w-16 print:p-1">ADVANCE</TableHead>
                      <TableHead className="min-w-24 text-right font-bold bg-muted/80 text-primary print:min-w-0 print:w-20 print:p-1">WAGE BALANCE</TableHead>
                    </>
                  )}
                  <TableHead className="no-print text-center w-20 font-bold">ACTION</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {monthlyWorkerRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={permissions.canViewWagesAndPayments ? 14 : 9} className="py-12 text-center text-muted-foreground">
                      No active workers found in database.
                    </TableCell>
                  </TableRow>
                ) : (
                  monthlyWorkerRows.map((r) => (
                    <TableRow key={r.employee.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="text-center font-mono text-muted-foreground">{r.sno}</TableCell>
                      
                      {/* Worker Name with Drilldown click */}
                      <TableCell className="font-medium">
                        <button
                          type="button"
                          onClick={() => setDrilldownWorker(r.employee)}
                          className="text-left font-semibold text-primary hover:underline cursor-pointer flex items-center gap-1.5"
                          title="Click to view full day-by-day attendance for this month"
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

                      {/* Days Present */}
                      <TableCell className="text-center font-mono font-semibold">
                        {r.daysPresent}
                      </TableCell>

                      {/* Half Days */}
                      <TableCell className="text-center font-mono text-muted-foreground">
                        {r.halfDays || "—"}
                      </TableCell>

                      {/* Leave Days */}
                      <TableCell className="text-center font-mono text-muted-foreground">
                        {r.leaveDays || "—"}
                      </TableCell>

                      {/* Total Days */}
                      <TableCell className="border-l text-center font-bold font-mono text-sm bg-muted/20">
                        {r.totalDays.toFixed(1)}
                      </TableCell>

                      {/* Total Hours */}
                      <TableCell className="text-center font-mono font-medium bg-muted/20">
                        {r.totalHours.toFixed(0)} hrs
                      </TableCell>

                      {/* Wage Columns (MD / Accounts Only) */}
                      {permissions.canViewWagesAndPayments && (
                        <>
                          <TableCell className="text-right font-mono font-medium">
                            {currency(r.wageRate).replace("₹", "")}
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold bg-muted/20">
                            {currency(r.wage).replace("₹", "")}
                          </TableCell>
                          <TableCell className="text-right font-mono bg-muted/20">
                            {r.busPetrol ? currency(r.busPetrol).replace("₹", "") : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono bg-muted/20 text-muted-foreground">
                            {r.advance ? currency(r.advance).replace("₹", "") : "—"}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-primary bg-muted/30">
                            {currency(r.wageBalance).replace("₹", "")}
                          </TableCell>
                        </>
                      )}

                      {/* Drilldown button */}
                      <TableCell className="no-print text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDrilldownWorker(r.employee)}
                          className="h-7 px-2 text-xs text-primary"
                        >
                          View Days
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>

              {/* Monthly Grand Totals Bottom Row */}
              <TableRow className="border-t-2 bg-muted font-bold text-xs">
                <TableCell colSpan={3} className="text-right uppercase tracking-wider py-3">
                  Monthly Grand Totals:
                </TableCell>
                <TableCell className="text-center font-mono text-sm py-3">
                  {monthlyGrandTotalPresent}
                </TableCell>
                <TableCell className="text-center font-mono text-sm py-3">
                  {monthlyGrandTotalHalfDays}
                </TableCell>
                <TableCell className="text-center font-mono text-sm py-3">
                  {monthlyGrandTotalLeaveDays}
                </TableCell>
                <TableCell className="text-center font-mono text-sm py-3 border-l font-bold">
                  {monthlyGrandTotalDays.toFixed(1)}
                </TableCell>
                <TableCell className="text-center font-mono text-sm py-3 font-bold">
                  {monthlyGrandTotalHours.toFixed(0)} hrs
                </TableCell>
                {permissions.canViewWagesAndPayments && (
                  <>
                    <TableCell className="text-right font-mono text-sm py-3">—</TableCell>
                    <TableCell className="text-right font-mono text-sm py-3">
                      {currency(monthlyGrandTotalWage)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm py-3">
                      {currency(monthlyGrandTotalBusPetrol)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm py-3">
                      {currency(monthlyGrandTotalAdvance)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-base font-bold text-primary py-3">
                      {currency(monthlyGrandTotalBalance)}
                    </TableCell>
                  </>
                )}
                <TableCell className="no-print" />
              </TableRow>
            </Table>
          </div>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* 3C. TEAM-WISE PAYMENT TABLES & 3D. OTHER PAYMENTS PLACEHOLDER */}
      {/* ========================================================================= */}
      {permissions.canViewWagesAndPayments && (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold flex items-center gap-2">
                  <Users className="size-4 text-primary" /> Team-Wise {viewMode === "weekly" ? "Weekly" : "Monthly"} Wage Settlements
                </h2>
                <p className="text-xs text-muted-foreground">
                  Aggregated payments per team for group cash distribution ({viewMode === "weekly" ? "Current Week" : getMonthDisplayName(selectedMonth.year, selectedMonth.month)}).
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {(viewMode === "weekly" ? teamPaymentGroups : monthlyTeamPaymentGroups).map((grp) => (
                <Card key={grp.teamName} className="border shadow-2xs">
                  <CardHeader className="py-2.5 px-3.5 bg-muted/40 border-b flex flex-row items-center justify-between">
                    <CardTitle className="text-xs font-bold uppercase tracking-wide">
                      {grp.teamName}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs font-bold text-primary">
                        {currency(grp.teamTotal)}
                      </Badge>
                      {permissions.canViewWagesAndPayments && (
                        <Button
                          size="sm"
                          variant="default"
                          className="h-6 text-[11px] px-2 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-none"
                          onClick={() => {
                            const teamObj = (teams.data ?? []).find((t) => t.name === grp.teamName);
                            const tId = teamObj?.id || (grp.members[0] as any)?.employee?.team_id || "";
                            setTeamWagePayTarget({
                              teamId: tId,
                              teamName: grp.teamName,
                              weekStart: weekStartISO,
                              membersCount: grp.members.length,
                              totalWageDue: grp.teamTotal,
                              alreadyPaid: 0,
                              pendingAmount: grp.teamTotal,
                            });
                          }}
                        >
                          <Banknote className="size-3" /> Pay Team
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table className="text-xs">
                      <TableHeader>
                        <TableRow className="bg-muted/10">
                          <TableHead className="h-7 text-[11px]">Name</TableHead>
                          <TableHead className="h-7 text-right text-[11px]">Total Days</TableHead>
                          <TableHead className="h-7 text-right text-[11px]">Total (₹)</TableHead>
                          <TableHead className="h-7 text-right text-[11px] font-bold">Payment</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {grp.members.map((m) => (
                          <TableRow key={m.employee.id} className="h-8">
                            <TableCell className="font-medium py-1">{m.employee.full_name}</TableCell>
                            <TableCell className="text-right font-mono py-1">{m.totalDays.toFixed(1)}</TableCell>
                            <TableCell className="text-right font-mono py-1">{m.wage + m.busPetrol}</TableCell>
                            <TableCell
                              className={`text-right font-mono font-bold py-1 ${
                                m.wageBalance > 0
                                  ? "text-destructive"
                                  : "text-emerald-600 dark:text-emerald-400"
                              }`}
                            >
                              {m.wageBalance}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* 3D. Other Payments — live from subcontractor_payments (Update 6) */}
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <HardHat className="size-4 text-amber-600" /> Other Separate Payments
              </h2>
              <p className="text-xs text-muted-foreground">
                Painters, electricians and site-specific vendor vouchers for this week.
                Manage via <span className="font-medium">Contractors → Other Payments</span>.
              </p>
            </div>

            <Card className="border p-4">
              {subPayments.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (subPayments.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No other payments recorded for this week. Add them in Contractors → Other Payments.
                </p>
              ) : (
                <div className="space-y-2">
                  {(subPayments.data ?? []).map((sp, idx) => (
                    <div
                      key={sp.id}
                      className={`flex items-center justify-between text-xs ${
                        idx < (subPayments.data ?? []).length - 1 ? "pb-2 border-b" : ""
                      }`}
                    >
                      <div>
                        <p className="font-semibold">{sp.name}</p>
                        {sp.work_description && (
                          <p className="text-[11px] text-muted-foreground">{sp.work_description}</p>
                        )}
                        <span
                          className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium mt-0.5 ${
                            sp.status === "job_done"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {sp.status === "job_done" ? "Job done" : "Pending"}
                        </span>
                      </div>
                      <span className="font-mono font-bold">
                        ₹{Number(sp.amount).toLocaleString("en-IN")}
                      </span>
                    </div>
                  ))}
                  <div className="mt-3 pt-2 border-t flex items-center justify-between text-xs font-semibold">
                    <span>Total other payments</span>
                    <span className="font-mono">
                      ₹{(subPayments.data ?? [])
                        .reduce((s, p) => s + Number(p.amount), 0)
                        .toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* QUICK DAY ATTENDANCE EDIT MODAL */}
      {/* ========================================================================= */}
      <Dialog open={!!editCell} onOpenChange={(open) => !open && setEditCell(null)}>
        <DialogContent className="w-full max-h-[90vh] overflow-y-auto sm:max-w-md">
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

            <div className="flex items-center justify-between pt-2">
              {editCell?.existing?.id ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 text-xs gap-1 h-8 px-2"
                  disabled={deleteAttendance.isPending}
                  onClick={async () => {
                    if (!editCell?.existing?.id) return;
                    try {
                      await deleteAttendance.mutateAsync({
                        id: editCell.existing.id,
                        reason: `Deleted attendance for ${editCell.employee.full_name} on ${formatDateISO(editCell.date)}`,
                      });
                      toast.success(`Attendance entry removed for ${editCell.employee.full_name}`);
                      setEditCell(null);
                    } catch (err: any) {
                      toast.error(err?.message || "Failed to delete attendance");
                    }
                  }}
                >
                  <Trash2 className="size-3.5" /> Delete Entry
                </Button>
              ) : <div />}
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditCell(null)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveDayAttendance} disabled={saveAttendance.isPending}>
                  <Save className="mr-1.5 size-3.5" /> Save Attendance
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* ADVANCE PAYMENT METHOD & REFERENCE MODAL */}
      {/* ========================================================================= */}
      <Dialog open={!!advanceModal} onOpenChange={(open) => !open && setAdvanceModal(null)}>
        <DialogContent className="w-full max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="size-4 text-primary" /> Advance Payment Details
            </DialogTitle>
            <DialogDescription>
              {advanceModal?.employeeName} — Week starting {dateFmt(weekStartISO)}
            </DialogDescription>
          </DialogHeader>

          {advanceModal && (
            <div className="space-y-4 pt-2">
              <div className="rounded-lg border p-3 bg-muted/20">
                <p className="text-xs text-muted-foreground uppercase">Advance Amount</p>
                <p className="font-mono text-lg font-bold text-primary">₹{advanceModal.advance.toLocaleString("en-IN")}</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Payment Method</Label>
                <Select
                  value={advanceModal.paymentMethod}
                  onValueChange={(val) => setAdvanceModal((prev) => prev ? { ...prev, paymentMethod: val } : null)}
                >
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI / Online</SelectItem>
                    <SelectItem value="bank">Bank Transfer</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(advanceModal.paymentMethod === "upi" ||
                advanceModal.paymentMethod === "bank" ||
                advanceModal.paymentMethod === "cheque" ||
                advanceModal.paymentMethod === "other") && (
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Reference Number {advanceModal.paymentMethod === "cheque" ? "(Cheque #)" : "(Transaction ID / UTR)"}
                  </Label>
                  <Input
                    value={advanceModal.referenceNumber}
                    onChange={(e) =>
                      setAdvanceModal((prev) => (prev ? { ...prev, referenceNumber: e.target.value } : null))
                    }
                    placeholder={advanceModal.paymentMethod === "cheque" ? "e.g. CHQ-448102" : "e.g. UTR-99281923"}
                    className="font-mono text-xs"
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setAdvanceModal(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={async () => {
                    await handleSaveAdjustment(
                      advanceModal.employeeId,
                      advanceModal.busPetrol,
                      advanceModal.advance,
                      advanceModal.paymentMethod,
                      advanceModal.referenceNumber.trim() || null,
                    );
                    setAdvanceModal(null);
                  }}
                  disabled={saveAdjustment.isPending}
                >
                  Save Details
                </Button>
              </div>
            </div>
          )}
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

      {/* ========================================================================= */}
      {/* 3F. MONTHLY WORKER DAY-BY-DAY DRILLDOWN DIALOG */}
      {/* ========================================================================= */}
      <Dialog open={!!drilldownWorker} onOpenChange={(open) => !open && setDrilldownWorker(null)}>
        <DialogContent className="w-full max-w-3xl max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="size-5 text-primary" /> {drilldownWorker?.full_name} — Daily Breakdown
            </DialogTitle>
            <DialogDescription>
              Day-by-day attendance log for {getMonthDisplayName(selectedMonth.year, selectedMonth.month)} ({drilldownWorker?.designation || "Worker"}).
            </DialogDescription>
          </DialogHeader>

          {drilldownWorker && (
            <div className="mt-3 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="rounded-lg border bg-muted/40 p-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase font-medium">Days Present</p>
                  <p className="text-base font-bold">
                    {monthlyWorkerRows.find((w) => w.employee.id === drilldownWorker.id)?.daysPresent ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/40 p-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase font-medium">Half Days</p>
                  <p className="text-base font-bold">
                    {monthlyWorkerRows.find((w) => w.employee.id === drilldownWorker.id)?.halfDays ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/40 p-2.5">
                  <p className="text-[10px] text-muted-foreground uppercase font-medium">Total Days</p>
                  <p className="text-base font-bold text-primary font-mono">
                    {(monthlyWorkerRows.find((w) => w.employee.id === drilldownWorker.id)?.totalDays ?? 0).toFixed(1)}
                  </p>
                </div>
                {permissions.canViewWagesAndPayments && (
                  <div className="rounded-lg border bg-primary/5 p-2.5">
                    <p className="text-[10px] text-muted-foreground uppercase font-medium">Month Balance</p>
                    <p className="text-base font-bold text-primary font-mono">
                      {currency(monthlyWorkerRows.find((w) => w.employee.id === drilldownWorker.id)?.wageBalance ?? 0)}
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-md border overflow-x-auto max-h-[50vh] overflow-y-auto">
                <Table className="text-xs">
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-12 text-center font-bold">DATE</TableHead>
                      <TableHead className="w-20 font-bold">DAY</TableHead>
                      <TableHead className="font-bold">STATUS</TableHead>
                      <TableHead className="font-bold">IN TIME</TableHead>
                      <TableHead className="font-bold">OUT TIME</TableHead>
                      <TableHead className="font-bold">SITE LOCATION</TableHead>
                      <TableHead className="text-center font-bold">DAY VALUE</TableHead>
                      {permissions.canViewWagesAndPayments && (
                        <TableHead className="text-right font-bold">CALCULATED WAGE</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthDates.map((d) => {
                      const iso = formatDateISO(d);
                      const rec = (monthlyAttendance.data ?? []).find(
                        (a) => a.employee_id === drilldownWorker.id && a.attendance_date === iso,
                      );
                      const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];

                      return (
                        <TableRow key={iso} className={rec ? "hover:bg-muted/30" : "text-muted-foreground/60"}>
                          <TableCell className="text-center font-mono font-medium">{d.getDate()}</TableCell>
                          <TableCell className="font-medium text-xs">{dayName}</TableCell>
                          <TableCell>
                            {rec ? (
                              rec.is_leave ? (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                  Leave
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {Number(rec.day_value ?? 0) === 0 ? "Absent" : "Present"}
                                </Badge>
                              )
                            ) : (
                              <span className="text-[11px]">—</span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono">{rec?.in_time ? `${rec.in_time} AM` : "—"}</TableCell>
                          <TableCell className="font-mono">{rec?.out_time ? `${rec.out_time} PM` : "—"}</TableCell>
                          <TableCell className="text-xs">{rec?.site_name || "—"}</TableCell>
                          <TableCell className="text-center font-bold font-mono">
                            {rec ? (
                              rec.is_leave ? (
                                <span className="text-destructive">0.0</span>
                              ) : (
                                <span className="text-primary">{Number(rec.day_value ?? 0).toFixed(1)}</span>
                              )
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          {permissions.canViewWagesAndPayments && (
                            <TableCell className="text-right font-mono font-semibold">
                              {rec && !rec.is_leave
                                ? currency(rec.calculated_wage ?? Math.round(Number(rec.day_value ?? 0) * (drilldownWorker.wage_rate || 0)))
                                : "—"}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Mark All Present Confirmation Dialog */}
      <Dialog open={markAllOpen} onOpenChange={setMarkAllOpen}>
        <DialogContent className="max-w-md sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
              <UserCheck className="size-5 text-emerald-600" /> Mark All Workers Present
            </DialogTitle>
            <DialogDescription className="text-xs">
              Batch-fill daily attendance (1.0 Day Value, 08:00 to 17:00, 8 hours) for active workers.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div>
              <Label className="text-xs mb-1 block font-semibold">Select Target Period</Label>
              <Select value={markAllTarget} onValueChange={(v) => setMarkAllTarget(v as any)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Choose period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Full 7-Day Week ({formatDateDisplay(weekStartDate)} to {formatDateDisplay(weekDates[6] ?? weekStartDate)})</SelectItem>
                  {weekDates.map((d) => {
                    const iso = formatDateISO(d);
                    return (
                      <SelectItem key={iso} value={iso}>
                        Single Day: {formatDateDisplay(d)} ({d.toLocaleDateString("en-US", { weekday: "long" })})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
              <div className="flex justify-between font-medium">
                <span className="text-muted-foreground">Active Workers:</span>
                <span className="font-bold font-mono">{markAllStats.workerCount} workers</span>
              </div>
              <div className="flex justify-between font-medium">
                <span className="text-muted-foreground">Target Period:</span>
                <span className="font-bold">{markAllTarget === "week" ? "7 Days" : "1 Day"}</span>
              </div>
              <div className="flex justify-between font-medium text-emerald-700 dark:text-emerald-400 border-t pt-1.5 mt-1.5">
                <span>Cells to be filled / updated:</span>
                <span className="font-bold font-mono">{markAllStats.totalCells} attendance entries</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/20 p-3">
              <Checkbox
                id="overwrite-check"
                checked={markAllOverwrite}
                onCheckedChange={(c) => setMarkAllOverwrite(Boolean(c))}
                className="mt-0.5"
              />
              <div className="space-y-0.5">
                <Label htmlFor="overwrite-check" className="text-xs font-semibold cursor-pointer text-amber-900 dark:text-amber-200">
                  Overwrite existing attendance values
                </Label>
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Default is unchecked (skips workers who already have a day value recorded).
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setMarkAllOpen(false)} disabled={markingAll}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleExecuteMarkAllPresent}
              disabled={markingAll || markAllStats.totalCells === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              {markingAll ? "Filling Attendance..." : `Confirm & Fill (${markAllStats.totalCells} Entries)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </RequirePermission>
  );
}
