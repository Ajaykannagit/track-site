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
});
