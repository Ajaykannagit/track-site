export const currency = (n: number | null | undefined) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(n ?? 0));

export const num = (n: number | null | undefined, digits = 2) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits }).format(Number(n ?? 0));

export const pct = (n: number | null | undefined) => `${Number(n ?? 0).toFixed(1)}%`;

export const dateFmt = (d: string | null | undefined) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

export const dateTimeFmt = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

/**
 * Convert a Date to a local ISO date string (YYYY-MM-DD) using the device's
 * local clock — not UTC. This is critical for India (IST = UTC+5:30) where
 * toISOString() can return the previous day at early morning hours.
 */
export function toLocalISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Today's date in YYYY-MM-DD using the device's local timezone (not UTC). */
export const today = (): string => toLocalISODate(new Date());

/** First day of a month (offset by offsetMonths from now) in YYYY-MM-DD local time. */
export const monthStart = (offsetMonths = 0): string => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offsetMonths);
  return toLocalISODate(d);
};

/** N years ago from today in YYYY-MM-DD local time. */
export const yearsAgo = (n: number): string => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return toLocalISODate(d);
};
