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
- **QA Step 1 completed and pushed**:
  - `src/components/FormDialog.tsx`: Added form-level trimming, required check with clear inline error message ("<Field> is required"), positive number validation for required amount fields, and submission blocking until all required fields are valid.
  - Covers create & edit forms across projects, clients, workers, contractors, suppliers, quotations, expenses, and subcontractors.
  - Optional database constraint SQL drafted for `projects.name`.
- **QA Step 2 verified**:
  - Confirmed thresholds in `src/lib/wageRules.ts` (<4h=0, 4-8h=0.5, 8-12h=1.0, >=12h=1.5) match client rules and all paper cases (6-6=1.5, 9-6=1.0, 6-2=1.0).
  - Benchmark week 13.09.2026–19.09.2026 verified: Wage 64,425, Bus/Petrol 320, Advance 0, Balance 64,745; Vinoth 26,850, Eranna 11,695, Sathish 2,600, Krishna 23,600.
- **QA Step 3 completed and pushed**:
  - `src/styles.css`: Added full print media rules (`@page { size: landscape; margin: 8mm; }`, unclipping overflow containers, repeating `thead` across pages, preventing row break splits with `break-inside: avoid`).
  - `src/routes/_authenticated/attendance.tsx`: Optimized print column min-widths (`print:min-w-0`), swapped editable input boxes for formatted text on print (`print:inline`), and verified that all 7 day columns, summary columns, and team settlement tables display without horizontal cutoff. Excel export verified to include all 7 days and totals.
- **QA Step 4 completed and pushed**:
  - `src/routes/_authenticated/dashboard.tsx`: Added "+ Add Expense" button (MD only) and per-row Edit and Delete (with confirmation step via `ConfirmDeleteDialog`) for corporate office expenses.
  - Fields covered: Date, Category (with default office categories merged with DB categories), Description, Amount, Payment Method, and Receipt Reference.
  - Configured `project_id: null` on insert/update for office expenses.
  - Added sticky header, scrollable table (`max-h-[50vh]`), and footer showing grand total.
- **QA Step 5 completed and pushed**:
  - `src/routes/_authenticated/attendance.tsx`:
    - Added Weekly / Monthly view toggle and month picker (month name + year with previous/next navigation).
    - Added monthly aggregation displaying per-worker metrics: Days Present, Half Days, Leave Days, Total Days, Total Hours, Wage, Bus/Petrol, Advance, and Wage Balance. Day values use the Step 2 calculation standard.
    - Added Grand Total summary row across all workers.
    - Added interactive Day-by-Day drilldown modal when clicking on any worker row (showing date, day of week, in/out time, site location, day value, and calculated wage).
    - Added monthly team payment summary cards (Vinoth Team, Eranna Team, Sathish Team, Krishna Team) grouping wages, allowances, and balances.
    - Added Monthly Excel export (`handleExportMonthlyExcel`) with comprehensive worker-by-worker summary and totals.
    - Implemented landscape print layout with header repetition and page width fit.
- **QA Step 6 completed and pushed**:
  - Code inspection & responsive design audit conducted at 360px, 390px, and 414px mobile viewport widths:
    - `src/components/AppShell.tsx`: Optimized mobile header by making the Sign Out button compact (icon-only on small viewports with `hidden sm:inline` label) to prevent user email truncation and flex header overflows.
    - `src/styles.css`: Added a global mobile viewport constraint on Radix dialog contents (`max-width: calc(100vw - 2rem)`) to guarantee zero off-screen overflow on 360px displays.
    - `src/components/FormDialog.tsx`: Added `w-full` and scroll container styles so dynamic forms fit viewport height and width cleanly.
    - `src/routes/_authenticated/dashboard.tsx`: Added `w-full max-h-[90vh] overflow-y-auto` and horizontal scroll wrappers to Active Projects, Contract Value Breakdown, 6-Month Spend, and Corporate Office Expenses dialogs and tables.
    - `src/routes/_authenticated/masters.tsx`: Wrapped `<TabsList>` in an `overflow-x-auto` container with `w-max min-w-full` so the 5 master tabs (Clients, Employees, Contractors, Suppliers, Machines) scroll smoothly on small screens rather than wrapping or squishing.
    - `src/routes/_authenticated/attendance.tsx`: Added `w-full` and scrolling wrappers to Quick Day Attendance Edit modal and the Monthly Worker Daily Breakdown drilldown dialog.
- **QA Step 7 (Part A & Part B) completed and pushed**:
  - `Part A SQL` executed on hosted Supabase: created sanitized views (`projects_view`, `employees_view`, `attendance_view`, `material_requests_view`, `material_receipts_view`) and automated wage calculation trigger (`handle_attendance_wage_calc`).
  - `Part B SQL` executed on hosted Supabase: revoked direct SELECT on sensitive columns (`quotation_amount`, `wage_rate`, `ot_rate_per_hour`, `calculated_wage`, `total_amount`) from base tables for `anon` and `authenticated`.
  - Switched frontend read queries to use sanitized views across all routes (`attendance`, `masters`, `projects`, `projects.$projectId`, `dashboard`, `materials`, `contractors`, `accounts`, `reports`).
  - Direct base table access via API now strictly denies reading restricted financial columns, while views enforce role-based masking (`MD`/`Accounts` see real amounts; `Supervisor`/`Viewer` get 0/null or 0 rows).
  - All writes/mutations continue directly to base tables, with backend triggers computing wages securely.
  - Verified with `npx tsc --noEmit` and `npm run build`.
- **Client Batch 2, Step 1 completed and pushed**:
  - Payment method added across all transaction entry forms (Supplier Payments, Contractor Payments, Subcontractor Payments, Office Expenses, Client Receipts, Labour Advance Payments).
  - Optional Reference Number (Cheque # / Transaction ID) supported on Cheque, UPI and Bank Transfer payments.
  - Uniform "Not recorded" fallback shown on all tables, lists, and Excel exports when payment method is empty.
  - `useDeleteRow` hooked to `soft_delete_record` RPC function with `useRestoreRow` added.
  - Company Cash on Hand gated behind dedicated `canViewCompanyCashOnHand` permission (MD only).
  - Zero TypeScript errors (`npx tsc --noEmit`) and clean production build (`npm run build`).

---

## 2. Pending List (Next Steps)
- **a. Apply Missing Migrations**: ✅ RESOLVED. `supabase/checks/check_tables.sql` verified against live database schema. All required tables exist.
- **b. Review Security SQL**: ✅ RESOLVED. Replaced draft `20261012000000_column_security_proposal.sql` by executing Step 7 Part A and Part B directly. File renamed to `.SUPERSEDED.sql`.
- **c. Batch 2 Demo Seed**: ✅ FULLY EXECUTED & VERIFIED ON HOSTED DB
  - All prerequisites and demo seed SQL successfully ran against hosted Supabase (`https://bcfirpcfowqaueqayksz.supabase.co`).
  - Verified live row counts:
    - `attendance`: 97
    - `cash_closing`: 11
    - `clients`: 4
    - `contractor_bills`: 5
    - `contractor_payments`: 5
    - `contractors`: 5
    - `employees`: 18
    - `expenses`: 21
    - `material_receipts`: 3
    - `measurement_books`: 4
    - `project_quotations`: 5
    - `projects`: 5
    - `purchase_orders`: 3
    - `subcontractor_pmts`: 5
    - `supplier_payments`: 7
    - `suppliers`: 5
    - `weekly_wage_adj`: 4
    - `work_orders`: 5
  - Cleanup script ready at `supabase/demo/02_demo_cleanup.sql`.
- **d. Demo Polish & UI Verification**: ✅ VERIFIED
  - Verified screens with loaded demo data (Dashboard, Projects, Attendance, Materials, Suppliers, Contractors, Subcontractors, Masters, Reports, Accounts).
  - TypeScript zero-error clean (`npx tsc --noEmit`).
  - Production build fully succeeds (`npm run build`).

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

