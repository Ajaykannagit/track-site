# Handover & Progress Note — Brickweld Track Site

## 1. Done So Far
- **Updates 1 to 8 completed and pushed**:
  - Update 1: Role-based access and backend permissions matrix.
  - Update 2: Clickable project rows/cards & print/PDF detail page.
  - Update 3: Unified weekly attendance sheet with auto day-value/wage calculation, team payment tables, Excel/PDF export, merged payroll.
  - Update 4: Project quotations CRUD, dynamic project contract value (base + quotations).
  - Update 5: Dashboard interactive MD cards (full 6-month spend breakdown & cash closing history dialogs).
  - Update 6: Materials & subcontractor payments (ad-hoc payments ledger & live attendance sheet integration).
  - Update 7: Standalone idempotent seed script for benchmark week (13.09.2026 – 19.09.2026) marked with `is_demo = true`.
  - Update 8: Cleanup of obsolete legacy payroll route & updated internal links.
- **Fix Batch 1a completed and pushed**:
  - BUG-01: Added missing `sum` import in `src/routes/_authenticated/projects.index.tsx`.
  - BUG-02: Added `max-h-[85vh] overflow-y-auto` scroll container classes to Office Expenses dialog in `src/routes/_authenticated/dashboard.tsx`.

---

## 2. Pending List (Not Done Yet)
- **a. BUG-03 (Contractors) and BUG-04 (Masters)**:
  - Find the root cause and real error text of the errors seen as MD before changing any code.
- **b. Security Check**:
  - Query the API as Viewer and Supervisor to verify whether `projects.quotation_amount` or employee wage fields are returned over the network.
- **c. Batch 2 Demo Seed**:
  - Comprehensive demo dataset with no duplicates with earlier seed.
  - `is_demo = true` on every seeded record.
  - Correct foreign-key cleanup order script.
  - Role logins created through Supabase Auth.
  - Explicit confirmation of which database is targeted.
- **d. Optional Demo Polish**:
  - UI refinements, empty state guidance, and mobile table responsiveness.

---

## 3. Section D Benchmark Verification Result
Status: pending
