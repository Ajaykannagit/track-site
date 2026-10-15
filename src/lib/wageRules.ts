/**
 * Brickweld Construction Wage & Day Value Calculation Rules.
 * Centralized in one configurable file.
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
 * Parses 12-hour clock times without AM/PM.
 * In-time is treated as AM (e.g. 6 -> 6:00 AM, 9 -> 9:00 AM).
 * Out-time is treated as PM (e.g. 6 -> 6:00 PM = 18:00, 2 -> 2:00 PM = 14:00).
 */
export function parseHoursBetween(inTimeStr?: string | null, outTimeStr?: string | null): number {
  if (!inTimeStr || !outTimeStr) return 0;

  const parseHour = (str: string, isPM: boolean): number => {
    const cleaned = str.trim().toLowerCase().replace(/am|pm/g, "");
    const parts = cleaned.split(":");
    let h = parseFloat(parts[0] || "0");
    const m = parts[1] ? parseFloat(parts[1]) / 60 : 0;
    if (isNaN(h)) return 0;

    if (isPM && h < 12) {
      h += 12;
    } else if (!isPM && h === 12) {
      h = 0;
    }
    return h + m;
  };

  const startHour = parseHour(inTimeStr, false); // AM
  const endHour = parseHour(outTimeStr, true);   // PM

  const diff = endHour - startHour;
  return diff > 0 ? diff : 0;
}

/**
 * Calculates suggested day value based on in/out times or leave status.
 * TODO: Temporary rules until client confirms additional edge cases:
 * - 12 hours or more      -> 1.5
 * - 8 to 11 hours         -> 1.0
 * - 4 to under 8 hours    -> 0.5
 * - under 4 hours / Leave -> 0.0
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
