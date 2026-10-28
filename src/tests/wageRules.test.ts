import { describe, it, expect } from "vitest";
import {
  parseHoursBetween,
  calculateSuggestedDayValue,
  calculateWorkerWeeklyWage,
  getAttendanceWarning,
} from "@/lib/wageRules";

describe("Wage Rules & Day Value Calculations", () => {
  it("benchmark case: 6 to 6 = 1.5 days (12 hours)", () => {
    const hours = parseHoursBetween("6", "6");
    expect(hours).toBe(12);
    expect(calculateSuggestedDayValue("6", "6")).toBe(1.5);
  });

  it("benchmark case: 9 to 6 = 1.0 day (9 hours)", () => {
    const hours = parseHoursBetween("9", "6");
    expect(hours).toBe(9);
    expect(calculateSuggestedDayValue("9", "6")).toBe(1.0);
  });

  it("benchmark case: 6 to 2 = 1.0 day (8 hours)", () => {
    const hours = parseHoursBetween("6", "2");
    expect(hours).toBe(8);
    expect(calculateSuggestedDayValue("6", "2")).toBe(1.0);
  });

  it("in-time 12 is treated as 12:00 noon (not midnight)", () => {
    // 12 in-time to 6 (PM) out-time is 6 hours -> 0.5 days (half day)
    const hours = parseHoursBetween("12", "6");
    expect(hours).toBe(6);
    expect(calculateSuggestedDayValue("12", "6")).toBe(0.5);
  });

  it("handles explicit am/pm suffixes", () => {
    // 9am to 5pm = 8 hours -> 1.0 day
    expect(parseHoursBetween("9am", "5pm")).toBe(8);
    expect(calculateSuggestedDayValue("9am", "5pm")).toBe(1.0);

    // 12pm (noon) to 8pm = 8 hours -> 1.0 day
    expect(parseHoursBetween("12pm", "8pm")).toBe(8);
    expect(calculateSuggestedDayValue("12pm", "8pm")).toBe(1.0);
  });

  it("handles 24-hour time format", () => {
    // 14:00 (2 PM) to 22:00 (10 PM) = 8 hours -> 1.0 day
    expect(parseHoursBetween("14", "22")).toBe(8);
    expect(calculateSuggestedDayValue("14", "22")).toBe(1.0);
  });

  it("leave returns 0 day value", () => {
    expect(calculateSuggestedDayValue("6", "6", true)).toBe(0);
  });

  it("calculates weekly wage settlements accurately (benchmark week)", () => {
    // Benchmark week: total wage 64,425, bus/petrol 320, balance 64,745
    // E.g. worker with 8.5 days at 750/day = 6375, advance 0, bus 100 => 6475
    const res = calculateWorkerWeeklyWage(85.9, 750, 320, 0);
    // 85.9 * 750 = 64425
    expect(res.wage).toBe(64425);
    expect(res.wageBalance).toBe(64745);
  });

  it("warns when out-time is not after in-time or computed hours are > 16", () => {
    expect(getAttendanceWarning("18", "6")).not.toBeNull();
    expect(getAttendanceWarning("6", "23")).not.toBeNull(); // 17 hours
    expect(getAttendanceWarning("9", "6")).toBeNull();
  });
});
