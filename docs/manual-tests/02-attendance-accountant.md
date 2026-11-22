# Manual Test Guide: Attendance & Wages (Accountant Role)

**Document ID:** `02-attendance-accountant`  
**Page Name:** Attendance (`/attendance`)  
**Target User Role:** Accountant (`accounts`)  
**Verification Target:** Attendance grids, daily logs, advance/allowance adjustments, wage sheets, team wage payments, and role-based permissions against Supabase RLS policies.

---

## 1. Page Overview

- **Purpose:** Daily and weekly attendance logging for construction labor teams and staff, calculation of daily units and wages based on in/out times, tracking weekly travel allowances (Bus/Petrol) and advances with payment methods, printing labor/staff wage slips, and recording team wage cash disbursements.
- **Menu Path:** Click **Attendance** in the left sidebar navigation menu, or navigate directly to `http://localhost:5173/attendance` (or hosted domain equivalent).
- **Login Used:** User account assigned the `accounts` role in `user_roles`.
- **Route Guard:** Guarded by `<RequirePermission permission="canEnterAttendance">`. Because the `accounts` role has `canEnterAttendance = true`, the page loads completely without redirection.

---

## 2. Access Matrix

| Action / Element | Accountant Allowed? | How It Shows in UI | Backend Enforced? (RLS / DB) |
| :--- | :---: | :--- | :--- |
| **View Attendance Page** | Yes | Full page loads; sidebar link "Attendance" visible. | Enforced by session authentication. |
| **Supervisor Banner** | Hidden | Banner stating "Supervisor View (Financials Hidden)" is NOT displayed. | Enforced in UI: condition is `!permissions.canViewWagesAndPayments`. Accountant has `canViewWagesAndPayments = true`. |
| **Wage Columns & Financial Totals** | Yes | Columns `WAGE/DAY`, `WAGE (₹)`, `BUS/PETROL`, `ADVANCE`, `WAGE BALANCE`, and grand total summaries are visible. | Enforced in UI and backed by `attendance`, `weekly_wage_adjustments`, and `labour_wage_payments` SELECT policies (all allow authenticated). |
| **Toggle Weekly / Monthly View** | Yes | Toggle buttons visible and active at top-right. | Pure UI state toggle. |
| **Navigate Weeks & Jump to Benchmark (13.09.2026)** | Yes | Navigation arrows `◀`, `▶`, and the badge `13.09.2026` are clickable. | Pure UI state calculation. |
| **Quick Day Attendance (Add / Edit)** | Yes | Clicking any daily cell in the weekly grid opens the `Record Day Attendance` dialog. | Enforced by `can_write_attendance()` policy (`is_md() OR has_role('supervisor') OR has_role('accounts')`). |
| **Delete Day Attendance** | **No (Mismatch)** | Trash button **"Delete Entry"** is visible inside the Day Edit dialog when an entry exists. Clicking it calls `deleteAttendance` RPC `soft_delete_record`. | **Blocked by Backend:** `soft_delete_record` enforces `is_md()`. Shows toast error: *"Permission denied. Only Managing Director (MD) can delete records."* |
| **Mark All Present (Batch Fill)** | Yes | Emerald button **"Mark All Present"** is visible and opens confirmation dialog. | Writes to `attendance` table, allowed via `can_write_attendance()`. |
| **Edit Bus / Petrol (Inline)** | Yes | Number input field directly in weekly grid row. Saves on blur / Enter. | Enforced by `weekly_wage_adjustments` policy (`is_finance_user()`: MD or accounts). |
| **Edit Advance (Inline)** | Yes | Number input field directly in weekly grid row. Saves on blur / Enter. | Enforced by `weekly_wage_adjustments` policy (`is_finance_user()`: MD or accounts). |
| **Advance Payment Details Modal** | Yes | Pill button showing payment method (e.g., `CAS`, `UPI`) appears next to advance input when advance > 0. Opens modal to enter method and reference. | Enforced by `weekly_wage_adjustments` policy (`is_finance_user()`: MD or accounts). |
| **View Worker Profile Drawer** | Yes | Clicking worker full name in weekly table opens slide-over Sheet with ledger and details. | Enforced by `canViewWorkerProfiles = true`. |
| **Change Worker Team in Drawer** | Yes | Select dropdown in drawer allows reassigning worker's team. | Backed by `can_manage_masters()` policy on `employees` table (MD and accounts have access). |
| **Pay Team Wages ("Pay Team" button)** | Yes | Green button **"Pay Team"** visible on each team card under Team-Wise Wage Settlements. Opens `PayTeamWageDialog`. | Backed by `lwp_write_policy` on `labour_wage_payments` and `wage_payments` policy (MD or accounts). |
| **Team Management & Rosters** | Yes | Button **"Manage Teams & Rosters"** visible at top bar. Opens dialog with tabs to edit teams, replace absent workers, and create teams. | Backed by `teams` and `team_members` write policies (MD or accounts). |
| **Print Wage Sheets (Weekly / Monthly)** | Yes | Print buttons visible; generates printable wage sheet modal with print styles. | Pure client-side report generator. |
| **Export Excel** | Yes | Button **"Export Excel"** visible; downloads CSV of current view. | Pure client-side CSV generator. |
| **Monthly Worker Day Breakdown** | Yes | In monthly view, clicking worker name or "View Days" opens drilldown dialog. | Read-only query on monthly attendance. |

### What the Accountant CANNOT Access on this Page
1. **Direct Delete of Attendance Entries:** The UI displays a red "Delete Entry" button in the Day Edit modal, but any delete attempt will fail because `soft_delete_record` strictly requires the `md` role.
2. **MD-Only Financial Overview:** The accountant cannot see company profit/loss calculations on the dashboard, but within `/attendance`, all wage rates and labor costs are fully accessible.

---

## 3. Test Data Pack

All test data uses realistic Tamil Nadu construction locations, worker names, wages, and sites.

### A. Seed Data Required Before Starting
Ensure the following records exist in your project database before executing the test cases:

#### 1. Sites
| Site ID | Site Name | Location |
| :--- | :--- | :--- |
| `site-637` | **Site 637** | Coimbatore Main Site |
| `site-3033` | **Site 3033** | Pollachi Highway Expansion |
| `site-kelam` | **Kelamangalam** | Hosur Brick Kiln Unit |

#### 2. Teams
| Team ID | Team Name | Team Leader |
| :--- | :--- | :--- |
| `team-vinoth` | **Vinoth Team** | Vinoth Kumar |
| `team-eranna` | **Eranna Team** | Eranna Gowda |

#### 3. Workers (Employees)
| Employee Code | Full Name | Designation | Assigned Team | Daily Wage Rate (₹) | Phone |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `BW-EMP-001` | **Murugan P** | Mason | Vinoth Team | ₹850.00 | 9842100001 |
| `BW-EMP-002` | **Selvam K** | Helper | Vinoth Team | ₹550.00 | 9842100002 |
| `BW-EMP-003` | **Ravi Chandran** | Bar Bender | Eranna Team | ₹750.00 | 9842100003 |
| `BW-EMP-004` | **Suresh M** | Helper | Eranna Team | ₹500.00 | 9842100004 |

---

### B. Form Data Sets

#### Form 1: Quick Day Attendance Dialog (Record Day Attendance)
Opened by clicking any date cell for a worker in the weekly grid.

##### 1. VALID Data Sets (Standard Working Hours & Automatic Day Value)
| Field | Valid Set 1 (Full Day: 8h) | Valid Set 2 (Overtime: 12h) | Valid Set 3 (Half Day: 6h) | Valid Set 4 (Leave) |
| :--- | :--- | :--- | :--- | :--- |
| **In Time (AM)** | `9` (or `09:00`) | `6` (or `06:00`) | `12` | *Disabled* |
| **Out Time (PM)** | `6` (or `06:00`) | `6` (or `06:00`) | `6` | *Disabled* |
| **Work Site Location** | `Site 637` | `Site 3033` | `Kelamangalam` | *Disabled* |
| **Mark Leave** | Unchecked | Unchecked | Unchecked | Clicked (Active) |
| **Day Value (Units)** | Auto-calculates to `1.0` | Auto-calculates to `1.5` | Auto-calculates to `0.5` | `0` (Zero) |
| **Calculated Wage (Murugan ₹850)** | `1.0 × 850 = ₹850` | `1.5 × 850 = ₹1,275` | `0.5 × 850 = ₹425` | `0 × 850 = ₹0` |

##### 2. INVALID Data Set
| Field | Invalid Value | Expected Behaviour |
| :--- | :--- | :--- |
| **In Time** | `25:00` or `abc` | Auto-suggestion falls back to 0.0 or 1.0; does not crash. |
| **Day Value** | `-1.0` | Blocked by UI constraint (`min="0"`). If forced, triggers validation error. |
| **Day Value** | `3.5` | Exceeds max range (`max="2.5"`). |

##### 3. BOUNDARY Data Set
| Scenario | Input Values | Expected Behaviour |
| :--- | :--- | :--- |
| **Zero Hours (< 4 hrs)** | In: `10`, Out: `1` (3 hours) | Day Value auto-suggests `0.0`. Cell shows `0.0` (amber/muted). |
| **Exact 4 Hours Boundary** | In: `10`, Out: `2` (4 hours) | Day Value auto-suggests `0.5` (Half Day). |
| **Exact 8 Hours Boundary** | In: `9`, Out: `5` (8 hours) | Day Value auto-suggests `1.0` (Full Day). |
| **Exact 12 Hours Boundary** | In: `6`, Out: `6` (12 hours) | Day Value auto-suggests `1.5` (Overtime Day). |
| **Manual Override** | In: `9`, Out: `6`, Override Day Value to `2.0` | Day value accepts `2.0`. Wage = `2.0 × Daily Rate`. |

---

#### Form 2: Advance Payment Details Modal
Opened by clicking the payment method pill (e.g. `CAS`) when an advance amount > 0 is entered in the weekly table.

##### 1. VALID Data Sets
| Field | Set 1 (Cash) | Set 2 (UPI) | Set 3 (Bank / NEFT) | Set 4 (Cheque) |
| :--- | :--- | :--- | :--- | :--- |
| **Advance Amount** | (Read-only, e.g., `1500`) | (Read-only, e.g., `1500`) | (Read-only, e.g., `1500`) | (Read-only, e.g., `1500`) |
| **Payment Method** | `Cash` | `UPI / Online` | `Bank Transfer` | `Cheque` |
| **Reference Number** | *(Field hidden)* | `UPI/9842100001/01` | `NEFT-SBIN2026091401` | `CHQ-778901` |
| **Expected Result** | Method saved as `cash`, pill shows `CAS`. | Method saved as `upi`, pill shows `UPI`. | Method saved as `bank`, pill shows `BAN`. | Method saved as `cheque`, pill shows `CHE`. |

##### 2. BOUNDARY / SPECIAL Data Sets
| Scenario | Field | Input Value | Expected Behaviour |
| :--- | :--- | :--- | :--- |
| **Blank Reference on UPI** | Reference Number | *(Leave blank)* | Saves successfully; reference stored as `null`. |
| **Special Characters in Ref** | Reference Number | `UTR#988102-SBIN@01` | Accepted and saved without error. |

---

#### Form 3: Pay Team Wages Modal (`PayTeamWageDialog`)
Opened by clicking the green **"Pay Team"** button on any team card under Team-Wise Wage Settlements.

##### 1. VALID Data Sets
Assume **Vinoth Team** has 2 active workers with a total calculated pending wage balance of **₹12,400.00**.

| Field | Set 1: Full Cash Payment | Set 2: Partial Bank Payment |
| :--- | :--- | :--- |
| **Payment Amount (₹)** | `12400` (or click "Pay Full") | `6000` |
| **Pay From (Source)** | `Petty Cash` | `Bank Account` |
| **Payment Date** | Today's Date (`2026-09-19`) | Today's Date (`2026-09-19`) |
| **Ref / Voucher #** | `PC-VOUCH-2026-041` | `IMPS-884920018` |
| **Remarks** | `Weekly wage settlement for Vinoth Team` | `Part-payment 1st instalment` |
| **Expected Calculation** | Pending balance becomes **₹0.00**. | Pending balance becomes **₹6,400.00** (`12,400 - 6,000`). |

##### 2. INVALID Data Sets
| Scenario | Field | Value | Expected Error Message |
| :--- | :--- | :--- | :--- |
| **Zero Amount** | Payment Amount | `0` | *"Payment amount must be greater than zero."* |
| **Negative Amount** | Payment Amount | `-500` | Blocked by UI input (`min="1"`) or triggers toast error. |
| **Overpayment** | Payment Amount | `15000` (Pending is 12400) | *"Payment amount (₹15,000) cannot exceed pending wage (₹12,400)."* |
| **Missing Pay From** | Pay From Source | *(None selected)* | *"Please select 'Pay from': Bank or Petty Cash is mandatory."* |

---

#### Form 4: Team Management Dialog (`TeamManagementDialog`)
Opened by clicking **"Manage Teams & Rosters"** in the top header.

##### Tab 1: Manage Existing Team
- **Team Name:** Text field, e.g., `Vinoth Super Team`.
- **Leader / Supervisor:** Dropdown select from existing employees.

##### Tab 2: Replace Absent Worker (Vinoth Workflow)
- **Team:** Select `Vinoth Team`.
- **Effective Replacement Date:** `2026-09-15`.
- **Absent / Leaving Worker:** Select `Selvam K (BW-EMP-002)`.
- **Replacement Helper / Worker:** Select `Ravi Chandran (BW-EMP-003)`.
- **Reason / Handover Note:** `Selvam hospital leave, Ravi assigned as substitute`.
- **Expected Result:** Selvam's `team_members` row is updated with `left_on = 2026-09-15` and `is_active = false`. Ravi is inserted into `team_members` starting `2026-09-15`. Selvam's past attendance remains untouched.

##### Tab 3: Create New Team
- **Team Name:** `Kovai Plastering Team` (Required).
- **Leader:** Select `Murugan P` (Optional).
- **Expected Result:** New team inserted into `teams` table; becomes selectable across the app.

---

## 4. Button-by-Button Guide

### Action 1: Toggle Weekly / Monthly View
- **Location:** Top-right action bar next to the date controls.
- **Labels:** Two joined buttons: `Weekly` and `Monthly`.
- **Preconditions:** Attendance page is open.
- **Steps:**
  1. Click **Monthly**.
  2. Observe the header controls replace week arrows with Month and Year dropdowns.
  3. Observe table headers shift from individual day dates (Sun–Sat) to aggregate columns: `DAYS PRESENT`, `HALF DAYS`, `LEAVE DAYS`, `TOTAL DAYS`, `TOTAL HOURS`, `MONTHLY WAGE`, `ACTION`.
  4. Click **Weekly**.
  5. Page returns to standard 7-day Sunday-to-Saturday layout.

---

### Action 2: Navigate Weeks & Benchmark Reset
- **Location:** Top-left period banner.
- **Labels:** `◀` (Previous Week), `▶` (Next Week), and date pill button `13.09.2026`.
- **Steps:**
  1. Click `▶` (Next Week).
  2. The period header updates to the next week (e.g., `20 Sep 2026 – 26 Sep 2026`).
  3. Weekly attendance and wage numbers update dynamically for that week.
  4. Click the **13.09.2026** badge button.
  5. The view immediately resets back to the benchmark week starting **13 Sep 2026**.

---

### Action 3: Record Single-Day Attendance via Cell Click
- **Location:** Inside any day column cell (Sun, Mon, Tue, etc.) on a worker's row.
- **Preconditions:** Worker `Murugan P` exists in the weekly grid.
- **Steps:**
  1. Click the cell for `Murugan P` on **Mon (14.09.2026)**.
  2. Modal opens: **"Record Day Attendance"** showing `Murugan P (Mason) — 14 Sep 2026`.
  3. Enter **In Time (AM)**: `9`.
  4. Enter **Out Time (PM)**: `6`.
  5. Notice the **Day Value (Units)** field automatically updates to `1.0`.
  6. Select **Work Site Location**: `Site 637`.
  7. Click **Save Attendance**.
- **Expected Result:**
  - Modal closes.
  - Toast message appears: *"Attendance recorded for Murugan P"*.
  - Mon cell shows `1.0` with site label `Site 637` and green present indicator.
  - `TOTAL DAYS` increments by `1.0`.
  - `WAGE (₹)` increments by `₹850.00` (`1.0 × ₹850`).
  - `WAGE BALANCE` updates accordingly.

---

### Action 4: Mark Worker as Leave
- **Location:** Inside the Day Attendance modal.
- **Steps:**
  1. Click the cell for `Murugan P` on **Tue (15.09.2026)**.
  2. In the modal, click the button **Mark Leave**.
  3. In Time, Out Time, and Work Site Location become disabled.
  4. Day Value resets to `0`.
  5. Click **Save Attendance**.
- **Expected Result:**
  - Tue cell renders in rose/red color with text **"Leave"**.
  - Total days does not increase.
  - Calculated wage for this day is ₹0.

---

### Action 5: Batch Fill Attendance ("Mark All Present")
- **Location:** Top header action bar (Green button with user-check icon).
- **Label:** **Mark All Present**
- **Preconditions:** Multiple active workers exist with empty attendance cells for the current week.
- **Steps:**
  1. Click **Mark All Present**.
  2. Modal opens titled *"Mark All Workers Present"*.
  3. Select Target Period: Choose **Full 7-Day Week** (or pick a single date).
  4. Checkbox **"Overwrite existing attendance values"**: Leave **Unchecked** (to preserve manual edits already made).
  5. The card displays the count of active workers and total cells to be populated (e.g., `14 attendance entries`).
  6. Click **Confirm & Fill**.
- **Expected Result:**
  - Button state changes to *"Filling Attendance..."*.
  - Modal closes.
  - Toast message: *"Attendance marked for X workers across the period"*.
  - All blank cells across active workers are now populated with `1.0`, hours `08:00 – 17:00`, and default site `Site 637`.
  - Total Days, Weekly Wages, and Grand Totals at the bottom update instantly.

---

### Action 6: Inline Edit of Bus / Petrol (Travel Allowance)
- **Location:** Weekly table column **BUS/PETROL** for any worker.
- **Steps:**
  1. Locate row for `Murugan P`.
  2. Click into the number box in the `BUS/PETROL` column.
  3. Type `150`.
  4. Press **Tab** or click outside the input (triggers blur).
- **Expected Result:**
  - Input border flashes green indicating success.
  - Total allowance updates in DB table `weekly_wage_adjustments`.
  - `WAGE BALANCE` immediately increases by `+₹150.00` (`Balance = Wage + Bus/Petrol - Advance`).
  - Grand total for `BUS/PETROL` at the table footer increases by `₹150.00`.

---

### Action 7: Inline Edit of Advance & Recording Payment Method
- **Location:** Weekly table column **ADVANCE**.
- **Steps:**
  1. Locate row for `Murugan P`.
  2. Click into the number box in the `ADVANCE` column.
  3. Type `500`.
  4. Press **Enter** or blur the field.
  5. Input flashes green.
  6. Notice a small uppercase button appears next to the input (e.g. `CAS` or `—`).
  7. Click the `CAS` button.
  8. Modal opens: **"Advance Payment Details"** showing `Murugan P — Week starting 13 Sep 2026`, Advance Amount: `₹500`.
  9. Change **Payment Method** from `Cash` to `UPI / Online`.
  10. Enter **Reference Number**: `UPI-ICICI-9921004`.
  11. Click **Save Details**.
- **Expected Result:**
  - Modal closes.
  - Toast confirms adjustment details saved.
  - The badge next to the advance input now reads `UPI`.
  - Hovering over the badge shows tooltip with reference number `(UPI-ICICI-9921004)`.
  - `WAGE BALANCE` decreases by `₹500.00`.
  - Grand total for `ADVANCE` at the table footer increases by `₹500.00`.

---

### Action 8: Inspect Worker Profile & Ledger Drawer
- **Location:** Worker name link in the weekly grid.
- **Steps:**
  1. Click the text link **Murugan P** in the `NAME` column.
  2. Slide-over Sheet opens from the right titled **"Worker Profile & Ledger"**.
  3. Review details:
     - Avatar circle with initial `M`.
     - Designation badge: `Mason`.
     - Employee Code: `BW-EMP-001`.
     - Daily Wage Rate: `₹850.00`.
     - Current Week Balance: Displays exact calculated balance.
  4. Change Team Assignment dropdown: Select a different team, e.g., `Eranna Team`.
  5. Toast confirms: *"Team assignment updated"*.
  6. Close sheet by clicking the `X` or outside overlay.

---

### Action 9: Pay Team Wages via `PayTeamWageDialog`
- **Location:** Cards section below the weekly grid titled **"Team-Wise Weekly Wage Settlements"**.
- **Label:** Green button **"Pay Team"** on each team card.
- **Preconditions:** At least one worker in the team has earned wages this week.
- **Steps:**
  1. On the card for **Vinoth Team**, review the members list and total pending amount (e.g., `₹4,750.00`).
  2. Click **Pay Team**.
  3. Modal opens: **"Pay Team Wages — Vinoth Team"**.
  4. Notice the **Payment Amount (₹)** is auto-populated with the full pending balance (`4750`).
  5. Select **Pay from**: Click `Petty Cash` (mandatory).
  6. Notice the petty cash available balance is displayed.
  7. Enter **Ref / Voucher #**: `VOUCH-SEP-19`.
  8. Enter **Remarks**: `Cash distributed at site office by supervisor`.
  9. Click **Confirm Payment (₹4,750.00)**.
- **Expected Result:**
  - Button shows *"Recording..."* then dialog closes.
  - Toast message: *"₹4,750.00 paid to Vinoth Team from Petty Cash."*
  - Record inserted into `wage_payments`.
  - Petty Cash balance reduced by `₹4,750.00`.
  - Team card reflects the payment.

---

### Action 10: Print Wage Sheets
- **Location:** Top header buttons next to Export Excel.
- **Labels:**
  - **Weekly Wage PDF (Labour Only)**
  - **Monthly Wage PDF (All Staff)**
- **Steps:**
  1. Click **Weekly Wage PDF (Labour Only)**.
  2. Printable modal opens showing formal contractor/labor wage sheet formatted for A4 printing, containing columns: Code, Name, Staff Type, Designation, Team, Total Days, Rate, Earned Wage, Allowances, Deductions, Net Payable, Signature column.
  3. Click **Print** button in the modal.
  4. Browser system print preview opens.
  5. Click **Cancel** in print preview, then close dialog.

---

### Action 11: Export Excel (CSV Download)
- **Location:** Top header button with download icon.
- **Label:** **Export Excel**
- **Steps:**
  1. Click **Export Excel**.
  2. Browser automatically downloads a CSV file named e.g. `attendance_weekly_2026-09-13.csv` (or monthly equivalent).
  3. Open CSV in Excel / text editor.
  4. Verify all worker names, designations, daily values, bus/petrol, advance, and wage totals match what is displayed on screen.

---

## 5. Edge-Case and Negative Tests

| ID | Field / Scenario | Exact Input / Action | Expected Result |
| :--- | :--- | :--- | :--- |
| **EDG-ATT-01** | Zero hours worked | In: `09:00`, Out: `09:00` | Auto-suggests `0.0` days. Cell shows `0.0`. Calculated wage is ₹0. |
| **EDG-ATT-02** | Inverted work hours | In: `6` (AM), Out: `5` (AM next day / inverted) | Hour diff calculation handles or yields negative; Day Value clamp ensures value is not negative. |
| **EDG-ATT-03** | Decimal day value input | Day Value: `0.75` | Input allows decimals; wage calculates accurately: `0.75 × Rate`. |
| **EDG-ATT-04** | Maximum day value clamp | Day Value: `3.0` | UI input has `max="2.5"`. If bypassed, triggers error or caps. |
| **EDG-ATT-05** | Negative advance entered | Advance column: `-500` | Rejected by validation or clamped to 0. Advances cannot be negative. |
| **EDG-ATT-06** | Huge advance > wage | Wage is `₹3,500`, Advance entered: `₹5,000` | Balance becomes negative (`-₹1,500.00`). Displays in **emerald green** font (indicates company is owed money / prepaid). |
| **EDG-ATT-07** | Positive wage balance | Wage is `₹3,500`, Advance is `₹500`, Balance is `₹3,000` | Balance displays in **bold red** font (destructive color indicating liability owed to worker). |
| **EDG-ATT-08** | Delete attendance entry | Click cell → click red "Delete Entry" button | **Mismatch / Backend Block:** Toast error *"Permission denied. Only Managing Director (MD) can delete records."* Entry remains intact. |
| **EDG-ATT-09** | Team wage payment exceeding balance | Pending: `₹4,750`. Type: `₹5,000` | Toast error: *"Payment amount (₹5,000) cannot exceed pending wage (₹4,750)."* Submission blocked. |
| **EDG-ATT-10** | Team wage without selecting payment source | Fill amount, leave "Pay from" unselected, submit form | Toast error: *"Please select 'Pay from': Bank or Petty Cash is mandatory."* |
| **EDG-ATT-11** | Replace worker with himself | Select `Murugan P` as absent worker and `Murugan P` as replacement | Toast error: *"Cannot replace a worker with themselves."* |
| **EDG-ATT-12** | Create team with blank name | Name: `   ` (spaces only) | Toast error: *"Please enter a team name."* |

---

## 6. Permission Tests

Execute these tests to confirm role isolation between `accounts`, `supervisor`, and `md`.

### Test PERM-ATT-01: Verify Supervisor Cannot See Wage Rates or Financials
1. Log out and log in as a **Supervisor** (`supervisor` role).
2. Navigate to `/attendance`.
3. **Verify:**
   - Amber alert banner appears at the top: *"Supervisor View (Financials Hidden) — Daily hours, presence, and muster-roll operations only. Wage amounts and rates are restricted to MD and Accounts."*
   - Columns `WAGE/DAY`, `WAGE (₹)`, `BUS/PETROL`, `ADVANCE`, `WAGE BALANCE` are completely removed from both Weekly and Monthly tables.
   - Grand totals for wages, advances, and balances are hidden.
   - Section *"Team-Wise Wage Settlements"* is hidden.
   - Button *"Pay Team"* is hidden.

### Test PERM-ATT-02: Verify Accountant Sees Full Financials
1. Log in as **Accountant** (`accounts` role).
2. Navigate to `/attendance`.
3. **Verify:**
   - Amber banner is **not** present.
   - All wage columns, rates, allowances, advances, and net balances are visible.
   - Team settlement cards and *"Pay Team"* buttons are visible and functional.

### Test PERM-ATT-03: Direct URL Permission Guard (`RequirePermission`)
1. While logged in as a role lacking `canEnterAttendance` (e.g., creating a custom viewer or unprivileged session):
2. Type URL `http://localhost:5173/attendance` directly into browser address bar.
3. **Verify:**
   - Page does not render tables.
   - Center screen displays padlock icon with message: *"Access Restricted — You do not have permission to view this page. Contact the MD to request access."*

### Test PERM-ATT-04: Attendance Record Deletion Blocked by Backend
1. As Accountant, click an existing attendance cell.
2. In the modal, locate the red trash button **"Delete Entry"**.
3. Click **Delete Entry**.
4. **Verify:**
   - Request calls RPC `soft_delete_record`.
   - RPC checks `is_md()`.
   - Action fails with error: *"Permission denied. Only Managing Director (MD) can delete records."*
   - Entry is not removed.

---

## 7. Cross-Page Checks

After performing operations on the Attendance page, verify the financial flow across the application:

1. **Petty Cash Balance Deduction (`/accounts`):**
   - Note the Petty Cash balance before making a team wage payment.
   - Execute a Team Wage payment of **₹4,750.00** from `Petty Cash`.
   - Navigate to `/accounts`.
   - **Verify:** Petty Cash balance has decreased by exactly **₹4,750.00**.
   - **Verify:** Under Transactions / Cash Book, a new debit entry exists: *"Wage disbursement for Vinoth Team (Week 13 Sep 2026)"*, Amount: `₹4,750.00`.

2. **Bank Balance Deduction (`/accounts`):**
   - Execute a Team Wage payment of **₹6,000.00** from `Bank`.
   - Navigate to `/accounts`.
   - **Verify:** Bank account balance has decreased by exactly **₹6,000.00**.

3. **Labor Costs on Projects (`/projects`):**
   - Navigate to `/projects`.
   - Open details for `Site 637`.
   - **Verify:** Labor costs reflect the accumulated wages earned at `Site 637`.

4. **Audit Log Trail (`/audit`):**
   - Navigate to `/audit`.
   - **Verify:** An audit entry is logged for the attendance updates, wage adjustments, and wage payment records created by the accountant user.

---

## 8. Test Results Checklist

| ID | Test Description | Data Set Used | Expected Result | Pass / Fail | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-ATT-01** | Load Weekly Attendance View | Default (Week of 13 Sep 2026) | 7 day columns displayed with worker names and designations. | | |
| **TC-ATT-02** | Toggle to Monthly View | Current Month | Monthly aggregate columns shown; day columns hidden. | | |
| **TC-ATT-03** | Reset to Benchmark Week | Click `13.09.2026` button | View resets to week starting 13 Sep 2026. | | |
| **TC-ATT-04** | Record Full Day Attendance | In: 9, Out: 6, Site: Site 637 | Day Value = 1.0, Wage = 1.0 × Rate. Cell turns green. | | |
| **TC-ATT-05** | Record Overtime Day Attendance | In: 6, Out: 6, Site: Site 3033 | Day Value = 1.5, Wage = 1.5 × Rate. | | |
| **TC-ATT-06** | Record Half Day Attendance | In: 12, Out: 6 | Day Value = 0.5, Wage = 0.5 × Rate. | | |
| **TC-ATT-07** | Mark Day as Leave | Click "Mark Leave" | Day Value = 0, Wage = ₹0. Cell turns rose/red "Leave". | | |
| **TC-ATT-08** | Batch Fill Attendance | Mark All Present (Target: Week) | All unrecorded cells filled with 1.0; totals update. | | |
| **TC-ATT-09** | Batch Fill with Overwrite | Check "Overwrite existing" | Overwrites existing days with 1.0. | | |
| **TC-ATT-10** | Inline Edit Bus / Petrol | Input: `150` on worker row | Flashes green; Wage Balance increases by ₹150. | | |
| **TC-ATT-11** | Inline Edit Advance | Input: `500` on worker row | Flashes green; Wage Balance decreases by ₹500. | | |
| **TC-ATT-12** | Save Advance Payment Details | Method: UPI, Ref: `UPI-99182` | Method badge shows `UPI`; ref tooltip displayed. | | |
| **TC-ATT-13** | Open Worker Profile Sheet | Click worker full name | Drawer opens showing worker ledger and rates. | | |
| **TC-ATT-14** | Reassign Worker Team in Sheet | Change team dropdown | Team updated; changes reflected across teams. | | |
| **TC-ATT-15** | View Monthly Worker Drilldown | Click "View Days" in Monthly view | Modal shows day-by-day table for entire month. | | |
| **TC-ATT-16** | Pay Team Wage - Full Cash | Petty Cash, Full amount | Wage payment recorded; Petty Cash deducted. | | |
| **TC-ATT-17** | Pay Team Wage - Overpayment Error | Amount > Pending balance | Error toast prevents recording overpayment. | | |
| **TC-ATT-18** | Pay Team Wage - Missing Source | "Pay from" unselected | Error toast prompts user to select Bank or Petty Cash. | | |
| **TC-ATT-19** | Replace Absent Worker | Effective date + new helper | Old worker marked left; new helper joins team. | | |
| **TC-ATT-20** | Create New Team | Name: `Kovai Plastering Team` | Team created and appears in team filters. | | |
| **TC-ATT-21** | Print Weekly Wage Sheet | Click "Weekly Wage PDF" | Printable modal renders labor wage sheet with print view. | | |
| **TC-ATT-22** | Export Excel | Click "Export Excel" | Downloads CSV file matching current grid. | | |
| **TC-ATT-23** | Delete Attendance Permission Check | Click "Delete Entry" in day modal | Blocked by `soft_delete_record`: MD permission required. | | |
| **TC-ATT-24** | Financials Hidden for Supervisor | Login as supervisor | All wage columns and payment buttons hidden. | | |
| **TC-ATT-25** | Cross-Page Petty Cash Sync | Check `/accounts` after team pay | Petty cash balance decremented by payment amount. | | |

---

## 9. Open Questions, UNVERIFIED Items & Suspected Code Bugs

1. **UI-vs-RLS Mismatch on Attendance Deletion:**
   - **Location:** `src/routes/_authenticated/attendance.tsx` line 1868 (`deleteAttendance.mutateAsync` via `useDeleteRow("attendance", "Attendance")`).
   - **Issue:** The UI shows a red **"Delete Entry"** button to the accountant in the Day Attendance dialog. However, the underlying RPC `soft_delete_record` rejects the deletion because it enforces `is_md()`. The accountant gets a runtime error toast: *"Permission denied. Only Managing Director (MD) can delete records."*
   - **Recommendation:** Either hide the "Delete Entry" button when `!isMD`, or update the RPC / backend policy if accountants are intended to void mistakes in day attendance.

2. **Negative Wage Balance Color Indication:**
   - **Code Behavior:** In `attendance.tsx` line 1416–1419, if `r.wageBalance > 0`, the text color is `text-destructive` (red). If `r.wageBalance <= 0`, it is `text-emerald-600` (green).
   - **Tester Note:** A positive wage balance represents an outstanding liability that the company owes to the worker (hence shown in red). When the worker is fully paid (balance = 0) or has taken an excess advance (balance < 0), it displays in green.

3. **Subcontractor / Other Payments Read-Only on Attendance:**
   - Section 3D *"Other Separate Payments"* displays subcontractor vouchers (painters, electricians) for the week, but displays a note: *"Manage via Contractors → Other Payments"*.
   - There are no inline add/edit buttons for other subcontractor payments directly on `/attendance`; it functions purely as an informational rollup.
