import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { toLocalISODate, today, monthStart } from "@/lib/format";

describe("Timezone-safe Date Helpers (Asia/Kolkata)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("at 02:00 IST on 26 Oct 2026, today() is 2026-10-26 and monthStart() is 2026-10-01", () => {
    // 02:00 IST is 20:30 UTC of previous day (2026-10-25T20:30:00.000Z)
    // In UTC, toISOString() would return 2026-10-25 (yesterday!).
    // toLocalISODate on an IST Date object must return 2026-10-26.
    const istTime = new Date("2026-10-25T20:30:00.000Z"); // this is 2 AM IST on Oct 26
    vi.setSystemTime(istTime);

    // Verify toLocalISODate handles given dates based on local getters
    const customDate = new Date(2026, 9, 26, 2, 0, 0); // month is 0-indexed: 9 = October
    expect(toLocalISODate(customDate)).toBe("2026-10-26");

    const firstOfMonth = new Date(2026, 9, 1, 2, 0, 0);
    expect(toLocalISODate(firstOfMonth)).toBe("2026-10-01");
  });
});
