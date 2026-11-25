import React, { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Landmark,
  Mail,
  MapPin,
  Phone,
  Plus,
  Printer,
  Receipt,
  Search,
  Sparkles,
  Truck,
  UserCheck,
  Wallet,
  X,
} from "lucide-react";
import { useRows, useSaveRow, sum } from "@/lib/db";
import { currency, dateFmt } from "@/lib/format";
import { StatusBadge } from "@/components/StatusBadge";
import {
  PrintableVoucherDialog,
  type PrintableVoucherData,
} from "@/components/PrintableVoucherDialog";
import { toast } from "sonner";

export type Party360Type = "client" | "supplier" | "contractor";

export interface Party360DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partyType: Party360Type;
  partyId: string | null;
  initialTab?: "overview" | "transactions" | "statement";
  onNewTransaction?: (action: string, partyId: string) => void;
}

export interface StatementLedgerEntry {
  id: string;
  date: string;
  docType: string;
  docNumber: string;
  details: string;
  projectName: string;
  billedAmount: number; // Invoiced / Billed / PO / Contract value
  paidAmount: number; // Payment received or made (+ TDS credit)
  runningBalance: number;
  isAdvance?: boolean;
  voucherData?: PrintableVoucherData;
}

export function computePartyStatementEntries(params: {
  openingBalance: number;
  entries: Omit<StatementLedgerEntry, "runningBalance">[];
}): {
  rows: StatementLedgerEntry[];
  totalBilled: number;
  totalPaid: number;
  closingBalance: number;
  unusedAdvance: number;
  netPayableOrReceivable: number;
} {
  const sorted = [...params.entries].sort((a, b) => {
    const cmp = (a.date || "").localeCompare(b.date || "");
    if (cmp !== 0) return cmp;
    return a.id.localeCompare(b.id);
  });

  let running = Number(params.openingBalance || 0);
  let totalBilled = 0;
  let totalPaid = 0;

  const rows: StatementLedgerEntry[] = sorted.map((e) => {
    const billed = Number(e.billedAmount || 0);
    const paid = Number(e.paidAmount || 0);
    totalBilled += billed;
    totalPaid += paid;
    running = running + billed - paid;
    return {
      ...e,
      runningBalance: running,
    };
  });

  const closingBalance = running;
  const unusedAdvance = closingBalance < 0 ? Math.abs(closingBalance) : 0;
  const netPayableOrReceivable = closingBalance > 0 ? closingBalance : 0;

  return {
    rows,
    totalBilled,
    totalPaid,
    closingBalance,
    unusedAdvance,
    netPayableOrReceivable,
  };
}

type DateRangePreset =
  | "all_time"
  | "this_month"
  | "last_month"
  | "this_fy"
  | "prev_fy"
  | "custom";

function getPresetDates(preset: DateRangePreset): { from: string; to: string; label: string } {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = now.getMonth(); // 0-indexed

  if (preset === "this_month") {
    const start = new Date(yyyy, mm, 1).toISOString().slice(0, 10);
    const end = new Date(yyyy, mm + 1, 0).toISOString().slice(0, 10);
    return { from: start, to: end, label: "This Month" };
  }
  if (preset === "last_month") {
    const start = new Date(yyyy, mm - 1, 1).toISOString().slice(0, 10);
    const end = new Date(yyyy, mm, 0).toISOString().slice(0, 10);
    return { from: start, to: end, label: "Last Month" };
  }
  if (preset === "this_fy") {
    const fyStartYear = mm >= 3 ? yyyy : yyyy - 1;
    return {
      from: `${fyStartYear}-04-01`,
      to: `${fyStartYear + 1}-03-31`,
      label: `FY ${fyStartYear}-${String(fyStartYear + 1).slice(2)}`,
    };
  }
  if (preset === "prev_fy") {
    const fyStartYear = (mm >= 3 ? yyyy : yyyy - 1) - 1;
    return {
      from: `${fyStartYear}-04-01`,
      to: `${fyStartYear + 1}-03-31`,
      label: `FY ${fyStartYear}-${String(fyStartYear + 1).slice(2)}`,
    };
  }
  return { from: "", to: "", label: "All Time" };
}

export function Party360Dialog({
  open,
  onOpenChange,
  partyType,
  partyId: initialPartyId,
  initialTab = "statement",
  onNewTransaction,
}: Party360DialogProps) {
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(initialPartyId);
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [sidebarSearch, setSidebarSearch] = useState<string>("");
  const [sidebarProjectFilter, setSidebarProjectFilter] = useState<string>("all");
  const [datePreset, setDatePreset] = useState<DateRangePreset>("all_time");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [voucherModalData, setVoucherModalData] = useState<PrintableVoucherData | null>(null);
  const [openAccordions, setOpenAccordions] = useState<{
    sec1: boolean;
    sec2: boolean;
    sec3: boolean;
    sec4: boolean;
    sec5: boolean;
  }>({
    sec1: true,
    sec2: true,
    sec3: true,
    sec4: true,
    sec5: true,
  });

  React.useEffect(() => {
    if (initialPartyId) setSelectedPartyId(initialPartyId);
  }, [initialPartyId]);

  React.useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab, open]);

  // Master Tables
  const clients = useRows<any>("clients", { order: { col: "name", asc: true }, enabled: open });
  const suppliers = useRows<any>("suppliers", { order: { col: "name", asc: true }, enabled: open });
  const contractors = useRows<any>("contractors", {
    order: { col: "name", asc: true },
    enabled: open,
  });
  const projects = useRows<any>("projects_view", {
    order: { col: "name", asc: true },
    enabled: open,
  });

  // Transaction Tables
  const quotations = useRows<any>("project_quotations", {
    order: { col: "created_at", asc: true },
    enabled: open && partyType === "client",
  });
  const milestones = useRows<any>("payment_milestones", {
    order: { col: "due_date", asc: true },
    enabled: open && partyType === "client",
  });
  const clientPayments = useRows<any>("client_payments", {
    order: { col: "payment_date", asc: true },
    enabled: open && partyType === "client",
  });

  const pos = useRows<any>("purchase_orders", {
    order: { col: "po_date", asc: true },
    enabled: open && partyType === "supplier",
  });
  const receipts = useRows<any>("material_receipts_view", {
    order: { col: "receipt_date", asc: true },
    enabled: open && partyType === "supplier",
  });
  const supplierPayments = useRows<any>("supplier_payments", {
    order: { col: "payment_date", asc: true },
    enabled: open && partyType === "supplier",
  });

  const workOrders = useRows<any>("work_orders", {
    order: { col: "wo_date", asc: true },
    enabled: open && partyType === "contractor",
  });
  const mbs = useRows<any>("measurement_books", {
    order: { col: "mb_date", asc: true },
    enabled: open && partyType === "contractor",
  });
  const contractorBills = useRows<any>("contractor_bills", {
    order: { col: "bill_date", asc: true },
    enabled: open && partyType === "contractor",
  });
  const contractorPayments = useRows<any>("contractor_payments", {
    order: { col: "payment_date", asc: true },
    enabled: open && partyType === "contractor",
  });

  const expenses = useRows<any>("expenses", {
    order: { col: "expense_date", asc: true },
    enabled: open,
  });

  const saveSupplierPayment = useSaveRow("supplier_payments", "Supplier Advance Application");
  const saveContractorPayment = useSaveRow(
    "contractor_payments",
    "Contractor Advance Application"
  );

  const projectName = (pid: string | null | undefined) =>
    (projects.data ?? []).find((p: any) => p.id === pid)?.name ?? "General / Corporate";
  const projectCode = (pid: string | null | undefined) =>
    (projects.data ?? []).find((p: any) => p.id === pid)?.project_code ?? "";

  // Compute all parties of this type with live balances & linked projects for the Left Sidebar Switcher
  const partyListWithMetrics = useMemo(() => {
    if (partyType === "client") {
      return (clients.data ?? [])
        .filter((c: any) => !c.deleted_at)
        .map((c: any) => {
          const clientProjects = (projects.data ?? []).filter(
            (p: any) => p.client_id === c.id && !p.deleted_at
          );
          const pIds = new Set(clientProjects.map((p: any) => p.id));
          const baseContract = sum(clientProjects, (p: any) => Number(p.quotation_amount || 0));
          const extraQuot = sum(
            (quotations.data ?? []).filter(
              (q: any) =>
                pIds.has(q.project_id) && q.status === "approved" && !q.is_void && !q.deleted_at
            ),
            (q: any) => Number(q.amount || 0)
          );
          const billed = Number(c.opening_balance || 0) + baseContract + extraQuot;
          const received = sum(
            (clientPayments.data ?? []).filter(
              (cp: any) =>
                (cp.client_id === c.id || pIds.has(cp.project_id)) &&
                !cp.is_void &&
                !cp.deleted_at
            ),
            (cp: any) =>
              cp.payment_category === "reversal"
                ? -Number(cp.amount || 0)
                : Number(cp.amount || 0) + Number(cp.tds_amount || 0)
          );
          const net = billed - received;
          return {
            ...c,
            projectIds: Array.from(pIds),
            projectNames: clientProjects.map((p: any) => p.name),
            billed,
            paid: received,
            netBalance: net,
            unusedAdvance: net < 0 ? Math.abs(net) : 0,
            outstanding: net > 0 ? net : 0,
          };
        });
    }

    if (partyType === "supplier") {
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
          const pIds = new Set<string>([
            ...sPos.map((x: any) => x.project_id).filter(Boolean),
            ...sGrns.map((x: any) => x.project_id).filter(Boolean),
            ...sPays.map((x: any) => x.project_id).filter(Boolean),
          ]);
          // Use PO total or GRN total (whichever reflects billed commitment; in Brickweld POs track balance due, plus standalone GRNs without PO)
          const poTotal = sum(sPos, (p: any) => Number(p.total_amount || 0));
          const standaloneGrnTotal = sum(
            sGrns.filter((g: any) => !g.po_id),
            (g: any) => Number(g.total_amount || 0)
          );
          const billed = Number(s.opening_balance || 0) + poTotal + standaloneGrnTotal;
          const paid = sum(sPays, (p: any) => Number(p.amount || 0));
          const net = billed - paid;
          const unappliedAdvances = sum(
            sPays.filter((p: any) => !p.po_id),
            (p: any) => Number(p.amount || 0)
          );
          return {
            ...s,
            projectIds: Array.from(pIds),
            projectNames: Array.from(pIds).map((id) => projectName(id)),
            billed,
            paid,
            netBalance: net,
            unusedAdvance: net < 0 ? Math.abs(net) : unappliedAdvances,
            outstanding: net > 0 ? net : 0,
          };
        });
    }

    // Contractor
    return (contractors.data ?? [])
      .filter((c: any) => !c.deleted_at)
      .map((c: any) => {
        const cWos = (workOrders.data ?? []).filter(
          (w: any) => w.contractor_id === c.id && !w.is_void && !w.deleted_at
        );
        const cBills = (contractorBills.data ?? []).filter(
          (b: any) =>
            b.contractor_id === c.id &&
            b.status !== "rejected" &&
            !b.is_void &&
            !b.deleted_at
        );
        const cPays = (contractorPayments.data ?? []).filter(
          (p: any) => p.contractor_id === c.id && !p.is_void && !p.deleted_at
        );
        const pIds = new Set<string>([
          ...cWos.map((x: any) => x.project_id).filter(Boolean),
          ...cBills.map((x: any) => x.project_id).filter(Boolean),
          ...cPays.map((x: any) => x.project_id).filter(Boolean),
        ]);
        const billed =
          Number(c.opening_balance || 0) + sum(cBills, (b: any) => Number(b.net_amount || 0));
        const paid = sum(cPays, (p: any) => Number(p.amount || 0));
        const net = billed - paid;
        const unappliedAdvances = sum(
          cPays.filter((p: any) => !p.bill_id),
          (p: any) => Number(p.amount || 0)
        );
        return {
          ...c,
          projectIds: Array.from(pIds),
          projectNames: Array.from(pIds).map((id) => projectName(id)),
          billed,
          paid,
          netBalance: net,
          unusedAdvance: net < 0 ? Math.abs(net) : unappliedAdvances,
          outstanding: net > 0 ? net : 0,
        };
      });
  }, [
    partyType,
    clients.data,
    suppliers.data,
    contractors.data,
    projects.data,
    quotations.data,
    clientPayments.data,
    pos.data,
    receipts.data,
    supplierPayments.data,
    workOrders.data,
    contractorBills.data,
    contractorPayments.data,
  ]);

  const filteredSidebarParties = useMemo(() => {
    return partyListWithMetrics.filter((p: any) => {
      if (
        sidebarProjectFilter !== "all" &&
        !(p.projectIds || []).includes(sidebarProjectFilter)
      ) {
        return false;
      }
      if (!sidebarSearch.trim()) return true;
      const q = sidebarSearch.toLowerCase();
      const matchName = (p.name || "").toLowerCase().includes(q);
      const matchCode = (p.contractor_code || p.gst_number || "").toLowerCase().includes(q);
      const matchProj = (p.projectNames || []).some((pn: string) =>
        pn.toLowerCase().includes(q)
      );
      return matchName || matchCode || matchProj;
    });
  }, [partyListWithMetrics, sidebarSearch, sidebarProjectFilter]);

  const currentParty = useMemo(() => {
    return (
      partyListWithMetrics.find((p: any) => p.id === selectedPartyId) ||
      partyListWithMetrics[0] ||
      null
    );
  }, [partyListWithMetrics, selectedPartyId]);

  // Date Window
  const activeDates = useMemo(() => {
    if (datePreset === "custom") {
      return {
        from: customFrom,
        to: customTo,
        label:
          customFrom || customTo
            ? `${customFrom ? dateFmt(customFrom) : "Start"} to ${
                customTo ? dateFmt(customTo) : "Today"
              }`
            : "All Time",
      };
    }
    return getPresetDates(datePreset);
  }, [datePreset, customFrom, customTo]);

  const inDateAndProject = (dateStr: string | null | undefined, pid: string | null | undefined) => {
    if (projectFilter !== "all" && pid !== projectFilter) return false;
    const d = (dateStr || "").slice(0, 10);
    if (activeDates.from && d && d < activeDates.from) return false;
    if (activeDates.to && d && d > activeDates.to) return false;
    return true;
  };

  // Party-specific Filtered Records & Chronological Statement Rows
  const partyData = useMemo(() => {
    if (!currentParty) {
      return {
        statement: computePartyStatementEntries({ openingBalance: 0, entries: [] }),
        clientProjects: [],
        clientQuotations: [],
        clientMilestones: [],
        clientReceipts: [],
        supplierPos: [],
        supplierGrns: [],
        supplierPays: [],
        contractorWos: [],
        contractorMbs: [],
        contractorBillsList: [],
        contractorPays: [],
        taggedExpenses: [],
        unappliedAdvancesList: [],
        openDocumentsToApply: [],
      };
    }

    const rawEntries: Omit<StatementLedgerEntry, "runningBalance">[] = [];

    if (partyType === "client") {
      const clientProjects = (projects.data ?? []).filter(
        (p: any) =>
          p.client_id === currentParty.id &&
          !p.deleted_at &&
          (projectFilter === "all" || p.id === projectFilter)
      );
      const allClientPids = new Set(
        (projects.data ?? [])
          .filter((p: any) => p.client_id === currentParty.id && !p.deleted_at)
          .map((p: any) => p.id)
      );

      const clientQuotations = (quotations.data ?? []).filter(
        (q: any) =>
          allClientPids.has(q.project_id) &&
          !q.is_void &&
          !q.deleted_at &&
          inDateAndProject(q.created_at, q.project_id)
      );
      const clientMilestones = (milestones.data ?? []).filter(
        (m: any) =>
          allClientPids.has(m.project_id) &&
          !m.deleted_at &&
          inDateAndProject(m.due_date || m.created_at, m.project_id)
      );
      const clientReceipts = (clientPayments.data ?? []).filter(
        (cp: any) =>
          (cp.client_id === currentParty.id || allClientPids.has(cp.project_id)) &&
          !cp.is_void &&
          !cp.deleted_at &&
          inDateAndProject(cp.payment_date, cp.project_id)
      );
      const taggedExpenses = (expenses.data ?? []).filter(
        (e: any) =>
          (e.client_id === currentParty.id || allClientPids.has(e.project_id)) &&
          !e.is_void &&
          !e.deleted_at &&
          inDateAndProject(e.expense_date, e.project_id)
      );

      // Statement Entries for Client (Buyer)
      for (const p of clientProjects) {
        if (Number(p.quotation_amount || 0) > 0) {
          rawEntries.push({
            id: `proj-${p.id}`,
            date: p.start_date || (p.created_at || "").slice(0, 10),
            docType: "Project Contract",
            docNumber: p.project_code,
            details: `${p.name} — Base Contract Value`,
            projectName: p.name,
            billedAmount: Number(p.quotation_amount || 0),
            paidAmount: 0,
          });
        }
      }

      for (const q of clientQuotations.filter((x: any) => x.status === "approved")) {
        rawEntries.push({
          id: `quot-${q.id}`,
          date: (q.created_at || "").slice(0, 10),
          docType: "Approved Quotation",
          docNumber: q.quotation_number,
          details: q.description || "Additional scope quotation",
          projectName: projectName(q.project_id),
          billedAmount: Number(q.amount || 0),
          paidAmount: 0,
          voucherData: {
            type: "quotation",
            voucherNumber: q.quotation_number,
            date: (q.created_at || "").slice(0, 10),
            statusBadge: "Approved",
            partyLabel: "Customer / Buyer",
            partyName: currentParty.name,
            partyAddress: currentParty.address,
            partyPhone: currentParty.phone,
            partyGstin: currentParty.gst_number,
            projectName: projectName(q.project_id),
            amount: Number(q.amount || 0),
            notes: q.description,
          },
        });
      }

      for (const cp of clientReceipts) {
        const isRev = cp.payment_category === "reversal";
        const amt = Number(cp.amount || 0);
        const tds = Number(cp.tds_amount || 0);
        rawEntries.push({
          id: `cp-${cp.id}`,
          date: cp.payment_date,
          docType: isRev
            ? "Receipt Reversal"
            : cp.payment_category === "advance"
            ? "Customer Advance"
            : "Payment Received",
          docNumber: cp.receipt_number,
          details: `${(cp.payment_method || "Bank").toUpperCase()}${
            cp.reference_number ? ` · Ref: ${cp.reference_number}` : ""
          }${tds > 0 ? ` · Includes TDS ${currency(tds)}` : ""}`,
          projectName: projectName(cp.project_id),
          billedAmount: isRev ? amt : 0,
          paidAmount: isRev ? 0 : amt + tds,
          isAdvance: cp.payment_category === "advance",
          voucherData: {
            type: "client_receipt",
            voucherNumber: cp.receipt_number,
            date: cp.payment_date,
            statusBadge: cp.payment_category === "advance" ? "Advance" : "Received",
            statusTone: cp.payment_category === "advance" ? "blue" : "emerald",
            partyLabel: "Received From (Buyer)",
            partyName: currentParty.name,
            partyAddress: currentParty.address,
            partyPhone: currentParty.phone,
            partyGstin: currentParty.gst_number,
            projectName: projectName(cp.project_id),
            paymentMode: cp.payment_method,
            paymentSource: cp.payment_source,
            walletName: cp.wallet_name,
            referenceNumber: cp.reference_number,
            linkedDocLabel: "Invoice / Milestone Ref",
            linkedDocNumber: cp.invoice_reference,
            amount: amt,
            tdsAmount: tds,
            overPaymentAmount: cp.payment_category === "advance" ? amt : null,
            notes: cp.notes,
          },
        });
      }

      return {
        statement: computePartyStatementEntries({
          openingBalance: Number(currentParty.opening_balance || 0),
          entries: rawEntries,
        }),
        clientProjects,
        clientQuotations,
        clientMilestones,
        clientReceipts,
        supplierPos: [],
        supplierGrns: [],
        supplierPays: [],
        contractorWos: [],
        contractorMbs: [],
        contractorBillsList: [],
        contractorPays: [],
        taggedExpenses,
        unappliedAdvancesList: [],
        openDocumentsToApply: [],
      };
    }

    if (partyType === "supplier") {
      const supplierPos = (pos.data ?? []).filter(
        (p: any) =>
          p.supplier_id === currentParty.id &&
          !p.is_void &&
          !p.deleted_at &&
          inDateAndProject(p.po_date, p.project_id)
      );
      const supplierGrns = (receipts.data ?? []).filter(
        (r: any) =>
          r.supplier_id === currentParty.id &&
          !r.deleted_at &&
          inDateAndProject(r.receipt_date, r.project_id)
      );
      const supplierPays = (supplierPayments.data ?? []).filter(
        (p: any) =>
          p.supplier_id === currentParty.id &&
          !p.is_void &&
          !p.deleted_at &&
          inDateAndProject(p.payment_date, p.project_id)
      );
      const taggedExpenses = (expenses.data ?? []).filter(
        (e: any) =>
          e.supplier_id === currentParty.id &&
          !e.is_void &&
          !e.deleted_at &&
          inDateAndProject(e.expense_date, e.project_id)
      );

      for (const po of supplierPos) {
        const hasGrn = supplierGrns.some((g: any) => g.po_id === po.id);
        const bStatus =
          po.billed_status === "billed" || hasGrn ? "Billed" : "Yet to be Billed";
        rawEntries.push({
          id: `po-${po.id}`,
          date: po.po_date,
          docType: `Purchase Order (${bStatus})`,
          docNumber: po.po_number,
          details: `${projectName(po.project_id)}${
            po.supplier_bill_number ? ` · Bill #${po.supplier_bill_number}` : ""
          }`,
          projectName: projectName(po.project_id),
          billedAmount: Number(po.total_amount || 0),
          paidAmount: 0,
          voucherData: {
            type: "purchase_order",
            voucherNumber: po.po_number,
            date: po.po_date,
            statusBadge: bStatus,
            statusTone: bStatus === "Billed" ? "emerald" : "amber",
            partyLabel: "Supplier / Vendor",
            partyName: currentParty.name,
            partyAddress: currentParty.address,
            partyPhone: currentParty.phone,
            partyGstin: currentParty.gst_number,
            projectName: projectName(po.project_id),
            grossAmount: Number(po.subtotal || 0),
            taxAmount: Number(po.tax_amount || 0),
            travelCharges: Number(po.travel_charges || 0),
            amount: Number(po.total_amount || 0),
            notes: po.terms,
          },
        });
      }

      // Include standalone GRNs that don't have a PO so their billed amount is never missed
      for (const grn of supplierGrns.filter((g: any) => !g.po_id)) {
        rawEntries.push({
          id: `grn-${grn.id}`,
          date: grn.receipt_date,
          docType: "Direct Goods Receipt (Bill)",
          docNumber: grn.receipt_number,
          details: grn.remarks || "Direct material receipt without PO",
          projectName: projectName(grn.project_id),
          billedAmount: Number(grn.total_amount || 0),
          paidAmount: 0,
          voucherData: {
            type: "grn_bill",
            voucherNumber: grn.receipt_number,
            date: grn.receipt_date,
            statusBadge: "Billed",
            partyLabel: "Supplier / Vendor",
            partyName: currentParty.name,
            partyAddress: currentParty.address,
            partyPhone: currentParty.phone,
            partyGstin: currentParty.gst_number,
            projectName: projectName(grn.project_id),
            amount: Number(grn.total_amount || 0),
            notes: grn.remarks,
          },
        });
      }

      for (const sp of supplierPays) {
        const linkedPo = (pos.data ?? []).find((p: any) => p.id === sp.po_id);
        const isAdv = !sp.po_id || Boolean(sp.is_advance);
        const overPay = !sp.po_id
          ? Number(sp.amount || 0)
          : linkedPo && Number(sp.amount || 0) > Number(linkedPo.total_amount || 0)
          ? Number(sp.amount || 0) - Number(linkedPo.total_amount || 0)
          : Number(sp.unused_amount || 0);

        rawEntries.push({
          id: `sp-${sp.id}`,
          date: sp.payment_date,
          docType: isAdv ? "Vendor Advance / Payment" : "Payment Made",
          docNumber: sp.reference_number || `PAY-${sp.id.slice(0, 6).toUpperCase()}`,
          details: linkedPo
            ? `Applied to ${linkedPo.po_number} (${(
                sp.payment_method || "Bank"
              ).toUpperCase()})`
            : `Excess advance payment · ${(sp.payment_method || "Bank").toUpperCase()}`,
          projectName: projectName(sp.project_id),
          billedAmount: 0,
          paidAmount: Number(sp.amount || 0),
          isAdvance: isAdv,
          voucherData: {
            type: "supplier_payment",
            voucherNumber: sp.reference_number || `PAY-${sp.id.slice(0, 6).toUpperCase()}`,
            date: sp.payment_date,
            statusBadge: isAdv ? "Advance" : "Paid",
            statusTone: isAdv ? "amber" : "emerald",
            partyLabel: "Paid To (Supplier)",
            partyName: currentParty.name,
            partyAddress: currentParty.address,
            partyPhone: currentParty.phone,
            partyGstin: currentParty.gst_number,
            projectName: projectName(sp.project_id),
            paymentMode: sp.payment_method || sp.payment_mode,
            paymentSource: sp.payment_source,
            walletName: sp.wallet_name,
            referenceNumber: sp.reference_number,
            linkedDocLabel: linkedPo ? "Purchase Order #" : null,
            linkedDocNumber: linkedPo?.po_number ?? null,
            linkedDocDate: linkedPo?.po_date ?? null,
            linkedDocTotal: linkedPo ? Number(linkedPo.total_amount || 0) : null,
            amount: Number(sp.amount || 0),
            overPaymentAmount: overPay > 0 ? overPay : null,
            notes: sp.remarks,
          },
        });
      }

      const unappliedAdvancesList = supplierPays.filter((p: any) => !p.po_id);
      const openDocumentsToApply = supplierPos
        .map((po: any) => {
          const paid = sum(
            supplierPays.filter((p: any) => p.po_id === po.id),
            (p: any) => Number(p.amount || 0)
          );
          return {
            id: po.id,
            docNumber: po.po_number,
            date: po.po_date,
            total: Number(po.total_amount || 0),
            balanceDue: Math.max(0, Number(po.total_amount || 0) - paid),
          };
        })
        .filter((d: any) => d.balanceDue > 0);

      return {
        statement: computePartyStatementEntries({
          openingBalance: Number(currentParty.opening_balance || 0),
          entries: rawEntries,
        }),
        clientProjects: [],
        clientQuotations: [],
        clientMilestones: [],
        clientReceipts: [],
        supplierPos,
        supplierGrns,
        supplierPays,
        contractorWos: [],
        contractorMbs: [],
        contractorBillsList: [],
        contractorPays: [],
        taggedExpenses,
        unappliedAdvancesList,
        openDocumentsToApply,
      };
    }

    // Contractor
    const contractorWos = (workOrders.data ?? []).filter(
      (w: any) =>
        w.contractor_id === currentParty.id &&
        !w.is_void &&
        !w.deleted_at &&
        inDateAndProject(w.wo_date, w.project_id)
    );
    const contractorMbs = (contractorWos.length >= 0 ? mbs.data ?? [] : []).filter(
      (m: any) =>
        m.contractor_id === currentParty.id &&
        !m.deleted_at &&
        inDateAndProject(m.mb_date, m.project_id)
    );
    const contractorBillsList = (contractorBills.data ?? []).filter(
      (b: any) =>
        b.contractor_id === currentParty.id &&
        b.status !== "rejected" &&
        !b.is_void &&
        !b.deleted_at &&
        inDateAndProject(b.bill_date, b.project_id)
    );
    const contractorPays = (contractorPayments.data ?? []).filter(
      (p: any) =>
        p.contractor_id === currentParty.id &&
        !p.is_void &&
        !p.deleted_at &&
        inDateAndProject(p.payment_date, p.project_id)
    );
    const taggedExpenses = (expenses.data ?? []).filter(
      (e: any) =>
        e.contractor_id === currentParty.id &&
        !e.is_void &&
        !e.deleted_at &&
        inDateAndProject(e.expense_date, e.project_id)
    );

    for (const b of contractorBillsList) {
      rawEntries.push({
        id: `cb-${b.id}`,
        date: b.bill_date,
        docType: "Contractor RA Bill",
        docNumber: b.bill_number,
        details: `${projectName(b.project_id)} · Gross ${currency(b.gross_amount)}${
          Number(b.deductions || 0) > 0 ? ` · TDS/Ded: ${currency(b.deductions)}` : ""
        }`,
        projectName: projectName(b.project_id),
        billedAmount: Number(b.net_amount || 0),
        paidAmount: 0,
        voucherData: {
          type: "contractor_bill",
          voucherNumber: b.bill_number,
          date: b.bill_date,
          statusBadge: (b.status || "Approved").toUpperCase(),
          partyLabel: "Contractor / Subcontractor",
          partyName: currentParty.name,
          partyCode: currentParty.contractor_code,
          partyAddress: currentParty.address,
          partyPhone: currentParty.phone,
          partyGstin: currentParty.gst_number,
          projectName: projectName(b.project_id),
          grossAmount: Number(b.gross_amount || 0),
          tdsAmount: Number(b.deductions || 0),
          retentionAmount: Number(b.retention_amount || 0),
          amount: Number(b.net_amount || 0),
          notes: b.remarks,
        },
      });
    }

    for (const cp of contractorPays) {
      const linkedBill = (contractorBills.data ?? []).find((b: any) => b.id === cp.bill_id);
      const isAdv = !cp.bill_id || Boolean(cp.is_advance);
      const overPay = !cp.bill_id
        ? Number(cp.amount || 0)
        : linkedBill && Number(cp.amount || 0) > Number(linkedBill.net_amount || 0)
        ? Number(cp.amount || 0) - Number(linkedBill.net_amount || 0)
        : Number(cp.unused_amount || 0);

      rawEntries.push({
        id: `cpay-${cp.id}`,
        date: cp.payment_date,
        docType: isAdv ? "Contractor Advance" : "Payment Made",
        docNumber: cp.reference_number || `CPAY-${cp.id.slice(0, 6).toUpperCase()}`,
        details: linkedBill
          ? `Applied to Bill ${linkedBill.bill_number} (${(
              cp.payment_method || "Bank"
            ).toUpperCase()})`
          : `Excess advance payment · ${(cp.payment_method || "Bank").toUpperCase()}`,
        projectName: projectName(cp.project_id),
        billedAmount: 0,
        paidAmount: Number(cp.amount || 0),
        isAdvance: isAdv,
        voucherData: {
          type: "contractor_payment",
          voucherNumber: cp.reference_number || `CPAY-${cp.id.slice(0, 6).toUpperCase()}`,
          date: cp.payment_date,
          statusBadge: isAdv ? "Advance" : "Paid",
          statusTone: isAdv ? "amber" : "emerald",
          partyLabel: "Paid To (Contractor)",
          partyName: currentParty.name,
          partyCode: currentParty.contractor_code,
          partyAddress: currentParty.address,
          partyPhone: currentParty.phone,
          partyGstin: currentParty.gst_number,
          projectName: projectName(cp.project_id),
          paymentMode: cp.payment_method || cp.payment_mode,
          paymentSource: cp.payment_source,
          walletName: cp.wallet_name,
          referenceNumber: cp.reference_number,
          linkedDocLabel: linkedBill ? "Contractor Bill #" : null,
          linkedDocNumber: linkedBill?.bill_number ?? null,
          linkedDocDate: linkedBill?.bill_date ?? null,
          linkedDocTotal: linkedBill ? Number(linkedBill.net_amount || 0) : null,
          amount: Number(cp.amount || 0),
          overPaymentAmount: overPay > 0 ? overPay : null,
          notes: cp.remarks,
        },
      });
    }

    const unappliedAdvancesList = contractorPays.filter((p: any) => !p.bill_id);
    const openDocumentsToApply = contractorBillsList
      .map((b: any) => {
        const paid = sum(
          contractorPays.filter((p: any) => p.bill_id === b.id),
          (p: any) => Number(p.amount || 0)
        );
        return {
          id: b.id,
          docNumber: b.bill_number,
          date: b.bill_date,
          total: Number(b.net_amount || 0),
          balanceDue: Math.max(0, Number(b.net_amount || 0) - paid),
        };
      })
      .filter((d: any) => d.balanceDue > 0);

    return {
      statement: computePartyStatementEntries({
        openingBalance: Number(currentParty.opening_balance || 0),
        entries: rawEntries,
      }),
      clientProjects: [],
      clientQuotations: [],
      clientMilestones: [],
      clientReceipts: [],
      supplierPos: [],
      supplierGrns: [],
      supplierPays: [],
      contractorWos,
      contractorMbs,
      contractorBillsList,
      contractorPays,
      taggedExpenses,
      unappliedAdvancesList,
      openDocumentsToApply,
    };
  }, [
    currentParty,
    partyType,
    projectFilter,
    activeDates,
    projects.data,
    quotations.data,
    milestones.data,
    clientPayments.data,
    pos.data,
    receipts.data,
    supplierPayments.data,
    workOrders.data,
    mbs.data,
    contractorBills.data,
    contractorPayments.data,
    expenses.data,
  ]);

  const handleApplyAdvanceToDocument = async (advancePaymentId: string, targetDocId: string) => {
    try {
      if (partyType === "supplier") {
        await saveSupplierPayment.mutateAsync({
          id: advancePaymentId,
          values: { po_id: targetDocId, is_advance: false },
        });
        toast.success("Advance credit applied to Purchase Order!");
      } else if (partyType === "contractor") {
        await saveContractorPayment.mutateAsync({
          id: advancePaymentId,
          values: { bill_id: targetDocId, is_advance: false },
        });
        toast.success("Advance credit applied to Contractor Bill!");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to apply advance credit.");
    }
  };

  // Print A4 Statement of Accounts Sheet
  const handlePrintStatement = () => {
    const el = document.getElementById("zoho-party-statement-a4-sheet");
    if (!el || !currentParty) return;
    const win = window.open("", "_blank", "width=1000,height=1150");
    if (!win) {
      window.print();
      return;
    }
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Statement of Accounts - ${currentParty.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #0f172a;
      background: #ffffff;
      padding: 20px;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    @page { size: A4 portrait; margin: 10mm; }
    .no-print-in-sheet { display: none !important; }
  </style>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  ${el.outerHTML}
  <script>
    setTimeout(() => {
      window.print();
    }, 350);
  </script>
</body>
</html>`);
    win.document.close();
  };

  // Export Statement CSV
  const handleExportCsv = () => {
    if (!currentParty) return;
    const headers = [
      "Date",
      "Transaction Type",
      "Document / Ref #",
      "Project / Site",
      "Details",
      partyType === "client" ? "Contract / Invoiced (Rs)" : "Billed Amount (Rs)",
      partyType === "client" ? "Received + TDS (Rs)" : "Payments Made (Rs)",
      "Running Balance (Rs)",
    ];
    const lines = [
      headers.join(","),
      [
        "Opening",
        "Opening Balance",
        "-",
        "-",
        "Opening Balance",
        Number(currentParty.opening_balance || 0),
        0,
        Number(currentParty.opening_balance || 0),
      ].join(","),
      ...partyData.statement.rows.map((r) =>
        [
          r.date,
          `"${r.docType.replace(/"/g, '""')}"`,
          `"${(r.docNumber || "").replace(/"/g, '""')}"`,
          `"${(r.projectName || "").replace(/"/g, '""')}"`,
          `"${(r.details || "").replace(/"/g, '""')}"`,
          r.billedAmount,
          r.paidAmount,
          r.runningBalance,
        ].join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Statement-${currentParty.name.replace(/[^a-zA-Z0-9]/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleAccordion = (key: "sec1" | "sec2" | "sec3" | "sec4" | "sec5") =>
    setOpenAccordions((prev) => ({ ...prev, [key]: !prev[key] }));

  const roleTitle =
    partyType === "client"
      ? "Customer / Buyer"
      : partyType === "supplier"
      ? "Material Supplier (Vendor)"
      : "Work Contractor (Vendor)";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[96vw] sm:max-w-[95vw] xl:max-w-7xl h-[92vh] p-0 overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-950">
          {/* Top Workspace Bar */}
          <DialogHeader className="px-5 py-3 bg-white dark:bg-slate-900 border-b flex flex-row items-center justify-between space-y-0 shrink-0">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
                {partyType === "client" ? (
                  <Building2 className="size-5" />
                ) : partyType === "supplier" ? (
                  <Truck className="size-5" />
                ) : (
                  <UserCheck className="size-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-base font-bold">
                    {currentParty ? currentParty.name : `Zoho Books ${roleTitle} 360°`}
                  </DialogTitle>
                  <Badge variant="outline" className="text-[11px] font-semibold">
                    {roleTitle} 360° Workspace
                  </Badge>
                  {currentParty?.contractor_code && (
                    <Badge variant="secondary" className="font-mono text-[11px]">
                      {currentParty.contractor_code}
                    </Badge>
                  )}
                  {currentParty?.gst_number && (
                    <Badge variant="secondary" className="font-mono text-[11px]">
                      GSTIN: {currentParty.gst_number}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Switch {partyType}s in the left pane · Inspect all transactions · Download 1-click A4 Statement of Accounts PDF
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {currentParty && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleExportCsv}
                    className="h-8 text-xs gap-1.5"
                  >
                    <FileSpreadsheet className="size-3.5 text-emerald-600" /> Excel / CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => {
                      setActiveTab("statement");
                      setTimeout(handlePrintStatement, 100);
                    }}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Printer className="size-3.5" /> Download Statement PDF
                  </Button>
                </>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="size-8"
                onClick={() => onOpenChange(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
          </DialogHeader>

          {/* Main Split View: Left Party Switcher Sidebar + Right 360° Detail Pane */}
          <div className="flex-1 flex overflow-hidden">
            {/* LEFT SIDEBAR: ZOHO MASTER-DETAIL SWITCHER */}
            <div className="w-72 border-r bg-white dark:bg-slate-900 flex flex-col shrink-0 hidden md:flex">
              <div className="p-3 border-b space-y-2">
                <div className="relative">
                  <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    value={sidebarSearch}
                    onChange={(e) => setSidebarSearch(e.target.value)}
                    placeholder={`Search ${partyType} or site (e.g. Kolar)...`}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                <Select value={sidebarProjectFilter} onValueChange={setSidebarProjectFilter}>
                  <SelectTrigger className="h-7 text-[11px]">
                    <SelectValue placeholder="Filter by Project / Site" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects / Sites ({partyListWithMetrics.length})</SelectItem>
                    {(projects.data ?? []).map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 overflow-y-auto divide-y">
                {filteredSidebarParties.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    No matching {partyType}s found.
                  </div>
                ) : (
                  filteredSidebarParties.map((p: any) => {
                    const isSelected = currentParty?.id === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setSelectedPartyId(p.id)}
                        className={`w-full text-left px-3.5 py-2.5 transition-colors flex items-start justify-between gap-2 ${
                          isSelected
                            ? "bg-primary/10 border-l-4 border-l-primary font-semibold"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate text-foreground">
                            {p.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                            {p.projectNames?.length
                              ? p.projectNames.join(", ")
                              : p.phone || p.address || "No project tagged"}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          {p.outstanding > 0 ? (
                            <span className="text-[11px] font-mono font-bold text-destructive block">
                              {currency(p.outstanding)}
                            </span>
                          ) : p.unusedAdvance > 0 ? (
                            <span className="text-[11px] font-mono font-bold text-amber-600 block">
                              Adv: {currency(p.unusedAdvance)}
                            </span>
                          ) : (
                            <span className="text-[11px] font-mono text-emerald-600 block">
                              ₹0
                            </span>
                          )}
                          <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                            {p.outstanding > 0
                              ? partyType === "client"
                                ? "Receivable"
                                : "Payable"
                              : p.unusedAdvance > 0
                              ? "Unused Cr"
                              : "Settled"}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* RIGHT DETAIL WORKSPACE */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {!currentParty ? (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                  Select a {partyType} to view their 360° ledger and statement.
                </div>
              ) : (
                <>
                  {/* Filter & Summary Strip */}
                  <div className="px-6 py-3 bg-white dark:bg-slate-900 border-b flex flex-wrap items-center justify-between gap-3 shrink-0">
                    <Tabs
                      value={activeTab}
                      onValueChange={setActiveTab}
                      className="w-auto"
                    >
                      <TabsList className="h-8">
                        <TabsTrigger value="overview" className="text-xs px-3 py-1">
                          Overview
                        </TabsTrigger>
                        <TabsTrigger value="transactions" className="text-xs px-3 py-1">
                          Transactions ({partyData.statement.rows.length})
                        </TabsTrigger>
                        <TabsTrigger value="statement" className="text-xs px-3 py-1 font-semibold">
                          Statement of Accounts (PDF View)
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>

                    {/* Project & Date Period Filters */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Select value={projectFilter} onValueChange={setProjectFilter}>
                        <SelectTrigger className="h-8 w-44 text-xs">
                          <SelectValue placeholder="All Projects" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Projects / Sites</SelectItem>
                          {(projects.data ?? []).map((p: any) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select
                        value={datePreset}
                        onValueChange={(v) => setDatePreset(v as DateRangePreset)}
                      >
                        <SelectTrigger className="h-8 w-40 text-xs">
                          <SelectValue placeholder="Date Range" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all_time">All Time</SelectItem>
                          <SelectItem value="this_month">This Month</SelectItem>
                          <SelectItem value="last_month">Last Month</SelectItem>
                          <SelectItem value="this_fy">This Fiscal Year</SelectItem>
                          <SelectItem value="prev_fy">Previous Fiscal Year</SelectItem>
                          <SelectItem value="custom">Custom Date Range</SelectItem>
                        </SelectContent>
                      </Select>

                      {datePreset === "custom" && (
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="date"
                            value={customFrom}
                            onChange={(e) => setCustomFrom(e.target.value)}
                            className="h-8 w-32 text-xs"
                          />
                          <span className="text-xs text-muted-foreground">to</span>
                          <Input
                            type="date"
                            value={customTo}
                            onChange={(e) => setCustomTo(e.target.value)}
                            className="h-8 w-32 text-xs"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Unapplied Advance Credits Banner (Batch 3 Items 25 & 26) */}
                  {partyData.unappliedAdvancesList.length > 0 &&
                    partyData.openDocumentsToApply.length > 0 && (
                      <div className="mx-6 mt-3 rounded-lg border border-blue-300 bg-blue-50/90 dark:bg-blue-950/40 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
                        <div className="flex items-center gap-2 text-xs text-blue-950 dark:text-blue-200">
                          <Sparkles className="size-4 text-blue-600 shrink-0" />
                          <span>
                            <strong>
                              Unused Advance Credits Available (
                              {currency(
                                sum(partyData.unappliedAdvancesList, (a: any) =>
                                  Number(a.amount || 0)
                                )
                              )}
                              ):
                            </strong>{" "}
                            You have {partyData.unappliedAdvancesList.length} unapplied advance
                            payment(s) and {partyData.openDocumentsToApply.length} open{" "}
                            {partyType === "supplier" ? "Purchase Order(s)" : "Contractor Bill(s)"}.
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {partyData.unappliedAdvancesList[0] &&
                            partyData.openDocumentsToApply[0] && (
                              <Button
                                size="sm"
                                variant="default"
                                className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={() => {
                                  const adv = partyData.unappliedAdvancesList[0];
                                  const doc = partyData.openDocumentsToApply[0];
                                  if (adv && doc) {
                                    handleApplyAdvanceToDocument(adv.id, doc.id);
                                  }
                                }}
                              >
                                Apply {currency(partyData.unappliedAdvancesList[0].amount)} to{" "}
                                {partyData.openDocumentsToApply[0].docNumber}
                              </Button>
                            )}
                        </div>
                      </div>
                    )}

                  {/* TAB CONTENTS */}
                  <div className="flex-1 overflow-y-auto p-6">
                    {/* ==================== TAB 1: OVERVIEW ==================== */}
                    {activeTab === "overview" && (
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Left Contact & Identity Card */}
                        <div className="lg:col-span-4 space-y-4">
                          <div className="rounded-lg border bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                {roleTitle} Profile
                              </p>
                              <h3 className="text-lg font-bold mt-1">{currentParty.name}</h3>
                              {currentParty.contact_person && (
                                <p className="text-xs text-muted-foreground">
                                  Contact: {currentParty.contact_person}
                                </p>
                              )}
                            </div>

                            <div className="space-y-2.5 text-xs pt-2 border-t">
                              <div className="flex items-start gap-2.5">
                                <Phone className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
                                <span>{currentParty.phone || "No phone recorded"}</span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <Mail className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
                                <span>{currentParty.email || "No email recorded"}</span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <MapPin className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
                                <span>{currentParty.address || "No address recorded"}</span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <Landmark className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />
                                <div>
                                  <p>
                                    GSTIN:{" "}
                                    <strong className="font-mono">
                                      {currentParty.gst_number || "Unregistered"}
                                    </strong>
                                  </p>
                                  <p className="text-muted-foreground mt-0.5">
                                    Place of Supply: {currentParty.place_of_supply || "Tamil Nadu"}
                                  </p>
                                  {currentParty.bank_details && (
                                    <p className="text-muted-foreground mt-0.5">
                                      Bank: {currentParty.bank_details}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Tagged Projects List */}
                            <div className="pt-3 border-t">
                              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                                Active Projects / Sites ({currentParty.projectNames?.length || 0})
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {(currentParty.projectNames || []).length === 0 ? (
                                  <span className="text-xs text-muted-foreground">
                                    No project transactions yet
                                  </span>
                                ) : (
                                  currentParty.projectNames.map((pn: string, i: number) => (
                                    <Badge key={i} variant="secondary" className="text-xs">
                                      {pn}
                                    </Badge>
                                  ))
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right Financial Summary & Recent Activity Timeline */}
                        <div className="lg:col-span-8 space-y-5">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="rounded-lg border bg-white dark:bg-slate-900 p-4">
                              <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                                {partyType === "client" ? "Total Contract / Billed" : "Total Billed"}
                              </p>
                              <p className="text-lg font-bold font-mono mt-1">
                                {currency(partyData.statement.totalBilled)}
                              </p>
                            </div>
                            <div className="rounded-lg border bg-white dark:bg-slate-900 p-4">
                              <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                                {partyType === "client" ? "Amount Received" : "Amount Paid"}
                              </p>
                              <p className="text-lg font-bold font-mono text-emerald-600 mt-1">
                                {currency(partyData.statement.totalPaid)}
                              </p>
                            </div>
                            <div className="rounded-lg border bg-white dark:bg-slate-900 p-4">
                              <p className="text-[11px] font-semibold uppercase text-muted-foreground">
                                {partyType === "client" ? "Outstanding Receivable" : "Payable Owed"}
                              </p>
                              <p className="text-lg font-bold font-mono text-destructive mt-1">
                                {currency(partyData.statement.netPayableOrReceivable)}
                              </p>
                            </div>
                            <div className="rounded-lg border bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 p-4">
                              <p className="text-[11px] font-semibold uppercase text-amber-800 dark:text-amber-300">
                                Unused Advance Credits
                              </p>
                              <p className="text-lg font-bold font-mono text-amber-700 dark:text-amber-300 mt-1">
                                {currency(partyData.statement.unusedAdvance)}
                              </p>
                            </div>
                          </div>

                          {/* Chronological Activity Timeline */}
                          <div className="rounded-lg border bg-white dark:bg-slate-900 p-5">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="text-sm font-bold">
                                Recent Ledger Timeline ({partyData.statement.rows.length})
                              </h4>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => setActiveTab("statement")}
                              >
                                Open Full Statement PDF
                              </Button>
                            </div>
                            {partyData.statement.rows.length === 0 ? (
                              <p className="text-xs text-muted-foreground py-6 text-center">
                                No transactions recorded for this period.
                              </p>
                            ) : (
                              <div className="space-y-3">
                                {[...partyData.statement.rows]
                                  .reverse()
                                  .slice(0, 10)
                                  .map((row) => (
                                    <div
                                      key={row.id}
                                      className="flex items-center justify-between border-b pb-2.5 last:border-b-0 text-xs"
                                    >
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="font-semibold text-foreground">
                                            {row.docType}
                                          </span>
                                          <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-muted">
                                            {row.docNumber}
                                          </span>
                                          <span className="text-muted-foreground">
                                            {dateFmt(row.date)}
                                          </span>
                                        </div>
                                        <p className="text-muted-foreground mt-0.5">
                                          {row.projectName} · {row.details}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <div className="text-right font-mono">
                                          {row.billedAmount > 0 ? (
                                            <span className="font-semibold text-foreground">
                                              {currency(row.billedAmount)}
                                            </span>
                                          ) : (
                                            <span className="font-semibold text-emerald-600">
                                              {currency(row.paidAmount)}
                                            </span>
                                          )}
                                          <span className="block text-[10px] text-muted-foreground">
                                            Bal: {currency(row.runningBalance)}
                                          </span>
                                        </div>
                                        {row.voucherData && (
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="size-7"
                                            title="Print / Download Voucher PDF"
                                            onClick={() => setVoucherModalData(row.voucherData!)}
                                          >
                                            <Printer className="size-3.5" />
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ==================== TAB 2: TRANSACTIONS ACCORDIONS ==================== */}
                    {activeTab === "transactions" && (
                      <div className="space-y-4">
                        {/* CLIENT (BUYER) ACCORDIONS */}
                        {partyType === "client" && (
                          <>
                            {/* 1. Projects */}
                            <div className="rounded-lg border bg-white dark:bg-slate-900 overflow-hidden">
                              <button
                                type="button"
                                onClick={() => toggleAccordion("sec1")}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-xs font-bold"
                              >
                                <span className="flex items-center gap-2">
                                  {openAccordions.sec1 ? (
                                    <ChevronDown className="size-4" />
                                  ) : (
                                    <ChevronRight className="size-4" />
                                  )}
                                  1. Client Projects ({partyData.clientProjects.length})
                                </span>
                                <span className="font-mono">
                                  Total Base Contract:{" "}
                                  {currency(
                                    sum(partyData.clientProjects, (p: any) =>
                                      Number(p.quotation_amount || 0)
                                    )
                                  )}
                                </span>
                              </button>
                              {openAccordions.sec1 && (
                                <div className="p-4 overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b text-left text-muted-foreground">
                                        <th className="pb-2">Project Code</th>
                                        <th className="pb-2">Project Name</th>
                                        <th className="pb-2">Start Date</th>
                                        <th className="pb-2">Status</th>
                                        <th className="pb-2 text-right">Base Contract Value</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                      {partyData.clientProjects.map((p: any) => (
                                        <tr key={p.id}>
                                          <td className="py-2 font-mono font-semibold">
                                            {p.project_code}
                                          </td>
                                          <td className="py-2 font-medium">{p.name}</td>
                                          <td className="py-2">{dateFmt(p.start_date)}</td>
                                          <td className="py-2">
                                            <StatusBadge status={p.status} />
                                          </td>
                                          <td className="py-2 text-right font-mono font-semibold">
                                            {currency(p.quotation_amount)}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>

                            {/* 2. Quotations */}
                            <div className="rounded-lg border bg-white dark:bg-slate-900 overflow-hidden">
                              <button
                                type="button"
                                onClick={() => toggleAccordion("sec2")}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-xs font-bold"
                              >
                                <span className="flex items-center gap-2">
                                  {openAccordions.sec2 ? (
                                    <ChevronDown className="size-4" />
                                  ) : (
                                    <ChevronRight className="size-4" />
                                  )}
                                  2. Quotations & Scope Additions ({partyData.clientQuotations.length})
                                </span>
                                <span className="font-mono">
                                  Approved:{" "}
                                  {currency(
                                    sum(
                                      partyData.clientQuotations.filter(
                                        (q: any) => q.status === "approved"
                                      ),
                                      (q: any) => Number(q.amount || 0)
                                    )
                                  )}
                                </span>
                              </button>
                              {openAccordions.sec2 && (
                                <div className="p-4 overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b text-left text-muted-foreground">
                                        <th className="pb-2">Quotation #</th>
                                        <th className="pb-2">Project</th>
                                        <th className="pb-2">Description</th>
                                        <th className="pb-2">Status</th>
                                        <th className="pb-2 text-right">Amount</th>
                                        <th className="pb-2 text-right">Print PDF</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                      {partyData.clientQuotations.map((q: any) => (
                                        <tr key={q.id}>
                                          <td className="py-2 font-mono font-semibold">
                                            {q.quotation_number}
                                          </td>
                                          <td className="py-2">{projectName(q.project_id)}</td>
                                          <td className="py-2">{q.description || "—"}</td>
                                          <td className="py-2">
                                            <StatusBadge status={q.status} />
                                          </td>
                                          <td className="py-2 text-right font-mono font-semibold">
                                            {currency(q.amount)}
                                          </td>
                                          <td className="py-2 text-right">
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-7 px-2 text-xs gap-1"
                                              onClick={() =>
                                                setVoucherModalData({
                                                  type: "quotation",
                                                  voucherNumber: q.quotation_number,
                                                  date: (q.created_at || "").slice(0, 10),
                                                  statusBadge: q.status,
                                                  partyLabel: "Customer / Buyer",
                                                  partyName: currentParty.name,
                                                  partyAddress: currentParty.address,
                                                  partyPhone: currentParty.phone,
                                                  projectName: projectName(q.project_id),
                                                  amount: Number(q.amount || 0),
                                                  notes: q.description,
                                                })
                                              }
                                            >
                                              <Printer className="size-3.5" /> PDF
                                            </Button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>

                            {/* 3. Client Receipts */}
                            <div className="rounded-lg border bg-white dark:bg-slate-900 overflow-hidden">
                              <button
                                type="button"
                                onClick={() => toggleAccordion("sec3")}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-xs font-bold"
                              >
                                <span className="flex items-center gap-2">
                                  {openAccordions.sec3 ? (
                                    <ChevronDown className="size-4" />
                                  ) : (
                                    <ChevronRight className="size-4" />
                                  )}
                                  3. Client Payment Receipts & Advances ({partyData.clientReceipts.length})
                                </span>
                                <span className="font-mono text-emerald-600">
                                  Total Received:{" "}
                                  {currency(
                                    sum(partyData.clientReceipts, (c: any) =>
                                      Number(c.amount || 0)
                                    )
                                  )}
                                </span>
                              </button>
                              {openAccordions.sec3 && (
                                <div className="p-4 overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b text-left text-muted-foreground">
                                        <th className="pb-2">Receipt #</th>
                                        <th className="pb-2">Date</th>
                                        <th className="pb-2">Project</th>
                                        <th className="pb-2">Category</th>
                                        <th className="pb-2">Mode / Ref</th>
                                        <th className="pb-2 text-right">Amount</th>
                                        <th className="pb-2 text-right">TDS</th>
                                        <th className="pb-2 text-right">Voucher PDF</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                      {partyData.clientReceipts.map((cp: any) => (
                                        <tr key={cp.id}>
                                          <td className="py-2 font-mono font-semibold">
                                            {cp.receipt_number}
                                          </td>
                                          <td className="py-2">{dateFmt(cp.payment_date)}</td>
                                          <td className="py-2">{projectName(cp.project_id)}</td>
                                          <td className="py-2 capitalize">
                                            <Badge variant="outline" className="text-[10px]">
                                              {cp.payment_category || "milestone"}
                                            </Badge>
                                          </td>
                                          <td className="py-2 uppercase font-mono">
                                            {cp.payment_method}{" "}
                                            {cp.reference_number ? `(${cp.reference_number})` : ""}
                                          </td>
                                          <td className="py-2 text-right font-mono font-semibold text-emerald-700">
                                            {currency(cp.amount)}
                                          </td>
                                          <td className="py-2 text-right font-mono">
                                            {currency(cp.tds_amount || 0)}
                                          </td>
                                          <td className="py-2 text-right">
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-7 px-2 text-xs gap-1"
                                              onClick={() =>
                                                setVoucherModalData({
                                                  type: "client_receipt",
                                                  voucherNumber: cp.receipt_number,
                                                  date: cp.payment_date,
                                                  statusBadge:
                                                    cp.payment_category === "advance"
                                                      ? "Advance"
                                                      : "Received",
                                                  partyLabel: "Received From (Buyer)",
                                                  partyName: currentParty.name,
                                                  partyAddress: currentParty.address,
                                                  partyPhone: currentParty.phone,
                                                  projectName: projectName(cp.project_id),
                                                  paymentMode: cp.payment_method,
                                                  paymentSource: cp.payment_source,
                                                  referenceNumber: cp.reference_number,
                                                  amount: Number(cp.amount || 0),
                                                  tdsAmount: Number(cp.tds_amount || 0),
                                                  notes: cp.notes,
                                                })
                                              }
                                            >
                                              <Printer className="size-3.5" /> PDF
                                            </Button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </>
                        )}

                        {/* SUPPLIER ACCORDIONS */}
                        {partyType === "supplier" && (
                          <>
                            {/* 1. Purchase Orders */}
                            <div className="rounded-lg border bg-white dark:bg-slate-900 overflow-hidden">
                              <button
                                type="button"
                                onClick={() => toggleAccordion("sec1")}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-xs font-bold"
                              >
                                <span className="flex items-center gap-2">
                                  {openAccordions.sec1 ? (
                                    <ChevronDown className="size-4" />
                                  ) : (
                                    <ChevronRight className="size-4" />
                                  )}
                                  1. Purchase Orders ({partyData.supplierPos.length})
                                </span>
                                <span className="font-mono">
                                  Total PO Value:{" "}
                                  {currency(
                                    sum(partyData.supplierPos, (p: any) =>
                                      Number(p.total_amount || 0)
                                    )
                                  )}
                                </span>
                              </button>
                              {openAccordions.sec1 && (
                                <div className="p-4 overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b text-left text-muted-foreground">
                                        <th className="pb-2">PO #</th>
                                        <th className="pb-2">Date</th>
                                        <th className="pb-2">Project</th>
                                        <th className="pb-2">Order Status</th>
                                        <th className="pb-2">Billed Status (Zoho)</th>
                                        <th className="pb-2 text-right">Amount</th>
                                        <th className="pb-2 text-right">Print PDF</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                      {partyData.supplierPos.map((po: any) => {
                                        const hasGrn = partyData.supplierGrns.some(
                                          (g: any) => g.po_id === po.id
                                        );
                                        const isBilled =
                                          po.billed_status === "billed" || hasGrn;
                                        return (
                                          <tr key={po.id}>
                                            <td className="py-2 font-mono font-semibold">
                                              {po.po_number}
                                            </td>
                                            <td className="py-2">{dateFmt(po.po_date)}</td>
                                            <td className="py-2">{projectName(po.project_id)}</td>
                                            <td className="py-2">
                                              <StatusBadge status={po.status} />
                                            </td>
                                            <td className="py-2">
                                              <span
                                                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                                  isBilled
                                                    ? "bg-emerald-100 text-emerald-800"
                                                    : "bg-amber-100 text-amber-800"
                                                }`}
                                              >
                                                {isBilled ? "Billed (GRN)" : "Yet To Be Billed"}
                                              </span>
                                            </td>
                                            <td className="py-2 text-right font-mono font-semibold">
                                              {currency(po.total_amount)}
                                            </td>
                                            <td className="py-2 text-right">
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 px-2 text-xs gap-1"
                                                onClick={() =>
                                                  setVoucherModalData({
                                                    type: "purchase_order",
                                                    voucherNumber: po.po_number,
                                                    date: po.po_date,
                                                    statusBadge: isBilled
                                                      ? "Billed"
                                                      : "Yet To Be Billed",
                                                    partyLabel: "Supplier / Vendor",
                                                    partyName: currentParty.name,
                                                    partyAddress: currentParty.address,
                                                    partyPhone: currentParty.phone,
                                                    partyGstin: currentParty.gst_number,
                                                    projectName: projectName(po.project_id),
                                                    grossAmount: Number(po.subtotal || 0),
                                                    taxAmount: Number(po.tax_amount || 0),
                                                    travelCharges: Number(po.travel_charges || 0),
                                                    amount: Number(po.total_amount || 0),
                                                    notes: po.terms,
                                                  })
                                                }
                                              >
                                                <Printer className="size-3.5" /> PDF
                                              </Button>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>

                            {/* 2. Goods Receipts (GRNs / Bills) */}
                            <div className="rounded-lg border bg-white dark:bg-slate-900 overflow-hidden">
                              <button
                                type="button"
                                onClick={() => toggleAccordion("sec2")}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-xs font-bold"
                              >
                                <span className="flex items-center gap-2">
                                  {openAccordions.sec2 ? (
                                    <ChevronDown className="size-4" />
                                  ) : (
                                    <ChevronRight className="size-4" />
                                  )}
                                  2. Goods Receipts / Vendor Bills ({partyData.supplierGrns.length})
                                </span>
                                <span className="font-mono">
                                  Total Received:{" "}
                                  {currency(
                                    sum(partyData.supplierGrns, (g: any) =>
                                      Number(g.total_amount || 0)
                                    )
                                  )}
                                </span>
                              </button>
                              {openAccordions.sec2 && (
                                <div className="p-4 overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b text-left text-muted-foreground">
                                        <th className="pb-2">GRN #</th>
                                        <th className="pb-2">Date</th>
                                        <th className="pb-2">Project</th>
                                        <th className="pb-2">Remarks</th>
                                        <th className="pb-2 text-right">Amount</th>
                                        <th className="pb-2 text-right">Print PDF</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                      {partyData.supplierGrns.map((grn: any) => (
                                        <tr key={grn.id}>
                                          <td className="py-2 font-mono font-semibold">
                                            {grn.receipt_number}
                                          </td>
                                          <td className="py-2">{dateFmt(grn.receipt_date)}</td>
                                          <td className="py-2">{projectName(grn.project_id)}</td>
                                          <td className="py-2">{grn.remarks || "—"}</td>
                                          <td className="py-2 text-right font-mono font-semibold">
                                            {currency(grn.total_amount)}
                                          </td>
                                          <td className="py-2 text-right">
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-7 px-2 text-xs gap-1"
                                              onClick={() =>
                                                setVoucherModalData({
                                                  type: "grn_bill",
                                                  voucherNumber: grn.receipt_number,
                                                  date: grn.receipt_date,
                                                  statusBadge: "Billed",
                                                  partyLabel: "Supplier / Vendor",
                                                  partyName: currentParty.name,
                                                  partyAddress: currentParty.address,
                                                  partyPhone: currentParty.phone,
                                                  projectName: projectName(grn.project_id),
                                                  amount: Number(grn.total_amount || 0),
                                                  notes: grn.remarks,
                                                })
                                              }
                                            >
                                              <Printer className="size-3.5" /> PDF
                                            </Button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>

                            {/* 3. Supplier Payments & Advances */}
                            <div className="rounded-lg border bg-white dark:bg-slate-900 overflow-hidden">
                              <button
                                type="button"
                                onClick={() => toggleAccordion("sec3")}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-xs font-bold"
                              >
                                <span className="flex items-center gap-2">
                                  {openAccordions.sec3 ? (
                                    <ChevronDown className="size-4" />
                                  ) : (
                                    <ChevronRight className="size-4" />
                                  )}
                                  3. Supplier Payments Made & Advances ({partyData.supplierPays.length})
                                </span>
                                <span className="font-mono text-emerald-600">
                                  Total Paid:{" "}
                                  {currency(
                                    sum(partyData.supplierPays, (p: any) =>
                                      Number(p.amount || 0)
                                    )
                                  )}
                                </span>
                              </button>
                              {openAccordions.sec3 && (
                                <div className="p-4 overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b text-left text-muted-foreground">
                                        <th className="pb-2">Date</th>
                                        <th className="pb-2">Project</th>
                                        <th className="pb-2">Allocation / PO#</th>
                                        <th className="pb-2">Mode & Source</th>
                                        <th className="pb-2 text-right">Amount Paid</th>
                                        <th className="pb-2 text-right">Voucher PDF</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                      {partyData.supplierPays.map((sp: any) => {
                                        const linkedPo = (pos.data ?? []).find(
                                          (p: any) => p.id === sp.po_id
                                        );
                                        return (
                                          <tr key={sp.id}>
                                            <td className="py-2">{dateFmt(sp.payment_date)}</td>
                                            <td className="py-2">{projectName(sp.project_id)}</td>
                                            <td className="py-2">
                                              {linkedPo ? (
                                                <span className="font-mono font-semibold">
                                                  {linkedPo.po_number}
                                                </span>
                                              ) : (
                                                <Badge
                                                  variant="outline"
                                                  className="bg-amber-50 text-amber-800 border-amber-300 text-[10px]"
                                                >
                                                  Advance / Unapplied Credit
                                                </Badge>
                                              )}
                                            </td>
                                            <td className="py-2 uppercase font-mono">
                                              {sp.payment_method || "Bank"} ·{" "}
                                              {sp.payment_source === "petty_cash"
                                                ? "Petty Cash"
                                                : "Bank"}
                                            </td>
                                            <td className="py-2 text-right font-mono font-semibold text-emerald-700">
                                              {currency(sp.amount)}
                                            </td>
                                            <td className="py-2 text-right">
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 px-2 text-xs gap-1"
                                                onClick={() =>
                                                  setVoucherModalData({
                                                    type: "supplier_payment",
                                                    voucherNumber:
                                                      sp.reference_number ||
                                                      `PAY-${sp.id.slice(0, 6).toUpperCase()}`,
                                                    date: sp.payment_date,
                                                    statusBadge: linkedPo ? "Paid" : "Advance",
                                                    statusTone: linkedPo ? "emerald" : "amber",
                                                    partyLabel: "Paid To (Supplier)",
                                                    partyName: currentParty.name,
                                                    partyAddress: currentParty.address,
                                                    partyPhone: currentParty.phone,
                                                    projectName: projectName(sp.project_id),
                                                    paymentMode: sp.payment_method,
                                                    paymentSource: sp.payment_source,
                                                    referenceNumber: sp.reference_number,
                                                    linkedDocLabel: linkedPo ? "PO Number" : null,
                                                    linkedDocNumber: linkedPo?.po_number ?? null,
                                                    linkedDocTotal: linkedPo
                                                      ? Number(linkedPo.total_amount || 0)
                                                      : null,
                                                    amount: Number(sp.amount || 0),
                                                    overPaymentAmount: !linkedPo
                                                      ? Number(sp.amount || 0)
                                                      : null,
                                                    notes: sp.remarks,
                                                  })
                                                }
                                              >
                                                <Printer className="size-3.5" /> PDF
                                              </Button>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </>
                        )}

                        {/* CONTRACTOR ACCORDIONS */}
                        {partyType === "contractor" && (
                          <>
                            {/* 1. Work Orders */}
                            <div className="rounded-lg border bg-white dark:bg-slate-900 overflow-hidden">
                              <button
                                type="button"
                                onClick={() => toggleAccordion("sec1")}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-xs font-bold"
                              >
                                <span className="flex items-center gap-2">
                                  {openAccordions.sec1 ? (
                                    <ChevronDown className="size-4" />
                                  ) : (
                                    <ChevronRight className="size-4" />
                                  )}
                                  1. Work Orders ({partyData.contractorWos.length})
                                </span>
                                <span className="font-mono">
                                  Total Work Orders:{" "}
                                  {currency(
                                    sum(partyData.contractorWos, (w: any) =>
                                      Number(w.contract_amount ?? w.total_amount ?? 0)
                                    )
                                  )}
                                </span>
                              </button>
                              {openAccordions.sec1 && (
                                <div className="p-4 overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b text-left text-muted-foreground">
                                        <th className="pb-2">WO #</th>
                                        <th className="pb-2">Issue Date</th>
                                        <th className="pb-2">Project</th>
                                        <th className="pb-2">Work Description</th>
                                        <th className="pb-2">Status</th>
                                        <th className="pb-2 text-right">Value</th>
                                        <th className="pb-2 text-right">Print PDF</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                      {partyData.contractorWos.map((wo: any) => (
                                        <tr key={wo.id}>
                                          <td className="py-2 font-mono font-semibold">
                                            {wo.work_order_number || wo.wo_number}
                                          </td>
                                          <td className="py-2">{dateFmt(wo.wo_date || wo.issue_date)}</td>
                                          <td className="py-2">{projectName(wo.project_id)}</td>
                                          <td className="py-2">{wo.work_description}</td>
                                          <td className="py-2">
                                            <StatusBadge status={wo.status} />
                                          </td>
                                          <td className="py-2 text-right font-mono font-semibold">
                                            {currency(wo.contract_amount ?? wo.total_amount ?? 0)}
                                          </td>
                                          <td className="py-2 text-right">
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-7 px-2 text-xs gap-1"
                                              onClick={() =>
                                                setVoucherModalData({
                                                  type: "work_order",
                                                  voucherNumber: wo.work_order_number || wo.wo_number,
                                                  date: wo.wo_date || wo.issue_date,
                                                  statusBadge: wo.status,
                                                  partyLabel: "Contractor",
                                                  partyName: currentParty.name,
                                                  partyCode: currentParty.contractor_code,
                                                  partyAddress: currentParty.address,
                                                  partyPhone: currentParty.phone,
                                                  projectName: projectName(wo.project_id),
                                                  amount: Number(wo.contract_amount ?? wo.total_amount ?? 0),
                                                  notes: wo.work_description,
                                                })
                                              }
                                            >
                                              <Printer className="size-3.5" /> PDF
                                            </Button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>

                            {/* 2. Contractor Bills */}
                            <div className="rounded-lg border bg-white dark:bg-slate-900 overflow-hidden">
                              <button
                                type="button"
                                onClick={() => toggleAccordion("sec2")}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-xs font-bold"
                              >
                                <span className="flex items-center gap-2">
                                  {openAccordions.sec2 ? (
                                    <ChevronDown className="size-4" />
                                  ) : (
                                    <ChevronRight className="size-4" />
                                  )}
                                  2. Contractor RA Bills ({partyData.contractorBillsList.length})
                                </span>
                                <span className="font-mono">
                                  Total Net Billed:{" "}
                                  {currency(
                                    sum(partyData.contractorBillsList, (b: any) =>
                                      Number(b.net_amount || 0)
                                    )
                                  )}
                                </span>
                              </button>
                              {openAccordions.sec2 && (
                                <div className="p-4 overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b text-left text-muted-foreground">
                                        <th className="pb-2">Bill #</th>
                                        <th className="pb-2">Date</th>
                                        <th className="pb-2">Project</th>
                                        <th className="pb-2 text-right">Gross</th>
                                        <th className="pb-2 text-right">TDS / Ded</th>
                                        <th className="pb-2 text-right">Retention</th>
                                        <th className="pb-2 text-right">Net Payable</th>
                                        <th className="pb-2 text-right">Print PDF</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                      {partyData.contractorBillsList.map((b: any) => (
                                        <tr key={b.id}>
                                          <td className="py-2 font-mono font-semibold">
                                            {b.bill_number}
                                          </td>
                                          <td className="py-2">{dateFmt(b.bill_date)}</td>
                                          <td className="py-2">{projectName(b.project_id)}</td>
                                          <td className="py-2 text-right font-mono">
                                            {currency(b.gross_amount)}
                                          </td>
                                          <td className="py-2 text-right font-mono text-amber-700">
                                            {currency(b.deductions)}
                                          </td>
                                          <td className="py-2 text-right font-mono text-amber-700">
                                            {currency(b.retention_amount)}
                                          </td>
                                          <td className="py-2 text-right font-mono font-bold">
                                            {currency(b.net_amount)}
                                          </td>
                                          <td className="py-2 text-right">
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="h-7 px-2 text-xs gap-1"
                                              onClick={() =>
                                                setVoucherModalData({
                                                  type: "contractor_bill",
                                                  voucherNumber: b.bill_number,
                                                  date: b.bill_date,
                                                  statusBadge: b.status,
                                                  partyLabel: "Contractor",
                                                  partyName: currentParty.name,
                                                  partyCode: currentParty.contractor_code,
                                                  partyAddress: currentParty.address,
                                                  partyPhone: currentParty.phone,
                                                  projectName: projectName(b.project_id),
                                                  grossAmount: Number(b.gross_amount || 0),
                                                  tdsAmount: Number(b.deductions || 0),
                                                  retentionAmount: Number(b.retention_amount || 0),
                                                  amount: Number(b.net_amount || 0),
                                                  notes: b.remarks,
                                                })
                                              }
                                            >
                                              <Printer className="size-3.5" /> PDF
                                            </Button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>

                            {/* 3. Contractor Payments & Advances */}
                            <div className="rounded-lg border bg-white dark:bg-slate-900 overflow-hidden">
                              <button
                                type="button"
                                onClick={() => toggleAccordion("sec3")}
                                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between text-xs font-bold"
                              >
                                <span className="flex items-center gap-2">
                                  {openAccordions.sec3 ? (
                                    <ChevronDown className="size-4" />
                                  ) : (
                                    <ChevronRight className="size-4" />
                                  )}
                                  3. Contractor Payments & Advances ({partyData.contractorPays.length})
                                </span>
                                <span className="font-mono text-emerald-600">
                                  Total Paid:{" "}
                                  {currency(
                                    sum(partyData.contractorPays, (p: any) =>
                                      Number(p.amount || 0)
                                    )
                                  )}
                                </span>
                              </button>
                              {openAccordions.sec3 && (
                                <div className="p-4 overflow-x-auto">
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b text-left text-muted-foreground">
                                        <th className="pb-2">Date</th>
                                        <th className="pb-2">Project</th>
                                        <th className="pb-2">Allocation / Bill#</th>
                                        <th className="pb-2">Mode & Source</th>
                                        <th className="pb-2 text-right">Amount Paid</th>
                                        <th className="pb-2 text-right">Voucher PDF</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                      {partyData.contractorPays.map((cp: any) => {
                                        const linkedBill = (contractorBills.data ?? []).find(
                                          (b: any) => b.id === cp.bill_id
                                        );
                                        return (
                                          <tr key={cp.id}>
                                            <td className="py-2">{dateFmt(cp.payment_date)}</td>
                                            <td className="py-2">{projectName(cp.project_id)}</td>
                                            <td className="py-2">
                                              {linkedBill ? (
                                                <span className="font-mono font-semibold">
                                                  {linkedBill.bill_number}
                                                </span>
                                              ) : (
                                                <Badge
                                                  variant="outline"
                                                  className="bg-amber-50 text-amber-800 border-amber-300 text-[10px]"
                                                >
                                                  Advance / Unapplied Credit
                                                </Badge>
                                              )}
                                            </td>
                                            <td className="py-2 uppercase font-mono">
                                              {cp.payment_method || "Bank"} ·{" "}
                                              {cp.payment_source === "petty_cash"
                                                ? "Petty Cash"
                                                : "Bank"}
                                            </td>
                                            <td className="py-2 text-right font-mono font-semibold text-emerald-700">
                                              {currency(cp.amount)}
                                            </td>
                                            <td className="py-2 text-right">
                                              <Button
                                                size="sm"
                                                variant="ghost"
                                                className="h-7 px-2 text-xs gap-1"
                                                onClick={() =>
                                                  setVoucherModalData({
                                                    type: "contractor_payment",
                                                    voucherNumber:
                                                      cp.reference_number ||
                                                      `CPAY-${cp.id.slice(0, 6).toUpperCase()}`,
                                                    date: cp.payment_date,
                                                    statusBadge: linkedBill ? "Paid" : "Advance",
                                                    statusTone: linkedBill ? "emerald" : "amber",
                                                    partyLabel: "Paid To (Contractor)",
                                                    partyName: currentParty.name,
                                                    partyCode: currentParty.contractor_code,
                                                    partyAddress: currentParty.address,
                                                    partyPhone: currentParty.phone,
                                                    projectName: projectName(cp.project_id),
                                                    paymentMode: cp.payment_method,
                                                    paymentSource: cp.payment_source,
                                                    referenceNumber: cp.reference_number,
                                                    linkedDocLabel: linkedBill
                                                      ? "Bill Number"
                                                      : null,
                                                    linkedDocNumber:
                                                      linkedBill?.bill_number ?? null,
                                                    linkedDocTotal: linkedBill
                                                      ? Number(linkedBill.net_amount || 0)
                                                      : null,
                                                    amount: Number(cp.amount || 0),
                                                    overPaymentAmount: !linkedBill
                                                      ? Number(cp.amount || 0)
                                                      : null,
                                                    notes: cp.remarks,
                                                  })
                                                }
                                              >
                                                <Printer className="size-3.5" /> PDF
                                              </Button>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* ==================== TAB 3: STATEMENT OF ACCOUNTS (A4 PRINTABLE SHEET) ==================== */}
                    {activeTab === "statement" && (
                      <div className="space-y-4">
                        <div
                          id="zoho-party-statement-a4-sheet"
                          className="mx-auto max-w-[850px] bg-white text-slate-900 shadow-lg border border-slate-200 p-10 rounded-sm"
                        >
                          {/* Top Letterhead */}
                          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 pb-6 border-b-2 border-slate-900">
                            <div>
                              <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                                BRICKWELD PRIVATE LIMITED
                              </h1>
                              <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-md">
                                No 598, 2nd Floor, 1st A Main Road, Sector 6, HSR Layout
                                <br />
                                Bengaluru, Karnataka / Tamil Nadu · India
                              </p>
                              <p className="text-xs font-medium text-slate-700 mt-1">
                                GSTIN: <strong className="font-mono">33AAOCB3181E1ZU</strong> ·{" "}
                                brickweldprivatelimited@gmail.com
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="inline-block bg-slate-900 text-white px-4 py-1.5 rounded text-xs font-bold tracking-widest uppercase">
                                Statement of Accounts
                              </div>
                              <p className="text-xs text-slate-600 mt-2 font-medium">
                                Period: <strong>{activeDates.label}</strong>
                              </p>
                              {projectFilter !== "all" && (
                                <p className="text-xs text-slate-600 font-medium">
                                  Project: <strong>{projectName(projectFilter)}</strong>
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Party To + Zoho Account Summary Table */}
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 py-6 border-b border-slate-200 items-start">
                            <div className="md:col-span-6">
                              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                Statement For ({roleTitle})
                              </p>
                              <h2 className="text-base font-bold text-slate-900 mt-1">
                                {currentParty.name}
                              </h2>
                              {currentParty.contractor_code && (
                                <p className="text-xs text-slate-600 font-mono mt-0.5">
                                  Code: {currentParty.contractor_code}
                                </p>
                              )}
                              {currentParty.address && (
                                <p className="text-xs text-slate-600 mt-0.5 max-w-sm">
                                  {currentParty.address}
                                </p>
                              )}
                              {currentParty.phone && (
                                <p className="text-xs text-slate-600 mt-0.5">
                                  Phone: {currentParty.phone}
                                </p>
                              )}
                              {currentParty.gst_number && (
                                <p className="text-xs text-slate-600 mt-0.5">
                                  GSTIN:{" "}
                                  <strong className="font-mono">{currentParty.gst_number}</strong>
                                </p>
                              )}
                            </div>

                            {/* Zoho Books Account Summary Box */}
                            <div className="md:col-span-6">
                              <div className="rounded border border-slate-300 overflow-hidden text-xs">
                                <div className="bg-slate-800 text-white px-3.5 py-2 font-bold uppercase tracking-wider text-[11px]">
                                  Account Summary (INR)
                                </div>
                                <div className="divide-y divide-slate-200 bg-slate-50/50">
                                  <div className="flex justify-between px-3.5 py-2">
                                    <span className="text-slate-600">Opening Balance</span>
                                    <span className="font-mono font-semibold">
                                      {currency(currentParty.opening_balance || 0)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between px-3.5 py-2">
                                    <span className="text-slate-600">
                                      {partyType === "client"
                                        ? "Contract / Invoiced Amount"
                                        : "Billed / Ordered Amount"}
                                    </span>
                                    <span className="font-mono font-semibold">
                                      {currency(partyData.statement.totalBilled)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between px-3.5 py-2">
                                    <span className="text-slate-600">
                                      {partyType === "client"
                                        ? "Amount Received (+ TDS)"
                                        : "Amount Paid"}
                                    </span>
                                    <span className="font-mono font-semibold text-emerald-700">
                                      {currency(partyData.statement.totalPaid)}
                                    </span>
                                  </div>
                                  {partyData.statement.unusedAdvance > 0 && (
                                    <div className="flex justify-between px-3.5 py-2 bg-amber-50 text-amber-900">
                                      <span className="font-semibold">
                                        Unused Advance Credit Held
                                      </span>
                                      <span className="font-mono font-bold">
                                        -{currency(partyData.statement.unusedAdvance)}
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex justify-between px-3.5 py-2.5 bg-slate-200/80 font-bold text-slate-900">
                                    <span>
                                      {partyData.statement.closingBalance < 0
                                        ? "Net Advance Credit Balance"
                                        : partyType === "client"
                                        ? "Closing Balance Receivable"
                                        : "Closing Balance Payable"}
                                    </span>
                                    <span className="font-mono text-sm">
                                      {partyData.statement.closingBalance < 0
                                        ? `-${currency(
                                            Math.abs(partyData.statement.closingBalance)
                                          )} (Cr)`
                                        : currency(partyData.statement.closingBalance)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Chronological Running-Balance Ledger Table */}
                          <div className="pt-6">
                            <table className="w-full text-xs border-collapse">
                              <thead>
                                <tr className="bg-slate-900 text-white">
                                  <th className="py-2.5 px-2.5 text-left font-semibold w-24">
                                    Date
                                  </th>
                                  <th className="py-2.5 px-2.5 text-left font-semibold w-40">
                                    Transactions
                                  </th>
                                  <th className="py-2.5 px-2.5 text-left font-semibold">
                                    Details & Project / Site
                                  </th>
                                  <th className="py-2.5 px-2.5 text-right font-semibold w-28">
                                    {partyType === "client" ? "Invoiced" : "Amount"}
                                  </th>
                                  <th className="py-2.5 px-2.5 text-right font-semibold w-28">
                                    Payments
                                  </th>
                                  <th className="py-2.5 px-2.5 text-right font-semibold w-32">
                                    Balance
                                  </th>
                                  <th className="py-2.5 px-2 text-center font-semibold w-12 no-print-in-sheet">
                                    PDF
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-200">
                                {/* Opening Balance Row */}
                                <tr className="bg-slate-50 font-medium">
                                  <td className="py-2.5 px-2.5 font-mono text-slate-500">
                                    Opening
                                  </td>
                                  <td className="py-2.5 px-2.5 font-semibold">
                                    *** Opening Balance ***
                                  </td>
                                  <td className="py-2.5 px-2.5 text-slate-500">
                                    Brought forward balance
                                  </td>
                                  <td className="py-2.5 px-2.5 text-right font-mono">
                                    {currency(currentParty.opening_balance || 0)}
                                  </td>
                                  <td className="py-2.5 px-2.5 text-right font-mono">—</td>
                                  <td className="py-2.5 px-2.5 text-right font-mono font-bold">
                                    {currency(currentParty.opening_balance || 0)}
                                  </td>
                                  <td className="py-2.5 px-2 text-center no-print-in-sheet">—</td>
                                </tr>

                                {partyData.statement.rows.length === 0 ? (
                                  <tr>
                                    <td
                                      colSpan={7}
                                      className="py-8 text-center text-slate-500 italic"
                                    >
                                      No transactions recorded in this period.
                                    </td>
                                  </tr>
                                ) : (
                                  partyData.statement.rows.map((row) => (
                                    <tr key={row.id} className="hover:bg-slate-50/80">
                                      <td className="py-2.5 px-2.5 whitespace-nowrap font-mono text-slate-700">
                                        {dateFmt(row.date)}
                                      </td>
                                      <td className="py-2.5 px-2.5">
                                        <span className="font-semibold text-slate-900 block">
                                          {row.docType}
                                        </span>
                                        <span className="font-mono text-[11px] text-slate-500">
                                          {row.docNumber}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-2.5 text-slate-700">
                                        <span className="font-medium text-slate-900">
                                          {row.projectName}
                                        </span>
                                        {row.details ? ` — ${row.details}` : ""}
                                      </td>
                                      <td className="py-2.5 px-2.5 text-right font-mono">
                                        {row.billedAmount > 0
                                          ? currency(row.billedAmount)
                                          : "—"}
                                      </td>
                                      <td className="py-2.5 px-2.5 text-right font-mono text-emerald-700 font-medium">
                                        {row.paidAmount > 0 ? currency(row.paidAmount) : "—"}
                                      </td>
                                      <td className="py-2.5 px-2.5 text-right font-mono font-bold text-slate-900">
                                        {row.runningBalance < 0
                                          ? `-${currency(Math.abs(row.runningBalance))}`
                                          : currency(row.runningBalance)}
                                      </td>
                                      <td className="py-2.5 px-2 text-center no-print-in-sheet">
                                        {row.voucherData ? (
                                          <Button
                                            size="icon"
                                            variant="ghost"
                                            className="size-7 text-slate-600 hover:text-slate-900"
                                            title="Print individual document PDF"
                                            onClick={() => setVoucherModalData(row.voucherData!)}
                                          >
                                            <Printer className="size-3.5" />
                                          </Button>
                                        ) : (
                                          "—"
                                        )}
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                              <tfoot>
                                <tr className="border-t-2 border-slate-900 bg-slate-100 font-bold text-slate-900">
                                  <td colSpan={3} className="py-3 px-2.5 text-right uppercase">
                                    Closing Balance
                                  </td>
                                  <td className="py-3 px-2.5 text-right font-mono">
                                    {currency(partyData.statement.totalBilled)}
                                  </td>
                                  <td className="py-3 px-2.5 text-right font-mono text-emerald-700">
                                    {currency(partyData.statement.totalPaid)}
                                  </td>
                                  <td className="py-3 px-2.5 text-right font-mono text-sm">
                                    {partyData.statement.closingBalance < 0
                                      ? `-${currency(
                                          Math.abs(partyData.statement.closingBalance)
                                        )}`
                                      : currency(partyData.statement.closingBalance)}
                                  </td>
                                  <td className="no-print-in-sheet" />
                                </tr>
                              </tfoot>
                            </table>
                          </div>

                          {/* Statement Footer */}
                          <div className="mt-10 pt-4 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-500">
                            <span>
                              Generated from Brickweld Private Limited — Project & Financial Control
                            </span>
                            <span>Authorized Signatory · BRICKWELD PRIVATE LIMITED</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Universal Printable Document / Payment Voucher Modal */}
      <PrintableVoucherDialog
        open={!!voucherModalData}
        onOpenChange={(v) => !v && setVoucherModalData(null)}
        data={voucherModalData}
      />
    </>
  );
}
