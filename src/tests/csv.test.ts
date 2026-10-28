import { describe, it, expect } from "vitest";
import { toCsv, parseCsv } from "@/lib/csv";

describe("CSV Export Safety & Formula Injection Protection", () => {
  it("prefixes dangerous characters (=, +, -, @) with single quote", () => {
    const rows = [
      { name: "=1+1", desc: "+SUM(A1:A10)", tag: "-danger", email: "@user" },
    ];
    const columns = [
      { header: "Name", value: (r: any) => r.name },
      { header: "Desc", value: (r: any) => r.desc },
      { header: "Tag", value: (r: any) => r.tag },
      { header: "Email", value: (r: any) => r.email },
    ];

    const csv = toCsv(rows, columns);
    expect(csv).toContain("'=1+1");
    expect(csv).toContain("'+SUM(A1:A10)");
    expect(csv).toContain("'-danger");
    expect(csv).toContain("'@user");
  });

  it("leaves normal numbers unchanged", () => {
    const rows = [{ amount: 500, balance: -200 }];
    const columns = [
      { header: "Amount", value: (r: any) => r.amount },
      { header: "Balance", value: (r: any) => r.balance },
    ];
    const csv = toCsv(rows, columns);
    expect(csv).toContain("500");
    expect(csv).toContain("-200");
  });

  it("prepends UTF-8 BOM so Excel opens non-ASCII characters correctly", () => {
    const rows = [{ text: "பிரிக்வெல்ட் ₹500" }];
    const columns = [{ header: "Text", value: (r: any) => r.text }];
    const csv = toCsv(rows, columns);
    expect(csv.startsWith("\uFEFF")).toBe(true);
  });
});
