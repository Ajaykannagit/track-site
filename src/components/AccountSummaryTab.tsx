import React, { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { currency, dateFmt } from "@/lib/format";
import { Printer, CheckCircle2, AlertTriangle, ChevronRight, FileSpreadsheet } from "lucide-react";
import { useAccountBalances } from "@/lib/db";
import { downloadCsv, type CsvColumn } from "@/lib/csv";

export type HeadCategory = "Equity" | "Income" | "Expense";

export interface AccountHeadTransaction {
  id: string;
  date: string;
  amount: number;
  payment_source: "bank" | "petty_cash";
  head: string;
  category: HeadCategory;
  project_id: string | null;
  projectName: string;
  party: string;
  reference_number: string;
  remarks: string;
}

interface AccountSummaryTabProps {
  from: string;
  to: string;
  onFromChange: (val: string) => void;
  onToChange: (val: string) => void;
  projectOptions: { value: string; label: string }[];
  transactions: AccountHeadTransaction[];
  openingBalances?: { bank: number; petty_cash: number };
}

export function AccountSummaryTab({
  from,
  to,
  onFromChange,
  onToChange,
  projectOptions,
  transactions,
  openingBalances = { bank: 0, petty_cash: 0 },
}: AccountSummaryTabProps) {
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [drilldownHead, setDrilldownHead] = useState<string | null>(null);

  const { data: liveBalances } = useAccountBalances();

  // Filter transactions
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (t.date < from || t.date > to) return false;
      if (selectedProject !== "all" && t.project_id !== selectedProject) return false;
      if (selectedSource !== "all" && t.payment_source !== selectedSource) return false;
      return true;
    });
  }, [transactions, from, to, selectedProject, selectedSource]);

  // Aggregate by Category & Head
  const groupedData = useMemo(() => {
    const map = new Map<HeadCategory, Map<string, { total: number; count: number }>>();
    map.set("Equity", new Map());
    map.set("Income", new Map());
    map.set("Expense", new Map());

    for (const t of filtered) {
      const catMap = map.get(t.category);
      if (catMap) {
        const cur = catMap.get(t.head) || { total: 0, count: 0 };
        cur.total += t.amount;
        cur.count += 1;
        catMap.set(t.head, cur);
      }
    }

    return map;
  }, [filtered]);

  // Totals for Equity, Income, Expense
  const equityTotal = Array.from(groupedData.get("Equity")?.values() || []).reduce((s, v) => s + v.total, 0);
  const incomeTotal = Array.from(groupedData.get("Income")?.values() || []).reduce((s, v) => s + v.total, 0);
  const expenseTotal = Array.from(groupedData.get("Expense")?.values() || []).reduce((s, v) => s + v.total, 0);

  // Reconciliation calculations for Bank and Petty Cash separately
  const recon = useMemo(() => {
    const calc = (src: "bank" | "petty_cash") => {
      const open = openingBalances[src] || 0;
      // Inflows in filtered period
      const inflows = filtered
        .filter((t) => t.payment_source === src && (t.category === "Income" || t.category === "Equity"))
        .reduce((sum, t) => sum + t.amount, 0);
      // Outflows in filtered period
      const outflows = filtered
        .filter((t) => t.payment_source === src && t.category === "Expense")
        .reduce((sum, t) => sum + t.amount, 0);

      const computedClosing = Math.round((open + inflows - outflows) * 100) / 100;
      const liveBal = liveBalances?.[src]?.balance ?? computedClosing;
      const match = Math.abs(computedClosing - liveBal) < 0.01;

      return { open, inflows, outflows, computedClosing, liveBal, match, diff: computedClosing - liveBal };
    };

    return {
      bank: calc("bank"),
      petty_cash: calc("petty_cash"),
    };
  }, [filtered, openingBalances, liveBalances]);

  // Drilldown transactions for selected head
  const drilldownTxns = useMemo(() => {
    if (!drilldownHead) return [];
    return filtered.filter((t) => t.head === drilldownHead);
  }, [filtered, drilldownHead]);

  // Export to CSV
  const handleExportCsv = () => {
    type SummaryRow = {
      category: string;
      head: string;
      count: number | string;
      amount: number;
    };
    const rows: SummaryRow[] = [];
    groupedData.forEach((heads, category) => {
      heads.forEach((data, head) => {
        rows.push({
          category,
          head,
          count: data.count,
          amount: data.total,
        });
      });
    });
    rows.push({ category: "TOTAL", head: "Total Equity (Cr)", count: "—", amount: equityTotal });
    rows.push({ category: "TOTAL", head: "Total Income (Cr)", count: "—", amount: incomeTotal });
    rows.push({ category: "TOTAL", head: "Total Expense (Dr)", count: "—", amount: expenseTotal });

    const cols: CsvColumn<SummaryRow>[] = [
      { header: "Classification", value: (r) => r.category },
      { header: "Account Head", value: (r) => r.head },
      { header: "Transactions Count", value: (r) => r.count },
      { header: "Amount (INR)", value: (r) => r.amount },
    ];
    downloadCsv("account-summary-trial-balance", rows, cols);
  };

  return (
    <div className="space-y-6">
      {/* Filters Bar */}
      <div className="no-print p-3 bg-card border rounded-lg flex flex-wrap items-end gap-3 text-xs">
        <div>
          <Label className="text-[11px] font-medium text-muted-foreground block mb-1">From Date</Label>
          <Input type="date" value={from} onChange={(e) => onFromChange(e.target.value)} className="h-8 text-xs w-36" />
        </div>
        <div>
          <Label className="text-[11px] font-medium text-muted-foreground block mb-1">To Date</Label>
          <Input type="date" value={to} onChange={(e) => onToChange(e.target.value)} className="h-8 text-xs w-36" />
        </div>
        <div>
          <Label className="text-[11px] font-medium text-muted-foreground block mb-1">Project</Label>
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="h-8 text-xs w-44">
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
          <Label className="text-[11px] font-medium text-muted-foreground block mb-1">Payment Source</Label>
          <Select value={selectedSource} onValueChange={setSelectedSource}>
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue placeholder="All Sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="bank">🏦 Bank Account</SelectItem>
              <SelectItem value="petty_cash">💵 Petty Cash</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="h-8 text-xs gap-1.5">
            <FileSpreadsheet className="size-3.5" /> Export Excel/CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="h-8 text-xs gap-1.5">
            <Printer className="size-3.5" /> Print / PDF
          </Button>
        </div>
      </div>

      {/* Trial Balance / Account Summary Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="p-4 border-b bg-muted/40 flex justify-between items-center">
          <div>
            <h3 className="font-semibold text-sm">Account Summary by Head (Trial Balance Style)</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Structured summary categorized under Equity, Income, and Expense heads. Click any head to drill down into transactions.
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-muted-foreground font-mono">
              Period: {dateFmt(from)} to {dateFmt(to)}
            </span>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="text-xs bg-muted/60">
              <TableHead className="w-[50%]">Account Head</TableHead>
              <TableHead className="text-center w-[15%]">Transactions</TableHead>
              <TableHead className="text-right w-[17%]">Debit (Dr ₹)</TableHead>
              <TableHead className="text-right w-[18%]">Credit (Cr ₹)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* 1. EQUITY */}
            <TableRow className="bg-primary/5 font-bold text-xs uppercase tracking-wider">
              <TableCell colSpan={4} className="py-2 text-primary">
                1. Equity & Capital
              </TableCell>
            </TableRow>
            {Array.from(groupedData.get("Equity")?.entries() || []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-xs text-muted-foreground italic pl-6 py-2">
                  No equity/investment transactions in this period.
                </TableCell>
              </TableRow>
            ) : (
              Array.from(groupedData.get("Equity")?.entries() || []).map(([head, data]) => (
                <TableRow
                  key={head}
                  className="hover:bg-muted/40 cursor-pointer"
                  onClick={() => setDrilldownHead(head)}
                >
                  <TableCell className="pl-6 text-xs font-medium flex items-center gap-1.5">
                    <ChevronRight className="size-3 text-muted-foreground" />
                    <span>{head}</span>
                  </TableCell>
                  <TableCell className="text-center text-xs font-mono text-muted-foreground">
                    {data.count}
                  </TableCell>
                  <TableCell className="text-right text-xs font-mono">—</TableCell>
                  <TableCell className="text-right text-xs font-mono font-semibold text-emerald-700">
                    {currency(data.total)}
                  </TableCell>
                </TableRow>
              ))
            )}
            <TableRow className="bg-muted/20 font-semibold text-xs border-b">
              <TableCell className="pl-6">Total Equity (Cr):</TableCell>
              <TableCell />
              <TableCell className="text-right font-mono">—</TableCell>
              <TableCell className="text-right font-mono text-emerald-800">{currency(equityTotal)}</TableCell>
            </TableRow>

            {/* 2. INCOME */}
            <TableRow className="bg-emerald-500/10 font-bold text-xs uppercase tracking-wider">
              <TableCell colSpan={4} className="py-2 text-emerald-800 dark:text-emerald-300">
                2. Income / Revenue
              </TableCell>
            </TableRow>
            {Array.from(groupedData.get("Income")?.entries() || []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-xs text-muted-foreground italic pl-6 py-2">
                  No income transactions in this period.
                </TableCell>
              </TableRow>
            ) : (
              Array.from(groupedData.get("Income")?.entries() || []).map(([head, data]) => (
                <TableRow
                  key={head}
                  className="hover:bg-muted/40 cursor-pointer"
                  onClick={() => setDrilldownHead(head)}
                >
                  <TableCell className="pl-6 text-xs font-medium flex items-center gap-1.5">
                    <ChevronRight className="size-3 text-muted-foreground" />
                    <span>{head}</span>
                  </TableCell>
                  <TableCell className="text-center text-xs font-mono text-muted-foreground">
                    {data.count}
                  </TableCell>
                  <TableCell className="text-right text-xs font-mono">—</TableCell>
                  <TableCell className="text-right text-xs font-mono font-semibold text-emerald-700">
                    {currency(data.total)}
                  </TableCell>
                </TableRow>
              ))
            )}
            <TableRow className="bg-muted/20 font-semibold text-xs border-b">
              <TableCell className="pl-6">Total Income (Cr):</TableCell>
              <TableCell />
              <TableCell className="text-right font-mono">—</TableCell>
              <TableCell className="text-right font-mono text-emerald-800">{currency(incomeTotal)}</TableCell>
            </TableRow>

            {/* 3. EXPENSES */}
            <TableRow className="bg-rose-500/10 font-bold text-xs uppercase tracking-wider">
              <TableCell colSpan={4} className="py-2 text-rose-800 dark:text-rose-300">
                3. Expenses & Disbursements
              </TableCell>
            </TableRow>
            {Array.from(groupedData.get("Expense")?.entries() || []).length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-xs text-muted-foreground italic pl-6 py-2">
                  No expense transactions in this period.
                </TableCell>
              </TableRow>
            ) : (
              Array.from(groupedData.get("Expense")?.entries() || []).map(([head, data]) => (
                <TableRow
                  key={head}
                  className="hover:bg-muted/40 cursor-pointer"
                  onClick={() => setDrilldownHead(head)}
                >
                  <TableCell className="pl-6 text-xs font-medium flex items-center gap-1.5">
                    <ChevronRight className="size-3 text-muted-foreground" />
                    <span>{head}</span>
                  </TableCell>
                  <TableCell className="text-center text-xs font-mono text-muted-foreground">
                    {data.count}
                  </TableCell>
                  <TableCell className="text-right text-xs font-mono font-semibold text-rose-700">
                    {currency(data.total)}
                  </TableCell>
                  <TableCell className="text-right text-xs font-mono">—</TableCell>
                </TableRow>
              ))
            )}
            <TableRow className="bg-muted/20 font-semibold text-xs border-b">
              <TableCell className="pl-6">Total Expenses (Dr):</TableCell>
              <TableCell />
              <TableCell className="text-right font-mono text-rose-800">{currency(expenseTotal)}</TableCell>
              <TableCell className="text-right font-mono">—</TableCell>
            </TableRow>

            {/* GRAND TOTAL */}
            <TableRow className="bg-muted/50 font-bold text-xs border-t-2">
              <TableCell className="pl-6 text-sm">Grand Totals (Trial Balance Balance Check):</TableCell>
              <TableCell className="text-center font-mono">{filtered.length} entries</TableCell>
              <TableCell className="text-right font-mono text-sm text-rose-800">
                {currency(expenseTotal)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm text-emerald-800">
                {currency(equityTotal + incomeTotal)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* RECONCILIATION BLOCK */}
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <span>Account Reconciliation & Live Balance Check</span>
            </h4>
            <p className="text-xs text-muted-foreground">
              Mathematical formula: <code>Opening + Inflows - Outflows = Closing</code>. Verified directly against <code>get_account_balances()</code>.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Bank Account Reconciliation */}
          <div className="p-3.5 rounded-lg border bg-sky-500/5 space-y-2 text-xs">
            <div className="flex items-center justify-between font-semibold border-b pb-2">
              <span className="flex items-center gap-1.5 text-sky-800 dark:text-sky-300">
                🏦 Bank Account Reconciliation
              </span>
              {recon.bank.match ? (
                <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 gap-1 text-[11px]">
                  <CheckCircle2 className="size-3 text-emerald-600" /> Reconciled
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1 text-[11px]">
                  <AlertTriangle className="size-3" /> Mismatch: {currency(recon.bank.diff)}
                </Badge>
              )}
            </div>
            <div className="space-y-1 font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Opening Balance:</span>
                <span>{currency(recon.bank.open)}</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>+ Inflows (Receipts/Investments):</span>
                <span>+{currency(recon.bank.inflows)}</span>
              </div>
              <div className="flex justify-between text-rose-700">
                <span>- Outflows (Disbursements):</span>
                <span>-{currency(recon.bank.outflows)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 font-bold">
                <span>= Computed Closing:</span>
                <span>{currency(recon.bank.computedClosing)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Live Database Balance (get_account_balances):</span>
                <span>{currency(recon.bank.liveBal)}</span>
              </div>
            </div>
          </div>

          {/* Petty Cash Reconciliation */}
          <div className="p-3.5 rounded-lg border bg-amber-500/5 space-y-2 text-xs">
            <div className="flex items-center justify-between font-semibold border-b pb-2">
              <span className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                💵 Petty Cash Reconciliation
              </span>
              {recon.petty_cash.match ? (
                <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-300 gap-1 text-[11px]">
                  <CheckCircle2 className="size-3 text-emerald-600" /> Reconciled
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1 text-[11px]">
                  <AlertTriangle className="size-3" /> Mismatch: {currency(recon.petty_cash.diff)}
                </Badge>
              )}
            </div>
            <div className="space-y-1 font-mono">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Opening Balance:</span>
                <span>{currency(recon.petty_cash.open)}</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>+ Inflows (Receipts/Investments):</span>
                <span>+{currency(recon.petty_cash.inflows)}</span>
              </div>
              <div className="flex justify-between text-rose-700">
                <span>- Outflows (Disbursements):</span>
                <span>-{currency(recon.petty_cash.outflows)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 font-bold">
                <span>= Computed Closing:</span>
                <span>{currency(recon.petty_cash.computedClosing)}</span>
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Live Database Balance (get_account_balances):</span>
                <span>{currency(recon.petty_cash.liveBal)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Drilldown Modal */}
      {drilldownHead && (
        <Dialog open={!!drilldownHead} onOpenChange={(o) => !o && setDrilldownHead(null)}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">
                Transactions for Head: {drilldownHead} ({drilldownTxns.length})
              </DialogTitle>
              <DialogDescription className="text-xs">
                Detailed record view for {drilldownHead} during {dateFmt(from)} to {dateFmt(to)}.
              </DialogDescription>
            </DialogHeader>

            <div className="border rounded-lg overflow-hidden bg-card mt-3">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs bg-muted/60">
                    <TableHead>Date</TableHead>
                    <TableHead>Party / Payee</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drilldownTxns.map((tx) => (
                    <TableRow key={tx.id} className="text-xs">
                      <TableCell>{dateFmt(tx.date)}</TableCell>
                      <TableCell className="font-medium">{tx.party}</TableCell>
                      <TableCell>{tx.projectName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] uppercase font-mono">
                          {tx.payment_source === "bank" ? "🏦 Bank" : "💵 Cash"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">{tx.reference_number || "—"}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {currency(tx.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
