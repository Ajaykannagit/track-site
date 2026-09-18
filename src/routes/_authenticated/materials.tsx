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

export const Route = createFileRoute("/_authenticated/materials")({
  head: () => ({
    meta: [
      { title: "Materials — Brickweld Pvt Ltd" },
      {
        name: "description",
        content:
          "Material indents, purchase orders and site receipts with approval status for each project.",
      },
      { property: "og:title", content: "Materials — Brickweld Pvt Ltd" },
      {
        property: "og:description",
        content: "Indent to purchase order to goods receipt, tracked per site.",
      },
    ],
  }),
  component: MaterialsPage,
});

type Request = {
  id: string;
  request_number: string;
  project_id: string;
  material_name?: string | null;
  request_date: string;
  required_date: string | null;
  status: string;
  total_amount: number;
  remarks: string | null;
};

type Po = {
  id: string;
  po_number: string;
  project_id: string;
  supplier_id: string | null;
  request_id?: string | null;
  po_date: string;
  status: string;
  subtotal: number;
  tax_percent: number;
  tax_amount: number;
  total_amount: number;
  terms?: string | null;
};

type Receipt = {
  id: string;
  receipt_number: string;
  project_id: string;
  supplier_id: string | null;
  po_id: string | null;
  receipt_date: string;
  total_amount: number;
  remarks: string | null;
};

type SupplierPayment = {
  id: string;
  project_id: string;
  supplier_id: string;
  po_id: string | null;
  payment_date: string;
  amount: number;
  payment_method: string | null;
  reference_number: string | null;
  remarks: string | null;
};

const docNumber = (prefix: string) => `${prefix}-${Date.now().toString().slice(-8)}`;

function MaterialsPage() {
  const { canWriteSite, canWriteFinance, isMD } = useAuth();

  // Selected for Edit and Delete
  const [editingRequest, setEditingRequest] = useState<Request | null>(null);
  const [deletingRequest, setDeletingRequest] = useState<Request | null>(null);

  const [editingPo, setEditingPo] = useState<Po | null>(null);
  const [deletingPo, setDeletingPo] = useState<Po | null>(null);

  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null);
  const [deletingReceipt, setDeletingReceipt] = useState<Receipt | null>(null);

  const [editingPayment, setEditingPayment] = useState<SupplierPayment | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<SupplierPayment | null>(null);

  // Filters
  const [reqProjectFilter, setReqProjectFilter] = useState<string>("all");
  const [poProjectFilter, setPoProjectFilter] = useState<string>("all");
  const [grnProjectFilter, setGrnProjectFilter] = useState<string>("all");
  const [payProjectFilter, setPayProjectFilter] = useState<string>("all");
  const [paySupplierFilter, setPaySupplierFilter] = useState<string>("all");

  const projects = useRows<{ id: string; name: string }>("projects", { select: "id,name" });
  const suppliers = useRows<{ id: string; name: string }>("suppliers", { select: "id,name" });

  const requests = useRows<Request>("material_requests", {
    order: { col: "request_date" },
    limit: 300,
  });
  const pos = useRows<Po>("purchase_orders", { order: { col: "po_date" }, limit: 300 });
  const receipts = useRows<Receipt>("material_receipts", {
    order: { col: "receipt_date" },
    limit: 300,
  });
  const payments = useRows<SupplierPayment>("supplier_payments", {
    order: { col: "payment_date" },
    limit: 300,
  });

  const saveRequest = useSaveRow("material_requests", "Material request");
  const deleteRequest = useDeleteRow("material_requests", "Material request");

  const savePo = useSaveRow("purchase_orders", "Purchase order");
  const deletePo = useDeleteRow("purchase_orders", "Purchase order");

  const saveReceipt = useSaveRow("material_receipts", "Material receipt");
  const deleteReceipt = useDeleteRow("material_receipts", "Material receipt");

  const savePayment = useSaveRow("supplier_payments", "Supplier payment");
  const deletePayment = useDeleteRow("supplier_payments", "Supplier payment");

  const projectName = (id: string | null) => projects.data?.find((p) => p.id === id)?.name ?? "—";
  const supplierName = (id: string | null) => suppliers.data?.find((s) => s.id === id)?.name ?? "—";
  const projectOptions = (projects.data ?? []).map((p) => ({ value: p.id, label: p.name }));
  const supplierOptions = (suppliers.data ?? []).map((s) => ({ value: s.id, label: s.name }));

  // Permissions
  const canModifySite = canWriteSite || isMD;
  const canModifyFinance = canWriteFinance || isMD;

  // Filtered lists
  const filteredRequests = useMemo(() => {
    let list = requests.data ?? [];
    if (reqProjectFilter !== "all") list = list.filter((r) => r.project_id === reqProjectFilter);
    return list;
  }, [requests.data, reqProjectFilter]);

  const filteredPos = useMemo(() => {
    let list = pos.data ?? [];
    if (poProjectFilter !== "all") list = list.filter((p) => p.project_id === poProjectFilter);
    return list;
  }, [pos.data, poProjectFilter]);

  const filteredReceipts = useMemo(() => {
    let list = receipts.data ?? [];
    if (grnProjectFilter !== "all") list = list.filter((r) => r.project_id === grnProjectFilter);
    return list;
  }, [receipts.data, grnProjectFilter]);

  const filteredPayments = useMemo(() => {
    let list = payments.data ?? [];
    if (payProjectFilter !== "all") list = list.filter((p) => p.project_id === payProjectFilter);
    if (paySupplierFilter !== "all") list = list.filter((p) => p.supplier_id === paySupplierFilter);
    return list;
  }, [payments.data, payProjectFilter, paySupplierFilter]);

  // Request Columns
  const requestColumns: Column<Request>[] = [
    { header: "Indent #", cell: (r) => r.request_number, value: (r) => r.request_number },
    {
      header: "Project",
      cell: (r) => projectName(r.project_id),
      value: (r) => projectName(r.project_id),
    },
    {
      header: "Material",
      cell: (r) => r.material_name || "—",
      value: (r) => r.material_name,
    },
    { header: "Raised", cell: (r) => dateFmt(r.request_date), value: (r) => r.request_date },
    { header: "Required", cell: (r) => dateFmt(r.required_date), value: (r) => r.required_date },
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
            cell: (r: Request) => (
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setEditingRequest(r)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  onClick={() => setDeletingRequest(r)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  // PO Columns
  const poColumns: Column<Po>[] = [
    { header: "PO #", cell: (r) => r.po_number, value: (r) => r.po_number },
    {
      header: "Project",
      cell: (r) => projectName(r.project_id),
      value: (r) => projectName(r.project_id),
    },
    {
      header: "Supplier",
      cell: (r) => supplierName(r.supplier_id),
      value: (r) => supplierName(r.supplier_id),
    },
    { header: "Date", cell: (r) => dateFmt(r.po_date), value: (r) => r.po_date },
    { header: "Status", cell: (r) => <StatusBadge status={r.status} />, value: (r) => r.status },
    {
      header: "Total",
      cell: (r) => currency(r.total_amount),
      value: (r) => r.total_amount,
      className: "text-right",
    },
    ...(canModifyFinance
      ? [
          {
            header: "Actions",
            className: "text-right w-24",
            cell: (r: Po) => (
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setEditingPo(r)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  onClick={() => setDeletingPo(r)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  // Receipt Columns
  const receiptColumns: Column<Receipt>[] = [
    { header: "GRN #", cell: (r) => r.receipt_number, value: (r) => r.receipt_number },
    {
      header: "Project",
      cell: (r) => projectName(r.project_id),
      value: (r) => projectName(r.project_id),
    },
    {
      header: "Supplier",
      cell: (r) => supplierName(r.supplier_id),
      value: (r) => supplierName(r.supplier_id),
    },
    { header: "Date", cell: (r) => dateFmt(r.receipt_date), value: (r) => r.receipt_date },
    { header: "Remarks", cell: (r) => r.remarks ?? "—", value: (r) => r.remarks },
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
            cell: (r: Receipt) => (
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  onClick={() => setEditingReceipt(r)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  onClick={() => setDeletingReceipt(r)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  // Payment Columns
  const paymentColumns: Column<SupplierPayment>[] = [
    { header: "Date", cell: (r) => dateFmt(r.payment_date), value: (r) => r.payment_date },
    {
      header: "Project",
      cell: (r) => projectName(r.project_id),
      value: (r) => projectName(r.project_id),
    },
    {
      header: "Supplier",
      cell: (r) => supplierName(r.supplier_id),
      value: (r) => supplierName(r.supplier_id),
    },
    {
      header: "Against PO",
      cell: (r) => (r.po_id ? (pos.data?.find((p) => p.id === r.po_id)?.po_number ?? "—") : "—"),
      value: (r) => r.po_id,
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
            cell: (r: SupplierPayment) => (
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

  // Field specs
  const requestFields: Field[] = [
    { name: "request_number", label: "Indent number", required: true },
    {
      name: "project_id",
      label: "Project",
      type: "select",
      required: true,
      options: projectOptions,
    },
    { name: "request_date", label: "Request date", type: "date", required: true },
    { name: "required_date", label: "Required by", type: "date" },
    { name: "material_name", label: "Material name (optional)" },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: ["draft", "submitted", "verified", "approved", "rejected", "closed"].map((s) => ({
        value: s,
        label: s,
      })),
    },
    { name: "total_amount", label: "Estimated value (₹)", type: "number" },
    { name: "remarks", label: "Remarks", type: "textarea" },
  ];

  const paymentFields: Field[] = [
    { name: "payment_date", label: "Payment date", type: "date", required: true },
    {
      name: "project_id",
      label: "Project",
      type: "select",
      required: true,
      options: projectOptions,
    },
    { name: "supplier_id", label: "Supplier", type: "select", required: true, options: supplierOptions },
    {
      name: "po_id",
      label: "Against PO (optional)",
      type: "select",
      options: (pos.data ?? []).map((p) => ({ value: p.id, label: p.po_number })),
    },
    {
      name: "payment_method",
      label: "Method",
      type: "select",
      options: ["bank", "cash", "upi", "cheque"].map((m) => ({ value: m, label: m })),
    },
    { name: "amount", label: "Amount (₹)", type: "number", required: true },
    { name: "reference_number", label: "Reference number" },
    { name: "remarks", label: "Remarks", type: "textarea" },
  ];

  const poFields: Field[] = [
    { name: "po_number", label: "PO number", required: true },
    {
      name: "project_id",
      label: "Project",
      type: "select",
      required: true,
      options: projectOptions,
    },
    { name: "supplier_id", label: "Supplier", type: "select", options: supplierOptions },
    {
      name: "request_id",
      label: "Against indent",
      type: "select",
      options: (requests.data ?? []).map((r) => ({ value: r.id, label: r.request_number })),
    },
    { name: "po_date", label: "PO date", type: "date", required: true },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: ["draft", "approved", "ordered", "partially_received", "received", "closed"].map(
        (s) => ({
          value: s,
          label: s.replace(/_/g, " "),
        }),
      ),
    },
    { name: "subtotal", label: "Subtotal (₹)", type: "number", required: true },
    { name: "tax_percent", label: "Tax %", type: "number" },
    { name: "terms", label: "Terms", type: "textarea" },
  ];

  const receiptFields: Field[] = [
    { name: "receipt_number", label: "GRN number", required: true },
    {
      name: "project_id",
      label: "Project",
      type: "select",
      required: true,
      options: projectOptions,
    },
    { name: "supplier_id", label: "Supplier", type: "select", options: supplierOptions },
    {
      name: "po_id",
      label: "Against PO",
      type: "select",
      options: (pos.data ?? []).map((p) => ({ value: p.id, label: p.po_number })),
    },
    { name: "receipt_date", label: "Receipt date", type: "date", required: true },
    { name: "total_amount", label: "Received value (₹)", type: "number" },
    { name: "remarks", label: "Remarks", type: "textarea" },
  ];

  return (
    <div>
      <PageHeader
        title="Materials"
        description="Indent → purchase order → site receipt, with approval status."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Open indents"
          value={String((requests.data ?? []).filter((r) => r.status !== "closed").length)}
        />
        <StatCard
          label="PO value"
          value={currency(sum(pos.data ?? [], (r) => r.total_amount))}
          tone="warning"
        />
        <StatCard
          label="Received value"
          value={currency(sum(receipts.data ?? [], (r) => r.total_amount))}
          tone="success"
        />
        <StatCard
          label="Paid to suppliers"
          value={currency(sum(payments.data ?? [], (r) => r.amount))}
        />
      </div>

      <Tabs defaultValue="requests">
        <TabsList className="no-print">
          <TabsTrigger value="requests">Indents</TabsTrigger>
          <TabsTrigger value="pos">Purchase orders</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>


        {/* ================= INDENTS ================= */}
        <TabsContent value="requests" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {canModifySite && (
              <FormDialog
                title="Raise material indent"
                description="Request materials for a project site."
                trigger={
                  <Button>
                    <Plus className="mr-2 size-4" /> New indent
                  </Button>
                }
                submitting={saveRequest.isPending}
                initial={{
                  request_number: docNumber("MR"),
                  request_date: today(),
                  status: "draft",
                  total_amount: 0,
                  material_name: "",
                }}
                fields={requestFields}
                onSubmit={async (values) => {
                  await saveRequest.mutateAsync({
                    values: {
                      ...values,
                      required_date: values["required_date"] || null,
                      material_name: values["material_name"] || null,
                      total_amount: Number(values["total_amount"] ?? 0),
                    },
                  });
                }}
              />
            )}

            {/* Indent Project Filter */}
            <div className="no-print flex items-center gap-2">
              <div>
                <Select value={reqProjectFilter} onValueChange={setReqProjectFilter}>
                  <SelectTrigger className="w-44 h-8 text-xs">
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
              {reqProjectFilter !== "all" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setReqProjectFilter("all")}
                  className="h-8 px-2 text-xs"
                >
                  <RotateCcw className="mr-1 size-3" /> Reset
                </Button>
              )}
            </div>
          </div>

          {editingRequest && (
            <FormDialog
              open={!!editingRequest}
              onOpenChange={(v) => !v && setEditingRequest(null)}
              title="Edit material indent"
              fields={requestFields}
              submitting={saveRequest.isPending}
              initial={{
                request_number: editingRequest.request_number,
                project_id: editingRequest.project_id,
                request_date: editingRequest.request_date,
                required_date: editingRequest.required_date ?? "",
                status: editingRequest.status,
                total_amount: editingRequest.total_amount,
                material_name: editingRequest.material_name ?? "",
                remarks: editingRequest.remarks ?? "",
              }}
              onSubmit={async (values) => {
                await saveRequest.mutateAsync({
                  id: editingRequest.id,
                  values: {
                    ...values,
                    required_date: values["required_date"] || null,
                    material_name: values["material_name"] || null,
                    total_amount: Number(values["total_amount"] ?? 0),
                  },
                });
                setEditingRequest(null);
              }}
            />
          )}

          {deletingRequest && (
            <ConfirmDeleteDialog
              open={!!deletingRequest}
              onOpenChange={(v) => !v && setDeletingRequest(null)}
              title="Delete indent"
              description={`Are you sure you want to delete indent "${deletingRequest.request_number}"? This action cannot be undone.`}
              onConfirm={async () => {
                await deleteRequest.mutateAsync(deletingRequest.id);
                setDeletingRequest(null);
              }}
            />
          )}

          <DataTable
            rows={filteredRequests}
            columns={requestColumns}
            loading={requests.isLoading}
            exportName="brickweld-material-indents"
            exportTitle="Material Indents Report"
            exportDescription="Construction Project Control System — Material Indents Report"
            appliedFilters={
              reqProjectFilter !== "all" ? { Project: projectName(reqProjectFilter) } : undefined
            }
          />
        </TabsContent>

        {/* ================= PURCHASE ORDERS ================= */}
        <TabsContent value="pos" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {canModifyFinance && (
              <FormDialog
                title="Create purchase order"
                description="Issue a purchase order to a supplier."
                trigger={
                  <Button>
                    <Plus className="mr-2 size-4" /> New PO
                  </Button>
                }
                submitting={savePo.isPending}
                initial={{
                  po_number: docNumber("PO"),
                  po_date: today(),
                  status: "draft",
                  subtotal: 0,
                  tax_percent: 18,
                }}
                fields={poFields}
                onSubmit={async (values) => {
                  const subtotal = Number(values["subtotal"] ?? 0);
                  const taxPercent = Number(values["tax_percent"] ?? 0);
                  const taxAmount = Math.round((subtotal * taxPercent) / 100);
                  await savePo.mutateAsync({
                    values: {
                      ...values,
                      supplier_id: values["supplier_id"] || null,
                      request_id: values["request_id"] || null,
                      subtotal,
                      tax_percent: taxPercent,
                      tax_amount: taxAmount,
                      total_amount: subtotal + taxAmount,
                    },
                  });
                }}
              />
            )}

            {/* PO Project Filter */}
            <div className="no-print flex items-center gap-2">
              <div>
                <Select value={poProjectFilter} onValueChange={setPoProjectFilter}>
                  <SelectTrigger className="w-44 h-8 text-xs">
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
              {poProjectFilter !== "all" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPoProjectFilter("all")}
                  className="h-8 px-2 text-xs"
                >
                  <RotateCcw className="mr-1 size-3" /> Reset
                </Button>
              )}
            </div>
          </div>

          {editingPo && (
            <FormDialog
              open={!!editingPo}
              onOpenChange={(v) => !v && setEditingPo(null)}
              title="Edit purchase order"
              fields={poFields}
              submitting={savePo.isPending}
              initial={{
                po_number: editingPo.po_number,
                project_id: editingPo.project_id,
                supplier_id: editingPo.supplier_id ?? "",
                request_id: editingPo.request_id ?? "",
                po_date: editingPo.po_date,
                status: editingPo.status,
                subtotal: editingPo.subtotal,
                tax_percent: editingPo.tax_percent,
                terms: editingPo.terms ?? "",
              }}
              onSubmit={async (values) => {
                const subtotal = Number(values["subtotal"] ?? 0);
                const taxPercent = Number(values["tax_percent"] ?? 0);
                const taxAmount = Math.round((subtotal * taxPercent) / 100);
                await savePo.mutateAsync({
                  id: editingPo.id,
                  values: {
                    ...values,
                    supplier_id: values["supplier_id"] || null,
                    request_id: values["request_id"] || null,
                    subtotal,
                    tax_percent: taxPercent,
                    tax_amount: taxAmount,
                    total_amount: subtotal + taxAmount,
                  },
                });
                setEditingPo(null);
              }}
            />
          )}

          {deletingPo && (
            <ConfirmDeleteDialog
              open={!!deletingPo}
              onOpenChange={(v) => !v && setDeletingPo(null)}
              title="Delete purchase order"
              description={`Are you sure you want to delete PO "${deletingPo.po_number}"? This action cannot be undone.`}
              onConfirm={async () => {
                await deletePo.mutateAsync(deletingPo.id);
                setDeletingPo(null);
              }}
            />
          )}

          <DataTable
            rows={filteredPos}
            columns={poColumns}
            loading={pos.isLoading}
            exportName="brickweld-purchase-orders"
            exportTitle="Purchase Orders Report"
            exportDescription="Construction Project Control System — Purchase Orders Report"
            appliedFilters={
              poProjectFilter !== "all" ? { Project: projectName(poProjectFilter) } : undefined
            }
          />
        </TabsContent>

        {/* ================= RECEIPTS ================= */}
        <TabsContent value="receipts" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {canModifySite && (
              <FormDialog
                title="Record material receipt"
                description="Log materials received at site against a purchase order."
                trigger={
                  <Button>
                    <Plus className="mr-2 size-4" /> New receipt
                  </Button>
                }
                submitting={saveReceipt.isPending}
                initial={{
                  receipt_number: docNumber("GRN"),
                  receipt_date: today(),
                  total_amount: 0,
                }}
                fields={receiptFields}
                onSubmit={async (values) => {
                  await saveReceipt.mutateAsync({
                    values: {
                      ...values,
                      supplier_id: values["supplier_id"] || null,
                      po_id: values["po_id"] || null,
                      total_amount: Number(values["total_amount"] ?? 0),
                    },
                  });
                }}
              />
            )}

            {/* GRN Project Filter */}
            <div className="no-print flex items-center gap-2">
              <div>
                <Select value={grnProjectFilter} onValueChange={setGrnProjectFilter}>
                  <SelectTrigger className="w-44 h-8 text-xs">
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
              {grnProjectFilter !== "all" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setGrnProjectFilter("all")}
                  className="h-8 px-2 text-xs"
                >
                  <RotateCcw className="mr-1 size-3" /> Reset
                </Button>
              )}
            </div>
          </div>

          {editingReceipt && (
            <FormDialog
              open={!!editingReceipt}
              onOpenChange={(v) => !v && setEditingReceipt(null)}
              title="Edit material receipt"
              fields={receiptFields}
              submitting={saveReceipt.isPending}
              initial={{
                receipt_number: editingReceipt.receipt_number,
                project_id: editingReceipt.project_id,
                supplier_id: editingReceipt.supplier_id ?? "",
                po_id: editingReceipt.po_id ?? "",
                receipt_date: editingReceipt.receipt_date,
                total_amount: editingReceipt.total_amount,
                remarks: editingReceipt.remarks ?? "",
              }}
              onSubmit={async (values) => {
                await saveReceipt.mutateAsync({
                  id: editingReceipt.id,
                  values: {
                    ...values,
                    supplier_id: values["supplier_id"] || null,
                    po_id: values["po_id"] || null,
                    total_amount: Number(values["total_amount"] ?? 0),
                  },
                });
                setEditingReceipt(null);
              }}
            />
          )}

          {deletingReceipt && (
            <ConfirmDeleteDialog
              open={!!deletingReceipt}
              onOpenChange={(v) => !v && setDeletingReceipt(null)}
              title="Delete receipt"
              description={`Are you sure you want to delete GRN "${deletingReceipt.receipt_number}"? This action cannot be undone.`}
              onConfirm={async () => {
                await deleteReceipt.mutateAsync(deletingReceipt.id);
                setDeletingReceipt(null);
              }}
            />
          )}

          <DataTable
            rows={filteredReceipts}
            columns={receiptColumns}
            loading={receipts.isLoading}
            exportName="brickweld-material-receipts"
            exportTitle="Material Receipts Report"
            exportDescription="Construction Project Control System — Material Receipts Report"
            appliedFilters={
              grnProjectFilter !== "all" ? { Project: projectName(grnProjectFilter) } : undefined
            }
          />
        </TabsContent>

        {/* ================= SUPPLIER PAYMENTS ================= */}
        <TabsContent value="payments" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {canModifyFinance && (
              <FormDialog
                title="Record supplier payment"
                description="Log a payment made to a supplier."
                trigger={
                  <Button>
                    <Plus className="mr-2 size-4" /> New payment
                  </Button>
                }
                submitting={savePayment.isPending}
                initial={{ payment_date: today(), payment_method: "bank", amount: 0 }}
                fields={paymentFields}
                onSubmit={async (values) => {
                  await savePayment.mutateAsync({
                    values: {
                      ...values,
                      po_id: values["po_id"] || null,
                      amount: Number(values["amount"] ?? 0),
                    },
                  });
                }}
              />
            )}

            {/* Payment Filters */}
            <div className="no-print flex items-center gap-2">
              <div>
                <Select value={payProjectFilter} onValueChange={setPayProjectFilter}>
                  <SelectTrigger className="w-44 h-8 text-xs">
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
                <Select value={paySupplierFilter} onValueChange={setPaySupplierFilter}>
                  <SelectTrigger className="w-40 h-8 text-xs">
                    <SelectValue placeholder="All Suppliers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Suppliers</SelectItem>
                    {supplierOptions.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(payProjectFilter !== "all" || paySupplierFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setPayProjectFilter("all");
                    setPaySupplierFilter("all");
                  }}
                  className="h-8 px-2 text-xs"
                >
                  <RotateCcw className="mr-1 size-3" /> Reset
                </Button>
              )}
            </div>
          </div>

          {editingPayment && (
            <FormDialog
              open={!!editingPayment}
              onOpenChange={(v) => !v && setEditingPayment(null)}
              title="Edit supplier payment"
              fields={paymentFields}
              submitting={savePayment.isPending}
              initial={{
                payment_date: editingPayment.payment_date,
                project_id: editingPayment.project_id,
                supplier_id: editingPayment.supplier_id,
                po_id: editingPayment.po_id ?? "",
                payment_method: editingPayment.payment_method ?? "bank",
                amount: editingPayment.amount,
                reference_number: editingPayment.reference_number ?? "",
                remarks: editingPayment.remarks ?? "",
              }}
              onSubmit={async (values) => {
                await savePayment.mutateAsync({
                  id: editingPayment.id,
                  values: {
                    ...values,
                    po_id: values["po_id"] || null,
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
              description={`Are you sure you want to delete this payment of ${currency(deletingPayment.amount)}? This action cannot be undone.`}
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
            exportName="brickweld-supplier-payments"
            exportTitle="Supplier Payments Report"
            exportDescription="Construction Project Control System — Supplier Payments Report"
            appliedFilters={{
              ...(payProjectFilter !== "all" ? { Project: projectName(payProjectFilter) } : {}),
              ...(paySupplierFilter !== "all"
                ? { Supplier: supplierName(paySupplierFilter) }
                : {}),
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
