export const currency = (n: number | null | undefined) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(n ?? 0));

export const num = (n: number | null | undefined, digits = 2) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: digits }).format(Number(n ?? 0));

export const pct = (n: number | null | undefined) => `${(Number(n ?? 0)).toFixed(1)}%`;

export const dateFmt = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const dateTimeFmt = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

export const today = () => new Date().toISOString().slice(0, 10);

export const monthStart = (offsetMonths = 0) => {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMonths, 1);
  return d.toISOString().slice(0, 10);
};

export const yearsAgo = (n: number) => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  return d.toISOString().slice(0, 10);
};
