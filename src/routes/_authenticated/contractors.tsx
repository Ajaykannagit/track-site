import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { useRows, useSaveRow, useDeleteRow, sum } from "@/lib/db";
import { currency, dateFmt, today } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/contractors")({
  head: () => ({
    meta: [
      { title: "Contractors — Brickweld" },
      {
        name: "description",
        content:
          "Work orders, measurement books, contractor bills and payments across all construction sites.",
      },
      { property: "og:title", content: "Contractors — Brickweld" },
      {
        property: "og:description",
        content: "Work order to measurement book to bill to payment, in one place.",
      },
    ],
  }),
  component: ContractorsPage,
});

type Wo = {
  id: string;
  work_order_number: string;
  project_id: string;
  contractor_id: string;
  wo_date: string;
  contract_amount: number;
  rate?: number;
  quantity?: number;
  unit?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status: string;
  work_description: string | null;
};

type Mb = {
  id: string;
  mb_number: string;
  project_id: string;
  contractor_id: string | null;
  work_order_id?: string | null;
  mb_date: string;
  total_amount: number;
  status: string;
  remarks?: string | null;
};

type Bill = {
  id: string;
  bill_number: string;
  project_id: string;
  contractor_id: string;
  work_order_id?: string | null;
  bill_date: string;
  gross_amount: number;
  deductions: number;
  net_amount: number;
  status: string;
  remarks?: string | null;
};

type Payment = {
  id: string;
  project_id: string;
  contractor_id: string;
  bill_id?: string | null;
  payment_date: string;
  amount: number;
  payment_method: string | null;
  reference_number: string | null;
  remarks?: string | null;
};

const docNumber = (prefix: string) => `${prefix}-${Date.now().toString().slice(-8)}`;

function ContractorsPage() {
  const { canWriteSite, canWriteFinance, isMD } = useAuth();

  // Selected for Edit and Delete
  const [editingWo, setEditingWo] = useState<Wo | null>(null);
  const [deletingWo, setDeletingWo] = useState<Wo | null>(null);

  const [editingMb, setEditingMb] = useState<Mb | null>(null);
  const [deletingMb, setDeletingMb] = useState<Mb | null>(null);

  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [deletingBill, setDeletingBill] = useState<Bill | null>(null);

  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<Payment | null>(null);

  // Common Filters
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [contractorFilter, setContractorFilter] = useState<string>("all");

  const projects = useRows<{ id: string; name: string }>("projects", { select: "id,name" });
  const contractors = useRows<{ id: string; name: string }>("contractors", { select: "id,name" });

  const wos = useRows<Wo>("work_orders", { order: { col: "wo_date" }, limit: 300 });
  const mbs = useRows<Mb>("measurement_books", { order: { col: "mb_date" }, limit: 300 });
  const bills = useRows<Bill>("contractor_bills", { order: { col: "bill_date" }, limit: 300 });
  const payments = useRows<Payment>("contractor_payments", {
    order: { col: "payment_date" },
    limit: 300,
  });

  const saveWo = useSaveRow("work_orders", "Work order");
  const deleteWo = useDeleteRow("work_orders", "Work order");

  const saveMb = useSaveRow("measurement_books", "Measurement book");
  const deleteMb = useDeleteRow("measurement_books", "Measurement book");

  const saveBill = useSaveRow("contractor_bills", "Contractor bill");
  const deleteBill = useDeleteRow("contractor_bills", "Contractor bill");

  const savePayment = useSaveRow("contractor_payments", "Payment");
  const deletePayment = useDeleteRow("contractor_payments", "Payment");

  const projectName = (id: string | null) => projects.data?.find((p) => p.id === id)?.name ?? "—";
  const contractorName = (id: string | null) =>
    contractors.data?.find((c) => c.id === id)?.name ?? "—";
  const projectOptions = (projects.data ?? []).map((p) => ({ value: p.id, label: p.name }));
  const contractorOptions = (contractors.data ?? []).map((c) => ({ value: c.id, label: c.name }));

  const canModifySite = canWriteSite || isMD;
  const canModifyFinance = canWriteFinance || isMD;

  // Filtered lists
  const filteredWos = useMemo(() => {
    let list = wos.data ?? [];
    if (projectFilter !== "all") list = list.filter((r) => r.project_id === projectFilter);
    if (contractorFilter !== "all") list = list.filter((r) => r.contractor_id === contractorFilter);
    return list;
  }, [wos.data, projectFilter, contractorFilter]);

  const filteredMbs = useMemo(() => {
    let list = mbs.data ?? [];
    if (projectFilter !== "all") list = list.filter((r) => r.project_id === projectFilter);
    if (contractorFilter !== "all") list = list.filter((r) => r.contractor_id === contractorFilter);
    return list;
  }, [mbs.data, projectFilter, contractorFilter]);

  const filteredBills = useMemo(() => {
    let list = bills.data ?? [];
    if (projectFilter !== "all") list = list.filter((r) => r.project_id === projectFilter);
    if (contractorFilter !== "all") list = list.filter((r) => r.contractor_id === contractorFilter);
    return list;
  }, [bills.data, projectFilter, contractorFilter]);

  const filteredPayments = useMemo(() => {
    let list = payments.data ?? [];
    if (projectFilter !== "all") list = list.filter((r) => r.project_id === projectFilter);
    if (contractorFilter !== "all") list = list.filter((r) => r.contractor_id === contractorFilter);
    return list;
  }, [payments.data, projectFilter, contractorFilter]);

  // Columns
  const woColumns: Column<Wo>[] = [
    { header: "WO #", cell: (r) => r.work_order_number, value: (r) => r.work_order_number },
    {
      header: "Project",
      cell: (r) => projectName(r.project_id),
      value: (r) => projectName(r.project_id),
    },
    {
      header: "Contractor",
      cell: (r) => contractorName(r.contractor_id),
      value: (r) => contractorName(r.contractor_id),
    },
    { header: "Date", cell: (r) => dateFmt(r.wo_date), value: (r) => r.wo_date },
    { header: "Status", cell: (r) => <StatusBadge status={r.status} />, value: (r) => r.status },
    {
      header: "Value",
      cell: (r) => currency(r.contract_amount),
      value: (r) => r.contract_amount,
      className: "text-right",
    },
    ...(canModifyFinance
      ? [
          {
            header: "Actions",
            className: "text-right w-24",
            cell: (r: Wo) => (
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setEditingWo(r)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  onClick={() => setDeletingWo(r)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  const mbColumns: Column<Mb>[] = [
    { header: "MB #", cell: (r) => r.mb_number, value: (r) => r.mb_number },
    {
      header: "Project",
      cell: (r) => projectName(r.project_id),
      value: (r) => projectName(r.project_id),
    },
    {
      header: "Contractor",
      cell: (r) => contractorName(r.contractor_id),
      value: (r) => contractorName(r.contractor_id),
    },
    { header: "Date", cell: (r) => dateFmt(r.mb_date), value: (r) => r.mb_date },
    { header: "Status", cell: (r) => <StatusBadge status={r.status} />, value: (r) => r.status },
    {
      header: "Value",
      cell: (r) => currency(r.total_amount),
      value: (r) => r.total_amount,
      className: "text-right",
    },
    ...(canModifySite
      ? [
          {
            header: "Actions",
            className: "text-right w-24",
            cell: (r: Mb) => (
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setEditingMb(r)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  onClick={() => setDeletingMb(r)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  const billColumns: Column<Bill>[] = [
    { header: "Bill #", cell: (r) => r.bill_number, value: (r) => r.bill_number },
    {
      header: "Project",
      cell: (r) => projectName(r.project_id),
      value: (r) => projectName(r.project_id),
    },
    {
      header: "Contractor",
      cell: (r) => contractorName(r.contractor_id),
      value: (r) => contractorName(r.contractor_id),
    },
    { header: "Date", cell: (r) => dateFmt(r.bill_date), value: (r) => r.bill_date },
    { header: "Status", cell: (r) => <StatusBadge status={r.status} />, value: (r) => r.status },
    {
      header: "Gross",
      cell: (r) => currency(r.gross_amount),
      value: (r) => r.gross_amount,
      className: "text-right",
    },
    {
      header: "Net",
      cell: (r) => currency(r.net_amount),
      value: (r) => r.net_amount,
      className: "text-right",
    },
    ...(canModifyFinance
      ? [
          {
            header: "Actions",
            className: "text-right w-24",
            cell: (r: Bill) => (
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setEditingBill(r)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  onClick={() => setDeletingBill(r)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  const paymentColumns: Column<Payment>[] = [
    { header: "Date", cell: (r) => dateFmt(r.payment_date), value: (r) => r.payment_date },
    {
      header: "Project",
      cell: (r) => projectName(r.project_id),
      value: (r) => projectName(r.project_id),
    },
    {
      header: "Contractor",
      cell: (r) => contractorName(r.contractor_id),
      value: (r) => contractorName(r.contractor_id),
    },
    { header: "Method", cell: (r) => r.payment_method ?? "—", value: (r) => r.payment_method },
    {
      header: "Reference",
      cell: (r) => r.reference_number ?? "—",
      value: (r) => r.reference_number,
    },
    {
      header: "Amount",
      cell: (r) => currency(r.amount),
      value: (r) => r.amount,
      className: "text-right",
    },
    ...(canModifyFinance
      ? [
          {
            header: "Actions",
            className: "text-right w-24",
            cell: (r: Payment) => (
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setEditingPayment(r)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  onClick={() => setDeletingPayment(r)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  // Forms
  const woFields: Field[] = [
    { name: "work_order_number", label: "WO number", required: true },
    {
      name: "project_id",
      label: "Project",
      type: "select",
      required: true,
      options: projectOptions,
    },
    {
      name: "contractor_id",
      label: "Contractor",
      type: "select",
      required: true,
      options: contractorOptions,
    },
    { name: "wo_date", label: "WO date", type: "date", required: true },
    { name: "contract_amount", label: "Contract amount (₹)", type: "number", required: true },
    { name: "rate", label: "Rate (₹)", type: "number" },
    { name: "quantity", label: "Quantity", type: "number" },
    { name: "unit", label: "Unit" },
    { name: "start_date", label: "Start date", type: "date" },
    { name: "end_date", label: "End date", type: "date" },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: ["draft", "approved", "md_approved", "closed", "rejected"].map((s) => ({
        value: s,
        label: s.replace(/_/g, " "),
      })),
    },
    { name: "work_description", label: "Scope of work", type: "textarea" },
  ];

  const mbFields: Field[] = [
    { name: "mb_number", label: "MB number", required: true },
    {
      name: "project_id",
      label: "Project",
      type: "select",
      required: true,
      options: projectOptions,
    },
    { name: "contractor_id", label: "Contractor", type: "select", options: contractorOptions },
    {
      name: "work_order_id",
      label: "Against work order",
      type: "select",
      options: (wos.data ?? []).map((w) => ({ value: w.id, label: w.work_order_number })),
    },
    { name: "mb_date", label: "MB date", type: "date", required: true },
    { name: "total_amount", label: "Measured value (₹)", type: "number" },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: ["draft", "submitted", "verified", "approved", "rejected"].map((s) => ({
        value: s,
        label: s,
      })),
    },
    { name: "remarks", label: "Remarks", type: "textarea" },
  ];

  const billFields: Field[] = [
    { name: "bill_number", label: "Bill number", required: true },
    {
      name: "project_id",
      label: "Project",
      type: "select",
      required: true,
      options: projectOptions,
    },
    {
      name: "contractor_id",
      label: "Contractor",
      type: "select",
      required: true,
      options: contractorOptions,
    },
    {
      name: "work_order_id",
      label: "Against work order",
      type: "select",
      options: (wos.data ?? []).map((w) => ({ value: w.id, label: w.work_order_number })),
    },
    { name: "bill_date", label: "Bill date", type: "date", required: true },
    { name: "gross_amount", label: "Gross amount (₹)", type: "number", required: true },
    { name: "deductions", label: "Deductions (₹)", type: "number" },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: [
        "draft",
        "submitted",
        "verified",
        "approved",
        "md_approved",
        "payment_approved",
        "paid",
        "rejected",
      ].map((s) => ({ value: s, label: s.replace(/_/g, " ") })),
    },
    { name: "remarks", label: "Remarks", type: "textarea" },
  ];

  const paymentFields: Field[] = [
    {
      name: "project_id",
      label: "Project",
      type: "select",
      required: true,
      options: projectOptions,
    },
    {
      name: "contractor_id",
      label: "Contractor",
      type: "select",
      required: true,
      options: contractorOptions,
    },
    {
      name: "bill_id",
      label: "Against bill",
      type: "select",
      options: (bills.data ?? []).map((b) => ({ value: b.id, label: b.bill_number })),
    },
    { name: "payment_date", label: "Payment date", type: "date", required: true },
    { name: "amount", label: "Amount (₹)", type: "number", required: true },
    {
      name: "payment_method",
      label: "Method",
      type: "select",
      options: ["bank", "cash", "upi", "cheque"].map((m) => ({ value: m, label: m })),
    },
    { name: "reference_number", label: "Reference number" },
    { name: "remarks", label: "Remarks", type: "textarea" },
  ];

  const billed = sum(filteredBills, (r) => r.net_amount);
  const paid = sum(filteredPayments, (r) => r.amount);

  return (
    <div>
      <PageHeader
        title="Contractors"
        description="Work orders, measurement books, bills and payments."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <StatCard
          label="Work order value"
          value={currency(sum(filteredWos, (r) => r.contract_amount))}
        />
        <StatCard label="Billed (net)" value={currency(billed)} tone="warning" />
        <StatCard label="Paid" value={currency(paid)} tone="success" />
        <StatCard label="Outstanding" value={currency(billed - paid)} tone="destructive" />
      </div>

      {/* Shared Filter Bar */}
      <div className="no-print mb-4 rounded-lg border bg-card p-3 flex flex-wrap items-end gap-3">
        <div>
          <Label className="mb-1.5 block text-xs font-medium">Project</Label>
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
        </div>

        <div>
          <Label className="mb-1.5 block text-xs font-medium">Contractor</Label>
          <Select value={contractorFilter} onValueChange={setContractorFilter}>
            <SelectTrigger className="w-48 h-8 text-xs">
              <SelectValue placeholder="All Contractors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Contractors</SelectItem>
              {contractorOptions.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {(projectFilter !== "all" || contractorFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setProjectFilter("all");
              setContractorFilter("all");
            }}
            className="h-8 px-2 text-xs"
          >
            <RotateCcw className="mr-1 size-3.5" /> Reset
          </Button>
        )}
      </div>

      <Tabs defaultValue="wo">
        <TabsList className="no-print">
          <TabsTrigger value="wo">Work orders</TabsTrigger>
          <TabsTrigger value="mb">Measurement books</TabsTrigger>
          <TabsTrigger value="bills">Bills</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        {/* ================= WORK ORDERS ================= */}
        <TabsContent value="wo" className="mt-4 space-y-3">
          {canModifyFinance && (
            <FormDialog
              title="Issue work order"
              description="Award scope of work to a contractor for a project."
              trigger={
                <Button>
                  <Plus className="mr-2 size-4" /> New work order
                </Button>
              }
              submitting={saveWo.isPending}
              initial={{
                work_order_number: docNumber("WO"),
                wo_date: today(),
                status: "draft",
                rate: 0,
                quantity: 0,
              }}
              fields={woFields}
              onSubmit={async (values) => {
                await saveWo.mutateAsync({
                  values: {
                    ...values,
                    start_date: values["start_date"] || null,
                    end_date: values["end_date"] || null,
                    contract_amount: Number(values["contract_amount"] ?? 0),
                    rate: Number(values["rate"] ?? 0),
                    quantity: Number(values["quantity"] ?? 0),
                  },
                });
              }}
            />
          )}

          {editingWo && (
            <FormDialog
              open={!!editingWo}
              onOpenChange={(v) => !v && setEditingWo(null)}
              title="Edit work order"
              fields={woFields}
              submitting={saveWo.isPending}
              initial={{
                work_order_number: editingWo.work_order_number,
                project_id: editingWo.project_id,
                contractor_id: editingWo.contractor_id,
                wo_date: editingWo.wo_date,
                contract_amount: editingWo.contract_amount,
                rate: editingWo.rate ?? 0,
                quantity: editingWo.quantity ?? 0,
                unit: editingWo.unit ?? "",
                start_date: editingWo.start_date ?? "",
                end_date: editingWo.end_date ?? "",
                status: editingWo.status,
                work_description: editingWo.work_description ?? "",
              }}
              onSubmit={async (values) => {
                await saveWo.mutateAsync({
                  id: editingWo.id,
                  values: {
                    ...values,
                    start_date: values["start_date"] || null,
                    end_date: values["end_date"] || null,
                    contract_amount: Number(values["contract_amount"] ?? 0),
                    rate: Number(values["rate"] ?? 0),
                    quantity: Number(values["quantity"] ?? 0),
                  },
                });
                setEditingWo(null);
              }}
            />
          )}

          {deletingWo && (
            <ConfirmDeleteDialog
              open={!!deletingWo}
              onOpenChange={(v) => !v && setDeletingWo(null)}
              title="Delete work order"
              description={`Are you sure you want to delete work order "${deletingWo.work_order_number}"? This action cannot be undone.`}
              onConfirm={async () => {
                await deleteWo.mutateAsync(deletingWo.id);
                setDeletingWo(null);
              }}
            />
          )}

          <DataTable
            rows={filteredWos}
            columns={woColumns}
            loading={wos.isLoading}
            exportName="brickweld-work-orders"
            exportTitle="Work Orders Report"
            exportDescription="Construction Project Control System — Work Orders Report"
            appliedFilters={{
              ...(projectFilter !== "all" ? { Project: projectName(projectFilter) } : {}),
              ...(contractorFilter !== "all"
                ? { Contractor: contractorName(contractorFilter) }
                : {}),
            }}
          />
        </TabsContent>

        {/* ================= MEASUREMENT BOOKS ================= */}
        <TabsContent value="mb" className="mt-4 space-y-3">
          {canModifySite && (
            <FormDialog
              title="Record measurement book"
              description="Capture measured work executed by a contractor."
              trigger={
                <Button>
                  <Plus className="mr-2 size-4" /> New MB
                </Button>
              }
              submitting={saveMb.isPending}
              initial={{
                mb_number: docNumber("MB"),
                mb_date: today(),
                status: "draft",
                total_amount: 0,
              }}
              fields={mbFields}
              onSubmit={async (values) => {
                await saveMb.mutateAsync({
                  values: {
                    ...values,
                    contractor_id: values["contractor_id"] || null,
                    work_order_id: values["work_order_id"] || null,
                    total_amount: Number(values["total_amount"] ?? 0),
                  },
                });
              }}
            />
          )}

          {editingMb && (
            <FormDialog
              open={!!editingMb}
              onOpenChange={(v) => !v && setEditingMb(null)}
              title="Edit measurement book"
              fields={mbFields}
              submitting={saveMb.isPending}
              initial={{
                mb_number: editingMb.mb_number,
                project_id: editingMb.project_id,
                contractor_id: editingMb.contractor_id ?? "",
                work_order_id: editingMb.work_order_id ?? "",
                mb_date: editingMb.mb_date,
                total_amount: editingMb.total_amount,
                status: editingMb.status,
                remarks: editingMb.remarks ?? "",
              }}
              onSubmit={async (values) => {
                await saveMb.mutateAsync({
                  id: editingMb.id,
                  values: {
                    ...values,
                    contractor_id: values["contractor_id"] || null,
                    work_order_id: values["work_order_id"] || null,
                    total_amount: Number(values["total_amount"] ?? 0),
                  },
                });
                setEditingMb(null);
              }}
            />
          )}

          {deletingMb && (
            <ConfirmDeleteDialog
              open={!!deletingMb}
              onOpenChange={(v) => !v && setDeletingMb(null)}
              title="Delete measurement book"
              description={`Are you sure you want to delete MB "${deletingMb.mb_number}"? This action cannot be undone.`}
              onConfirm={async () => {
                await deleteMb.mutateAsync(deletingMb.id);
                setDeletingMb(null);
              }}
            />
          )}

          <DataTable
            rows={filteredMbs}
            columns={mbColumns}
            loading={mbs.isLoading}
            exportName="brickweld-measurement-books"
            exportTitle="Measurement Books Report"
            exportDescription="Construction Project Control System — Measurement Books Report"
            appliedFilters={{
              ...(projectFilter !== "all" ? { Project: projectName(projectFilter) } : {}),
              ...(contractorFilter !== "all"
                ? { Contractor: contractorName(contractorFilter) }
                : {}),
            }}
          />
        </TabsContent>

        {/* ================= BILLS ================= */}
        <TabsContent value="bills" className="mt-4 space-y-3">
          {canModifyFinance && (
            <FormDialog
              title="Raise contractor bill"
              description="Bill approved measurements with deductions and retention."
              trigger={
                <Button>
                  <Plus className="mr-2 size-4" /> New bill
                </Button>
              }
              submitting={saveBill.isPending}
              initial={{
                bill_number: docNumber("CB"),
                bill_date: today(),
                status: "draft",
                deductions: 0,
              }}
              fields={billFields}
              onSubmit={async (values) => {
                const gross = Number(values["gross_amount"] ?? 0);
                const deductions = Number(values["deductions"] ?? 0);
                await saveBill.mutateAsync({
                  values: {
                    ...values,
                    work_order_id: values["work_order_id"] || null,
                    mb_ids: [],
                    gross_amount: gross,
                    deductions,
                    net_amount: gross - deductions,
                  },
                });
              }}
            />
          )}

          {editingBill && (
            <FormDialog
              open={!!editingBill}
              onOpenChange={(v) => !v && setEditingBill(null)}
              title="Edit contractor bill"
              fields={billFields}
              submitting={saveBill.isPending}
              initial={{
                bill_number: editingBill.bill_number,
                project_id: editingBill.project_id,
                contractor_id: editingBill.contractor_id,
                work_order_id: editingBill.work_order_id ?? "",
                bill_date: editingBill.bill_date,
                gross_amount: editingBill.gross_amount,
                deductions: editingBill.deductions,
                status: editingBill.status,
                remarks: editingBill.remarks ?? "",
              }}
              onSubmit={async (values) => {
                const gross = Number(values["gross_amount"] ?? 0);
                const deductions = Number(values["deductions"] ?? 0);
                await saveBill.mutateAsync({
                  id: editingBill.id,
                  values: {
                    ...values,
                    work_order_id: values["work_order_id"] || null,
                    gross_amount: gross,
                    deductions,
                    net_amount: gross - deductions,
                  },
                });
                setEditingBill(null);
              }}
            />
          )}

          {deletingBill && (
            <ConfirmDeleteDialog
              open={!!deletingBill}
              onOpenChange={(v) => !v && setDeletingBill(null)}
              title="Delete bill"
              description={`Are you sure you want to delete bill "${deletingBill.bill_number}"? This action cannot be undone.`}
              onConfirm={async () => {
                await deleteBill.mutateAsync(deletingBill.id);
                setDeletingBill(null);
              }}
            />
          )}

          <DataTable
            rows={filteredBills}
            columns={billColumns}
            loading={bills.isLoading}
            exportName="brickweld-contractor-bills"
            exportTitle="Contractor Bills Report"
            exportDescription="Construction Project Control System — Contractor Bills Report"
            appliedFilters={{
              ...(projectFilter !== "all" ? { Project: projectName(projectFilter) } : {}),
              ...(contractorFilter !== "all"
                ? { Contractor: contractorName(contractorFilter) }
                : {}),
            }}
          />
        </TabsContent>

        {/* ================= PAYMENTS ================= */}
        <TabsContent value="payments" className="mt-4 space-y-3">
          {canModifyFinance && (
            <FormDialog
              title="Record payment"
              description="Log a payment released against a contractor bill."
              trigger={
                <Button>
                  <Plus className="mr-2 size-4" /> New payment
                </Button>
              }
              submitting={savePayment.isPending}
              initial={{ payment_date: today(), payment_method: "bank" }}
              fields={paymentFields}
              onSubmit={async (values) => {
                await savePayment.mutateAsync({
                  values: {
                    ...values,
                    bill_id: values["bill_id"] || null,
                    amount: Number(values["amount"] ?? 0),
                  },
                });
              }}
            />
          )}

          {editingPayment && (
            <FormDialog
              open={!!editingPayment}
              onOpenChange={(v) => !v && setEditingPayment(null)}
              title="Edit payment"
              fields={paymentFields}
              submitting={savePayment.isPending}
              initial={{
                project_id: editingPayment.project_id,
                contractor_id: editingPayment.contractor_id,
                bill_id: editingPayment.bill_id ?? "",
                payment_date: editingPayment.payment_date,
                amount: editingPayment.amount,
                payment_method: editingPayment.payment_method ?? "bank",
                reference_number: editingPayment.reference_number ?? "",
                remarks: editingPayment.remarks ?? "",
              }}
              onSubmit={async (values) => {
                await savePayment.mutateAsync({
                  id: editingPayment.id,
                  values: {
                    ...values,
                    bill_id: values["bill_id"] || null,
                    amount: Number(values["amount"] ?? 0),
                  },
                });
                setEditingPayment(null);
              }}
            />
          )}

          {deletingPayment && (
            <ConfirmDeleteDialog
              open={!!deletingPayment}
              onOpenChange={(v) => !v && setDeletingPayment(null)}
              title="Delete payment"
              description={`Are you sure you want to delete payment of ${currency(deletingPayment.amount)}? This action cannot be undone.`}
              onConfirm={async () => {
                await deletePayment.mutateAsync(deletingPayment.id);
                setDeletingPayment(null);
              }}
            />
          )}

          <DataTable
            rows={filteredPayments}
            columns={paymentColumns}
            loading={payments.isLoading}
            exportName="brickweld-contractor-payments"
            exportTitle="Contractor Payments Report"
            exportDescription="Construction Project Control System — Contractor Payments Report"
            appliedFilters={{
              ...(projectFilter !== "all" ? { Project: projectName(projectFilter) } : {}),
              ...(contractorFilter !== "all"
                ? { Contractor: contractorName(contractorFilter) }
                : {}),
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
