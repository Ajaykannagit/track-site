import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { DataTable, StatCard, type Column } from "@/components/DataTable";
import { FormDialog } from "@/components/FormDialog";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { useRows, useSaveRow, sum } from "@/lib/db";
import { currency, dateFmt, today } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/materials")({
  head: () => ({
    meta: [
      { title: "Materials — Brickweld" },
      {
        name: "description",
        content: "Material indents, purchase orders and site receipts with approval status for each project.",
      },
      { property: "og:title", content: "Materials — Brickweld" },
      { property: "og:description", content: "Indent to purchase order to goods receipt, tracked per site." },
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
  po_date: string;
  status: string;
  subtotal: number;
  tax_percent: number;
  tax_amount: number;
  total_amount: number;
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
  const { canWriteSite, canWriteFinance } = useAuth();

  const projects = useRows<{ id: string; name: string }>("projects", { select: "id,name" });
  const suppliers = useRows<{ id: string; name: string }>("suppliers", { select: "id,name" });

  const requests = useRows<Request>("material_requests", { order: { col: "request_date" }, limit: 300 });
  const pos = useRows<Po>("purchase_orders", { order: { col: "po_date" }, limit: 300 });
  const receipts = useRows<Receipt>("material_receipts", { order: { col: "receipt_date" }, limit: 300 });

  const saveRequest = useSaveRow("material_requests", "Material request");
  const savePo = useSaveRow("purchase_orders", "Purchase order");
  const saveReceipt = useSaveRow("material_receipts", "Material receipt");

  const projectName = (id: string | null) => projects.data?.find((p) => p.id === id)?.name ?? "—";
  const supplierName = (id: string | null) => suppliers.data?.find((s) => s.id === id)?.name ?? "—";
  const projectOptions = (projects.data ?? []).map((p) => ({ value: p.id, label: p.name }));
  const supplierOptions = (suppliers.data ?? []).map((s) => ({ value: s.id, label: s.name }));

  const requestColumns: Column<Request>[] = [
    { header: "Indent #", cell: (r) => r.request_number, value: (r) => r.request_number },
    { header: "Project", cell: (r) => projectName(r.project_id), value: (r) => projectName(r.project_id) },
    { header: "Raised", cell: (r) => dateFmt(r.request_date), value: (r) => r.request_date },
    { header: "Required", cell: (r) => dateFmt(r.required_date), value: (r) => r.required_date },
    { header: "Status", cell: (r) => <StatusBadge status={r.status} />, value: (r) => r.status },
    { header: "Value", cell: (r) => currency(r.total_amount), value: (r) => r.total_amount, className: "text-right" },
  ];

  const poColumns: Column<Po>[] = [
    { header: "PO #", cell: (r) => r.po_number, value: (r) => r.po_number },
    { header: "Project", cell: (r) => projectName(r.project_id), value: (r) => projectName(r.project_id) },
    { header: "Supplier", cell: (r) => supplierName(r.supplier_id), value: (r) => supplierName(r.supplier_id) },
    { header: "Date", cell: (r) => dateFmt(r.po_date), value: (r) => r.po_date },
    { header: "Status", cell: (r) => <StatusBadge status={r.status} />, value: (r) => r.status },
    { header: "Total", cell: (r) => currency(r.total_amount), value: (r) => r.total_amount, className: "text-right" },
  ];

  const receiptColumns: Column<Receipt>[] = [
    { header: "GRN #", cell: (r) => r.receipt_number, value: (r) => r.receipt_number },
    { header: "Project", cell: (r) => projectName(r.project_id), value: (r) => projectName(r.project_id) },
    { header: "Supplier", cell: (r) => supplierName(r.supplier_id), value: (r) => supplierName(r.supplier_id) },
    { header: "Date", cell: (r) => dateFmt(r.receipt_date), value: (r) => r.receipt_date },
    { header: "Remarks", cell: (r) => r.remarks ?? "—", value: (r) => r.remarks },
    { header: "Value", cell: (r) => currency(r.total_amount), value: (r) => r.total_amount, className: "text-right" },
  ];

  const reqRows = requests.data ?? [];
  const poRows = pos.data ?? [];
  const grnRows = receipts.data ?? [];

  return (
    <div>
      <PageHeader title="Materials" description="Indent → purchase order → site receipt, with approval status." />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="Open indents" value={String(reqRows.filter((r) => r.status !== "closed").length)} />
        <StatCard label="PO value" value={currency(sum(poRows, (r) => r.total_amount))} tone="warning" />
        <StatCard label="Received value" value={currency(sum(grnRows, (r) => r.total_amount))} tone="success" />
      </div>

      <Tabs defaultValue="requests">
        <TabsList className="no-print">
          <TabsTrigger value="requests">Indents</TabsTrigger>
          <TabsTrigger value="pos">Purchase orders</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-4 space-y-3">
          {canWriteSite ? (
            <FormDialog
              title="Raise material indent"
              description="Request materials for a project site."
              trigger={
                <Button>
                  <Plus className="mr-2 size-4" /> New indent
                </Button>
              }
              submitting={saveRequest.isPending}
              initial={{ request_number: docNumber("MR"), request_date: today(), status: "draft", total_amount: 0 }}
              fields={[
                { name: "request_number", label: "Indent number", required: true },
                { name: "project_id", label: "Project", type: "select", required: true, options: projectOptions },
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
              ]}
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
          ) : null}
          <DataTable rows={reqRows} columns={requestColumns} loading={requests.isLoading} exportName="material-indents" />
        </TabsContent>

        <TabsContent value="pos" className="mt-4 space-y-3">
          {canWriteFinance ? (
            <FormDialog
              title="Create purchase order"
              description="Issue a purchase order to a supplier."
              trigger={
                <Button>
                  <Plus className="mr-2 size-4" /> New PO
                </Button>
              }
              submitting={savePo.isPending}
              initial={{ po_number: docNumber("PO"), po_date: today(), status: "draft", subtotal: 0, tax_percent: 18 }}
              fields={[
                { name: "po_number", label: "PO number", required: true },
                { name: "project_id", label: "Project", type: "select", required: true, options: projectOptions },
                { name: "supplier_id", label: "Supplier", type: "select", options: supplierOptions },
                {
                  name: "request_id",
                  label: "Against indent",
                  type: "select",
                  options: reqRows.map((r) => ({ value: r.id, label: r.request_number })),
                },
                { name: "po_date", label: "PO date", type: "date", required: true },
                {
                  name: "status",
                  label: "Status",
                  type: "select",
                  options: ["draft", "approved", "ordered", "partially_received", "received", "closed"].map((s) => ({
                    value: s,
                    label: s.replace(/_/g, " "),
                  })),
                },
                { name: "subtotal", label: "Subtotal (₹)", type: "number", required: true },
                { name: "tax_percent", label: "Tax %", type: "number" },
                { name: "terms", label: "Terms", type: "textarea" },
              ]}
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
          ) : null}
          <DataTable rows={poRows} columns={poColumns} loading={pos.isLoading} exportName="purchase-orders" />
        </TabsContent>

        <TabsContent value="receipts" className="mt-4 space-y-3">
          {canWriteSite ? (
            <FormDialog
              title="Record material receipt"
              description="Log materials received at site against a purchase order."
              trigger={
                <Button>
                  <Plus className="mr-2 size-4" /> New receipt
                </Button>
              }
              submitting={saveReceipt.isPending}
              initial={{ receipt_number: docNumber("GRN"), receipt_date: today(), total_amount: 0 }}
              fields={[
                { name: "receipt_number", label: "GRN number", required: true },
                { name: "project_id", label: "Project", type: "select", required: true, options: projectOptions },
                { name: "supplier_id", label: "Supplier", type: "select", options: supplierOptions },
                {
                  name: "po_id",
                  label: "Against PO",
                  type: "select",
                  options: poRows.map((p) => ({ value: p.id, label: p.po_number })),
                },
                { name: "receipt_date", label: "Receipt date", type: "date", required: true },
                { name: "total_amount", label: "Received value (₹)", type: "number" },
                { name: "remarks", label: "Remarks", type: "textarea" },
              ]}
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
          ) : null}
          <DataTable rows={grnRows} columns={receiptColumns} loading={receipts.isLoading} exportName="material-receipts" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
