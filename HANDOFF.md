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
Status: verified (matches exactly)

Ran benchmark week (13.09.2026 to 19.09.2026) directly through `src/lib/wageRules.ts` (`calculateSuggestedDayValue` and `calculateWorkerWeeklyWage`):

- **Day value calculations**:
  - In 6 / Out 6 -> 1.5
  - In 9 / Out 6 -> 1.0
  - In 6 / Out 2 -> 1.0
- **Individual totals**:
  - Vinoth: Rate 1100, Days 7.5, Wage 8250, Bus 0, Advance 0, Balance 8250
  - Krishna: Rate 1100, Days 8.0, Wage 8800, Bus 0, Advance 0, Balance 8800
  - Eranna: Rate 750, Days 9.5, Wage 7125, Bus 320, Advance 0, Balance 7445
  - Ragunath: Rate 750, Days 8.0, Wage 6000, Bus 0, Advance 0, Balance 6000
  - Sanjay: Rate 1100, Days 8.0, Wage 8800, Bus 0, Advance 0, Balance 8800
  - Gowtham: Rate 750, Days 10.0, Wage 7500, Bus 0, Advance 0, Balance 7500
  - Narasamma: Rate 500, Days 8.5, Wage 4250, Bus 0, Advance 0, Balance 4250
  - Ravi: Rate 1100, Days 6.0, Wage 6600, Bus 0, Advance 0, Balance 6600
  - Madesh: Rate 750, Days 6.0, Wage 4500, Bus 0, Advance 0, Balance 4500
  - Sathish: Rate 1100, Days 1.0, Wage 1100, Bus 0, Advance 0, Balance 1100
  - Beema: Rate 750, Days 1.0, Wage 750, Bus 0, Advance 0, Balance 750
  - Rammappa: Rate 750, Days 1.0, Wage 750, Bus 0, Advance 0, Balance 750
- **Grand totals**:
  - Total Wage: 64,425
  - Total Bus/Petrol: 320
  - Total Advance: 0
  - Total Wage Balance: 64,745
- **Team totals**:
  - Vinoth Team: 26,850
  - Eranna Team: 11,695
  - Sathish Team (Kolar): 2,600
  - Krishna team: 23,600

