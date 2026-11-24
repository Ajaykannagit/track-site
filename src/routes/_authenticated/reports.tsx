import { RequirePermission } from "@/components/RequirePermission";
import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { DataTable, StatCard, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Party360Dialog, type Party360Type } from "@/components/Party360Dialog";
import { useAccountBalances, useRows, sum } from "@/lib/db";
import { currency, dateFmt, monthStart, today } from "@/lib/format";
import { Printer, RotateCcw, Building2, Users, Truck, Landmark, FileText } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({
    meta: [
      { title: "Reports & P&L —  Brickweld Pvt Ltd" },
      {
        name: "description",
        content:
          "Project-wise profit and loss: contract value against labour, material, contractor and other site costs.",
      },
      { property: "og:title", content: "Reports & P&L —  Brickweld Pvt Ltd" },
      {
        property: "og:description",
        content: "Company and project level profitability across a chosen date range.",
      },
    ],
  }),
  component: ReportsPage,
});

type Project = {
  id: string;
  name: string;
  project_code: string;
  status: string;
  quotation_amount: number;
  site_address: string | null;
  start_date: string | null;
  expected_completion_date: string | null;
};
type Dated = { id: string; project_id: string | null };
type Expense = Dated & {
  expense_date: string;
  category: string;
  amount: number;
  payment_method?: string | null;
  description?: string | null;
  is_void?: boolean;
  deleted_at?: string | null;
};
type Attendance = Dated & { attendance_date: string; calculated_wage: number };
type Receipt = Dated & { receipt_date: string; total_amount: number; receipt_number: string };
type Bill = Dated & { bill_date: string; net_amount: number; status: string; bill_number: string };

type Row = {
  id: string;
  code: string;
  name: string;
  status: string;
  value: number;
  labour: number;
  material: number;
  contractor: number;
  other: number;
  cost: number;
  profit: number;
  margin: number;
};

function ReportsPage() {
  const { permissions } = useAuth();
  const [from, setFrom] = useState(monthStart(-5));
  const [to, setTo] = useState(today());
  const [billStatus, setBillStatus] = useState<string>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");

  const projects = useRows<Project>("projects_view", { 
    order: { col: "name", asc: true },
    enabled: permissions.canViewProfitAndLoss,
  });
  const expenses = useRows<Expense>("expenses", {
    filters: [
      { col: "expense_date", op: "gte", value: from },
      { col: "expense_date", op: "lte", value: to },
    ],
    enabled: permissions.canViewProfitAndLoss,
  });
  const attendance = useRows<Attendance>("attendance_view", {
    filters: [
      { col: "attendance_date", op: "gte", value: from },
      { col: "attendance_date", op: "lte", value: to },
    ],
    enabled: permissions.canViewProfitAndLoss,
  });
  const receipts = useRows<Receipt>("material_receipts_view", {
    filters: [
      { col: "receipt_date", op: "gte", value: from },
      { col: "receipt_date", op: "lte", value: to },
    ],
    enabled: permissions.canViewProfitAndLoss,
  });
  const bills = useRows<Bill>("contractor_bills", {
    filters: [
      { col: "bill_date", op: "gte", value: from },
      { col: "bill_date", op: "lte", value: to },
      ...(billStatus !== "all" ? [{ col: "status", op: "eq" as const, value: billStatus }] : []),
    ],
    enabled: permissions.canViewProfitAndLoss,
  });
  const quotations = useRows<{ project_id: string; amount: number; status: string }>("project_quotations", {
    order: { col: "created_at" },
    enabled: permissions.canViewProfitAndLoss,
  });

  const settings = useRows<{ key: string; value: unknown; description: string | null }>(
    "app_settings",
    {
      order: { col: "key", asc: true },
    },
  );

  // Zoho Books Reports Center Queries & Party 360° Drill-down State
  const [party360Target, setParty360Target] = useState<{
    type: Party360Type;
    id: string;
  } | null>(null);

  const { data: liveBalances } = useAccountBalances();
  const clients = useRows<any>("clients", {
    order: { col: "name", asc: true },
    enabled: permissions.canViewProfitAndLoss,
  });
  const suppliers = useRows<any>("suppliers", {
    order: { col: "name", asc: true },
    enabled: permissions.canViewProfitAndLoss,
  });
  const contractors = useRows<any>("contractors", {
    order: { col: "name", asc: true },
    enabled: permissions.canViewProfitAndLoss,
  });
  const clientPayments = useRows<any>("client_payments", {
    enabled: permissions.canViewProfitAndLoss,
  });
  const pos = useRows<any>("purchase_orders", {
    enabled: permissions.canViewProfitAndLoss,
  });
  const supplierPayments = useRows<any>("supplier_payments", {
    enabled: permissions.canViewProfitAndLoss,
  });
  const contractorPayments = useRows<any>("contractor_payments", {
    enabled: permissions.canViewProfitAndLoss,
  });
  const mdInvestments = useRows<any>("md_investments", {
    enabled: permissions.canViewProfitAndLoss,
  });

  // Tab 2: Customer (Buyer) Balance Summary (Zoho Receivables Report)
  const customerBalanceRows = useMemo(() => {
    return (clients.data ?? [])
      .filter((c: any) => !c.deleted_at)
      .map((c: any) => {
        const cProjects = (projects.data ?? []).filter((p: any) => p.client_id === c.id);
        const pIds = new Set(cProjects.map((p: any) => p.id));
        const baseVal = sum(cProjects, (p: any) => Number(p.quotation_amount || 0));
        const extraVal = sum(
          (quotations.data ?? []).filter(
            (q: any) =>
              pIds.has(q.project_id) && q.status === "approved" && !q.is_void && !q.deleted_at
          ),
          (q: any) => Number(q.amount || 0)
        );
        const invoiced = Number(c.opening_balance || 0) + baseVal + extraVal;
        const cReceipts = (clientPayments.data ?? []).filter(
          (cp: any) =>
            (cp.client_id === c.id || pIds.has(cp.project_id)) &&
            !cp.is_void &&
            !cp.deleted_at
        );
        const cashReceived = sum(cReceipts, (cp: any) =>
          cp.payment_category === "reversal"
            ? -Number(cp.amount || 0)
            : Number(cp.amount || 0)
        );
        const tdsWithheld = sum(cReceipts, (cp: any) => Number(cp.tds_amount || 0));
        const net = invoiced - (cashReceived + tdsWithheld);
        return {
          id: c.id,
          name: c.name,
          projects: cProjects.map((p: any) => p.name).join(", ") || "—",
          invoiced,
          cashReceived,
          tdsWithheld,
          unusedAdvance: net < 0 ? Math.abs(net) : 0,
          receivableDue: net > 0 ? net : 0,
          closingBalance: net,
        };
      });
  }, [clients.data, projects.data, quotations.data, clientPayments.data]);

  // Tab 3: Vendor (Supplier & Contractor) Balance Summary (Zoho Payables Report)
  const vendorBalanceRows = useMemo(() => {
    const supRows = (suppliers.data ?? [])
      .filter((s: any) => !s.deleted_at)
      .map((s: any) => {
        const sPos = (pos.data ?? []).filter(
          (p: any) => p.supplier_id === s.id && !p.is_void && !p.deleted_at
        );
        const sGrns = (receipts.data ?? []).filter(
          (g: any) => g.supplier_id === s.id && !g.deleted_at && !g.po_id
        );
        const sPays = (supplierPayments.data ?? []).filter(
          (p: any) => p.supplier_id === s.id && !p.is_void && !p.deleted_at
        );
        const billed =
          Number(s.opening_balance || 0) +
          sum(sPos, (p: any) => Number(p.total_amount || 0)) +
          sum(sGrns, (g: any) => Number(g.total_amount || 0));
        const paid = sum(sPays, (p: any) => Number(p.amount || 0));
        const net = billed - paid;
        const unapplied = sum(
          sPays.filter((p: any) => !p.po_id),
          (p: any) => Number(p.amount || 0)
        );
        return {
          id: s.id,
          partyType: "supplier" as const,
          roleLabel: "Material Supplier",
          name: s.name,
          codeOrGstin: s.gst_number || "—",
          billed,
          paid,
          unusedAdvance: net < 0 ? Math.abs(net) : unapplied,
          payableOwed: net > 0 ? net : 0,
          closingBalance: net,
        };
      });

    const conRows = (contractors.data ?? [])
      .filter((c: any) => !c.deleted_at)
      .map((c: any) => {
        const cBills = (bills.data ?? []).filter(
          (b: any) =>
            b.contractor_id === c.id &&
            b.status !== "rejected" &&
            !b.is_void &&
            !b.deleted_at
        );
        const cPays = (contractorPayments.data ?? []).filter(
          (p: any) => p.contractor_id === c.id && !p.is_void && !p.deleted_at
        );
        const billed =
          Number(c.opening_balance || 0) +
          sum(cBills, (b: any) => Number(b.net_amount || 0));
        const paid = sum(cPays, (p: any) => Number(p.amount || 0));
        const net = billed - paid;
        const unapplied = sum(
          cPays.filter((p: any) => !p.bill_id),
          (p: any) => Number(p.amount || 0)
        );
        return {
          id: c.id,
          partyType: "contractor" as const,
          roleLabel: "Work Contractor",
          name: c.name,
          codeOrGstin: c.contractor_code || c.gst_number || "—",
          billed,
          paid,
          unusedAdvance: net < 0 ? Math.abs(net) : unapplied,
          payableOwed: net > 0 ? net : 0,
          closingBalance: net,
        };
      });

    return [...supRows, ...conRows].sort((a, b) => b.payableOwed - a.payableOwed);
  }, [
    suppliers.data,
    contractors.data,
    pos.data,
    receipts.data,
    supplierPayments.data,
    bills.data,
    contractorPayments.data,
  ]);

  // Tab 4: Purchases & POs by Supplier (Zoho Purchases by Vendor Report)
  const purchasesBySupplierRows = useMemo(() => {
    return (suppliers.data ?? [])
      .filter((s: any) => !s.deleted_at)
      .map((s: any) => {
        const sPos = (pos.data ?? []).filter(
          (p: any) => p.supplier_id === s.id && !p.is_void && !p.deleted_at
        );
        const sGrns = (receipts.data ?? []).filter(
          (r: any) => r.supplier_id === s.id && !r.deleted_at
        );
        const sPays = (supplierPayments.data ?? []).filter(
          (p: any) => p.supplier_id === s.id && !p.is_void && !p.deleted_at
        );
        return {
          id: s.id,
          name: s.name,
          poCount: sPos.length,
          poTotal: sum(sPos, (p: any) => Number(p.total_amount || 0)),
          grnCount: sGrns.length,
          grnTotal: sum(sGrns, (r: any) => Number(r.total_amount || 0)),
          paidTotal: sum(sPays, (p: any) => Number(p.amount || 0)),
        };
      })
      .filter((r) => r.poCount > 0 || r.grnCount > 0 || r.paidTotal > 0);
  }, [suppliers.data, pos.data, receipts.data, supplierPayments.data]);

  const loading =
    projects.isLoading ||
    expenses.isLoading ||
    attendance.isLoading ||
    receipts.isLoading ||
    bills.isLoading;

  const rows: Row[] = useMemo(() => {
    const byProject = <T extends Dated>(list: T[] | undefined, id: string) =>
      (list ?? []).filter((r) => r.project_id === id && !(r as any).is_void && !(r as any).deleted_at);

    return (projects.data ?? []).map((p) => {
      const labour = sum(byProject(attendance.data, p.id), (a) => a.calculated_wage);
      const material = sum(byProject(receipts.data, p.id), (r) => r.total_amount);
      const contractor = sum(byProject(bills.data, p.id), (b) => b.net_amount);
      const other = sum(byProject(expenses.data, p.id), (e) => e.amount);
      const cost = labour + material + contractor + other;
      const baseValue = Number(p.quotation_amount ?? 0);
      const additions = sum(
        (quotations.data ?? []).filter((q) => q.project_id === p.id && q.status === "approved" && !(q as any).deleted_at && !(q as any).is_void),
        (q) => Number(q.amount || 0)
      );
      const value = baseValue + additions;
      const profit = value - cost;
      return {
        id: p.id,
        code: p.project_code,
        name: p.name,
        status: p.status,
        value,
        labour,
        material,
        contractor,
        other,
        cost,
        profit,
        margin: value ? (profit / value) * 100 : 0,
      };
    });
  }, [projects.data, attendance.data, receipts.data, bills.data, expenses.data, quotations.data]);

  const selectedProjectObj = useMemo(() => {
    if (selectedProjectId === "all") return null;
    return (projects.data ?? []).find((p) => p.id === selectedProjectId) ?? null;
  }, [projects.data, selectedProjectId]);

  const selectedProjectRow = useMemo(() => {
    if (selectedProjectId === "all") return null;
    return rows.find((r) => r.id === selectedProjectId) ?? null;
  }, [rows, selectedProjectId]);

  const totalValue = selectedProjectRow ? selectedProjectRow.value : sum(rows, (r) => r.value);
  const totalCost = selectedProjectRow ? selectedProjectRow.cost : sum(rows, (r) => r.cost);
  const totalProfit = selectedProjectRow ? selectedProjectRow.profit : totalValue - totalCost;

  const unallocated =
    sum(
      (expenses.data ?? []).filter((e) => !e.project_id && !(e as any).is_void && !(e as any).deleted_at),
      (e) => e.amount,
    ) +
    sum(
      (attendance.data ?? []).filter((a) => !a.project_id),
      (a) => a.calculated_wage,
    );

  const byCategory = useMemo(() => {
    const list = selectedProjectId === "all"
      ? (expenses.data ?? []).filter((e) => !(e as any).is_void && !(e as any).deleted_at)
      : (expenses.data ?? []).filter((e) => e.project_id === selectedProjectId && !(e as any).is_void && !(e as any).deleted_at);

    const map = new Map<string, number>();
    for (const e of list) {
      map.set(e.category, (map.get(e.category) ?? 0) + Number(e.amount ?? 0));
    }
    return [...map.entries()]
      .map(([category, amount], i) => ({ id: `${i}-${category}`, category, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses.data, selectedProjectId]);

  const byPaymentMethod = useMemo(() => {
    const list = selectedProjectId === "all"
      ? (expenses.data ?? []).filter((e) => !(e as any).is_void && !(e as any).deleted_at)
      : (expenses.data ?? []).filter((e) => e.project_id === selectedProjectId && !(e as any).is_void && !(e as any).deleted_at);

    const map = new Map<string, number>();
    for (const e of list) {
      const method = e.payment_method ? e.payment_method.toUpperCase() : "Not recorded";
      map.set(method, (map.get(method) ?? 0) + Number(e.amount ?? 0));
    }
    return [...map.entries()]
      .map(([method, amount], i) => ({ id: `${i}-${method}`, method, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses.data, selectedProjectId]);

  const handlePrint = (projectId?: string) => {
    if (projectId && projectId !== selectedProjectId) {
      setSelectedProjectId(projectId);
      setTimeout(() => {
        window.print();
      }, 200);
    } else {
      window.print();
    }
  };

  const columns: Column<Row>[] = [
    {
      header: "Project",
      cell: (r) => (
        <Link
          to="/projects/$projectId"
          params={{ projectId: r.id }}
          className="font-medium text-primary hover:underline"
        >
          {r.name}
        </Link>
      ),
      value: (r) => r.name,
    },
    { header: "Code", cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.code}</span>, value: (r) => r.code },
    { header: "Status", cell: (r) => <StatusBadge status={r.status} />, value: (r) => r.status },
    {
      header: "Contract value",
      cell: (r) => <span className="tabular-nums font-medium">{currency(r.value)}</span>,
      value: (r) => r.value,
      className: "text-right",
    },
    {
      header: "Labour",
      cell: (r) => <span className="tabular-nums text-muted-foreground">{currency(r.labour)}</span>,
      value: (r) => r.labour,
      className: "text-right",
    },
    {
      header: "Materials",
      cell: (r) => <span className="tabular-nums text-muted-foreground">{currency(r.material)}</span>,
      value: (r) => r.material,
      className: "text-right",
    },
    {
      header: "Contractors",
      cell: (r) => <span className="tabular-nums text-muted-foreground">{currency(r.contractor)}</span>,
      value: (r) => r.contractor,
      className: "text-right",
    },
    {
      header: "Other",
      cell: (r) => <span className="tabular-nums text-muted-foreground">{currency(r.other)}</span>,
      value: (r) => r.other,
      className: "text-right",
    },
    {
      header: "Total cost",
      cell: (r) => <span className="tabular-nums font-semibold">{currency(r.cost)}</span>,
      value: (r) => r.cost,
      className: "text-right",
    },
    {
      header: "Profit",
      cell: (r) => (
        <span
          className={`tabular-nums font-semibold ${r.profit >= 0 ? "text-success" : "text-destructive"}`}
        >
          {currency(r.profit)}
        </span>
      ),
      value: (r) => r.profit,
      className: "text-right",
    },
    {
      header: "Margin",
      cell: (r) => {
        const badgeClass =
          r.margin >= 15
            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
            : r.margin >= 0
              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800"
              : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border-rose-200 dark:border-rose-800";
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold tabular-nums border ${badgeClass}`}>
            {r.margin.toFixed(1)}%
          </span>
        );
      },
      value: (r) => r.margin.toFixed(1),
      className: "text-right",
    },
    {
      header: "Print",
      className: "text-center no-print w-20",
      cell: (r: Row) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-primary hover:bg-primary/10"
          title={`Print P&L for ${r.name}`}
          onClick={() => handlePrint(r.id)}
        >
          <Printer className="mr-1 size-3.5" /> Print
        </Button>
      ),
    },
  ];

  return (
    <RequirePermission permission="canViewProfitAndLoss" label="Reports & P&L">
    <div>
      <PageHeader
        title={
          selectedProjectObj
            ? `P&L Report —  ${selectedProjectObj.name} (${selectedProjectObj.project_code})`
            : "Reports & P&L"
        }
        description={
          selectedProjectObj
            ? `Single-project statement: contract quotation against recorded labour, materials, bills & expenses.`
            : "Project-wise and company level profit & loss report across chosen date range."
        }
        actions={
          <div className="flex items-center gap-2">
            {selectedProjectId !== "all" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedProjectId("all")}
                className="text-xs"
              >
                <RotateCcw className="mr-1 size-3" /> View All Projects
              </Button>
            )}
            <Button variant="outline" onClick={() => handlePrint()}>
              <Printer className="mr-1.5 size-4" />
              {selectedProjectId === "all" ? "Print Complete P&L" : `Print ${selectedProjectObj?.project_code} P&L`}
            </Button>
          </div>
        }
      />

      {/* Filter Card */}
      <Card className="no-print mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="w-56">
            <Label htmlFor="project-select">Report Scope / Project</Label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger id="project-select" className="mt-1">
                <SelectValue placeholder="All Projects (Complete Report)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects (Complete Report)</SelectItem>
                {(projects.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} ({p.project_code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="from">From</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="to">To</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1" />
          </div>
          <div className="w-52">
            <Label htmlFor="bill-status">Contractor bill status</Label>
            <Select value={billStatus} onValueChange={setBillStatus}>
              <SelectTrigger id="bill-status" className="mt-1">
                <SelectValue placeholder="All bill statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="md_approved">MD approved</SelectItem>
                <SelectItem value="payment_approved">Payment approved</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="w-full text-xs text-muted-foreground mt-1">
            Costs are counted by document date inside this range. Contract value is the full project quotation.
          </p>
        </CardContent>
      </Card>

      {/* Printable Header (Visible during Print) */}
      <div className="hidden print:block mb-6 border-b pb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold font-display">BRICKWELD PRIVATE LIMITED</h1>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Civil - Interior - Fabrication</p>
            <h2 className="text-lg font-semibold mt-2">
              {selectedProjectObj
                ? `Project Profit & Loss (P&L) Statement: ${selectedProjectObj.name} (${selectedProjectObj.project_code})`
                : "Company Project-wise Profit & Loss (P&L) Statement"}
            </h2>
          </div>
          <div className="text-right text-xs">
            <p><strong>Period:</strong> {dateFmt(from)} to {dateFmt(to)}</p>
            <p><strong>Generated on:</strong> {dateFmt(today())}</p>
            {selectedProjectObj?.site_address && <p><strong>Site:</strong> {selectedProjectObj.site_address}</p>}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={selectedProjectObj ? `${selectedProjectObj.project_code} Contract value` : "Contract value"}
          value={currency(totalValue)}
        />
        <StatCard
          label={selectedProjectObj ? `${selectedProjectObj.project_code} Total cost` : "Total cost"}
          value={currency(totalCost)}
          tone="warning"
        />
        <StatCard
          label="Net Profit"
          value={currency(totalProfit)}
          tone={totalProfit >= 0 ? "success" : "destructive"}
          hint={
            totalValue
              ? `${((totalProfit / totalValue) * 100).toFixed(1)}% profit margin`
              : "No contract value"
          }
        />
        {selectedProjectId === "all" ? (
          <StatCard
            label="Unallocated cost"
            value={currency(unallocated)}
            hint="Expenses and wages with no project"
          />
        ) : (
          <StatCard
            label="Project Status"
            value={selectedProjectObj?.status?.toUpperCase() ?? "ACTIVE"}
            hint={selectedProjectObj?.site_address || "Site project"}
            tone="default"
          />
        )}
      </div>

      {/* SINGLE PROJECT DETAILED BREAKDOWN (When a single project is selected) */}
      {selectedProjectObj && selectedProjectRow && (
        <Card className="mt-4 border-primary/30">
          <CardHeader className="bg-muted/40">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="size-4 text-primary" />
                  Detailed Cost Breakdown —  {selectedProjectObj.name} ({selectedProjectObj.project_code})
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  Site: {selectedProjectObj.site_address ?? "Not specified"} | Status: {selectedProjectObj.status.toUpperCase()}
                </p>
              </div>
              <Button size="sm" variant="outline" className="no-print" onClick={() => window.print()}>
                <Printer className="mr-1.5 size-3.5" /> Print Single Project P&L
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border">
                <thead className="bg-muted/60 text-xs">
                  <tr>
                    <th className="p-2.5 text-left border">Financial Head / Cost Category</th>
                    <th className="p-2.5 text-right border">Amount (₹)</th>
                    <th className="p-2.5 text-right border">% of Contract Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="p-2.5 font-bold border">1. Total Contract / Quotation Value</td>
                    <td className="p-2.5 text-right font-bold border font-mono">{currency(selectedProjectRow.value)}</td>
                    <td className="p-2.5 text-right border font-mono">100.0%</td>
                  </tr>
                  <tr className="bg-muted/10">
                    <td className="p-2.5 pl-6 border">Labour & Wages Cost</td>
                    <td className="p-2.5 text-right border font-mono">{currency(selectedProjectRow.labour)}</td>
                    <td className="p-2.5 text-right border font-mono text-xs text-muted-foreground">
                      {selectedProjectRow.value ? `${((selectedProjectRow.labour / selectedProjectRow.value) * 100).toFixed(1)}%` : "— "}
                    </td>
                  </tr>
                  <tr className="bg-muted/10">
                    <td className="p-2.5 pl-6 border">Material Goods Received Cost</td>
                    <td className="p-2.5 text-right border font-mono">{currency(selectedProjectRow.material)}</td>
                    <td className="p-2.5 text-right border font-mono text-xs text-muted-foreground">
                      {selectedProjectRow.value ? `${((selectedProjectRow.material / selectedProjectRow.value) * 100).toFixed(1)}%` : "— "}
                    </td>
                  </tr>
                  <tr className="bg-muted/10">
                    <td className="p-2.5 pl-6 border">Contractor Works Net Billed</td>
                    <td className="p-2.5 text-right border font-mono">{currency(selectedProjectRow.contractor)}</td>
                    <td className="p-2.5 text-right border font-mono text-xs text-muted-foreground">
                      {selectedProjectRow.value ? `${((selectedProjectRow.contractor / selectedProjectRow.value) * 100).toFixed(1)}%` : "— "}
                    </td>
                  </tr>
                  <tr className="bg-muted/10">
                    <td className="p-2.5 pl-6 border">Other Site & Fuel Expenses</td>
                    <td className="p-2.5 text-right border font-mono">{currency(selectedProjectRow.other)}</td>
                    <td className="p-2.5 text-right border font-mono text-xs text-muted-foreground">
                      {selectedProjectRow.value ? `${((selectedProjectRow.other / selectedProjectRow.value) * 100).toFixed(1)}%` : "— "}
                    </td>
                  </tr>
                  <tr className="bg-warning/10 font-semibold">
                    <td className="p-2.5 font-bold border">2. Total Project Cost Incurred</td>
                    <td className="p-2.5 text-right font-bold text-warning-foreground border font-mono">
                      {currency(selectedProjectRow.cost)}
                    </td>
                    <td className="p-2.5 text-right border font-mono">
                      {selectedProjectRow.value ? `${((selectedProjectRow.cost / selectedProjectRow.value) * 100).toFixed(1)}%` : "— "}
                    </td>
                  </tr>
                  <tr className={selectedProjectRow.profit >= 0 ? "bg-emerald-500/10 font-bold" : "bg-destructive/10 font-bold"}>
                    <td className="p-2.5 font-bold border text-base">3. Net Profit / (Loss)</td>
                    <td className={`p-2.5 text-right font-bold border font-mono text-base ${selectedProjectRow.profit >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}`}>
                      {currency(selectedProjectRow.profit)}
                    </td>
                    <td className="p-2.5 text-right border font-mono font-bold text-base">
                      {selectedProjectRow.margin.toFixed(1)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ALL PROJECTS P&L TABLE (or filtered single project row) */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">
            {selectedProjectId === "all" ? "All Projects P&L Table" : `Project Summary: ${selectedProjectObj?.name}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            rows={selectedProjectId === "all" ? rows : rows.filter((r) => r.id === selectedProjectId)}
            loading={loading}
            exportName="brickweld-project-pnl"
            exportTitle={selectedProjectObj ? `P&L Report: ${selectedProjectObj.name}` : "Project Profit & Loss (P&L) Report"}
            exportDescription="Construction Project Control System —  Project-wise Profit & Loss Report"
            appliedFilters={{
              "Scope": selectedProjectObj ? selectedProjectObj.name : "All Projects",
              "Date Range": `${from} to ${to}`,
              ...(billStatus !== "all"
                ? { "Contractor Bill Status": billStatus.replace(/_/g, " ") }
                : {}),
            }}
            columns={columns}
            empty="No projects found."
          />
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedProjectObj ? `Expenses for ${selectedProjectObj.project_code} by Category` : "Expenses by category"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              rows={byCategory}
              loading={expenses.isLoading}
              searchable={false}
              exportName="brickweld-expenses-by-category"
              exportTitle="Expenses by Category Report"
              exportDescription="Construction Project Control System —  Expenses by Category"
              appliedFilters={{ "Date Range": `${from} to ${to}` }}
              empty="No expenses recorded in this range."
              columns={[
                { header: "Category", cell: (r) => r.category, value: (r) => r.category },
                {
                  header: "Amount",
                  cell: (r) => currency(r.amount),
                  value: (r) => r.amount,
                  className: "text-right font-mono",
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {selectedProjectObj ? `Expenses by Payment Method` : "Expenses by payment method"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              rows={byPaymentMethod}
              loading={expenses.isLoading}
              searchable={false}
              exportName="brickweld-expenses-by-payment-method"
              exportTitle="Expenses by Payment Method Report"
              exportDescription="Construction Project Control System —  Expenses by Payment Method"
              appliedFilters={{ "Date Range": `${from} to ${to}` }}
              empty="No expenses recorded in this range."
              columns={[
                { header: "Payment Method", cell: (r) => r.method, value: (r) => r.method },
                {
                  header: "Amount",
                  cell: (r) => currency(r.amount),
                  value: (r) => r.amount,
                  className: "text-right font-mono",
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuration used</CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              rows={(settings.data ?? []).map((s) => ({ id: s.key, ...s }))}
              loading={settings.isLoading}
              searchable={false}
              empty="No configuration entries."
              columns={[
                { header: "Key", cell: (r) => r.key, value: (r) => r.key },
                {
                  header: "Value",
                  cell: (r) => JSON.stringify(r.value),
                  value: (r) => JSON.stringify(r.value),
                },
                {
                  header: "Description",
                  cell: (r) => r.description ?? "— ",
                  value: (r) => r.description,
                },
              ]}
            />
          </CardContent>
        </Card>
      </div>

      {/* Official Signatures for Printed P&L Statements */}
      <div className="hidden print:block print-signature-block pt-8 border-t border-zinc-300 text-xs text-center mt-8">
        <div className="grid grid-cols-2 gap-16 max-w-2xl mx-auto">
          <div>
            <div className="border-b border-zinc-400 pb-8"></div>
            <p className="mt-2 font-semibold text-zinc-800">Prepared by (Accounts / Finance)</p>
          </div>
          <div>
            <div className="border-b border-zinc-400 pb-8"></div>
            <p className="mt-2 font-semibold text-zinc-800">Approved by (Managing Director)</p>
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Report generated {dateFmt(today())}. Figures come strictly from recorded attendance wages,
        material receipts, contractor bills and expenses —  no estimated or projected values are
        added.
      </p>

      {/* ========================================================================= */}
      {/* ZOHO BOOKS FINANCIAL REPORTS CENTER (Customer & Vendor Balances, Purchases, Cash Flow & Balance Sheet) */}
      {/* ========================================================================= */}
      <div className="mt-8 pt-6 border-t-2">
        <div className="mb-4">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Landmark className="size-4 text-primary" /> Zoho Books Financial Reports Center
          </h2>
          <p className="text-xs text-muted-foreground">
            Click any Buyer, Supplier, or Contractor row below to open their 360° Master-Detail Workspace and download their A4 Statement of Accounts PDF.
          </p>
        </div>

        <Tabs defaultValue="customer_balances">
          <div className="no-print overflow-x-auto pb-1">
            <TabsList className="w-max min-w-full">
              <TabsTrigger value="customer_balances">
                <Users className="mr-1.5 size-3.5" /> Customer (Buyer) Balance Summary ({customerBalanceRows.length})
              </TabsTrigger>
              <TabsTrigger value="vendor_balances">
                <Truck className="mr-1.5 size-3.5" /> Vendor (Supplier & Contractor) Balance Summary ({vendorBalanceRows.length})
              </TabsTrigger>
              <TabsTrigger value="purchases_by_vendor">
                <FileText className="mr-1.5 size-3.5" /> Purchases & POs by Supplier ({purchasesBySupplierRows.length})
              </TabsTrigger>
              <TabsTrigger value="cash_flow_balance_sheet">
                <Landmark className="mr-1.5 size-3.5" /> Cash Flow & Financial Position (Balance Sheet)
              </TabsTrigger>
            </TabsList>
          </div>

          {/* 1. Customer (Buyer) Balance Summary */}
          <TabsContent value="customer_balances" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">
                  Customer (Buyer) Balance Summary — Receivables & Advances
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  rows={customerBalanceRows}
                  exportName="brickweld-customer-balance-summary"
                  exportTitle="Customer (Buyer) Balance Summary"
                  exportDescription="Zoho Books Receivables Report — Contract Invoiced vs Received, TDS Withheld, and Closing Receivable"
                  columns={[
                    {
                      header: "Customer / Buyer Name",
                      cell: (r) => (
                        <button
                          type="button"
                          onClick={() => setParty360Target({ type: "client", id: r.id })}
                          className="text-left font-semibold text-primary hover:underline"
                        >
                          {r.name}
                        </button>
                      ),
                      value: (r) => r.name,
                    },
                    {
                      header: "Projects / Sites",
                      cell: (r) => <span className="text-xs">{r.projects}</span>,
                      value: (r) => r.projects,
                    },
                    {
                      header: "Contract / Invoiced",
                      className: "text-right font-mono",
                      cell: (r) => currency(r.invoiced),
                      value: (r) => r.invoiced,
                    },
                    {
                      header: "Received",
                      className: "text-right font-mono text-emerald-700",
                      cell: (r) => currency(r.cashReceived),
                      value: (r) => r.cashReceived,
                    },
                    {
                      header: "TDS Withheld",
                      className: "text-right font-mono text-amber-700",
                      cell: (r) => currency(r.tdsWithheld),
                      value: (r) => r.tdsWithheld,
                    },
                    {
                      header: "Unused Advance (Cr)",
                      className: "text-right font-mono text-amber-700",
                      cell: (r) => (r.unusedAdvance > 0 ? currency(r.unusedAdvance) : "—"),
                      value: (r) => r.unusedAdvance,
                    },
                    {
                      header: "Receivable Due (Dr)",
                      className: "text-right font-mono font-bold text-destructive",
                      cell: (r) => (r.receivableDue > 0 ? currency(r.receivableDue) : "₹0"),
                      value: (r) => r.receivableDue,
                    },
                    {
                      header: "Statement PDF",
                      className: "text-right w-32",
                      cell: (r) => (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => setParty360Target({ type: "client", id: r.id })}
                        >
                          <Printer className="size-3 text-primary" /> Statement
                        </Button>
                      ),
                    },
                  ]}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* 2. Vendor (Supplier & Contractor) Balance Summary */}
          <TabsContent value="vendor_balances" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">
                  Vendor Balance Summary — Suppliers & Contractors Payables & Advances
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  rows={vendorBalanceRows}
                  exportName="brickweld-vendor-balance-summary"
                  exportTitle="Vendor (Supplier & Contractor) Balance Summary"
                  exportDescription="Zoho Books Payables Report — Billed Amount, Amount Paid, Unused Advances, and Net Payable"
                  columns={[
                    {
                      header: "Vendor Name",
                      cell: (r) => (
                        <button
                          type="button"
                          onClick={() =>
                            setParty360Target({ type: r.partyType, id: r.id })
                          }
                          className="text-left font-semibold text-primary hover:underline"
                        >
                          {r.name}
                        </button>
                      ),
                      value: (r) => r.name,
                    },
                    {
                      header: "Vendor Role",
                      cell: (r) => (
                        <Badge
                          variant={r.partyType === "supplier" ? "secondary" : "outline"}
                          className="text-[10px]"
                        >
                          {r.roleLabel}
                        </Badge>
                      ),
                      value: (r) => r.roleLabel,
                    },
                    {
                      header: "Code / GSTIN",
                      className: "font-mono text-xs",
                      cell: (r) => r.codeOrGstin,
                      value: (r) => r.codeOrGstin,
                    },
                    {
                      header: "Billed Amount",
                      className: "text-right font-mono",
                      cell: (r) => currency(r.billed),
                      value: (r) => r.billed,
                    },
                    {
                      header: "Amount Paid",
                      className: "text-right font-mono text-emerald-700",
                      cell: (r) => currency(r.paid),
                      value: (r) => r.paid,
                    },
                    {
                      header: "Unused Advance (Dr)",
                      className: "text-right font-mono text-amber-700",
                      cell: (r) => (r.unusedAdvance > 0 ? currency(r.unusedAdvance) : "—"),
                      value: (r) => r.unusedAdvance,
                    },
                    {
                      header: "Payable Owed (Cr)",
                      className: "text-right font-mono font-bold text-destructive",
                      cell: (r) => (r.payableOwed > 0 ? currency(r.payableOwed) : "₹0"),
                      value: (r) => r.payableOwed,
                    },
                    {
                      header: "Statement PDF",
                      className: "text-right w-32",
                      cell: (r) => (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() =>
                            setParty360Target({ type: r.partyType, id: r.id })
                          }
                        >
                          <Printer className="size-3 text-primary" /> Statement
                        </Button>
                      ),
                    },
                  ]}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* 3. Purchases & POs by Supplier */}
          <TabsContent value="purchases_by_vendor" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold">
                  Purchases & Purchase Orders by Supplier (Zoho Purchases by Vendor)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  rows={purchasesBySupplierRows}
                  exportName="brickweld-purchases-by-supplier"
                  exportTitle="Purchases & POs by Supplier Report"
                  columns={[
                    {
                      header: "Supplier Name",
                      cell: (r) => (
                        <button
                          type="button"
                          onClick={() => setParty360Target({ type: "supplier", id: r.id })}
                          className="text-left font-semibold text-primary hover:underline"
                        >
                          {r.name}
                        </button>
                      ),
                      value: (r) => r.name,
                    },
                    {
                      header: "PO Count",
                      className: "text-right font-mono",
                      cell: (r) => r.poCount,
                      value: (r) => r.poCount,
                    },
                    {
                      header: "Total PO Value",
                      className: "text-right font-mono",
                      cell: (r) => currency(r.poTotal),
                      value: (r) => r.poTotal,
                    },
                    {
                      header: "GRN (Bills) Count",
                      className: "text-right font-mono",
                      cell: (r) => r.grnCount,
                      value: (r) => r.grnCount,
                    },
                    {
                      header: "Total GRN Billed",
                      className: "text-right font-mono font-semibold",
                      cell: (r) => currency(r.grnTotal),
                      value: (r) => r.grnTotal,
                    },
                    {
                      header: "Total Paid",
                      className: "text-right font-mono text-emerald-700",
                      cell: (r) => currency(r.paidTotal),
                      value: (r) => r.paidTotal,
                    },
                  ]}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* 4. Cash Flow & Financial Position (Balance Sheet) */}
          <TabsContent value="cash_flow_balance_sheet" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold">
                    Cash Flow Summary (Operating & Financing)
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-2.5">
                  {(() => {
                    const totalClientIn = sum(customerBalanceRows, (c) => c.cashReceived);
                    const totalVendorOut = sum(vendorBalanceRows, (v) => v.paid);
                    const totalExpOut = sum(byCategory, (c) => c.amount);
                    const mdCapIn = sum(
                      (mdInvestments.data ?? []).filter(
                        (m: any) => !m.is_void && m.transaction_type !== "drawing"
                      ),
                      (m: any) => Number(m.amount || 0)
                    );
                    const mdDrawOut = sum(
                      (mdInvestments.data ?? []).filter(
                        (m: any) => !m.is_void && m.transaction_type === "drawing"
                      ),
                      (m: any) => Number(m.amount || 0)
                    );
                    const operatingCashFlow = totalClientIn - (totalVendorOut + totalExpOut);
                    const financingCashFlow = mdCapIn - mdDrawOut;
                    return (
                      <div className="divide-y border rounded-md">
                        <div className="flex justify-between p-2.5 bg-muted/30 font-semibold">
                          <span>A. Cash Inflows from Customers (Buyers)</span>
                          <span className="font-mono text-emerald-700">
                            +{currency(totalClientIn)}
                          </span>
                        </div>
                        <div className="flex justify-between p-2.5">
                          <span>B. Cash Paid to Suppliers & Contractors</span>
                          <span className="font-mono text-destructive">
                            -{currency(totalVendorOut)}
                          </span>
                        </div>
                        <div className="flex justify-between p-2.5">
                          <span>C. Direct Site & Office Expenses Paid</span>
                          <span className="font-mono text-destructive">
                            -{currency(totalExpOut)}
                          </span>
                        </div>
                        <div className="flex justify-between p-2.5 bg-muted/50 font-bold">
                          <span>Net Cash from Operating Activities (A - B - C)</span>
                          <span className="font-mono">{currency(operatingCashFlow)}</span>
                        </div>
                        <div className="flex justify-between p-2.5">
                          <span>D. Owner Capital Contributions (MD Investments)</span>
                          <span className="font-mono text-emerald-700">
                            +{currency(mdCapIn)}
                          </span>
                        </div>
                        <div className="flex justify-between p-2.5">
                          <span>E. Owner Drawings (MD Withdrawals)</span>
                          <span className="font-mono text-destructive">
                            -{currency(mdDrawOut)}
                          </span>
                        </div>
                        <div className="flex justify-between p-2.5 bg-slate-900 text-white font-bold">
                          <span>Net Financing Cash Flow (D - E)</span>
                          <span className="font-mono">{currency(financingCashFlow)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold">
                    Statement of Financial Position (Zoho Balance Sheet Snapshot)
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-2.5">
                  {(() => {
                    const bankBal = liveBalances?.bank?.balance ?? 0;
                    const pettyBal = liveBalances?.petty_cash?.balance ?? 0;
                    const totalReceivables = sum(customerBalanceRows, (c) => c.receivableDue);
                    const totalVendorAdvances = sum(vendorBalanceRows, (v) => v.unusedAdvance);
                    const totalPayables = sum(vendorBalanceRows, (v) => v.payableOwed);
                    const totalCustomerAdvances = sum(
                      customerBalanceRows,
                      (c) => c.unusedAdvance
                    );
                    return (
                      <div className="divide-y border rounded-md">
                        <div className="p-2 bg-slate-800 text-white font-bold uppercase text-[11px]">
                          Assets & Receivables
                        </div>
                        <div className="flex justify-between p-2.5">
                          <span>🏦 Bank Account Running Balance (xxxx5909)</span>
                          <span className="font-mono font-semibold">{currency(bankBal)}</span>
                        </div>
                        <div className="flex justify-between p-2.5">
                          <span>💵 Petty Cash Running Balance (Kodak)</span>
                          <span className="font-mono font-semibold">{currency(pettyBal)}</span>
                        </div>
                        <div className="flex justify-between p-2.5">
                          <span>Accounts Receivable (Due from Buyers)</span>
                          <span className="font-mono font-semibold text-emerald-700">
                            {currency(totalReceivables)}
                          </span>
                        </div>
                        <div className="flex justify-between p-2.5">
                          <span>Vendor Advances Paid (Unused Supplier/Contractor Credits)</span>
                          <span className="font-mono font-semibold text-amber-700">
                            {currency(totalVendorAdvances)}
                          </span>
                        </div>
                        <div className="p-2 bg-slate-800 text-white font-bold uppercase text-[11px]">
                          Liabilities & Customer Advances
                        </div>
                        <div className="flex justify-between p-2.5">
                          <span>Accounts Payable (Owed to Suppliers & Contractors)</span>
                          <span className="font-mono font-bold text-destructive">
                            {currency(totalPayables)}
                          </span>
                        </div>
                        <div className="flex justify-between p-2.5">
                          <span>Unearned Revenue / Customer Advances Held</span>
                          <span className="font-mono font-semibold">
                            {currency(totalCustomerAdvances)}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Universal Zoho Buyer & Vendor 360° Workspace Dialog */}
      {party360Target && (
        <Party360Dialog
          open={!!party360Target}
          onOpenChange={(v) => !v && setParty360Target(null)}
          partyType={party360Target.type}
          partyId={party360Target.id}
          initialTab="statement"
        />
      )}
    </div>
    </RequirePermission>
  );
}
