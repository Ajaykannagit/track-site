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

- **Fix Batch 1b completed and pushed**:
  - `contractors.tsx`: Protected `subcontractor_payments` query with `enabled: canWriteFinance || isMD`.
  - `masters.tsx`: Cleaned out legacy `payroll` and `payroll_items` queries, state, and the obsolete Payroll History drawer.
- **Step 2 (Schema Check Script) completed and pushed**:
  - Created `supabase/checks/check_tables.sql` for read-only table and `is_demo` verification in Supabase SQL Editor.
- **Step 3 (Security Check & Proposal) completed and pushed**:
  - Found that standard RLS operates on rows, so direct PostgREST table queries on `projects` and `employees` return all columns of allowed rows.
  - Authored proposed migration `supabase/migrations/20261012000000_column_security_proposal.sql` creating `projects_sanitized` and `employees_sanitized` views (unapplied, awaiting review).

---

## 2. Pending List (Next Steps)
- **a. Apply Missing Migrations**: Run `supabase/checks/check_tables.sql` to identify unapplied migrations on the hosted database.
- **b. Review Security SQL**: Review `supabase/migrations/20261012000000_column_security_proposal.sql` before applying.
- **c. Batch 2 Demo Seed**: ✅ DONE (commit `c6e13e6`)
  - `supabase/demo/00_prerequisites.sql` — adds missing tables/columns; safe to re-run.
  - `supabase/demo/01_demo_seed.sql` — full paste-and-run seed (5–10 records per section, is_demo=true, fixed UUIDs, ON CONFLICT DO NOTHING). Role-assignment SQL snippet included at the bottom.
  - `supabase/demo/02_demo_cleanup.sql` — removes only is_demo rows in correct FK order.
  - Database targeted: `https://bcfirpcfowqaueqayksz.supabase.co`
  - **NOT tested against a live Postgres** — review before running.
  - **Still pending**: Apply missing migrations (run `check_tables.sql` first), create 4 Auth users in Supabase dashboard, then run files in order: `00_prerequisites.sql` → `01_demo_seed.sql` (role snippet at bottom needs real emails filled in).
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

