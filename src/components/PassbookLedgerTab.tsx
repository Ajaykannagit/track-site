import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeftRight,
  Building2,
  FileSpreadsheet,
  Landmark,
  Printer,
  Search,
  Wallet,
} from "lucide-react";
import { currency, dateFmt } from "@/lib/format";

export type WalletFilterType =
  | "all"
  | "bank"
  | "petty_cash"
  | "Kodak- Petty Cash"
  | "General Petty Cash"
  | "Suspense Account";

export interface RawPassbookEvent {
  id: string;
  date: string;
  refNumber: string;
  type: string; // e.g., "Vendor Payment", "Customer Payment", "Transfer To Another Account", "Transfer From Another Account", "Expense", "Owner Contribution", "Drawings"
  subLabel: string; // e.g., "Vendor: Bhavani Hardware", "Customer: Mrs. Anitha", "To Account: Kodak- Petty Cash", "From Account: Brickweld Bank (xxxx5909)"
  projectName: string;
  projectId: string | null;
  accountSource: "bank" | "petty_cash";
  walletName: string;
  deposit: number; // + Inflow
  withdrawal: number; // - Outflow
  partyType?: "client" | "supplier" | "contractor" | null;
  partyId?: string | null;
}

export interface ComputedPassbookRow extends RawPassbookEvent {
  runningBalance: number;
}

export function computePassbookRunningLedger(params: {
  openingBalance: number;
  events: RawPassbookEvent[];
}): {
  rowsDesc: ComputedPassbookRow[];
  rowsAsc: ComputedPassbookRow[];
  totalDeposits: number;
  totalWithdrawals: number;
  closingBalance: number;
} {
  // Sort ascending by date then id to compute true chronological cumulative running balance
  const sortedAsc = [...params.events].sort((a, b) => {
    const cmp = (a.date || "").localeCompare(b.date || "");
    if (cmp !== 0) return cmp;
    return a.id.localeCompare(b.id);
  });

  let running = Number(params.openingBalance || 0);
  let totalDeposits = 0;
  let totalWithdrawals = 0;

  const rowsAsc: ComputedPassbookRow[] = sortedAsc.map((ev) => {
    const dep = Number(ev.deposit || 0);
    const wd = Number(ev.withdrawal || 0);
    totalDeposits += dep;
    totalWithdrawals += wd;
    running = running + dep - wd;
    return {
      ...ev,
      runningBalance: running,
    };
  });

  const rowsDesc = [...rowsAsc].reverse();

  return {
    rowsDesc,
    rowsAsc,
    totalDeposits,
    totalWithdrawals,
    closingBalance: running,
  };
}

interface PassbookLedgerTabProps {
  events: RawPassbookEvent[];
  openingBalances: {
    bank: number;
    petty_cash: number;
  };
  projectOptions: { value: string; label: string }[];
  onOpenParty360?: (partyType: "client" | "supplier" | "contractor", partyId: string) => void;
  onOpenTransferModal?: () => void;
  onOpenMdCapitalModal?: () => void;
}

export function PassbookLedgerTab({
  events,
  openingBalances,
  projectOptions,
  onOpenParty360,
  onOpenTransferModal,
  onOpenMdCapitalModal,
}: PassbookLedgerTabProps) {
  const [selectedWallet, setSelectedWallet] = useState<WalletFilterType>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const activeOpeningBalance = useMemo(() => {
    if (selectedWallet === "bank") return Number(openingBalances.bank || 0);
    if (
      selectedWallet === "petty_cash" ||
      selectedWallet === "Kodak- Petty Cash" ||
      selectedWallet === "General Petty Cash"
    ) {
      return Number(openingBalances.petty_cash || 0);
    }
    if (selectedWallet === "Suspense Account") return 0;
    return Number(openingBalances.bank || 0) + Number(openingBalances.petty_cash || 0);
  }, [selectedWallet, openingBalances]);

  const walletFilteredEvents = useMemo(() => {
    return events.filter((ev) => {
      if (selectedWallet === "bank" && ev.accountSource !== "bank") return false;
      if (selectedWallet === "petty_cash" && ev.accountSource !== "petty_cash") return false;
      if (selectedWallet === "Kodak- Petty Cash") {
        if (ev.accountSource !== "petty_cash") return false;
        if (ev.walletName && ev.walletName !== "Kodak- Petty Cash") return false;
      }
      if (selectedWallet === "General Petty Cash") {
        if (ev.walletName !== "General Petty Cash") return false;
      }
      if (selectedWallet === "Suspense Account") {
        if (ev.walletName !== "Suspense Account") return false;
      }
      if (projectFilter !== "all" && ev.projectId !== projectFilter) return false;
      return true;
    });
  }, [events, selectedWallet, projectFilter]);

  const passbook = useMemo(
    () =>
      computePassbookRunningLedger({
        openingBalance: activeOpeningBalance,
        events: walletFilteredEvents,
      }),
    [activeOpeningBalance, walletFilteredEvents]
  );

  const displayedRows = useMemo(() => {
    if (!searchQuery.trim()) return passbook.rowsDesc;
    const q = searchQuery.toLowerCase();
    return passbook.rowsDesc.filter(
      (r) =>
        (r.type || "").toLowerCase().includes(q) ||
        (r.subLabel || "").toLowerCase().includes(q) ||
        (r.refNumber || "").toLowerCase().includes(q) ||
        (r.projectName || "").toLowerCase().includes(q)
    );
  }, [passbook.rowsDesc, searchQuery]);

  // Wallet-level live summaries for the top Zoho Banking Switcher Cards
  const walletSummaries = useMemo(() => {
    const bankEvs = events.filter((e) => e.accountSource === "bank");
    const pettyEvs = events.filter((e) => e.accountSource === "petty_cash");
    const bankComp = computePassbookRunningLedger({
      openingBalance: openingBalances.bank,
      events: bankEvs,
    });
    const pettyComp = computePassbookRunningLedger({
      openingBalance: openingBalances.petty_cash,
      events: pettyEvs,
    });
    return {
      combined: bankComp.closingBalance + pettyComp.closingBalance,
      bank: bankComp.closingBalance,
      petty: pettyComp.closingBalance,
    };
  }, [events, openingBalances]);

  const handlePrintPassbook = () => {
    const el = document.getElementById("zoho-passbook-printable-area");
    if (!el) return;
    const win = window.open("", "_blank", "width=1050,height=1100");
    if (!win) {
      window.print();
      return;
    }
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Zoho Banking Passbook Statement — Brickweld Pvt Ltd</title>
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
    @page { size: A4 landscape; margin: 10mm; }
  </style>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
  <div class="mb-4 pb-3 border-b-2 border-slate-900 flex justify-between items-end">
    <div>
      <h1 class="text-lg font-black uppercase">BRICKWELD PRIVATE LIMITED — BANK & PETTY CASH PASSBOOK</h1>
      <p class="text-xs text-slate-600">Wallet: ${selectedWallet.toUpperCase()} · Opening: ${currency(
      activeOpeningBalance
    )} · Closing: ${currency(passbook.closingBalance)}</p>
    </div>
    <span class="text-xs font-mono">GSTIN: 33AAOCB3181E1ZU</span>
  </div>
  ${el.outerHTML}
  <script>setTimeout(() => window.print(), 350);</script>
</body>
</html>`);
    win.document.close();
  };

  const handleExportCsv = () => {
    const headers = [
      "Date",
      "Reference #",
      "Type",
      "Transaction Details (Vendor / Customer / Account)",
      "Project / Site",
      "Wallet / Account",
      "Deposits (+ Rs)",
      "Withdrawals (- Rs)",
      "Running Balance (Rs)",
    ];
    const lines = [
      headers.join(","),
      ...passbook.rowsAsc.map((r) =>
        [
          r.date,
          `"${(r.refNumber || "").replace(/"/g, '""')}"`,
          `"${(r.type || "").replace(/"/g, '""')}"`,
          `"${(r.subLabel || "").replace(/"/g, '""')}"`,
          `"${(r.projectName || "").replace(/"/g, '""')}"`,
          `"${(r.walletName || "").replace(/"/g, '""')}"`,
          r.deposit,
          r.withdrawal,
          r.runningBalance,
        ].join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Brickweld-Passbook-${selectedWallet}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Zoho Banking Multi-Wallet Switcher Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setSelectedWallet("all")}
          className={`text-left rounded-lg border p-3.5 transition-all ${
            selectedWallet === "all"
              ? "border-primary bg-primary/5 ring-2 ring-primary/20"
              : "bg-card hover:bg-accent/5"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              All Bank & Petty Cash
            </span>
            <Wallet className="size-4 text-primary" />
          </div>
          <p className="text-lg font-mono font-bold mt-1.5">
            {currency(walletSummaries.combined)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Combined corporate liquidity
          </p>
        </button>

        <button
          type="button"
          onClick={() => setSelectedWallet("bank")}
          className={`text-left rounded-lg border p-3.5 transition-all ${
            selectedWallet === "bank"
              ? "border-sky-600 bg-sky-50/60 dark:bg-sky-950/30 ring-2 ring-sky-500/20"
              : "bg-card hover:bg-accent/5"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-300">
              🏦 Brickweld Bank (xxxx5909)
            </span>
            <Landmark className="size-4 text-sky-600" />
          </div>
          <p className="text-lg font-mono font-bold mt-1.5">
            {currency(walletSummaries.bank)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Primary corporate bank passbook
          </p>
        </button>

        <button
          type="button"
          onClick={() => setSelectedWallet("petty_cash")}
          className={`text-left rounded-lg border p-3.5 transition-all ${
            selectedWallet === "petty_cash" || selectedWallet === "Kodak- Petty Cash"
              ? "border-amber-600 bg-amber-50/60 dark:bg-amber-950/30 ring-2 ring-amber-500/20"
              : "bg-card hover:bg-accent/5"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              💵 Kodak- Petty Cash
            </span>
            <Wallet className="size-4 text-amber-600" />
          </div>
          <p className="text-lg font-mono font-bold mt-1.5">
            {currency(walletSummaries.petty)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Site & office petty cash wallet
          </p>
        </button>

        <div className="rounded-lg border bg-card p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Quick Contra & Equity
            </span>
            <ArrowLeftRight className="size-4 text-emerald-600" />
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {onOpenTransferModal && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] flex-1"
                onClick={onOpenTransferModal}
              >
                Bank ↔ Petty Cash
              </Button>
            )}
            {onOpenMdCapitalModal && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[11px] flex-1"
                onClick={onOpenMdCapitalModal}
              >
                Owner In/Out
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Filter & Export Toolbar */}
      <div className="rounded-lg border bg-card p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-64">
            <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search vendor, buyer, ref#, or type..."
              className="h-8 pl-8 text-xs"
            />
          </div>

          <Select
            value={selectedWallet}
            onValueChange={(v) => setSelectedWallet(v as WalletFilterType)}
          >
            <SelectTrigger className="h-8 w-52 text-xs">
              <SelectValue placeholder="Select Wallet" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Wallets Combined</SelectItem>
              <SelectItem value="bank">🏦 Brickweld Pvt Ltd (xxxx5909)</SelectItem>
              <SelectItem value="petty_cash">💵 All Petty Cash Wallets</SelectItem>
              <SelectItem value="Kodak- Petty Cash">💵 Kodak- Petty Cash (#7865)</SelectItem>
              <SelectItem value="General Petty Cash">💵 General Petty Cash</SelectItem>
            </SelectContent>
          </Select>

          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects / Corporate</SelectItem>
              {projectOptions.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCsv}
            className="h-8 text-xs gap-1.5"
          >
            <FileSpreadsheet className="size-3.5 text-emerald-600" /> Export CSV
          </Button>
          <Button
            size="sm"
            variant="default"
            onClick={handlePrintPassbook}
            className="h-8 text-xs gap-1.5"
          >
            <Printer className="size-3.5" /> Print Passbook PDF
          </Button>
        </div>
      </div>

      {/* Zoho Passbook Running-Balance Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="rounded-md border bg-muted/30 p-3">
          <span className="text-muted-foreground block">Opening Balance</span>
          <span className="font-mono text-base font-bold mt-0.5 block">
            {currency(activeOpeningBalance)}
          </span>
        </div>
        <div className="rounded-md border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 p-3">
          <span className="text-emerald-800 dark:text-emerald-300 block">
            Total Deposits (+)
          </span>
          <span className="font-mono text-base font-bold text-emerald-700 dark:text-emerald-400 mt-0.5 block">
            +{currency(passbook.totalDeposits)}
          </span>
        </div>
        <div className="rounded-md border bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 p-3">
          <span className="text-rose-800 dark:text-rose-300 block">
            Total Withdrawals (-)
          </span>
          <span className="font-mono text-base font-bold text-destructive mt-0.5 block">
            -{currency(passbook.totalWithdrawals)}
          </span>
        </div>
        <div className="rounded-md border bg-slate-900 text-white p-3">
          <span className="text-slate-300 block">Closing Running Balance</span>
          <span className="font-mono text-base font-bold mt-0.5 block">
            {currency(passbook.closingBalance)}
          </span>
        </div>
      </div>

      {/* Zoho Books Banking Passbook Table */}
      <div
        id="zoho-passbook-printable-area"
        className="rounded-lg border bg-card overflow-x-auto shadow-xs"
      >
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white border-b">
              <th className="py-2.5 px-3 text-left font-semibold w-28">Date</th>
              <th className="py-2.5 px-3 text-left font-semibold w-32">Ref #</th>
              <th className="py-2.5 px-3 text-left font-semibold">
                Type & Transaction Details (Zoho Banking Format)
              </th>
              <th className="py-2.5 px-3 text-left font-semibold w-44">Project / Site</th>
              <th className="py-2.5 px-3 text-left font-semibold w-44">Wallet / Account</th>
              <th className="py-2.5 px-3 text-right font-semibold w-32">Deposits (+)</th>
              <th className="py-2.5 px-3 text-right font-semibold w-32">Withdrawals (-)</th>
              <th className="py-2.5 px-3 text-right font-semibold w-36">Running Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {displayedRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-muted-foreground">
                  No passbook transactions match the selected wallet and filters.
                </td>
              </tr>
            ) : (
              displayedRows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                    {dateFmt(row.date)}
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                    {row.refNumber || "—"}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-foreground">{row.type}</div>
                    {row.partyType && row.partyId && onOpenParty360 ? (
                      <button
                        type="button"
                        onClick={() => onOpenParty360(row.partyType!, row.partyId!)}
                        className="text-[11px] text-primary hover:underline font-medium text-left"
                        title="Open Party 360° Ledger & Statement PDF"
                      >
                        {row.subLabel}
                      </button>
                    ) : (
                      <div className="text-[11px] text-muted-foreground">{row.subLabel}</div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-medium">{row.projectName}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        row.accountSource === "bank"
                          ? "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                      }`}
                    >
                      {row.walletName}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                    {row.deposit > 0 ? currency(row.deposit) : "—"}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-destructive">
                    {row.withdrawal > 0 ? currency(row.withdrawal) : "—"}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground bg-muted/20">
                    {row.runningBalance < 0
                      ? `-${currency(Math.abs(row.runningBalance))}`
                      : currency(row.runningBalance)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
