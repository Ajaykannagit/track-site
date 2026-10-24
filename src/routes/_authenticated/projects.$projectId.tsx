import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import {
  Printer,
  Users,
  Package,
  HardHat,
  FileText,
  Plus,
  FileSpreadsheet,
  Trash2,
  HandCoins,
  CreditCard,
  CalendarClock,
  RotateCcw,
  Receipt,
} from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { DataTable, StatCard, type Column } from "@/components/DataTable";
import { StatusBadge } from "@/components/StatusBadge";
import { FormDialog, type Field } from "@/components/FormDialog";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { useRows, useSaveRow, useDeleteRow, sum } from "@/lib/db";
import { currency, dateFmt, today } from "@/lib/format";
import { logAuditEntry } from "@/lib/audit";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  head: () => ({
    meta: [
      { title: "Project detail — Brickweld Pvt Ltd" },
      {
        name: "description",
        content: "Budget, spend, attendance, materials and contractor activity for a project.",
      },
      { property: "og:title", content: "Project detail — Brickweld Pvt Ltd" },
      {
        property: "og:description",
        content: "Full financial and site picture for a single construction project.",
      },
    ],
  }),
  component: ProjectDetail,
});

type ProjectQuotation = {
  id: string;
  project_id: string;
  quotation_number: string | null;
  title: string;
  description: string | null;
  amount: number;
  quotation_date: string;
  status: string;
};

type ClientPayment = {
  id: string;
  receipt_number: string;
  project_id: string;
  client_id: string | null;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference_number: string | null;
  payment_category: string;
  invoice_reference: string | null;
  notes: string | null;
  status: string;
  account_type: string;
  created_at: string;
  created_by: string | null;
};

type PaymentMilestone = {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  expected_amount: number;
  due_date: string;
  order_index: number;
  status: string;
};

function ProjectDetail() {
  const { projectId } = Route.useParams();
  const { permissions, isMD } = useAuth();
  const f = [{ col: "project_id", op: "eq" as const, value: projectId }];

  const [deletingQuotation, setDeletingQuotation] = useState<ProjectQuotation | null>(null);
  const [editingPayment, setEditingPayment] = useState<ClientPayment | null>(null);
  const [deletingPayment, setDeletingPayment] = useState<ClientPayment | null>(null);
  const [reversingPayment, setReversingPayment] = useState<ClientPayment | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);

  const [editingMilestone, setEditingMilestone] = useState<PaymentMilestone | null>(null);
  const [deletingMilestone, setDeletingMilestone] = useState<PaymentMilestone | null>(null);
  const [milestoneFormOpen, setMilestoneFormOpen] = useState(false);

  // Client Payments Filter States
  const [payCategoryFilter, setPayCategoryFilter] = useState<string>("all");
  const [payMethodFilter, setPayMethodFilter] = useState<string>("all");

  const project = useRows<{
    id: string;
    name: string;
    project_code: string;
    client_id: string | null;
    status: string;
    quotation_amount: number;
    site_address: string | null;
    house_number: string | null;
    start_date: string | null;
    expected_completion_date: string | null;
    agreement_details: string | null;
    details: string | null;
  }>("projects_view", { filters: [{ col: "id", op: "eq", value: projectId }] });

  const clients = useRows<{ id: string; name: string }>("clients", {
    select: "id,name",
  });

  // Client Payments & Milestones Queries
  const clientPayments = useRows<ClientPayment>("client_payments", {
    filters: f,
    order: { col: "payment_date", asc: false },
    enabled: permissions.canViewProjectFinancials,
  });

  const paymentMilestones = useRows<PaymentMilestone>("payment_milestones", {
    filters: f,
    order: { col: "due_date", asc: true },
    enabled: permissions.canViewProjectFinancials,
  });

  const savePayment = useSaveRow("client_payments", "Client Payment");
  const deletePayment = useDeleteRow("client_payments", "Client Payment");
  const saveMilestone = useSaveRow("payment_milestones", "Payment Milestone");
  const deleteMilestone = useDeleteRow("payment_milestones", "Payment Milestone");

  // Update 4: Project Quotations (mid-project variations & additions)
  const quotations = useRows<ProjectQuotation>("project_quotations", {
    filters: f,
    order: { col: "quotation_date", asc: false },
    enabled: permissions.canViewProjectFinancials,
  });

  const saveQuotation = useSaveRow("project_quotations", "Quotation");
  const deleteQuotation = useDeleteRow("project_quotations", "Quotation");

  const budgets = useRows<{
    id: string;
    category: string;
    budget_amount: number;
    notes: string | null;
  }>("project_budgets", { filters: f, enabled: permissions.canViewProjectFinancials });

  const expenses = useRows<{
    id: string;
    expense_date: string;
    category: string;
    amount: number;
    description: string | null;
  }>("expenses", {
    filters: f,
    order: { col: "expense_date" },
    enabled: permissions.canViewProjectFinancials,
  });

  const attendance = useRows<{
    id: string;
    attendance_date: string;
    kind: string;
    status: string;
    calculated_wage: number;
    workforce_count: number | null;
    remarks: string | null;
  }>("attendance_view", {
    filters: f,
    order: { col: "attendance_date" },
    limit: 300,
    enabled: permissions.canEnterAttendance,
  });

  const receipts = useRows<{
    id: string;
    receipt_number: string;
    receipt_date: string;
    total_amount: number;
    supplier_id: string | null;
  }>("material_receipts_view", {
    filters: f,
    order: { col: "receipt_date" },
    enabled: permissions.canViewMaterialsAndContractors,
  });

  const bills = useRows<{
    id: string;
    bill_number: string;
    bill_date: string;
    net_amount: number;
    status: string;
    contractor_id: string | null;
  }>("contractor_bills", {
    filters: f,
    order: { col: "bill_date" },
    enabled: permissions.canViewMaterialContractorCosts,
  });

  const p = project.data?.[0];
  const clientName = clients.data?.find((c) => c.id === p?.client_id)?.name ?? "—";
  const baseContractValue = Number(p?.quotation_amount ?? 0);
  const extraQuotationsTotal = sum(
    (quotations.data ?? []).filter((q) => q.status === "approved"),
    (q) => Number(q.amount || 0),
  );
  const totalContractValue = baseContractValue + extraQuotationsTotal;

  // Client Receipts & Advances
  const paymentsList = useMemo(() => clientPayments.data ?? [], [clientPayments.data]);
  const validReceipts = paymentsList.filter((cp) => cp.status === "received");
  const totalReceived = sum(validReceipts, (cp) => {
    if (cp.payment_category === "reversal") return -Number(cp.amount || 0);
    return Number(cp.amount || 0);
  });
  const advanceReceived = sum(
    validReceipts.filter((cp) => cp.payment_category === "advance"),
    (cp) => Number(cp.amount || 0),
  );
  const pendingReceivables = Math.max(0, totalContractValue - totalReceived);

  const labourWage = sum(attendance.data ?? [], (a) => a.calculated_wage);
  const materialCost = sum(receipts.data ?? [], (r) => r.total_amount);
  const contractorCost = sum(bills.data ?? [], (b) => b.net_amount);
  const otherCost = sum(expenses.data ?? [], (e) => e.amount);
  const totalCost = labourWage + materialCost + contractorCost + otherCost;
  const profit = totalContractValue - totalCost;

  const totalHeadcount = sum(attendance.data ?? [], (a) => a.workforce_count ?? 1);

  const costBreakdown = [
    { name: "Labour & wages", value: labourWage, fill: "var(--chart-1)" },
    { name: "Materials", value: materialCost, fill: "var(--chart-2)" },
    { name: "Contractors", value: contractorCost, fill: "var(--chart-3)" },
    { name: "Other expenses", value: otherCost, fill: "var(--chart-4)" },
  ];
  const hasCost = totalCost > 0;

  // Filtered Client Payments
  const filteredPayments = useMemo(() => {
    let list = paymentsList;
    if (payCategoryFilter !== "all") {
      list = list.filter((cp) => cp.payment_category === payCategoryFilter);
    }
    if (payMethodFilter !== "all") {
      list = list.filter((cp) => cp.payment_method === payMethodFilter);
    }
    return list;
  }, [paymentsList, payCategoryFilter, payMethodFilter]);

  const paymentFields: Field[] = [
    {
      name: "amount",
      label: "Amount Received (₹)",
      type: "number",
      required: true,
      placeholder: "e.g. 200000",
    },
    {
      name: "payment_date",
      label: "Receipt Date",
      type: "date",
      required: true,
    },
    {
      name: "payment_method",
      label: "Payment Method",
      type: "select",
      required: true,
      options: [
        { value: "bank", label: "Bank Transfer (NEFT/RTGS/IMPS)" },
        { value: "upi", label: "UPI" },
        { value: "cheque", label: "Cheque" },
        { value: "cash", label: "Cash" },
        { value: "other", label: "Other" },
      ],
    },
    {
      name: "payment_category",
      label: "Payment Category",
      type: "select",
      required: true,
      options: [
        { value: "advance", label: "Advance Payment" },
        { value: "progress", label: "Running Bill / Progress Payment" },
        { value: "final", label: "Final Settlement" },
        { value: "other", label: "Other" },
      ],
    },
    {
      name: "reference_number",
      label: "Transaction / UTR / Cheque Ref #",
      type: "text",
      placeholder: "e.g. UTR-998241 / CHQ-1048",
    },
    {
      name: "invoice_reference",
      label: "Invoice / RA Bill Reference",
      type: "text",
      placeholder: "e.g. RA-01 or INV-2026-08",
    },
    {
      name: "account_type",
      label: "Account Credited",
      type: "select",
      required: true,
      options: [
        { value: "bank", label: "Bank Account" },
        { value: "petty_cash", label: "Petty Cash" },
        { value: "office", label: "Office Central" },
      ],
    },
    {
      name: "notes",
      label: "Notes / Remarks",
      type: "textarea",
      placeholder: "e.g. Received via NEFT for second floor slab milestone",
    },
  ];

  const milestoneFields: Field[] = [
    {
      name: "title",
      label: "Milestone Title",
      type: "text",
      required: true,
      placeholder: "e.g. Foundation & Plinth Completion",
    },
    {
      name: "expected_amount",
      label: "Expected Amount (₹)",
      type: "number",
      required: true,
      placeholder: "e.g. 500000",
    },
    {
      name: "due_date",
      label: "Due Date",
      type: "date",
      required: true,
    },
    {
      name: "status",
      label: "Milestone Status",
      type: "select",
      required: true,
      options: [
        { value: "pending", label: "Pending" },
        { value: "partially_paid", label: "Partially Paid" },
        { value: "paid", label: "Fully Paid" },
        { value: "cancelled", label: "Cancelled" },
      ],
    },
    {
      name: "description",
      label: "Scope / Stage Description",
      type: "textarea",
      placeholder: "Deliverables required for this milestone release",
    },
  ];

  const quotationFields: Field[] = [
    { name: "title", label: "Quotation Title / Scope", required: true, placeholder: "e.g. Extra Bathroom Work, Terrace Waterproofing" },
    { name: "quotation_number", label: "Quotation Number / Ref", placeholder: "e.g. QTN-002" },
    { name: "amount", label: "Quotation Amount (₹)", type: "number", required: true },
    { name: "quotation_date", label: "Quotation Date", type: "date", required: true },
    {
      name: "status",
      label: "Status",
      type: "select",
      options: [
        { value: "approved", label: "Approved / Added to Contract" },
        { value: "draft", label: "Draft Proposal" },
        { value: "under_review", label: "Under Client Review" },
        { value: "rejected", label: "Rejected" },
      ],
    },
    { name: "description", label: "Detailed Scope of Work", type: "textarea" },
  ];

  return (
    <div>
      {/* Header with Print / PDF and + Quotation button */}
      <PageHeader
        title={p?.name ?? "Project"}
        description={p ? `${p.project_code} · ${p.site_address ?? "No site address"}` : "Loading…"}
        actions={
          <div className="flex items-center gap-2">
            {p ? <StatusBadge status={p.status} /> : null}

            {/* Update 4: + Button inside Project to add mid-project quotation */}
            {permissions.canManageQuotations && (
              <FormDialog
                title="Add Mid-Project Quotation"
                description={`Add a supplementary quotation or variation to ${p?.name || "this project"}. Approved amount is automatically added to the project's contract value.`}
                trigger={
                  <Button size="sm" className="no-print">
                    <Plus className="mr-1.5 size-4" /> Add Quotation
                  </Button>
                }
                submitting={saveQuotation.isPending}
                fields={quotationFields}
                initial={{
                  project_id: projectId,
                  quotation_date: today(),
                  status: "approved",
                  quotation_number: `QTN-${(quotations.data ?? []).length + 2}`,
                }}
                onSubmit={async (values) => {
                  await saveQuotation.mutateAsync({
                    values: {
                      ...values,
                      project_id: projectId,
                      amount: Number(values["amount"] ?? 0),
                    },
                  });
                }}
              />
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="no-print"
              title="Print / Save Project as PDF"
            >
              <Printer className="mr-2 size-4" /> Print / PDF
            </Button>
          </div>
        }
      />

      {/* ========================================================================= */}
      {/* PRINT-ONLY EXECUTIVE SUMMARY (Shows on window.print / PDF export) */}
      {/* ========================================================================= */}
      <div className="hidden print:block mb-6 p-4 border rounded-lg bg-white text-black">
        <div className="flex justify-between items-start border-b pb-4 mb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">BRICKWELD PRIVATE LIMITED</h1>
            <p className="text-xs text-gray-600 uppercase">Civil — Interior — Fabrication</p>
            <p className="text-sm font-semibold mt-2">{p?.name} ({p?.project_code})</p>
            <p className="text-xs text-gray-600">{p?.site_address ?? "No site address recorded"}</p>
          </div>
          <div className="text-right text-xs">
            <p className="font-semibold uppercase">Project Report</p>
            <p>Status: {p?.status.toUpperCase()}</p>
            <p>Start: {dateFmt(p?.start_date)}</p>
            <p>Target: {dateFmt(p?.expected_completion_date)}</p>
          </div>
        </div>

        {permissions.canViewProjectFinancials && (
          <div className="grid grid-cols-4 gap-3 border p-3 rounded mb-4 text-xs">
            <div>
              <span className="text-gray-500 block">Total Contract Value</span>
              <span className="font-bold text-sm">{currency(totalContractValue)}</span>
              {extraQuotationsTotal > 0 && (
                <span className="text-[10px] text-gray-500 block">(Base: {currency(baseContractValue)} + Extra: {currency(extraQuotationsTotal)})</span>
              )}
            </div>
            <div>
              <span className="text-gray-500 block">Total Spend</span>
              <span className="font-bold text-sm">{currency(totalCost)}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Labour & Wages</span>
              <span className="font-bold">{currency(labourWage)}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Materials (GRN)</span>
              <span className="font-bold">{currency(materialCost)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Financial StatCards */}
      {permissions.canViewProjectFinancials ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard
            label="Total Contract Value"
            value={currency(totalContractValue)}
            hint={
              extraQuotationsTotal > 0
                ? `Base ${currency(baseContractValue)} + ${currency(extraQuotationsTotal)} (${(quotations.data ?? []).length} additions)`
                : "Base contract value"
            }
          />
          <StatCard
            label="Received Amount"
            value={currency(totalReceived)}
            hint={`${validReceipts.length} receipts recorded`}
            tone="success"
          />
          <StatCard
            label="Pending Receivables"
            value={currency(pendingReceivables)}
            hint={advanceReceived > 0 ? `Adv rec: ${currency(advanceReceived)}` : "Contract bal due"}
            tone={pendingReceivables > 0 ? "warning" : "default"}
          />
          <StatCard label="Total cost" value={currency(totalCost)} tone="warning" />
          <StatCard
            label="Profit"
            value={currency(profit)}
            tone={profit >= 0 ? "success" : "destructive"}
            hint={totalContractValue ? `${((profit / totalContractValue) * 100).toFixed(1)}% margin` : "No contract value"}
          />
          <StatCard
            label="Budget allotted"
            value={currency(sum(budgets.data ?? [], (b) => b.budget_amount))}
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard label="Status" value={p?.status ?? "—"} />
          <StatCard label="Start date" value={dateFmt(p?.start_date)} />
          <StatCard label="Target completion" value={dateFmt(p?.expected_completion_date)} />
        </div>
      )}

      {/* Operational Highlights Cards */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {permissions.canEnterAttendance && (
          <Card className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-md bg-primary/10 text-primary">
                <Users className="size-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Labour & Attendance</p>
                <p className="text-sm font-semibold">{(attendance.data ?? []).length} Logs ({totalHeadcount} shifts)</p>
              </div>
            </div>
            {permissions.canViewWagesAndPayments && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Wages</p>
                <p className="text-sm font-bold">{currency(labourWage)}</p>
              </div>
            )}
          </Card>
        )}

        {permissions.canViewMaterialsAndContractors && (
          <Card className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-md bg-amber-500/10 text-amber-600">
                <Package className="size-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Material Receipts</p>
                <p className="text-sm font-semibold">{(receipts.data ?? []).length} GRNs</p>
              </div>
            </div>
            {permissions.canViewMaterialContractorCosts && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Value</p>
                <p className="text-sm font-bold">{currency(materialCost)}</p>
              </div>
            )}
          </Card>
        )}

        {permissions.canViewMaterialsAndContractors && (
          <Card className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-md bg-blue-500/10 text-blue-600">
                <HardHat className="size-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Contractors</p>
                <p className="text-sm font-semibold">{(bills.data ?? []).length} Bills</p>
              </div>
            </div>
            {permissions.canViewMaterialContractorCosts && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Bills Total</p>
                <p className="text-sm font-bold">{currency(contractorCost)}</p>
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Cost Composition Chart */}
      {permissions.canViewProjectFinancials && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Cost composition</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2">
                <StatCard label="Labour & wages" value={currency(labourWage)} />
                <StatCard label="Materials" value={currency(materialCost)} />
                <StatCard label="Contractors" value={currency(contractorCost)} />
                <StatCard label="Other expenses" value={currency(otherCost)} />
              </div>
              <div className="flex h-56 flex-col items-center justify-center rounded-lg border bg-card/50 p-2">
                {!hasCost ? (
                  <p className="text-sm text-muted-foreground">No costs recorded yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={costBreakdown}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={45}
                        outerRadius={75}
                        paddingAngle={3}
                      >
                        {costBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => currency(v)} />
                      <Legend
                        verticalAlign="bottom"
                        iconSize={8}
                        wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabbed details */}
      <Tabs defaultValue="info" className="mt-4">
        <TabsList className="no-print flex-wrap">
          <TabsTrigger value="info">
            <FileText className="mr-1.5 size-3.5" /> Details
          </TabsTrigger>
          {permissions.canViewProjectFinancials && (
            <TabsTrigger value="quotations">
              <FileSpreadsheet className="mr-1.5 size-3.5" /> Quotations ({(quotations.data ?? []).length})
            </TabsTrigger>
          )}
          {permissions.canViewProjectFinancials && (
            <TabsTrigger value="payments">
              <HandCoins className="mr-1.5 size-3.5" /> Payments &amp; Receivables ({paymentsList.length})
            </TabsTrigger>
          )}
          {permissions.canEnterAttendance && (
            <TabsTrigger value="attendance">
              <Users className="mr-1.5 size-3.5" /> Labour & Attendance
            </TabsTrigger>
          )}
          {permissions.canViewMaterialsAndContractors && (
            <TabsTrigger value="materials">
              <Package className="mr-1.5 size-3.5" /> Materials
            </TabsTrigger>
          )}
          {permissions.canViewMaterialContractorCosts && (
            <TabsTrigger value="contractors">
              <HardHat className="mr-1.5 size-3.5" /> Contractor Bills
            </TabsTrigger>
          )}
          {permissions.canViewProjectFinancials && (
            <TabsTrigger value="budget">Budget</TabsTrigger>
          )}
          {permissions.canViewProjectFinancials && (
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="info">
          <Card>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
              <Detail label="House / plot" value={p?.house_number ?? "—"} />
              <Detail label="Site address" value={p?.site_address ?? "—"} />
              <Detail label="Start date" value={dateFmt(p?.start_date)} />
              <Detail label="Expected completion" value={dateFmt(p?.expected_completion_date)} />
              <Detail label="Agreement" value={p?.agreement_details ?? "—"} />
              <Detail label="Scope / notes" value={p?.details ?? "—"} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Update 4: Project Quotations Tab */}
        {permissions.canViewProjectFinancials && (
          <TabsContent value="quotations" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Project Quotations & Variations</h3>
                <p className="text-xs text-muted-foreground">
                  Base contract value plus any mid-project additions (e.g. extra bathroom, compound wall).
                </p>
              </div>

              {permissions.canManageQuotations && (
                <FormDialog
                  title="Add Project Quotation"
                  description={`Add a supplementary quotation or variation to ${p?.name || "this project"}.`}
                  trigger={
                    <Button size="sm">
                      <Plus className="mr-1.5 size-4" /> Add Quotation
                    </Button>
                  }
                  submitting={saveQuotation.isPending}
                  fields={quotationFields}
                  initial={{
                    project_id: projectId,
                    quotation_date: today(),
                    status: "approved",
                    quotation_number: `QTN-${(quotations.data ?? []).length + 2}`,
                  }}
                  onSubmit={async (values) => {
                    await saveQuotation.mutateAsync({
                      values: {
                        ...values,
                        project_id: projectId,
                        amount: Number(values["amount"] ?? 0),
                      },
                    });
                  }}
                />
              )}
            </div>

            {/* Base Agreement Card */}
            <div className="rounded-lg border bg-muted/30 p-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold">Base Project Agreement Quotation</p>
                <p className="text-[11px] text-muted-foreground">{p?.agreement_details || "Original agreed contract estimate"}</p>
              </div>
              <div className="text-right">
                <span className="text-xs text-muted-foreground block">Base Amount</span>
                <span className="font-mono text-sm font-bold">{currency(baseContractValue)}</span>
              </div>
            </div>

            <DataTable
              rows={quotations.data ?? []}
              loading={quotations.isLoading}
              exportName={`${p?.project_code ?? "project"}-quotations`}
              exportTitle={`${p?.name} — Supplementary Quotations`}
              columns={[
                { header: "Quotation #", cell: (r) => r.quotation_number || "—", value: (r) => r.quotation_number },
                {
                  header: "Title / Scope",
                  cell: (r) => (
                    <div>
                      <p className="font-medium text-xs">{r.title}</p>
                      {r.description && <p className="text-[11px] text-muted-foreground">{r.description}</p>}
                    </div>
                  ),
                  value: (r) => r.title,
                },
                {
                  header: "Date",
                  cell: (r) => dateFmt(r.quotation_date),
                  value: (r) => r.quotation_date,
                },
                {
                  header: "Status",
                  cell: (r) => <Badge variant={r.status === "approved" ? "default" : "secondary"}>{r.status}</Badge>,
                  value: (r) => r.status,
                },
                {
                  header: "Amount (₹)",
                  cell: (r) => currency(r.amount),
                  value: (r) => r.amount,
                  className: "text-right font-mono font-semibold",
                },
                ...(isMD
                  ? [
                      {
                        header: "Actions",
                        className: "text-right w-16",
                        cell: (r: ProjectQuotation) => (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive hover:text-destructive"
                            onClick={() => setDeletingQuotation(r)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        ),
                      },
                    ]
                  : []),
              ]}
              empty="No supplementary quotations added yet. Click '+ Add Quotation' to add mid-project scope variations."
            />
          </TabsContent>
        )}

        {/* Client Payments & Receivables Tab */}
        {permissions.canViewProjectFinancials && (
          <TabsContent value="payments" className="space-y-6">
            {/* Header + Action Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <HandCoins className="size-4 text-emerald-600" /> Client Payments, Receipts &amp; Receivables
                </h3>
                <p className="text-xs text-muted-foreground">
                  Complete billing lifecycle for {p?.name}: advance tracking, progress milestones, and audit-logged client receipts.
                </p>
              </div>

              {permissions.canManageQuotations && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingMilestone(null);
                      setMilestoneFormOpen(true);
                    }}
                  >
                    <Plus className="mr-1.5 size-3.5" /> Add Milestone
                  </Button>
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => {
                      setEditingPayment(null);
                      setPaymentFormOpen(true);
                    }}
                  >
                    <Plus className="mr-1.5 size-3.5" /> Record Client Payment
                  </Button>
                </div>
              )}
            </div>

            {/* Contract & Receivable Position Overview Cards */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="p-3.5 rounded-lg border bg-card">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Revised Contract Value</p>
                <p className="text-lg font-bold font-mono mt-1">{currency(totalContractValue)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Base {currency(baseContractValue)} + Variations {currency(extraQuotationsTotal)}
                </p>
              </div>

              <div className="p-3.5 rounded-lg border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/50">
                <p className="text-[11px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-semibold">Total Received to Date</p>
                <p className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1">{currency(totalReceived)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {totalContractValue > 0 ? `${Math.round((totalReceived / totalContractValue) * 100)}% recovery achieved` : "—"}
                </p>
              </div>

              <div className="p-3.5 rounded-lg border bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/50">
                <p className="text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-400 font-semibold">Pending Receivables</p>
                <p className="text-lg font-bold font-mono text-amber-700 dark:text-amber-400 mt-1">{currency(pendingReceivables)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Remaining balance due from client
                </p>
              </div>

              <div className="p-3.5 rounded-lg border bg-card">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Advance Status</p>
                <p className="text-lg font-bold font-mono mt-1">{currency(advanceReceived)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Total mobilization advance received
                </p>
              </div>
            </div>

            {/* Payment Milestones Schedule */}
            <Card>
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <CalendarClock className="size-4 text-primary" /> Contractual Payment Milestones
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Defined payment triggers, expected release dates and completion progress.
                  </p>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <DataTable
                  rows={paymentMilestones.data ?? []}
                  loading={paymentMilestones.isLoading}
                  exportName={`${p?.project_code ?? "project"}-milestones`}
                  empty="No payment milestones defined. Click '+ Add Milestone' to configure stages."
                  columns={[
                    {
                      header: "Milestone",
                      cell: (r) => (
                        <div>
                          <p className="font-semibold text-xs">{r.title}</p>
                          {r.description && <p className="text-[11px] text-muted-foreground">{r.description}</p>}
                        </div>
                      ),
                      value: (r) => r.title,
                    },
                    {
                      header: "Due Date",
                      cell: (r) => {
                        const isOverdue = r.status === "pending" && r.due_date < today();
                        return (
                          <div>
                            <span className={isOverdue ? "text-destructive font-semibold" : ""}>
                              {dateFmt(r.due_date)}
                            </span>
                            {isOverdue && (
                              <Badge variant="destructive" className="ml-2 text-[9px] px-1 py-0 h-4">
                                Overdue
                              </Badge>
                            )}
                          </div>
                        );
                      },
                      value: (r) => r.due_date,
                    },
                    {
                      header: "Expected Amount",
                      cell: (r) => currency(r.expected_amount),
                      value: (r) => r.expected_amount,
                      className: "text-right font-mono font-semibold",
                    },
                    {
                      header: "Status",
                      cell: (r) => {
                        const statusColors: Record<string, string> = {
                          paid: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
                          partially_paid: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
                          pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
                          cancelled: "bg-muted text-muted-foreground",
                        };
                        return (
                          <Badge className={statusColors[r.status] || ""}>
                            {r.status.replace("_", " ")}
                          </Badge>
                        );
                      },
                      value: (r) => r.status,
                    },
                    ...(permissions.canManageQuotations
                      ? [
                          {
                            header: "Actions",
                            className: "text-right w-20",
                            cell: (r: PaymentMilestone) => (
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7"
                                  onClick={() => {
                                    setEditingMilestone(r);
                                    setMilestoneFormOpen(true);
                                  }}
                                >
                                  <FileText className="size-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-destructive hover:text-destructive"
                                  onClick={() => setDeletingMilestone(r)}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            ),
                          },
                        ]
                      : []),
                  ]}
                />
              </CardContent>
            </Card>

            {/* Payment Receipts History Table */}
            <Card>
              <CardHeader className="py-3 px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Receipt className="size-4 text-emerald-600" /> Client Receipts &amp; Transaction History
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Chronological ledger of payments received, transaction references and accounts credited.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Select value={payCategoryFilter} onValueChange={setPayCategoryFilter}>
                    <SelectTrigger className="w-36 h-8 text-xs">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="advance">Advance</SelectItem>
                      <SelectItem value="progress">Progress Payment</SelectItem>
                      <SelectItem value="final">Final Settlement</SelectItem>
                      <SelectItem value="reversal">Reversals</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={payMethodFilter} onValueChange={setPayMethodFilter}>
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue placeholder="All Methods" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      <SelectItem value="bank">Bank Transfer</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <DataTable
                  rows={filteredPayments}
                  loading={clientPayments.isLoading}
                  exportName={`${p?.project_code ?? "project"}-receipts`}
                  exportTitle={`${p?.name} — Client Payment Receipts`}
                  empty="No client receipts recorded yet. Click '+ Record Client Payment' above."
                  columns={[
                    {
                      header: "Receipt #",
                      cell: (r) => <span className="font-mono text-xs font-semibold">{r.receipt_number}</span>,
                      value: (r) => r.receipt_number,
                    },
                    {
                      header: "Date",
                      cell: (r) => dateFmt(r.payment_date),
                      value: (r) => r.payment_date,
                    },
                    {
                      header: "Client / Payer",
                      cell: () => clientName,
                      value: () => clientName,
                    },
                    {
                      header: "Category",
                      cell: (r) => {
                        const isReversal = r.payment_category === "reversal";
                        return (
                          <Badge variant={isReversal ? "destructive" : "secondary"}>
                            {r.payment_category}
                          </Badge>
                        );
                      },
                      value: (r) => r.payment_category,
                    },
                    {
                      header: "Method / Ref",
                      cell: (r) => (
                        <div>
                          <span className={r.payment_method ? "capitalize font-medium text-xs" : "text-muted-foreground italic text-xs"}>
                            {r.payment_method || "Not recorded"}
                          </span>
                          {r.reference_number && (
                            <span className="block text-[10px] font-mono text-muted-foreground">
                              {r.reference_number}
                            </span>
                          )}
                        </div>
                      ),
                      value: (r) => `${r.payment_method || "Not recorded"} ${r.reference_number || ""}`,
                    },
                    {
                      header: "Account",
                      cell: (r) => (
                        <Badge variant="outline" className="text-[10px]">
                          {r.account_type === "bank" ? "Bank" : r.account_type === "petty_cash" ? "Petty Cash" : "Office"}
                        </Badge>
                      ),
                      value: (r) => r.account_type,
                    },
                    {
                      header: "Amount (₹)",
                      cell: (r) => {
                        const isReversal = r.payment_category === "reversal";
                        return (
                          <span
                            className={`font-mono font-semibold ${
                              isReversal ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {isReversal ? `-${currency(r.amount)}` : currency(r.amount)}
                          </span>
                        );
                      },
                      value: (r) => r.amount,
                      className: "text-right",
                    },
                    ...(permissions.canManageQuotations
                      ? [
                          {
                            header: "Actions",
                            className: "text-right w-24",
                            cell: (r: ClientPayment) => (
                              <div className="flex items-center justify-end gap-1">
                                {r.payment_category !== "reversal" && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                    title="Create Authorized Reversal / Refund"
                                    onClick={() => {
                                      setReversingPayment(r);
                                      setReversalReason("");
                                    }}
                                  >
                                    <RotateCcw className="size-3.5" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-7 text-destructive hover:text-destructive"
                                  title="Delete Record (MD only)"
                                  onClick={() => setDeletingPayment(r)}
                                >
                                  <Trash2 className="size-3.5" />
                                </Button>
                              </div>
                            ),
                          },
                        ]
                      : []),
                  ]}
                />
              </CardContent>
            </Card>

            {/* Form Dialog: Record / Edit Payment */}
            {paymentFormOpen && (
              <FormDialog
                title={editingPayment ? "Edit Client Payment" : "Record Client Payment"}
                description={`Record an incoming client receipt for ${p?.name}. This will update project receivables and post to cash/bank records.`}
                fields={paymentFields}
                submitting={savePayment.isPending}
                open={paymentFormOpen}
                onOpenChange={setPaymentFormOpen}
                initial={
                  editingPayment
                    ? {
                        amount: editingPayment.amount,
                        payment_date: editingPayment.payment_date,
                        payment_method: editingPayment.payment_method,
                        payment_category: editingPayment.payment_category,
                        reference_number: editingPayment.reference_number || "",
                        invoice_reference: editingPayment.invoice_reference || "",
                        account_type: editingPayment.account_type || "bank",
                        notes: editingPayment.notes || "",
                      }
                    : {
                        payment_date: today(),
                        payment_method: "bank",
                        payment_category: "progress",
                        account_type: "bank",
                      }
                }
                onSubmit={async (values) => {
                  const amt = Number(values["amount"] || 0);
                  if (amt <= 0) return;
                  const genReceiptNum =
                    editingPayment?.receipt_number ||
                    `RCP-${p?.project_code || "PRJ"}-${Date.now().toString().slice(-6)}`;

                  await savePayment.mutateAsync({
                    id: editingPayment?.id,
                    values: {
                      receipt_number: genReceiptNum,
                      project_id: projectId,
                      client_id: p?.client_id || null,
                      amount: amt,
                      payment_date: values["payment_date"],
                      payment_method: values["payment_method"],
                      payment_category: values["payment_category"],
                      reference_number: values["reference_number"] ? String(values["reference_number"]).trim() : null,
                      invoice_reference: values["invoice_reference"] ? String(values["invoice_reference"]).trim() : null,
                      account_type: values["account_type"] || "bank",
                      notes: values["notes"] ? String(values["notes"]).trim() : null,
                      status: "received",
                    },
                  });

                  await logAuditEntry({
                    tableName: "client_payments",
                    recordId: editingPayment?.id || genReceiptNum,
                    action: editingPayment ? "update" : "insert",
                    module: "accounts",
                    fieldName: "amount",
                    newValue: amt,
                    reason: `Client receipt recorded for ${p?.name} (${genReceiptNum})`,
                  });

                  setPaymentFormOpen(false);
                }}
              />
            )}

            {/* Form Dialog: Add / Edit Milestone */}
            {milestoneFormOpen && (
              <FormDialog
                title={editingMilestone ? "Edit Payment Milestone" : "Add Payment Milestone"}
                description={`Define a contractual billing stage and expected amount for ${p?.name}.`}
                fields={milestoneFields}
                submitting={saveMilestone.isPending}
                open={milestoneFormOpen}
                onOpenChange={setMilestoneFormOpen}
                initial={
                  editingMilestone
                    ? {
                        title: editingMilestone.title,
                        expected_amount: editingMilestone.expected_amount,
                        due_date: editingMilestone.due_date,
                        status: editingMilestone.status,
                        description: editingMilestone.description || "",
                      }
                    : {
                        due_date: today(),
                        status: "pending",
                      }
                }
                onSubmit={async (values) => {
                  await saveMilestone.mutateAsync({
                    id: editingMilestone?.id,
                    values: {
                      project_id: projectId,
                      title: String(values["title"]),
                      expected_amount: Number(values["expected_amount"] || 0),
                      due_date: values["due_date"],
                      status: values["status"],
                      description: values["description"] ? String(values["description"]).trim() : null,
                    },
                  });
                  setMilestoneFormOpen(false);
                }}
              />
            )}

            {/* Reversal / Refund Confirmation Dialog */}
            {reversingPayment && (
              <ConfirmDeleteDialog
                open={!!reversingPayment}
                onOpenChange={(open) => !open && setReversingPayment(null)}
                title="Post Financial Reversal / Refund"
                description={`Post an authorized offsetting reversal of ${currency(reversingPayment.amount)} against receipt ${reversingPayment.receipt_number}? The original transaction will be preserved for audit compliance.`}
                onConfirm={async () => {
                  const revNum = `REV-${reversingPayment.receipt_number}-${Date.now().toString().slice(-4)}`;
                  await savePayment.mutateAsync({
                    values: {
                      receipt_number: revNum,
                      project_id: projectId,
                      client_id: reversingPayment.client_id,
                      amount: reversingPayment.amount,
                      payment_date: today(),
                      payment_method: reversingPayment.payment_method,
                      payment_category: "reversal",
                      reference_number: `Reversal of ${reversingPayment.receipt_number}`,
                      account_type: reversingPayment.account_type,
                      status: "received",
                      notes: reversalReason || `Authorized reversal of receipt ${reversingPayment.receipt_number}`,
                    },
                  });

                  await logAuditEntry({
                    tableName: "client_payments",
                    recordId: revNum,
                    action: "insert",
                    module: "accounts",
                    fieldName: "payment_category",
                    newValue: "reversal",
                    reason: `Reversal of ${reversingPayment.receipt_number}`,
                  });

                  setReversingPayment(null);
                }}
              />
            )}

            {/* Delete Payment Dialog */}
            {deletingPayment && (
              <ConfirmDeleteDialog
                open={!!deletingPayment}
                onOpenChange={(open) => !open && setDeletingPayment(null)}
                title="Delete Client Payment Record"
                tableName="client_payments"
                recordId={deletingPayment.id}
                recordTitle={`Client Receipt: ${deletingPayment.receipt_number} (${currency(deletingPayment.amount)})`}
                recordData={deletingPayment}
                description={`Delete client payment "${deletingPayment.receipt_number}" (${currency(deletingPayment.amount)})? This action requires MD approval.`}
                onConfirm={async () => {
                  await deletePayment.mutateAsync(deletingPayment.id);
                  setDeletingPayment(null);
                }}
              />
            )}

            {/* Delete Milestone Dialog */}
            {deletingMilestone && (
              <ConfirmDeleteDialog
                open={!!deletingMilestone}
                onOpenChange={(open) => !open && setDeletingMilestone(null)}
                title="Delete Payment Milestone"
                tableName="payment_milestones"
                recordId={deletingMilestone.id}
                recordTitle={`Milestone: ${deletingMilestone.title} (${currency(deletingMilestone.expected_amount)})`}
                recordData={deletingMilestone}
                description={`Delete milestone "${deletingMilestone.title}" (${currency(deletingMilestone.expected_amount)})? This action requires MD approval.`}
                onConfirm={async () => {
                  await deleteMilestone.mutateAsync(deletingMilestone.id);
                  setDeletingMilestone(null);
                }}
              />
            )}
          </TabsContent>
        )}

        {permissions.canEnterAttendance && (
          <TabsContent value="attendance">
            <DataTable
              rows={attendance.data ?? []}
              loading={attendance.isLoading}
              exportName={`${p?.project_code ?? "project"}-attendance`}
              exportTitle={`${p?.name} — Labour & Attendance`}
              columns={[
                {
                  header: "Date",
                  cell: (r) => dateFmt(r.attendance_date),
                  value: (r) => r.attendance_date,
                },
                { header: "Kind", cell: (r) => r.kind, value: (r) => r.kind },
                {
                  header: "Status",
                  cell: (r) => <StatusBadge status={r.status} />,
                  value: (r) => r.status,
                },
                {
                  header: "Headcount",
                  cell: (r) => r.workforce_count ?? 1,
                  value: (r) => r.workforce_count ?? 1,
                },
                ...(permissions.canViewWagesAndPayments
                  ? [
                      {
                        header: "Wage",
                        cell: (r: { calculated_wage: number }) => currency(r.calculated_wage),
                        value: (r: { calculated_wage: number }) => r.calculated_wage,
                        className: "text-right",
                      },
                    ]
                  : []),
                {
                  header: "Remarks",
                  cell: (r) => r.remarks ?? "—",
                  value: (r) => r.remarks,
                },
              ]}
            />
          </TabsContent>
        )}

        {permissions.canViewMaterialsAndContractors && (
          <TabsContent value="materials">
            <DataTable
              rows={receipts.data ?? []}
              loading={receipts.isLoading}
              exportName={`${p?.project_code ?? "project"}-materials`}
              exportTitle={`${p?.name} — Material Receipts`}
              columns={[
                { header: "Receipt No", cell: (r) => r.receipt_number, value: (r) => r.receipt_number },
                {
                  header: "Date",
                  cell: (r) => dateFmt(r.receipt_date),
                  value: (r) => r.receipt_date,
                },
                {
                  header: "Material / Item",
                  cell: () => "General Material Supply",
                  value: () => "General Material Supply",
                },
                ...(permissions.canViewMaterialContractorCosts
                  ? [
                      {
                        header: "Amount",
                        cell: (r: { total_amount: number }) => currency(r.total_amount),
                        value: (r: { total_amount: number }) => r.total_amount,
                        className: "text-right",
                      },
                    ]
                  : []),
              ]}
            />
          </TabsContent>
        )}

        {permissions.canViewMaterialContractorCosts && (
          <TabsContent value="contractors">
            <DataTable
              rows={bills.data ?? []}
              loading={bills.isLoading}
              exportName={`${p?.project_code ?? "project"}-contractors`}
              exportTitle={`${p?.name} — Contractor Bills`}
              columns={[
                { header: "Bill No", cell: (r) => r.bill_number, value: (r) => r.bill_number },
                { header: "Date", cell: (r) => dateFmt(r.bill_date), value: (r) => r.bill_date },
                {
                  header: "Status",
                  cell: (r) => <StatusBadge status={r.status} />,
                  value: (r) => r.status,
                },
                {
                  header: "Net Amount",
                  cell: (r) => currency(r.net_amount),
                  value: (r) => r.net_amount,
                  className: "text-right",
                },
              ]}
            />
          </TabsContent>
        )}

        {permissions.canViewProjectFinancials && (
          <TabsContent value="budget">
            <DataTable
              rows={budgets.data ?? []}
              loading={budgets.isLoading}
              exportName={`${p?.project_code ?? "project"}-budget`}
              exportTitle={`${p?.name} — Budget Allotments`}
              columns={[
                { header: "Category", cell: (r) => r.category, value: (r) => r.category },
                {
                  header: "Budget",
                  cell: (r) => currency(r.budget_amount),
                  value: (r) => r.budget_amount,
                  className: "text-right",
                },
                { header: "Notes", cell: (r) => r.notes ?? "—", value: (r) => r.notes },
              ]}
            />
          </TabsContent>
        )}

        {permissions.canViewProjectFinancials && (
          <TabsContent value="expenses">
            <DataTable
              rows={expenses.data ?? []}
              loading={expenses.isLoading}
              exportName={`${p?.project_code ?? "project"}-expenses`}
              exportTitle={`${p?.name} — Site Expenses`}
              columns={[
                {
                  header: "Date",
                  cell: (r) => dateFmt(r.expense_date),
                  value: (r) => r.expense_date,
                },
                { header: "Category", cell: (r) => r.category, value: (r) => r.category },
                {
                  header: "Description",
                  cell: (r) => r.description ?? "—",
                  value: (r) => r.description,
                },
                {
                  header: "Amount",
                  cell: (r) => currency(r.amount),
                  value: (r) => r.amount,
                  className: "text-right",
                },
              ]}
            />
          </TabsContent>
        )}
      </Tabs>

      {/* Delete Quotation Dialog */}
      {deletingQuotation && (
        <ConfirmDeleteDialog
          open={!!deletingQuotation}
          onOpenChange={(open) => !open && setDeletingQuotation(null)}
          title="Delete Quotation"
          tableName="project_quotations"
          recordId={deletingQuotation.id}
          recordTitle={`Quotation: ${deletingQuotation.title} (${currency(deletingQuotation.amount)})`}
          recordData={deletingQuotation}
          description={`Delete quotation "${deletingQuotation.title}" (${currency(deletingQuotation.amount)})? This action requires MD approval.`}
          onConfirm={async () => {
            await deleteQuotation.mutateAsync(deletingQuotation.id);
            setDeletingQuotation(null);
          }}
        />
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
