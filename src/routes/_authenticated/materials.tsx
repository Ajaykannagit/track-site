import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { History, ListPlus, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
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
import { ChangeHistoryDialog } from "@/components/ChangeHistoryDialog";
import { IndentItemsSheet } from "@/components/IndentItemsSheet";
import { PoItemsSheet } from "@/components/PoItemsSheet";
import { ReceiptItemsSheet } from "@/components/ReceiptItemsSheet";
import { MultiMaterialIndentDialog } from "@/components/MultiMaterialIndentDialog";
import { MultiMaterialPoDialog } from "@/components/MultiMaterialPoDialog";
import { MultiMaterialReceiptDialog } from "@/components/MultiMaterialReceiptDialog";

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

function MaterialsPage() {
  const { canWriteSite, canWriteFinance, isMD } = useAuth();

  // Viewing Line Items
  const [viewingRequest, setViewingRequest] = useState<Request | null>(null);
  const [viewingPo, setViewingPo] = useState<Po | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<Receipt | null>(null);

  // Multi-material Dialog States
  const [newIndentOpen, setNewIndentOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<Request | null>(null);
  const [deletingRequest, setDeletingRequest] = useState<Request | null>(null);

  const [newPoOpen, setNewPoOpen] = useState(false);
  const [editingPo, setEditingPo] = useState<Po | null>(null);
  const [deletingPo, setDeletingPo] = useState<Po | null>(null);

  const [newReceiptOpen, setNewReceiptOpen] = useState(false);
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

  const deleteRequest = useDeleteRow("material_requests", "Material request");
  const deletePo = useDeleteRow("purchase_orders", "Purchase order");
  const deleteReceipt = useDeleteRow("material_receipts", "Material receipt");
  const savePayment = useSaveRow("supplier_payments", "Supplier payment");
  const deletePayment = useDeleteRow("supplier_payments", "Supplier payment");

  const projectName = (id: string | null) => projects.data?.find((p) => p.id === id)?.name ?? "—";
  const supplierName = (id: string | null) => suppliers.data?.find((s) => s.id === id)?.name ?? "—";
  const projectOptions = (projects.data ?? []).map((p) => ({ value: p.id, label: p.name }));
  const supplierOptions = (suppliers.data ?? []).map((s) => ({ value: s.id, label: s.name }));
  const indentOptions = (requests.data ?? []).map((r) => ({
    value: r.id,
    label: `${r.request_number} — ${projectName(r.project_id)} (${currency(r.total_amount)})`,
  }));
  const poOptions = (pos.data ?? []).map((p) => ({
    value: p.id,
    label: `${p.po_number} — ${supplierName(p.supplier_id)} (${currency(p.total_amount)})`,
  }));

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
      header: "Material / Items",
      cell: (r) => (
        <div className="flex items-center gap-1.5">
          <span className="font-medium">{r.material_name || "Multiple items"}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-[11px] text-primary hover:bg-primary/10"
            title="Inspect line items"
            onClick={() => setViewingRequest(r)}
          >
            <ListPlus className="mr-1 size-3" /> Items
          </Button>
        </div>
      ),
      value: (r) => r.material_name,
    },
    { header: "Raised", cell: (r) => dateFmt(r.request_date), value: (r) => r.request_date },
    { header: "Required", cell: (r) => dateFmt(r.required_date), value: (r) => r.required_date },
    { header: "Status", cell: (r) => <StatusBadge status={r.status} />, value: (r) => r.status },
    {
      header: "Estimated Value",
      cell: (r) => currency(r.total_amount),
      value: (r) => r.total_amount,
      className: "text-right",
    },
    ...(canModifySite
      ? [
          {
            header: "Actions",
            className: "text-right w-36",
            cell: (r: Request) => (
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-primary hover:text-primary"
                  title="View line items"
                  onClick={() => setViewingRequest(r)}
                >
                  <ListPlus className="size-3.5" />
                </Button>
                <ChangeHistoryDialog
                  tableName="material_requests"
                  recordId={r.id}
                  title={`Indent Audit History — ${r.request_number}`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  title="Edit indent"
                  onClick={() => setEditingRequest(r)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  title="Delete indent"
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
      header: "Items",
      cell: (r) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-[11px] text-primary hover:bg-primary/10"
          title="Inspect PO items"
          onClick={() => setViewingPo(r)}
        >
          <ListPlus className="mr-1 size-3" /> View Items
        </Button>
      ),
      value: (r) => r.po_number,
    },
    {
      header: "Total Value",
      cell: (r) => currency(r.total_amount),
      value: (r) => r.total_amount,
      className: "text-right",
    },
    ...(canModifyFinance
      ? [
          {
            header: "Actions",
            className: "text-right w-28",
            cell: (r: Po) => (
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-primary hover:text-primary"
                  title="View line items"
                  onClick={() => setViewingPo(r)}
                >
                  <ListPlus className="size-3.5" />
                </Button>
                <ChangeHistoryDialog
                  tableName="purchase_orders"
                  recordId={r.id}
                  title={`PO Audit History — ${r.po_number}`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  title="Edit PO"
                  onClick={() => setEditingPo(r)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  title="Delete PO"
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
    {
      header: "Items",
      cell: (r) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-[11px] text-primary hover:bg-primary/10"
          title="Inspect received items"
          onClick={() => setViewingReceipt(r)}
        >
          <ListPlus className="mr-1 size-3" /> View Items
        </Button>
      ),
      value: (r) => r.receipt_number,
    },
    { header: "Remarks", cell: (r) => r.remarks ?? "—", value: (r) => r.remarks },
    {
      header: "Received Value",
      cell: (r) => currency(r.total_amount),
      value: (r) => r.total_amount,
      className: "text-right",
    },
    ...(canModifySite
      ? [
          {
            header: "Actions",
            className: "text-right w-28",
            cell: (r: Receipt) => (
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-primary hover:text-primary"
                  title="View line items"
                  onClick={() => setViewingReceipt(r)}
                >
                  <ListPlus className="size-3.5" />
                </Button>
                <ChangeHistoryDialog
                  tableName="material_receipts"
                  recordId={r.id}
                  title={`GRN Audit History — ${r.receipt_number}`}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  title="Edit GRN"
                  onClick={() => setEditingReceipt(r)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-destructive hover:text-destructive"
                  title="Delete GRN"
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
      header: "Amount Paid",
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
                <ChangeHistoryDialog
                  tableName="supplier_payments"
                  recordId={r.id}
                  title={`Payment Audit History — ${currency(r.amount)}`}
                />
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
      options: (pos.data ?? []).map((p) => ({ value: p.id, label: `${p.po_number} (${currency(p.total_amount)})` })),
    },
    {
      name: "payment_method",
      label: "Method",
      type: "select",
      options: ["bank", "cash", "upi", "cheque", "neft", "rtgs"].map((m) => ({ value: m, label: m.toUpperCase() })),
    },
    { name: "amount", label: "Amount (₹)", type: "number", required: true },
    { name: "reference_number", label: "Reference number / UTR" },
    { name: "remarks", label: "Remarks", type: "textarea" },
  ];

  return (
    <div>
      <PageHeader
        title="Materials"
        description="Multi-material workflow: Indent → Purchase Order → Site Receipt → Supplier Payment."
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
          <TabsTrigger value="receipts">Receipts (GRN)</TabsTrigger>
          <TabsTrigger value="payments">Supplier Payments</TabsTrigger>
        </TabsList>

        {/* ================= INDENTS ================= */}
        <TabsContent value="requests" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {canModifySite && (
              <Button onClick={() => setNewIndentOpen(true)}>
                <Plus className="mr-2 size-4" /> New Indent (+ Add More Material)
              </Button>
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

          {/* New Indent Dialog with multiple materials */}
          <MultiMaterialIndentDialog
            open={newIndentOpen}
            onOpenChange={setNewIndentOpen}
            projectOptions={projectOptions}
            onSuccess={() => requests.refetch()}
          />

          {/* Edit Indent Dialog */}
          {editingRequest && (
            <MultiMaterialIndentDialog
              open={!!editingRequest}
              onOpenChange={(v) => !v && setEditingRequest(null)}
              projectOptions={projectOptions}
              editingIndent={editingRequest}
              onSuccess={() => {
                setEditingRequest(null);
                requests.refetch();
              }}
            />
          )}

          {deletingRequest && (
            <ConfirmDeleteDialog
              open={!!deletingRequest}
              onOpenChange={(v) => !v && setDeletingRequest(null)}
              tableName="material_requests"
              recordId={deletingRequest.id}
              recordTitle={`Indent ${deletingRequest.request_number}`}
              recordData={deletingRequest}
              title="Delete Indent"
              description={`Delete indent "${deletingRequest.request_number}" (${currency(deletingRequest.total_amount)})? This action requires MD approval.`}
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
              <Button onClick={() => setNewPoOpen(true)}>
                <Plus className="mr-2 size-4" /> New Purchase Order (+ Add More Material)
              </Button>
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

          {/* New PO Dialog with multiple materials */}
          <MultiMaterialPoDialog
            open={newPoOpen}
            onOpenChange={setNewPoOpen}
            projectOptions={projectOptions}
            supplierOptions={supplierOptions}
            indentOptions={indentOptions}
            onSuccess={() => pos.refetch()}
          />

          {/* Edit PO Dialog */}
          {editingPo && (
            <MultiMaterialPoDialog
              open={!!editingPo}
              onOpenChange={(v) => !v && setEditingPo(null)}
              projectOptions={projectOptions}
              supplierOptions={supplierOptions}
              indentOptions={indentOptions}
              editingPo={editingPo}
              onSuccess={() => {
                setEditingPo(null);
                pos.refetch();
              }}
            />
          )}

          {deletingPo && (
            <ConfirmDeleteDialog
              open={!!deletingPo}
              onOpenChange={(v) => !v && setDeletingPo(null)}
              tableName="purchase_orders"
              recordId={deletingPo.id}
              recordTitle={`PO ${deletingPo.po_number}`}
              recordData={deletingPo}
              title="Delete Purchase Order"
              description={`Delete PO "${deletingPo.po_number}" (${currency(deletingPo.total_amount)})? This action requires MD approval.`}
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

        {/* ================= RECEIPTS (GRN) ================= */}
        <TabsContent value="receipts" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {canModifySite && (
              <Button onClick={() => setNewReceiptOpen(true)}>
                <Plus className="mr-2 size-4" /> New Receipt / GRN (+ Add More Material)
              </Button>
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

          {/* New Receipt Dialog with multiple materials */}
          <MultiMaterialReceiptDialog
            open={newReceiptOpen}
            onOpenChange={setNewReceiptOpen}
            projectOptions={projectOptions}
            supplierOptions={supplierOptions}
            poOptions={poOptions}
            onSuccess={() => receipts.refetch()}
          />

          {/* Edit Receipt Dialog */}
          {editingReceipt && (
            <MultiMaterialReceiptDialog
              open={!!editingReceipt}
              onOpenChange={(v) => !v && setEditingReceipt(null)}
              projectOptions={projectOptions}
              supplierOptions={supplierOptions}
              poOptions={poOptions}
              editingReceipt={editingReceipt}
              onSuccess={() => {
                setEditingReceipt(null);
                receipts.refetch();
              }}
            />
          )}

          {deletingReceipt && (
            <ConfirmDeleteDialog
              open={!!deletingReceipt}
              onOpenChange={(v) => !v && setDeletingReceipt(null)}
              tableName="material_receipts"
              recordId={deletingReceipt.id}
              recordTitle={`GRN ${deletingReceipt.receipt_number}`}
              recordData={deletingReceipt}
              title="Delete Material Receipt"
              description={`Delete GRN "${deletingReceipt.receipt_number}" (${currency(deletingReceipt.total_amount)})? This action requires MD approval.`}
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
                description="Log a payment made to a supplier against a Purchase Order or invoice."
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
              fields={[
                ...paymentFields,
                { name: "edit_reason", label: "Reason for edit *", type: "text", required: true },
              ]}
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
                edit_reason: "",
              }}
              onSubmit={async (values) => {
                const reason = String(values["edit_reason"] || "Payment updated");
                await logRecordFieldDiffs(
                  "supplier_payments",
                  editingPayment.id,
                  "materials",
                  editingPayment as Record<string, unknown>,
                  {
                    amount: Number(values["amount"] ?? 0),
                    payment_method: values["payment_method"],
                    reference_number: values["reference_number"] || null,
                  },
                  ["amount", "payment_method", "reference_number"],
                  reason,
                  "corrected"
                );
                const saveVals = {
                  ...values,
                  po_id: values["po_id"] || null,
                  amount: Number(values["amount"] ?? 0),
                };
                delete (saveVals as any)["edit_reason"];
                await savePayment.mutateAsync({
                  id: editingPayment.id,
                  values: saveVals,
                });
                setEditingPayment(null);
              }}
            />
          )}

          {deletingPayment && (
            <ConfirmDeleteDialog
              open={!!deletingPayment}
              onOpenChange={(v) => !v && setDeletingPayment(null)}
              tableName="supplier_payments"
              recordId={deletingPayment.id}
              recordTitle={`Payment of ${currency(deletingPayment.amount)}`}
              recordData={deletingPayment}
              title="Delete Supplier Payment"
              description={`Delete payment of ${currency(deletingPayment.amount)}? This action requires MD approval.`}
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

      {/* Line item inspection sheets */}
      <IndentItemsSheet
        indent={viewingRequest}
        canEdit={canModifySite}
        onClose={() => setViewingRequest(null)}
      />

      <PoItemsSheet
        po={viewingPo}
        onClose={() => setViewingPo(null)}
      />

      <ReceiptItemsSheet
        receipt={viewingReceipt}
        onClose={() => setViewingReceipt(null)}
      />
    </div>
  );
}
