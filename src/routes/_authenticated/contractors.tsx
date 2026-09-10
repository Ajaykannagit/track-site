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

export const Route = createFileRoute("/_authenticated/contractors")({
  head: () => ({
    meta: [
      { title: "Contractors — Brickweld" },
      {
        name: "description",
        content: "Work orders, measurement books, contractor bills and payments across all construction sites.",
      },
      { property: "og:title", content: "Contractors — Brickweld" },
      { property: "og:description", content: "Work order to measurement book to bill to payment, in one place." },
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
  status: string;
  work_description: string | null;
};

type Mb = {
  id: string;
  mb_number: string;
  project_id: string;
  contractor_id: string | null;
  mb_date: string;
  total_amount: number;
  status: string;
};

type Bill = {
  id: string;
  bill_number: string;
  project_id: string;
  contractor_id: string;
  bill_date: string;
  gross_amount: number;
  deductions: number;
  net_amount: number;
  status: string;
};

type Payment = {
  id: string;
  project_id: string;
  contractor_id: string;
  payment_date: string;
  amount: number;
  payment_method: string | null;
  reference_number: string | null;
};

const docNumber = (prefix: string) => `${prefix}-${Date.now().toString().slice(-8)}`;

function ContractorsPage() {
  const { canWriteSite, canWriteFinance } = useAuth();

  const projects = useRows<{ id: string; name: string }>("projects", { select: "id,name" });
  const contractors = useRows<{ id: string; name: string }>("contractors", { select: "id,name" });

  const wos = useRows<Wo>("work_orders", { order: { col: "wo_date" }, limit: 300 });
  const mbs = useRows<Mb>("measurement_books", { order: { col: "mb_date" }, limit: 300 });
  const bills = useRows<Bill>("contractor_bills", { order: { col: "bill_date" }, limit: 300 });
  const payments = useRows<Payment>("contractor_payments", { order: { col: "payment_date" }, limit: 300 });

  const saveWo = useSaveRow("work_orders", "Work order");
  const saveMb = useSaveRow("measurement_books", "Measurement book");
  const saveBill = useSaveRow("contractor_bills", "Contractor bill");
  const savePayment = useSaveRow("contractor_payments", "Payment");

  const projectName = (id: string | null) => projects.data?.find((p) => p.id === id)?.name ?? "—";
  const contractorName = (id: string | null) => contractors.data?.find((c) => c.id === id)?.name ?? "—";
  const projectOptions = (projects.data ?? []).map((p) => ({ value: p.id, label: p.name }));
  const contractorOptions = (contractors.data ?? []).map((c) => ({ value: c.id, label: c.name }));

  const woColumns: Column<Wo>[] = [
    { header: "WO #", cell: (r) => r.work_order_number, value: (r) => r.work_order_number },
    { header: "Project", cell: (r) => projectName(r.project_id), value: (r) => projectName(r.project_id) },
    { header: "Contractor", cell: (r) => contractorName(r.contractor_id), value: (r) => contractorName(r.contractor_id) },
    { header: "Date", cell: (r) => dateFmt(r.wo_date), value: (r) => r.wo_date },
    { header: "Status", cell: (r) => <StatusBadge status={r.status} />, value: (r) => r.status },
    { header: "Value", cell: (r) => currency(r.contract_amount), value: (r) => r.contract_amount, className: "text-right" },
  ];

  const mbColumns: Column<Mb>[] = [
    { header: "MB #", cell: (r) => r.mb_number, value: (r) => r.mb_number },
    { header: "Project", cell: (r) => projectName(r.project_id), value: (r) => projectName(r.project_id) },
    { header: "Contractor", cell: (r) => contractorName(r.contractor_id), value: (r) => contractorName(r.contractor_id) },
    { header: "Date", cell: (r) => dateFmt(r.mb_date), value: (r) => r.mb_date },
    { header: "Status", cell: (r) => <StatusBadge status={r.status} />, value: (r) => r.status },
    { header: "Value", cell: (r) => currency(r.total_amount), value: (r) => r.total_amount, className: "text-right" },
  ];

  const billColumns: Column<Bill>[] = [
    { header: "Bill #", cell: (r) => r.bill_number, value: (r) => r.bill_number },
    { header: "Project", cell: (r) => projectName(r.project_id), value: (r) => projectName(r.project_id) },
    { header: "Contractor", cell: (r) => contractorName(r.contractor_id), value: (r) => contractorName(r.contractor_id) },
    { header: "Date", cell: (r) => dateFmt(r.bill_date), value: (r) => r.bill_date },
    { header: "Status", cell: (r) => <StatusBadge status={r.status} />, value: (r) => r.status },
    { header: "Gross", cell: (r) => currency(r.gross_amount), value: (r) => r.gross_amount, className: "text-right" },
    { header: "Net", cell: (r) => currency(r.net_amount), value: (r) => r.net_amount, className: "text-right" },
  ];

  const paymentColumns: Column<Payment>[] = [
    { header: "Date", cell: (r) => dateFmt(r.payment_date), value: (r) => r.payment_date },
    { header: "Project", cell: (r) => projectName(r.project_id), value: (r) => projectName(r.project_id) },
    { header: "Contractor", cell: (r) => contractorName(r.contractor_id), value: (r) => contractorName(r.contractor_id) },
    { header: "Method", cell: (r) => r.payment_method ?? "—", value: (r) => r.payment_method },
    { header: "Reference", cell: (r) => r.reference_number ?? "—", value: (r) => r.reference_number },
    { header: "Amount", cell: (r) => currency(r.amount), value: (r) => r.amount, className: "text-right" },
  ];

  const woRows = wos.data ?? [];
  const mbRows = mbs.data ?? [];
  const billRows = bills.data ?? [];
  const payRows = payments.data ?? [];
  const billed = sum(billRows, (r) => r.net_amount);
  const paid = sum(payRows, (r) => r.amount);

  return (
    <div>
      <PageHeader title="Contractors" description="Work orders, measurement books, bills and payments." />

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <StatCard label="Work order value" value={currency(sum(woRows, (r) => r.contract_amount))} />
        <StatCard label="Billed (net)" value={currency(billed)} tone="warning" />
        <StatCard label="Paid" value={currency(paid)} tone="success" />
        <StatCard label="Outstanding" value={currency(billed - paid)} tone="destructive" />
      </div>

      <Tabs defaultValue="wo">
        <TabsList className="no-print">
          <TabsTrigger value="wo">Work orders</TabsTrigger>
          <TabsTrigger value="mb">Measurement books</TabsTrigger>
          <TabsTrigger value="bills">Bills</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
        </TabsList>

        <TabsContent value="wo" className="mt-4 space-y-3">
          {canWriteFinance ? (
            <FormDialog
              title="Issue work order"
              description="Award scope of work to a contractor for a project."
              trigger={
                <Button>
                  <Plus className="mr-2 size-4" /> New work order
                </Button>
              }
              submitting={saveWo.isPending}
              initial={{ work_order_number: docNumber("WO"), wo_date: today(), status: "draft", rate: 0, quantity: 0 }}
              fields={[
                { name: "work_order_number", label: "WO number", required: true },
                { name: "project_id", label: "Project", type: "select", required: true, options: projectOptions },
                { name: "contractor_id", label: "Contractor", type: "select", required: true, options: contractorOptions },
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
              ]}
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
          ) : null}
          <DataTable rows={woRows} columns={woColumns} loading={wos.isLoading} exportName="work-orders" />
        </TabsContent>

        <TabsContent value="mb" className="mt-4 space-y-3">
          {canWriteSite ? (
            <FormDialog
              title="Record measurement book"
              description="Capture measured work executed by a contractor."
              trigger={
                <Button>
                  <Plus className="mr-2 size-4" /> New MB
                </Button>
              }
              submitting={saveMb.isPending}
              initial={{ mb_number: docNumber("MB"), mb_date: today(), status: "draft", total_amount: 0 }}
              fields={[
                { name: "mb_number", label: "MB number", required: true },
                { name: "project_id", label: "Project", type: "select", required: true, options: projectOptions },
                { name: "contractor_id", label: "Contractor", type: "select", options: contractorOptions },
                {
                  name: "work_order_id",
                  label: "Against work order",
                  type: "select",
                  options: woRows.map((w) => ({ value: w.id, label: w.work_order_number })),
                },
                { name: "mb_date", label: "MB date", type: "date", required: true },
                { name: "total_amount", label: "Measured value (₹)", type: "number" },
                {
                  name: "status",
                  label: "Status",
                  type: "select",
                  options: ["draft", "submitted", "verified", "approved", "rejected"].map((s) => ({ value: s, label: s })),
                },
                { name: "remarks", label: "Remarks", type: "textarea" },
              ]}
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
          ) : null}
          <DataTable rows={mbRows} columns={mbColumns} loading={mbs.isLoading} exportName="measurement-books" />
        </TabsContent>

        <TabsContent value="bills" className="mt-4 space-y-3">
          {canWriteFinance ? (
            <FormDialog
              title="Raise contractor bill"
              description="Bill approved measurements with deductions and retention."
              trigger={
                <Button>
                  <Plus className="mr-2 size-4" /> New bill
                </Button>
              }
              submitting={saveBill.isPending}
              initial={{ bill_number: docNumber("CB"), bill_date: today(), status: "draft", deductions: 0 }}
              fields={[
                { name: "bill_number", label: "Bill number", required: true },
                { name: "project_id", label: "Project", type: "select", required: true, options: projectOptions },
                { name: "contractor_id", label: "Contractor", type: "select", required: true, options: contractorOptions },
                {
                  name: "work_order_id",
                  label: "Against work order",
                  type: "select",
                  options: woRows.map((w) => ({ value: w.id, label: w.work_order_number })),
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
              ]}
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
          ) : null}
          <DataTable rows={billRows} columns={billColumns} loading={bills.isLoading} exportName="contractor-bills" />
        </TabsContent>

        <TabsContent value="payments" className="mt-4 space-y-3">
          {canWriteFinance ? (
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
              fields={[
                { name: "project_id", label: "Project", type: "select", required: true, options: projectOptions },
                { name: "contractor_id", label: "Contractor", type: "select", required: true, options: contractorOptions },
                {
                  name: "bill_id",
                  label: "Against bill",
                  type: "select",
                  options: billRows.map((b) => ({ value: b.id, label: b.bill_number })),
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
              ]}
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
          ) : null}
          <DataTable rows={payRows} columns={paymentColumns} loading={payments.isLoading} exportName="contractor-payments" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
