import { describe, expect, it } from "vitest";
import { computePartyStatementEntries } from "@/components/Party360Dialog";
import { computePassbookRunningLedger } from "@/components/PassbookLedgerTab";

describe("Zoho Books 50 Upgrades — Party 360° Statement & Running Passbook Math", () => {
  it("computes chronological running balance and unused advance credit for a Vendor (like Bhavani Hardware)", () => {
    const result = computePartyStatementEntries({
      openingBalance: 0,
      entries: [
        {
          id: "pay-1",
          date: "2026-04-10",
          docType: "Vendor Advance / Payment",
          docNumber: "PAY-208",
          details: "Excess advance payment",
          projectName: "Gowri Shankar Site",
          billedAmount: 0,
          paidAmount: 24725,
          isAdvance: true,
        },
      ],
    });

    expect(result.totalBilled).toBe(0);
    expect(result.totalPaid).toBe(24725);
    expect(result.closingBalance).toBe(-24725);
    expect(result.unusedAdvance).toBe(24725);
    expect(result.netPayableOrReceivable).toBe(0);
    expect(result.rows[0]?.runningBalance).toBe(-24725);
  });

  it("nets advance payments against subsequent contractor bills in chronological order (like Nagaraj Centring Work - Kolar)", () => {
    const result = computePartyStatementEntries({
      openingBalance: 0,
      entries: [
        {
          id: "adv-1",
          date: "2026-04-01",
          docType: "Contractor Advance",
          docNumber: "CPAY-01",
          details: "Mobilization advance",
          projectName: "Kolar Site",
          billedAmount: 0,
          paidAmount: 40000,
          isAdvance: true,
        },
        {
          id: "bill-1",
          date: "2026-04-15",
          docType: "Contractor RA Bill",
          docNumber: "CB-101",
          details: "Slab centring bill",
          projectName: "Kolar Site",
          billedAmount: 100000,
          paidAmount: 0,
        },
        {
          id: "pay-2",
          date: "2026-04-18",
          docType: "Payment Made",
          docNumber: "CPAY-02",
          details: "Part settlement",
          projectName: "Kolar Site",
          billedAmount: 0,
          paidAmount: 35000,
        },
      ],
    });

    expect(result.rows.map((r) => r.runningBalance)).toEqual([-40000, 60000, 25000]);
    expect(result.totalBilled).toBe(100000);
    expect(result.totalPaid).toBe(75000);
    expect(result.closingBalance).toBe(25000);
    expect(result.unusedAdvance).toBe(0);
    expect(result.netPayableOrReceivable).toBe(25000);
  });

  it("computes multi-wallet passbook cumulative running balance across deposits, withdrawals, and contra transfers", () => {
    const passbook = computePassbookRunningLedger({
      openingBalance: 100000,
      events: [
        {
          id: "ev-2",
          date: "2026-04-05",
          refNumber: "CONTRA-01",
          type: "Transfer To Another Account",
          subLabel: "To Account: Kodak- Petty Cash",
          projectName: "Corporate / Contra",
          projectId: null,
          accountSource: "bank",
          walletName: "Brickweld Private Limited (xxxx5909)",
          deposit: 0,
          withdrawal: 25000,
        },
        {
          id: "ev-1",
          date: "2026-04-02",
          refNumber: "RCP-01",
          type: "Customer Payment",
          subLabel: "Customer: Mrs. Anitha",
          projectName: "Anitha Residence",
          projectId: "p1",
          accountSource: "bank",
          walletName: "Brickweld Private Limited (xxxx5909)",
          deposit: 50000,
          withdrawal: 0,
        },
        {
          id: "ev-3",
          date: "2026-04-08",
          refNumber: "VPAY-01",
          type: "Vendor Payment",
          subLabel: "Vendor: Bhavani Hardware",
          projectName: "Anitha Residence",
          projectId: "p1",
          accountSource: "bank",
          walletName: "Brickweld Private Limited (xxxx5909)",
          deposit: 0,
          withdrawal: 15000,
        },
      ],
    });

    // Sorted chronologically: 100,000 + 50,000 = 150,000 -> -25,000 = 125,000 -> -15,000 = 110,000
    expect(passbook.rowsAsc.map((r) => r.runningBalance)).toEqual([150000, 125000, 110000]);
    expect(passbook.totalDeposits).toBe(50000);
    expect(passbook.totalWithdrawals).toBe(40000);
    expect(passbook.closingBalance).toBe(110000);
    // rowsDesc has latest transaction first
    expect(passbook.rowsDesc[0]?.runningBalance).toBe(110000);
  });
});
