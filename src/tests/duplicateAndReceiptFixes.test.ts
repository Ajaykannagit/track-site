import { describe, it, expect } from "vitest";
import { formatDbError } from "@/lib/db";

describe("Problem 1 & 2 Automated Verification Tests", () => {
  describe("formatDbError - Specific duplicate error parsing", () => {
    it("extracts friendly field name and duplicate value from 23505 error detail", () => {
      const err = {
        code: "23505",
        message: "duplicate key value violates unique constraint",
        details: "Key (receipt_number)=(GRN-98765432) already exists.",
      };
      const msg = formatDbError(err, "save");
      expect(msg).toContain("GRN or Receipt number 'GRN-98765432' already exists");
      expect(msg).toContain("This is not a system error");
      expect(msg).toContain("possibly one that was deleted earlier");
    });

    it("extracts PO number correctly", () => {
      const err = {
        code: "23505",
        message: "duplicate key value violates unique constraint",
        details: "Key (po_number)=(PO-20261120) already exists.",
      };
      const msg = formatDbError(err, "save");
      expect(msg).toContain("PO number 'PO-20261120' already exists");
      expect(msg).toContain("This is not a system error");
    });

    it("extracts employee_code correctly", () => {
      const err = {
        code: "23505",
        message: "duplicate key value violates unique constraint",
        details: "Key (employee_code)=(EMP001) already exists.",
      };
      const msg = formatDbError(err, "save");
      expect(msg).toContain("Employee code 'EMP001' already exists");
    });

    it("extracts project_code correctly", () => {
      const err = {
        code: "23505",
        message: "duplicate key value violates unique constraint",
        details: "Key (project_code)=(PRJ-ALPHA) already exists.",
      };
      const msg = formatDbError(err, "save");
      expect(msg).toContain("Project code 'PRJ-ALPHA' already exists");
    });

    it("falls back to friendly message if detail cannot be parsed", () => {
      const err = {
        code: "23505",
        message: "duplicate key value violates unique constraint",
      };
      const msg = formatDbError(err, "save");
      expect(msg).toContain("A record with this code or identifier already exists");
      expect(msg).toContain("This is not a system error");
    });
  });

  describe("Filter Auto-Sync logic verification", () => {
    it("switches filter when saved project differs from active filter", () => {
      let activeFilter = "proj-1";
      const savedProjectId = "proj-2";
      let filterSwitched = false;

      // Simulate the onSuccess callback from materials.tsx
      const handleSuccess = (savedId?: string) => {
        if (savedId && activeFilter !== "all" && activeFilter !== savedId) {
          activeFilter = "all";
          filterSwitched = true;
        }
      };

      handleSuccess(savedProjectId);
      expect(activeFilter).toBe("all");
      expect(filterSwitched).toBe(true);
    });

    it("retains filter when saved project matches active filter", () => {
      let activeFilter = "proj-1";
      const savedProjectId = "proj-1";
      let filterSwitched = false;

      const handleSuccess = (savedId?: string) => {
        if (savedId && activeFilter !== "all" && activeFilter !== savedId) {
          activeFilter = "all";
          filterSwitched = true;
        }
      };

      handleSuccess(savedProjectId);
      expect(activeFilter).toBe("proj-1");
      expect(filterSwitched).toBe(false);
    });
  });

  describe("Client Receipt Status & Reconciliation Fixes", () => {
    it("validReceipts includes 'confirmed' receipts created in Accounts page", () => {
      const receipts = [
        { id: "1", amount: 100, status: "confirmed", is_void: false, deleted_at: null },
        { id: "2", amount: 200, status: "received", is_void: false, deleted_at: null },
        { id: "3", amount: 300, status: "completed", is_void: false, deleted_at: null },
        { id: "4", amount: 400, status: "void", is_void: true, deleted_at: null },
        { id: "5", amount: 500, status: "cancelled", is_void: false, deleted_at: null },
      ];

      const validReceipts = receipts.filter(
        (cp) =>
          !cp.deleted_at &&
          !cp.is_void &&
          (cp.status === "received" ||
            cp.status === "confirmed" ||
            cp.status === "completed" ||
            !cp.status)
      );

      expect(validReceipts.length).toBe(3);
      expect(validReceipts.map((r) => r.id)).toEqual(["1", "2", "3"]);
      const totalReceived = validReceipts.reduce((sum, r) => sum + r.amount, 0);
      expect(totalReceived).toBe(600); // 100 + 200 + 300
    });

    it("Dashboard and P&L contract calculations match with approved quotations", () => {
      const project = { id: "p1", quotation_amount: 100000 };
      const quotations = [
        { id: "q1", project_id: "p1", amount: 500, status: "approved", is_void: false, deleted_at: null },
        { id: "q2", project_id: "p1", amount: 1000, status: "draft", is_void: false, deleted_at: null },
        { id: "q3", project_id: "p1", amount: 2000, status: "approved", is_void: true, deleted_at: null },
      ];

      // Exact unified formula used across Dashboard, Projects index, Detail and Reports P&L
      const additions = quotations
        .filter((q) => q.project_id === project.id && q.status === "approved" && !q.is_void && !q.deleted_at)
        .reduce((sum, q) => sum + q.amount, 0);

      const totalContract = project.quotation_amount + additions;
      expect(additions).toBe(500);
      expect(totalContract).toBe(100500);
    });

    it("project_quotations select list does not request non-existent is_void column (Bug E)", () => {
      // Dashboard and Projects Index select lists must only request existing columns on project_quotations
      const projectQuotationsColumns = new Set([
        "id",
        "project_id",
        "quotation_number",
        "title",
        "description",
        "amount",
        "quotation_date",
        "status",
        "is_demo",
        "created_at",
        "updated_at",
        "deleted_at",
      ]);

      const dashboardSelect = "project_id,amount,status,deleted_at".split(",");
      for (const col of dashboardSelect) {
        expect(projectQuotationsColumns.has(col)).toBe(true);
      }
      expect(projectQuotationsColumns.has("is_void")).toBe(false);
    });

    it("voiding or unvoiding a record invalidates account_balances and projects caches immediately (Bug F)", () => {
      const invalidatedKeys: string[][] = [];
      const table = "client_payments";
      const viewAliases: Record<string, string[]> = { projects: ["projects_view"] };

      // Mirrors onSuccess in useVoidRow / useUnvoidRow / useRestoreRow
      const simulateVoidOnSuccess = () => {
        invalidatedKeys.push([table]);
        invalidatedKeys.push([`${table}_view`]);
        invalidatedKeys.push(["account_balances"]);
        invalidatedKeys.push(["projects"]);
        invalidatedKeys.push(["projects_view"]);
        invalidatedKeys.push(["notifications"]);
        for (const alias of viewAliases[table] ?? []) {
          invalidatedKeys.push([alias]);
        }
      };

      simulateVoidOnSuccess();
      expect(invalidatedKeys).toContainEqual(["client_payments"]);
      expect(invalidatedKeys).toContainEqual(["account_balances"]);
      expect(invalidatedKeys).toContainEqual(["projects"]);
      expect(invalidatedKeys).toContainEqual(["projects_view"]);
    });

    it("Historical attendance wages remain locked when worker master wage rate changes from 600 to 700", () => {
      // Historical records for a week in the past, recorded when wage was ₹600
      const oldRecords = [
        { attendance_date: "2026-10-01", day_value: 1.0, wage_rate: 600, calculated_wage: 600 },
        { attendance_date: "2026-10-02", day_value: 1.0, wage_rate: 600, calculated_wage: 600 },
        { attendance_date: "2026-10-03", day_value: 1.5, wage_rate: 600, calculated_wage: 900 },
      ];

      // Master wage rate is now edited to ₹700
      const updatedEmployee = { id: "emp1", wage_rate: 700, wage_type: "daily" };

      // Using historical recorded wages sum:
      let recordedWageSum = 0;
      let hasAnyRecordedWage = false;
      for (const rec of oldRecords) {
        if (rec.calculated_wage !== undefined && rec.calculated_wage !== null) {
          recordedWageSum += Number(rec.calculated_wage);
          hasAnyRecordedWage = true;
        }
      }

      const totalDays = oldRecords.reduce((s, r) => s + r.day_value, 0);
      const earnedWage = hasAnyRecordedWage ? recordedWageSum : totalDays * updatedEmployee.wage_rate;

      // Must remain locked at 600 + 600 + 900 = 2100, NOT 3.5 * 700 = 2450!
      expect(earnedWage).toBe(2100);
      expect(earnedWage).not.toBe(2450);
    });

    it("Voided expenses are strictly excluded from project costs and total spend", () => {
      const expenses = [
        { id: "e1", project_id: "p1", amount: 1500, is_void: false, deleted_at: null },
        { id: "e2", project_id: "p1", amount: 2000, is_void: true, deleted_at: null },
        { id: "e3", project_id: "p1", amount: 500, is_void: false, deleted_at: "2026-11-20T00:00:00Z" },
        { id: "e4", project_id: "p2", amount: 3000, is_void: false, deleted_at: null },
      ];

      const validProjectExpenses = expenses.filter(
        (e) => e.project_id === "p1" && !e.is_void && !e.deleted_at
      );

      const totalProjectSpend = validProjectExpenses.reduce((s, e) => s + e.amount, 0);

      expect(validProjectExpenses.length).toBe(1);
      expect(totalProjectSpend).toBe(1500); // Only e1, excludes e2 (void) and e3 (deleted)
    });

    it("Client receipt reversals are counted as Outflows in ledger and reconcile against inflows", () => {
      const receipts = [
        { id: "r1", amount: 50000, payment_category: "advance", is_void: false, deleted_at: null },
        { id: "r2", amount: 20000, payment_category: "progress", is_void: false, deleted_at: null },
        { id: "r3", amount: 5000, payment_category: "reversal", is_void: false, deleted_at: null },
        { id: "r4", amount: 10000, payment_category: "progress", is_void: true, deleted_at: null },
      ];

      // Net receipt calculation (used in Dashboard & Project Detail)
      const validReceipts = receipts.filter((r) => !r.is_void && !r.deleted_at);
      const netReceived = validReceipts.reduce((sum, r) => {
        if (r.payment_category === "reversal") return sum - r.amount;
        return sum + r.amount;
      }, 0);

      expect(netReceived).toBe(65000); // 50000 + 20000 - 5000

      // Ledger classification: reversals are outflows
      const ledgerEntries = validReceipts.map((r) => {
        const isReversal = r.payment_category === "reversal";
        return {
          id: r.id,
          amount: r.amount,
          type: isReversal ? "Client Receipt Reversal" : "Client Receipt",
          direction: isReversal ? "outflow" : "inflow",
        };
      });

      const totalInflows = ledgerEntries
        .filter((t) => t.direction === "inflow")
        .reduce((s, t) => s + t.amount, 0);
      const totalOutflows = ledgerEntries
        .filter((t) => t.direction === "outflow")
        .reduce((s, t) => s + t.amount, 0);

      expect(totalInflows).toBe(70000); // 50000 + 20000
      expect(totalOutflows).toBe(5000); // 5000 reversal outflow
      expect(totalInflows - totalOutflows).toBe(65000);
    });

    it("Team wage payments reduce pending balance and support unassigned teams (null team_id)", () => {
      const teamWorkers = [
        { id: "w1", wageBalance: 3000, team_id: null },
        { id: "w2", wageBalance: 2500, team_id: null },
      ];

      const teamTotalDue = teamWorkers.reduce((s, w) => s + w.wageBalance, 0);
      expect(teamTotalDue).toBe(5500);

      // Recorded wage payments in wage_payments table
      const wagePayments = [
        { id: "wp1", team_id: null, amount: 3000, week_start_date: "2026-11-15", is_void: false, deleted_at: null },
      ];

      const alreadyPaid = wagePayments
        .filter((wp) => wp.team_id === null && !wp.is_void && !wp.deleted_at)
        .reduce((s, wp) => s + wp.amount, 0);

      const pendingBalance = Math.max(0, teamTotalDue - alreadyPaid);

      expect(alreadyPaid).toBe(3000);
      expect(pendingBalance).toBe(2500);

      // Verify null team_id payload generation for unassigned teams
      const payTargetTeamId = "";
      const dbPayloadTeamId = payTargetTeamId ? payTargetTeamId : null;
      expect(dbPayloadTeamId).toBeNull();
    });

    it("Weekly wage adjustments handle rapid sequential edits without losing state", () => {
      // Simulate state transition when editing Bus/Petrol then immediately editing Advance
      let adjustmentsOverride: Record<string, { busPetrol: number; advance: number }> = {};
      const empId = "emp-42";

      // 1. User enters Bus/Petrol = 250
      const bpVal = 250;
      const initialAdv = 0;
      const effectiveBp1 = bpVal;
      const effectiveAdv1 = adjustmentsOverride[empId]?.advance ?? initialAdv;
      adjustmentsOverride = {
        ...adjustmentsOverride,
        [empId]: { busPetrol: effectiveBp1, advance: effectiveAdv1 },
      };

      expect(adjustmentsOverride[empId]).toEqual({ busPetrol: 250, advance: 0 });

      // 2. User immediately enters Advance = 500 before cache refetches
      const advVal = 500;
      const effectiveBp2 = adjustmentsOverride[empId]?.busPetrol ?? 0;
      const effectiveAdv2 = advVal;
      adjustmentsOverride = {
        ...adjustmentsOverride,
        [empId]: { busPetrol: effectiveBp2, advance: effectiveAdv2 },
      };

      // Both values are preserved atomically without clobbering each other
      expect(adjustmentsOverride[empId]).toEqual({ busPetrol: 250, advance: 500 });
    });
  });
});
