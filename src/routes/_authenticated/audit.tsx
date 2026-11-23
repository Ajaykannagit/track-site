import { RequirePermission } from "@/components/RequirePermission";
import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Shield, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { useRows } from "@/lib/db";
import { supabase as typedSupabase } from "@/integrations/supabase/client";
import { today } from "@/lib/format";
import { toast } from "sonner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = typedSupabase as any;

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({
    meta: [{ title: "Audit Log — Brickweld Pvt Ltd" }],
  }),
  component: AuditPage,
});

type AuditLog = {
  id: string;
  performed_at: string;
  performed_by: string | null;
  user_role: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  module: string | null;
  details: Record<string, unknown> | null;
};

// Human-readable table names
const TABLE_LABELS: Record<string, string> = {
  expenses: "Expenses",
  supplier_payments: "Supplier Payments",
  contractor_payments: "Contractor Payments",
  subcontractor_payments: "Subcontractor Payments",
  contractor_bills: "Contractor Bills",
  attendance: "Attendance",
  weekly_wage_adj: "Wage Adjustments",
  weekly_wage_adjustments: "Wage Adjustments",
  labour_wage_payments: "Labour Wage Payments",
  wage_payments: "Team Wage Payments",
  cash_closing: "Cash Closings",
  purchase_orders: "Purchase Orders",
  material_receipts: "Material Receipts",
  material_requests: "Material Indents",
  client_payments: "Client Payments",
  account_transfers: "Account Transfers",
  group_payments: "Group Payments",
  md_investments: "MD Investments & Drawings",
  work_orders: "Work Orders",
  measurement_books: "Measurement Books",
  project_quotations: "Project Quotations",
  payment_milestones: "Payment Milestones",
  projects: "Projects",
  employees: "Employees / Workers",
  contractors: "Contractors",
  suppliers: "Suppliers",
  clients: "Clients",
  machines: "Machines",
  job_types: "Job Types",
};

function getActionBadgeStyle(action: string): string {
  const norm = (action || "").toLowerCase();
  if (norm === "created" || norm === "insert") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300";
  if (norm === "updated" || norm === "update") return "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300";
  if (norm === "corrected") return "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300";
  if (norm === "deleted" || norm === "soft_delete" || norm === "delete") return "bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/50 dark:text-amber-300";
  if (norm === "restored" || norm === "restore") return "bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300";
  return "bg-muted text-muted-foreground";
}

function ActionBadge({ action }: { action: string }) {
  const cls = getActionBadgeStyle(action);
  const label = (action || "").replace(/_/g, " ");
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${cls}`}>
      {label}
    </span>
  );
}

// Expandable JSON details
function DetailsRow({ details }: { details: Record<string, unknown> | null }) {
  const [open, setOpen] = useState(false);
  if (!details || Object.keys(details).length === 0) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-xs text-primary hover:underline"
      >
        {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
        {open ? "Hide details" : "Show details"}
      </button>
      {open && (
        <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-2 text-[10px] leading-relaxed">
          {JSON.stringify(details, null, 2)}
        </pre>
      )}
    </div>
  );
}

function AuditPage() {
  const { permissions } = useAuth();

  // Redirect non-authorized users immediately
  if (!permissions.canViewAuditLog) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Shield className="size-12 text-destructive opacity-50" />
        <p className="text-lg font-semibold text-muted-foreground">Access restricted to MD and Accounts only.</p>
      </div>
    );
  }

  return <AuditPageInner />;
}

function AuditPageInner() {
  // Filters
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(today());
  const [tableFilter, setTableFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("");

  const logs = useRows<AuditLog>("audit_logs", {
    order: { col: "performed_at", asc: false },
    limit: 2000,
    filters: [
      { col: "performed_at", op: "gte", value: fromDate ? fromDate + "T00:00:00" : undefined },
      { col: "performed_at", op: "lte", value: toDate ? toDate + "T23:59:59" : undefined },
    ],
  });

  const filteredLogs = useMemo(() => {
    let list = logs.data ?? [];
    // Date range is applied server-side via useRows filters above
    if (tableFilter !== "all") list = list.filter((l) => l.table_name === tableFilter);
    if (actionFilter !== "all") list = list.filter((l) => l.action === actionFilter);
    if (userFilter.trim()) {
      const q = userFilter.trim().toLowerCase();
      list = list.filter(
        (l) =>
          l.performed_by?.toLowerCase().includes(q) ||
          l.user_role?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [logs.data, fromDate, toDate, tableFilter, actionFilter, userFilter]);

  const allTables = useMemo(() => {
    const seen = new Set<string>();
    (logs.data ?? []).forEach((l) => seen.add(l.table_name));
    return Array.from(seen).sort();
  }, [logs.data]);

  const allActions = useMemo(() => {
    const seen = new Set<string>();
    (logs.data ?? []).forEach((l) => seen.add(l.action));
    return Array.from(seen).sort();
  }, [logs.data]);

  // Deleted items — query each soft-delete table for rows where deleted_at IS NOT NULL
  const SOFT_DELETE_TABLES = [
    "expenses",
    "supplier_payments",
    "contractor_payments",
    "subcontractor_payments",
    "contractor_bills",
    "attendance",
    "weekly_wage_adj",
    "cash_closing",
    "purchase_orders",
    "material_receipts",
    "client_payments",
  ] as const;

  const qc = useQueryClient();
  const [restoringAll, setRestoringAll] = useState(false);

  // We use an aggregated query approach: fetch from audit_logs where action is 'deleted' / 'soft_delete'
  // and cross-reference with later 'restored' / 'restore' entries to find currently-deleted records
  const deletedLogs = useMemo(() => {
    const allLogs = logs.data ?? [];
    const deletedMap = new Map<string, AuditLog>(); // key: table_name::record_id
    const restoredMap = new Map<string, string>(); // key: table_name::record_id -> latest restore timestamp

    for (const log of allLogs) {
      if (!log.record_id) continue;
      const key = `${log.table_name}::${log.record_id}`;
      const act = (log.action || "").toLowerCase();
      if (act === "deleted" || act === "soft_delete" || act === "delete") {
        if (!deletedMap.has(key) || log.performed_at > deletedMap.get(key)!.performed_at) {
          deletedMap.set(key, log);
        }
      } else if (act === "restored" || act === "restore") {
        if (!restoredMap.has(key) || log.performed_at > restoredMap.get(key)!) {
          restoredMap.set(key, log.performed_at);
        }
      }
    }

    // Return only those whose latest delete is newer than any restore
    return Array.from(deletedMap.values()).filter((log) => {
      const key = `${log.table_name}::${log.record_id}`;
      const restoredAt = restoredMap.get(key);
      return !restoredAt || log.performed_at > restoredAt;
    });
  }, [logs.data]);

  const handleRestoreAll = async () => {
    if (deletedLogs.length === 0) return;
    setRestoringAll(true);
    try {
      const payload = deletedLogs
        .filter((l) => l.record_id)
        .map((l) => ({ table_name: l.table_name, record_id: l.record_id }));
      const { data, error } = await supabase.rpc("restore_records", { p_items: payload });
      if (error) throw error;
      await Promise.all([
        logs.refetch(),
        qc.invalidateQueries({ queryKey: ["attendance"] }),
        qc.invalidateQueries({ queryKey: ["attendance_view"] }),
        qc.invalidateQueries({ queryKey: ["account_balances"] }),
        qc.invalidateQueries({ queryKey: ["projects"] }),
        qc.invalidateQueries({ queryKey: ["projects_view"] }),
        qc.invalidateQueries({ queryKey: ["notifications"] }),
      ]);
      toast.success(`Restored ${data ?? payload.length} deleted record(s). MD has been notified.`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to restore all records";
      toast.error(msg);
    } finally {
      setRestoringAll(false);
    }
  };

  return (
    <RequirePermission permission="canViewAuditLog" label="Audit Log">
    <div>
      <PageHeader
        title="Audit Log"
        description="Complete record of all data changes, deletions, and restorations. MD & Accounts view."
      />

      <Tabs defaultValue="log">
        <TabsList className="no-print mb-4">
          <TabsTrigger value="log">Activity log</TabsTrigger>
          <TabsTrigger value="deleted">
            Deleted items
            {deletedLogs.length > 0 && (
              <span className="ml-1.5 rounded-full bg-destructive/10 px-1.5 text-[10px] font-semibold text-destructive">
                {deletedLogs.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ===== ACTIVITY LOG TAB ===== */}
        <TabsContent value="log" className="space-y-4">
          {/* Filter bar */}
          <div className="rounded-lg border bg-card p-3 flex flex-wrap items-end gap-3">
            <div>
              <Label className="mb-1 block text-xs font-medium">From</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-8 text-xs w-36"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium">To</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-8 text-xs w-36"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium">Table</Label>
              <Select value={tableFilter} onValueChange={setTableFilter}>
                <SelectTrigger className="h-8 text-xs w-44">
                  <SelectValue placeholder="All tables" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tables</SelectItem>
                  {allTables.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TABLE_LABELS[t] ?? t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium">Action</Label>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="h-8 text-xs w-36">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  {allActions.map((a) => (
                    <SelectItem key={a} value={a} className="capitalize">
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs font-medium">User (ID or role)</Label>
              <Input
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                placeholder="Search user…"
                className="h-8 text-xs w-44"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() - 30);
                setFromDate(d.toISOString().slice(0, 10));
                setToDate(today());
                setTableFilter("all");
                setActionFilter("all");
                setUserFilter("");
              }}
            >
              <RotateCcw className="mr-1 size-3.5" /> Reset
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            Showing {filteredLogs.length} of {(logs.data ?? []).length} entries
          </div>

          {logs.isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading audit log…</p>
          ) : filteredLogs.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No audit log entries match your filters.</p>
          ) : (
            <div className="rounded-lg border bg-card overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="p-2.5 text-left font-semibold">When</th>
                    <th className="p-2.5 text-left font-semibold">User</th>
                    <th className="p-2.5 text-left font-semibold">Role</th>
                    <th className="p-2.5 text-left font-semibold">Action</th>
                    <th className="p-2.5 text-left font-semibold">Table</th>
                    <th className="p-2.5 text-left font-semibold">Field</th>
                    <th className="p-2.5 text-left font-semibold">Old value</th>
                    <th className="p-2.5 text-left font-semibold">New value</th>
                    <th className="p-2.5 text-left font-semibold">Reason</th>
                    <th className="p-2.5 text-left font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/30">
                      <td className="p-2.5 whitespace-nowrap font-mono text-[11px]">
                        {new Date(log.performed_at).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="p-2.5 font-mono text-[10px] text-muted-foreground max-w-[120px] truncate">
                        {log.performed_by ? log.performed_by.slice(0, 12) + "…" : "—"}
                      </td>
                      <td className="p-2.5 capitalize">{log.user_role ?? "—"}</td>
                      <td className="p-2.5">
                        <ActionBadge action={log.action} />
                      </td>
                      <td className="p-2.5">{TABLE_LABELS[log.table_name] ?? log.table_name}</td>
                      <td className="p-2.5 font-mono text-[10px]">{log.field_name ?? "—"}</td>
                      <td className="p-2.5 max-w-[120px] truncate text-muted-foreground">{log.old_value ?? "—"}</td>
                      <td className="p-2.5 max-w-[120px] truncate">{log.new_value ?? "—"}</td>
                      <td className="p-2.5 text-muted-foreground italic">{log.reason ?? "—"}</td>
                      <td className="p-2.5">
                        <DetailsRow details={log.details as Record<string, unknown> | null} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ===== DELETED ITEMS TAB ===== */}
        <TabsContent value="deleted" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200 border border-amber-500/20">
            <span>
              These records have been soft-deleted and are hidden from normal screens. MD and Accountant can restore individual items or restore all at once (the MD is automatically notified of every restoration).
            </span>
            {deletedLogs.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-emerald-600/40 bg-emerald-50/80 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 shrink-0"
                disabled={restoringAll}
                onClick={handleRestoreAll}
              >
                <RotateCcw className="mr-1.5 size-3.5" />
                {restoringAll ? "Restoring All…" : `Restore All (${deletedLogs.length})`}
              </Button>
            )}
          </div>

          {logs.isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading deleted items…</p>
          ) : deletedLogs.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No deleted items found.</p>
          ) : (
            <div className="rounded-lg border bg-card overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b bg-muted/50">
                  <tr>
                    <th className="p-2.5 text-left font-semibold">Table</th>
                    <th className="p-2.5 text-left font-semibold">Record / Title</th>
                    <th className="p-2.5 text-left font-semibold">Deleted at</th>
                    <th className="p-2.5 text-left font-semibold">Deleted by</th>
                    <th className="p-2.5 text-left font-semibold">Reason</th>
                    <th className="p-2.5 text-right font-semibold w-28">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {deletedLogs.map((log) => (
                    <DeletedItemRow
                      key={log.id}
                      log={log}
                      onRestored={async () => {
                        await Promise.all([
                          logs.refetch(),
                          qc.invalidateQueries({ queryKey: [log.table_name] }),
                          qc.invalidateQueries({ queryKey: [`${log.table_name}_view`] }),
                          qc.invalidateQueries({ queryKey: ["account_balances"] }),
                          qc.invalidateQueries({ queryKey: ["notifications"] }),
                        ]);
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
    </RequirePermission>
  );
}

function DeletedItemRow({ log, onRestored }: { log: AuditLog; onRestored: () => void | Promise<void> }) {
  const { isMD, canWriteFinance } = useAuth();
  const canRestore = isMD || canWriteFinance;
  const [restoring, setRestoring] = useState(false);

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const { error } = await supabase.rpc("restore_record", {
        p_table_name: log.table_name,
        p_record_id: log.record_id,
      });
      if (error) throw error;
      await onRestored();
      toast.success(`Record restored from ${TABLE_LABELS[log.table_name] ?? log.table_name}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to restore record";
      toast.error(msg);
    } finally {
      setRestoring(false);
    }
  };

  const recordTitle =
    (log.details as Record<string, unknown> | null)?.record_title as string | undefined;

  return (
    <tr className="hover:bg-muted/30">
      <td className="p-2.5 font-medium">{TABLE_LABELS[log.table_name] ?? log.table_name}</td>
      <td className="p-2.5">
        {recordTitle && <span className="font-semibold block text-foreground">{recordTitle}</span>}
        <span className="font-mono text-[10px] text-muted-foreground">
          {log.record_id ? log.record_id.slice(0, 16) + "…" : "—"}
        </span>
      </td>
      <td className="p-2.5 whitespace-nowrap">
        {new Date(log.performed_at).toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </td>
      <td className="p-2.5 font-mono text-[10px] text-muted-foreground">
        {((log.details as Record<string, unknown> | null)?.performer_email as string | undefined) ??
          (log.performed_by ? log.performed_by.slice(0, 12) + "…" : "—")}
      </td>
      <td className="p-2.5 text-muted-foreground italic">{log.reason ?? "—"}</td>
      <td className="p-2.5 text-right">
        {canRestore ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-emerald-500/40 text-emerald-700 hover:bg-emerald-50"
            disabled={restoring || !log.record_id}
            onClick={handleRestore}
          >
            <RotateCcw className="mr-1 size-3" />
            {restoring ? "Restoring…" : "Restore"}
          </Button>
        ) : (
          <span className="text-[10px] text-muted-foreground">Restricted</span>
        )}
      </td>
    </tr>
  );
}
