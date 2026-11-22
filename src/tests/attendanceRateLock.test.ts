import { describe, it, expect } from "vitest";
import { daysInMonthOf, resolveAttendanceDailyRate } from "@/lib/wageRules";

const dailyWorker = { wage_rate: 700, wage_type: "daily" };
const monthlyStaff = { wage_rate: 30000, wage_type: "monthly" };

describe("Attendance rate locking (Bug B) and month-correct pro-rata (Bug C)", () => {
  it("daysInMonthOf uses the attendance date's own month", () => {
    expect(daysInMonthOf("2026-11-22")).toBe(30);
    expect(daysInMonthOf("2026-12-05")).toBe(31);
    expect(daysInMonthOf("2026-02-10")).toBe(28);
    expect(daysInMonthOf("2028-02-10")).toBe(29);
  });

  it("Bug B: re-saving an existing day keeps its stored rate after a master rate change", () => {
    // Saved at 600, master later raised to 700
    expect(resolveAttendanceDailyRate({ employee: dailyWorker, attendanceDate: "2026-11-22", storedRate: 600 })).toBe(600);
  });

  it("Bug B: explicit reprice uses the current master rate", () => {
    expect(
      resolveAttendanceDailyRate({ employee: dailyWorker, attendanceDate: "2026-11-22", storedRate: 600, reprice: true }),
    ).toBe(700);
  });

  it("new or unpriced legacy records use the master rate", () => {
    expect(resolveAttendanceDailyRate({ employee: dailyWorker, attendanceDate: "2026-11-22" })).toBe(700);
    expect(resolveAttendanceDailyRate({ employee: dailyWorker, attendanceDate: "2026-11-22", storedRate: 0 })).toBe(700);
  });

  it("Bug C: monthly staff are pro-rated by the attendance date's month, not the viewed month", () => {
    // 22 Nov → /30 = 1,000 regardless of December (31 days) being selected in the UI
    expect(resolveAttendanceDailyRate({ employee: monthlyStaff, attendanceDate: "2026-11-22" })).toBe(1000);
    expect(resolveAttendanceDailyRate({ employee: monthlyStaff, attendanceDate: "2026-12-22" })).toBe(968);
  });

  it("Bug C: an existing November day stays at 1,000 on re-save", () => {
    expect(
      resolveAttendanceDailyRate({ employee: monthlyStaff, attendanceDate: "2026-11-22", storedRate: 1000 }),
    ).toBe(1000);
  });
});
