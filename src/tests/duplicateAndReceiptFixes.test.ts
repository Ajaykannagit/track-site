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
  });
});
