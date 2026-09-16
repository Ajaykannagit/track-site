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
      { title: "Materials — Brickweld" },
      {
        name: "description",
        content:
          "Material indents, purchase orders and site receipts with approval status for each project.",
      },
      { property: "og:title", content: "Materials — Brickweld" },
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

  // Filters
  const [reqProjectFilter, setReqProjectFilter] = useState<string>("all");
  const [poProjectFilter, setPoProjectFilter] = useState<string>("all");
  const [grnProjectFilter, setGrnProjectFilter] = useState<string>("all");

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

  const saveRequest = useSaveRow("material_requests", "Material request");
  const deleteRequest = useDeleteRow("material_requests", "Material request");

  const savePo = useSaveRow("purchase_orders", "Purchase order");
  const deletePo = useDeleteRow("purchase_orders", "Purchase order");

  const saveReceipt = useSaveRow("material_receipts", "Material receipt");
  const deleteReceipt = useDeleteRow("material_receipts", "Material receipt");

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

  // Request Columns
  const requestColumns: Column<Request>[] = [
    { header: "Indent #", cell: (r) => r.request_number, value: (r) => r.request_number },
    {
      header: "Project",
      cell: (r) => projectName(r.project_id),
      value: (r) => projectName(r.project_id),
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

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
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
      </div>

      <Tabs defaultValue="requests">
        <TabsList className="no-print">
          <TabsTrigger value="requests">Indents</TabsTrigger>
          <TabsTrigger value="pos">Purchase orders</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
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
                }}
                fields={requestFields}
                onSubmit={async (values) => {
                  await saveRequest.mutateAsync({
                    values: {
                      ...values,
                      required_date: values["required_date"] || null,
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
                remarks: editingRequest.remarks ?? "",
              }}
              onSubmit={async (values) => {
                await saveRequest.mutateAsync({
                  id: editingRequest.id,
                  values: {
                    ...values,
                    required_date: values["required_date"] || null,
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
      </Tabs>
    </div>
  );
}
