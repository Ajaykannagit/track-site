/**
 * Brickweld Construction Wage & Day Value Calculation Rules.
 * Centralized in one configurable file.
 *
 * TODO: Temporary rules until client confirms additional edge cases.
 * Benchmark results that MUST NOT change:
 *   6→6  = 1.5 days  (6 AM in, 6 PM out = 12 hours)
 *   9→6  = 1.0 days  (9 AM in, 6 PM out = 9 hours)
 *   6→2  = 1.0 days  (6 AM in, 2 PM out = 8 hours)
 *   Week 13.09.2026–19.09.2026: total wage 64,425, bus/petrol 320, balance 64,745.
 */

export interface WageRuleConfig {
  hoursForFullDay: number;       // default: 8
  hoursForOvertimeDay: number;   // default: 12
  hoursForHalfDay: number;       // default: 4
  defaultInTime: string;         // e.g. "6:00" or "9:00"
  defaultOutTime: string;        // e.g. "18:00" or "6:00"
}

export const WAGE_RULES: WageRuleConfig = {
  hoursForFullDay: 8,
  hoursForOvertimeDay: 12,
  hoursForHalfDay: 4,
  defaultInTime: "6",
  defaultOutTime: "6",
};

/**
 * Parses an hour string to a 24-hour float.
 *
 * Rules (in priority order):
 * 1. Explicit "am"/"pm" suffix in the string → apply standard 12-hr logic.
 *    - 12am → 0, 1am → 1 … 11am → 11
 *    - 12pm → 12, 1pm → 13 … 11pm → 23
 * 2. Value ≥ 13  → already 24-hour format (e.g. "14", "13:30").
 * 3. Value == 12 → treat as 12:00 noon (NOT midnight) when no suffix.
 * 4. No suffix, isDefaultPM=true → add 12 (out-time assumed PM convention).
 * 5. No suffix, isDefaultPM=false → keep as AM (in-time assumed AM).
 *
 * @param str         The raw time string from the form.
 * @param isDefaultPM True for out-time fields (default: PM), false for in-time (default: AM).
 */
export function parseHourValue(str: string, isDefaultPM: boolean): number {
  const trimmed = str.trim().toLowerCase();
  const hasPM = trimmed.includes("pm");
  const hasAM = trimmed.includes("am");
  const cleaned = trimmed.replace(/[ap]m/g, "").trim();
  const parts = cleaned.split(":");
  let h = parseFloat(parts[0] || "0");
  const m = parts[1] ? parseFloat(parts[1]) / 60 : 0;
  if (isNaN(h)) return 0;

  if (hasPM) {
    // Explicit PM
    if (h < 12) h += 12;
    // h==12 stays 12 (noon)
  } else if (hasAM) {
    // Explicit AM
    if (h === 12) h = 0; // midnight
    // else keep
  } else if (h >= 13) {
    // 24-hour value — use as-is
  } else if (h === 12) {
    // 12 without AM/PM → noon (12:00), regardless of in/out
    // Keep h = 12
  } else {
    // No suffix, < 13, not exactly 12
    if (isDefaultPM) h += 12;
    // else keep for AM
  }
  return h + m;
}

/**
 * Calculate raw hours between in-time and out-time strings.
 *
 * In-time defaults to AM; out-time defaults to PM (when no explicit suffix).
 * Returns 0 if result is negative (out not after in).
 */
export function parseHoursBetween(inTimeStr?: string | null, outTimeStr?: string | null): number {
  if (!inTimeStr || !outTimeStr) return 0;

  const startHour = parseHourValue(inTimeStr, false);  // AM default
  const endHour = parseHourValue(outTimeStr, true);    // PM default

  const diff = endHour - startHour;
  return diff > 0 ? diff : 0;
}

/**
 * Validates computed hours and returns a warning string if something is off.
 * Returns null when everything looks fine.
 */
export function getAttendanceWarning(
  inTimeStr?: string | null,
  outTimeStr?: string | null,
): string | null {
  if (!inTimeStr || !outTimeStr) return null;
  const startHour = parseHourValue(inTimeStr, false);
  const endHour = parseHourValue(outTimeStr, true);
  if (endHour <= startHour) {
    return "Out time must be after in time. Check AM/PM or use 24-hour format (e.g. 18 for 6 PM).";
  }
  const hours = endHour - startHour;
  if (hours > 16) {
    return `Computed hours (${hours.toFixed(1)}h) seem unusually high. Please verify in/out times.`;
  }
  return null;
}

/**
 * Calculates suggested day value based on in/out times or leave status.
 * TODO: Temporary rules until client confirms additional edge cases:
 * - 12 hours or more      → 1.5
 * - 8 to 11 hours         → 1.0
 * - 4 to under 8 hours    → 0.5
 * - under 4 hours / Leave → 0.0
 */
export function calculateSuggestedDayValue(
  inTime?: string | null,
  outTime?: string | null,
  isLeave?: boolean | null,
): number {
  if (isLeave) return 0;
  if (!inTime || !outTime) return 0;

  const hours = parseHoursBetween(inTime, outTime);

  if (hours >= WAGE_RULES.hoursForOvertimeDay) {
    return 1.5;
  }
  if (hours >= WAGE_RULES.hoursForFullDay) {
    return 1.0;
  }
  if (hours >= WAGE_RULES.hoursForHalfDay) {
    return 0.5;
  }
  return 0;
}

/**
 * Calculates summary metrics for a worker given total days, daily wage rate, bus/petrol, and advance.
 */
export function calculateWorkerWeeklyWage(
  totalDays: number,
  wagePerDay: number,
  busPetrol: number = 0,
  advance: number = 0,
) {
  const wage = Math.round(totalDays * wagePerDay);
  const wageBalance = Math.round(wage + (busPetrol || 0) - (advance || 0));
  return {
    wage,
    wageBalance,
  };
}
