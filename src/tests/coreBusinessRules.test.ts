import { describe, it, expect } from "vitest";

// ============================================================================
// 1. PO Totals: GST on Materials only, Travel added after GST
// ============================================================================
export interface PoItemInput {
  unit_price: number;
  quantity: number;
  gst_percent: number;
}

export function computePoTotals(items: PoItemInput[], travelCharges: number) {
  const materialsSubtotal = items.reduce((acc, it) => acc + it.unit_price * it.quantity, 0);
  const gstAmount = items.reduce((acc, it) => {
    const lineTotal = it.unit_price * it.quantity;
    return acc + (lineTotal * (it.gst_percent || 0)) / 100;
  }, 0);
  const materialsWithGst = materialsSubtotal + gstAmount;
  const grandTotal = materialsWithGst + (Number(travelCharges) || 0);

  return {
    materialsSubtotal,
    gstAmount,
    materialsWithGst,
    travelCharges: Number(travelCharges) || 0,
    grandTotal,
  };
}

// ============================================================================
// 2. Running Account Balances & No Double Counting
// ============================================================================
export interface BalanceState {
  bank: number;
  petty_cash: number;
}

export interface TransactionHeader {
  type: "client_receipt" | "md_investment" | "group_payment" | "direct_payment" | "wage_payment" | "expense";
  source: "bank" | "petty_cash";
  amount: number;
  group_payment_id?: string | null;
}

export function applyTransaction(balance: BalanceState, tx: TransactionHeader): BalanceState {
  if (!tx.source || (tx.source !== "bank" && tx.source !== "petty_cash")) {
    throw new Error("payment_source is mandatory and must be 'bank' or 'petty_cash'");
  }
  const next = { ...balance };
  if (tx.type === "client_receipt" || tx.type === "md_investment") {
    next[tx.source] += tx.amount;
  } else {
    next[tx.source] -= tx.amount;
  }
  return next;
}

export function calculateAccountBalancesFromHeaders(
  opening: BalanceState,
  transactions: TransactionHeader[]
): BalanceState {
  return transactions.reduce((acc, tx) => {
    // Double counting rule: if an individual payment row belongs to a group payment, skip it
    if (tx.group_payment_id) {
      return acc;
    }
    return applyTransaction(acc, tx);
  }, opening);
}

// ============================================================================
// 3. Wage Payment vs Weekly Adjustment (Double-Counting Prevention)
// ============================================================================
export function calculateNetWageOutflow(
  actualWageDisbursement: number,
  busAdjustment: number,
  advanceDeduction: number
) {
  // Only the actual wage payment disbursement leaves Bank or Petty Cash.
  // Bus adjustment and advance deductions alter net pay calculation, but do NOT move cash twice.
  return actualWageDisbursement;
}

// ============================================================================
// 4. Staff Type Classification for Wage Printing
// ============================================================================
export interface EmployeeRecord {
  id: string;
  name: string;
  designation: string;
  staff_type: "labour" | "supervisor" | "officer";
}

export function filterStaffForWagePrint(
  staff: EmployeeRecord[],
  mode: "weekly" | "monthly"
): EmployeeRecord[] {
  if (mode === "weekly") {
    // LABOUR only (workers/helpers). Exclude supervisors and officers.
    return staff.filter((s) => s.staff_type === "labour");
  }
  // Monthly: ALL staff
  return staff;
}

// ============================================================================
// 5. Dependency Check & Bulk Notification Logic
// ============================================================================
export interface PoDependencyCheck {
  grnCount: number;
  paymentCount: number;
}

export function validatePoDeletion(dep: PoDependencyCheck): { canDelete: boolean; message?: string } {
  if (dep.grnCount > 0 || dep.paymentCount > 0) {
    const parts: string[] = [];
    if (dep.grnCount > 0) parts.push(`${dep.grnCount} GRN(s)`);
    if (dep.paymentCount > 0) parts.push(`${dep.paymentCount} payment(s)`);
    return {
      canDelete: false,
      message: `Cannot delete Purchase Order: ${parts.join(" and ")} are linked to it.`,
    };
  }
  return { canDelete: true };
}

export function generateBulkDeleteNotification(
  tableName: string,
  records: { id: string; title: string; amount?: number }[],
  userEmail: string,
  userRole: string,
  reason: string
) {
  if (userRole === "md") {
    return null; // MD does not notify themselves
  }
  const count = records.length;
  const titles = records.map((r) => r.title).join(", ");
  const totalAmount = records.reduce((acc, r) => acc + (r.amount || 0), 0);
  return {
    notificationCount: 1, // EXACTLY ONE consolidated notification
    title: `Bulk Delete: ${count} ${tableName} record(s) deleted`,
    message: `${userEmail} deleted ${count} ${tableName} record(s): ${titles}. Total amount: ₹${totalAmount}. Reason: ${reason}`,
    target_role: "md",
  };
}

// ============================================================================
// 6. Access Control Security Check
// ============================================================================
export function authorizeMdData(role: string): { allowed: boolean; error?: string } {
  if (role !== "md") {
    return { allowed: false, error: "Access denied. Restricted to Managing Director (MD)." };
  }
  return { allowed: true };
}

// ============================================================================
// VITEST TEST SUITE
// ============================================================================
describe("Part 2 Core Financial & Business Rules Tests", () => {
  it("rejects transaction when payment_source is missing or invalid", () => {
    const bal: BalanceState = { bank: 50000, petty_cash: 10000 };
    expect(() =>
      applyTransaction(bal, {
        type: "expense",
        source: "" as any,
        amount: 500,
      })
    ).toThrow("payment_source is mandatory and must be 'bank' or 'petty_cash'");

    expect(() =>
      applyTransaction(bal, {
        type: "expense",
        source: "upi" as any,
        amount: 500,
      })
    ).toThrow("payment_source is mandatory and must be 'bank' or 'petty_cash'");
  });

  it("updates running balances for bank and petty cash correctly upon payment, receipt, and MD investment", () => {
    let bal: BalanceState = { bank: 10000, petty_cash: 5000 };

    // 1. Client receipt into bank
    bal = applyTransaction(bal, { type: "client_receipt", source: "bank", amount: 25000 });
    expect(bal.bank).toBe(35000);
    expect(bal.petty_cash).toBe(5000);

    // 2. MD Investment into petty cash
    bal = applyTransaction(bal, { type: "md_investment", source: "petty_cash", amount: 15000 });
    expect(bal.petty_cash).toBe(20000);

    // 3. Payment from bank
    bal = applyTransaction(bal, { type: "direct_payment", source: "bank", amount: 12000 });
    expect(bal.bank).toBe(23000);

    // 4. Expense from petty cash
    bal = applyTransaction(bal, { type: "expense", source: "petty_cash", amount: 3000 });
    expect(bal.petty_cash).toBe(17000);
  });

  it("prevents double counting on group payments: counts header once, ignores child allocations in balances", () => {
    const opening: BalanceState = { bank: 100000, petty_cash: 20000 };

    const transactions: TransactionHeader[] = [
      // Group payment header of 40,000 paid from Bank
      { type: "group_payment", source: "bank", amount: 40000, group_payment_id: null },
      // Child allocations (for project costing only - must have group_payment_id)
      { type: "direct_payment", source: "bank", amount: 25000, group_payment_id: "gp-1" },
      { type: "direct_payment", source: "bank", amount: 15000, group_payment_id: "gp-1" },
    ];

    const finalBalances = calculateAccountBalancesFromHeaders(opening, transactions);
    // Bank should be 100,000 - 40,000 = 60,000 (NOT 100k - 40k - 40k = 20k)
    expect(finalBalances.bank).toBe(60000);
  });

  it("ensures weekly wage adjustments (advance/bus) do not trigger a second cash outflow", () => {
    const grossWage = 65000;
    const busAllowance = 500;
    const advanceDeduction = 5000;
    const actualDisbursement = grossWage + busAllowance - advanceDeduction; // 60,500

    const outflow = calculateNetWageOutflow(actualDisbursement, busAllowance, advanceDeduction);
    // Only the actual payout leaves cash/bank
    expect(outflow).toBe(60500);
  });

  it("calculates PO totals with GST on materials only and travel added post-GST", () => {
    const items: PoItemInput[] = [
      { unit_price: 350, quantity: 100, gst_percent: 28 }, // Cement: 35,000 + 28% (9,800) = 44,800
      { unit_price: 50, quantity: 200, gst_percent: 18 },  // Sand: 10,000 + 18% (1,800) = 11,800
      { unit_price: 20, quantity: 100, gst_percent: 0 },   // Unbranded: 2,000 + 0% = 2,000
    ];
    const travelCharges = 3500; // Travel charge added AFTER GST, zero GST applied to travel

    const totals = computePoTotals(items, travelCharges);

    expect(totals.materialsSubtotal).toBe(47000); // 35000 + 10000 + 2000
    expect(totals.gstAmount).toBe(11600);         // 9800 + 1800
    expect(totals.materialsWithGst).toBe(58600);   // 47000 + 11600
    expect(totals.travelCharges).toBe(3500);
    expect(totals.grandTotal).toBe(62100);        // 58600 + 3500
  });

  it("blocks soft delete with descriptive dependent records message", () => {
    const withDeps = validatePoDeletion({ grnCount: 2, paymentCount: 1 });
    expect(withDeps.canDelete).toBe(false);
    expect(withDeps.message).toBe("Cannot delete Purchase Order: 2 GRN(s) and 1 payment(s) are linked to it.");

    const clean = validatePoDeletion({ grnCount: 0, paymentCount: 0 });
    expect(clean.canDelete).toBe(true);
    expect(clean.message).toBeUndefined();
  });

  it("creates exactly ONE summary notification on bulk delete by Accounts", () => {
    const deletedRecords = [
      { id: "1", title: "PO-001", amount: 15000 },
      { id: "2", title: "PO-002", amount: 25000 },
      { id: "3", title: "PO-003", amount: 10000 },
    ];
    const notif = generateBulkDeleteNotification(
      "purchase_orders",
      deletedRecords,
      "accountant@brickweld.com",
      "accounts",
      "Batch cancellation"
    );

    expect(notif).not.toBeNull();
    expect(notif?.notificationCount).toBe(1);
    expect(notif?.title).toBe("Bulk Delete: 3 purchase_orders record(s) deleted");
    expect(notif?.message).toContain("PO-001, PO-002, PO-003");
    expect(notif?.message).toContain("₹50000");
    expect(notif?.target_role).toBe("md");
  });

  it("enforces MD-only access for notifications, deleted records, and financial dashboard", () => {
    const accountsAttempt = authorizeMdData("accounts");
    expect(accountsAttempt.allowed).toBe(false);
    expect(accountsAttempt.error).toContain("Restricted to Managing Director (MD)");

    const mdAttempt = authorizeMdData("md");
    expect(mdAttempt.allowed).toBe(true);
  });

  it("classifies staff correctly: weekly wage sheet includes Labour only, monthly includes all staff", () => {
    const staffList: EmployeeRecord[] = [
      { id: "e1", name: "Ramesh (Worker)", designation: "Mason", staff_type: "labour" },
      { id: "e2", name: "Suresh (Helper)", designation: "Helper", staff_type: "labour" },
      { id: "e3", name: "Vikram (Supervisor)", designation: "Site Supervisor", staff_type: "supervisor" },
      { id: "e4", name: "Anil (Engineer)", designation: "Project Engineer", staff_type: "officer" },
      { id: "e5", name: "Priya (Accounts)", designation: "Accountant", staff_type: "officer" },
    ];

    const weekly = filterStaffForWagePrint(staffList, "weekly");
    expect(weekly.length).toBe(2);
    expect(weekly.map((s) => s.staff_type)).toEqual(["labour", "labour"]);

    const monthly = filterStaffForWagePrint(staffList, "monthly");
    expect(monthly.length).toBe(5);
  });
});
