import { describe, it, expect } from "vitest";
import { ROLE_PERMISSIONS, getEffectivePermissions } from "@/lib/permissions";

describe("Permissions Matrix Enforcement", () => {
  it("only MD has canViewProfitAndLoss", () => {
    expect(ROLE_PERMISSIONS.md.canViewProfitAndLoss).toBe(true);
    expect(ROLE_PERMISSIONS.accounts.canViewProfitAndLoss).toBe(false);
    expect(ROLE_PERMISSIONS.supervisor.canViewProfitAndLoss).toBe(false);
    expect(ROLE_PERMISSIONS.viewer.canViewProfitAndLoss).toBe(false);
  });

  it("both MD and Accounts can enter attendance and manage attendance records", () => {
    expect(ROLE_PERMISSIONS.md.canEnterAttendance).toBe(true);
    expect(ROLE_PERMISSIONS.supervisor.canEnterAttendance).toBe(true);
    expect(ROLE_PERMISSIONS.accounts.canEnterAttendance).toBe(true);
  });

  it("viewer cannot enter attendance", () => {
    expect(ROLE_PERMISSIONS.viewer.canEnterAttendance).toBe(false);
    expect(ROLE_PERMISSIONS.viewer.canViewProjects).toBe(true);
  });

  it("effective permissions properly combine multi-roles", () => {
    const combined = getEffectivePermissions(["accounts", "supervisor"]);
    expect(combined.canEnterAttendance).toBe(true);
    expect(combined.canViewMaterialContractorCosts).toBe(true);
    expect(combined.canViewProfitAndLoss).toBe(false); // Neither has it
  });
});
