# Manual Test Guide: Contractors (Accountant Role)

**Document ID:** `03-contractors-accountant`  
**Page Name:** Contractors (`/contractors`)  
**Target User Role:** Accountant (`accounts`)  
**Verification Target:** Work Orders, Measurement Books (MB), Contractor Bills, Pending Payments Aging, Payments (Individual & Multi-Project Group Payments), Flow Tracker, Other Subcontractor Payments, and backend dependency/RLS checks.

---

## 1. Page Overview

- **Purpose:** Full end-to-end lifecycle management of contractor contracts and payments: issuing Work Orders (WO), recording Measurement Books (MB), raising and verifying Contractor Bills, monitoring aging unpaid balances, releasing individual or bulk group payments (with mandatory Bank / Petty Cash source tagging), tracking financial flow per contract, and handling ad-hoc payments for trade subcontractors (painters, electricians, vendors).
- **Menu Path:** Click **Contractors** in the left sidebar navigation menu, or navigate directly to `http://localhost:5173/contractors` (or hosted domain equivalent).
- **Login Used:** User account assigned the `accounts` role in `user_roles`.
- **Route Guard:** Guarded by `<RequirePermission permission="canViewMaterialsAndContractors" label="Contractors">`. Because the `accounts` role has `canViewMaterialsAndContractors = true`, the page loads completely without redirection.

---

## 2. Access Matrix

| Action / Tab / Element | Accountant Allowed? | How It Shows in UI | Backend Enforced? (RLS / DB) |
| :--- | :---: | :--- | :--- |
| **View Contractors Page** | Yes | Full page renders; sidebar link "Contractors" visible. | Enforced by session authentication & `canViewMaterialsAndContractors`. |
| **Top Stat Cards (WO Value, Billed, Paid, Outstanding)** | Yes | 4 metric cards displayed above filter bar with live calculations. | Backed by `SELECT` policies on `work_orders`, `contractor_bills`, `contractor_payments`. |
| **Filters (Project, Contractor, Job Type, Reset)** | Yes | Dropdown selects visible and active in top filter bar. | Client-side reactive state filtering. |
| **Work Orders Tab (`wo`)** | Yes | Tab visible. Shows table of work orders with actions. | `work_orders` table accessible for reading. |
| **Create Work Order ("New work order")** | Yes | Button visible (`canModifyFinance = true`). Opens `FormDialog`. | `finance write` policy on `work_orders` (`can_write_finance()` allows MD & accounts). |
| **Edit Work Order** | Yes | Pencil icon button in row actions. Opens edit dialog. | `finance write` policy on `work_orders`. |
| **Delete Work Order** | Yes (Conditional) | Red trash icon button in row actions. Opens `ConfirmDeleteDialog`. | Handled by `soft_delete_record` RPC (MD or accounts). **Blocked if dependent Contractor Bills exist**. |
| **Measurement Books Tab (`mb`)** | Yes | Tab visible. Shows MB records. | `measurement_books` table readable. |
| **Record MB ("New MB")** | Yes | Button visible (`canModifySite = true` since accounts has site write rights). Opens `FormDialog`. | `site write` policy on `measurement_books` (`can_write_site()` allows MD, accounts, supervisor). |
| **Edit MB** | Yes | Pencil icon button in row actions. | `site write` policy on `measurement_books`. |
| **Delete MB** | Yes | Red trash icon button in row actions. | Handled by `soft_delete_record` RPC (MD or accounts). |
| **Contractor Bills Tab (`bills`)** | Yes | Tab visible. Shows bills, gross/net amounts, paid, balance due. | `contractor_bills` table readable. |
| **Raise Bill ("New bill")** | Yes | Button visible (`canModifyFinance = true`). Opens `FormDialog`. | `finance write` policy on `contractor_bills`. |
| **Edit Bill** | Yes | Pencil icon button in row actions. | `finance write` policy on `contractor_bills`. |
| **Delete Bill** | Yes (Conditional) | Red trash icon button in row actions. | Handled by `soft_delete_record` RPC (MD or accounts). **Blocked if dependent Payments exist**. |
| **Pending Payments Tab (`pending`)** | Yes | Tab visible with badge showing count of unpaid bills. Table sorted by age in days. | Computed client-side from `contractor_bills` and `contractor_payments`. |
| **Payments Tab (`payments`)** | Yes | Tab visible. Lists all recorded payments. | `contractor_payments` table readable. |
| **Record Payment ("New payment")** | Yes | Button visible. Opens single payment dialog with mandatory "Pay from" selector. | `finance write` policy on `contractor_payments`. |
| **Group Payment ("Group Payment")** | Yes | Purple/blue icon button next to New Payment. Opens `GroupPaymentDialog` with multi-project allocation. | Handled by `create_group_payment` RPC (`is_md() OR has_role('accounts')`). |
| **Edit Payment** | Yes | Pencil icon button in row actions. | `finance write` policy on `contractor_payments`. |
| **Delete Payment** | Yes | Red trash icon button in row actions. | Handled by `soft_delete_record` RPC. Directly removes payment and triggers MD notification. |
| **Flow Tracker Tab (`flow`)** | Yes | Tab visible. Shows table comparing WO Value → MB Measured → Billed → Paid → Outstanding per contract. | Computed read-only summary table. |
| **Other Payments Tab (`subpay`)** | Yes | Tab visible (`canModifyFinance = true`). Manages painters, electricians, vendors. | Backed by `subcontractor_payments` table (`is_md() OR has_role('accounts')`). |
| **Export Excel / CSV** | Yes | Export buttons visible on every tab's table header. | Pure client-side CSV download. |

---

## 3. Test Data Pack

All test data uses realistic Tamil Nadu construction locations, contractors, projects, and INR figures.

### A. Seed Data Required Before Starting
Ensure the following master records exist before testing:

#### 1. Projects
| Project Name | Code | Location |
| :--- | :--- | :--- |
| **Site 637** | `PRJ-637` | Coimbatore Civil Site |
| **Site 3033** | `PRJ-3033` | Pollachi Commercial Hub |

#### 2. Contractors
| Contractor Name | Trade / Specialization | Contact Person | Phone |
| :--- | :--- | :--- | :--- |
| **Sri Lakshmi Constructions** | Civil & Structural Works | R. Lakshmanan | 9842155001 |
| **Kovai Steel & Fabrication** | Steel & Truss Works | P. Kumar | 9842155002 |
| **Sakthi Electricals & Plumbing** | MEP Works | S. Sakthivel | 9842155003 |

#### 3. Job Types (Master Specification)
| Job Type Name | Description |
| :--- | :--- |
| **Civil - Brickwork & Plastering** | Standard masonry and internal/external plastering |
| **Structural Steel Erection** | Fabrication and on-site truss erection |

---

### B. Form Data Sets

#### Form 1: Issue Work Order (`wo`)
Opened by clicking **"New work order"** on the Work Orders tab.

##### 1. VALID Data Set
| Field | Valid Set 1 (Civil Masonry) | Valid Set 2 (Steel Truss) |
| :--- | :--- | :--- |
| **WO number** | `WO-2026-081` (or auto-generated) | `WO-2026-082` |
| **Project** | `Site 637` | `Site 3033` |
| **Contractor** | `Sri Lakshmi Constructions` | `Kovai Steel & Fabrication` |
| **Job Type / Specification** | `Civil - Brickwork & Plastering` | `Structural Steel Erection` |
| **WO date** | Today (`2026-09-14`) | Today (`2026-09-14`) |
| **Contract amount (₹)** | `450000` | `280000` |
| **Rate (₹)** | `450` | `70` |
| **Quantity** | `1000` | `4000` |
| **Unit** | `Sq.Ft` | `Kg` |
| **Start date** | `2026-09-15` | `2026-09-20` |
| **End date** | `2026-11-15` | `2026-10-30` |
| **Status** | `approved` | `draft` |
| **Scope of work** | `Ground floor brick masonry and 1:6 cement plastering as per structural drawings.` | `Fabrication and erection of MS roof truss and purlins.` |
| **Expected Calculation** | Amount = `₹4,50,000.00`. Total WO Value stat card increases by `₹4,50,000.00`. | Amount = `₹2,80,000.00`. Total WO Value stat card increases by `₹2,80,000.00`. |

##### 2. INVALID Data Set
| Field | Invalid Value | Expected Behaviour |
| :--- | :--- | :--- |
| **WO number** | *(Blank)* | Form validation error: *"WO number is required."* Save blocked. |
| **Project** | *(Unselected)* | Validation error: *"Project is required."* Save blocked. |
| **Contractor** | *(Unselected)* | Validation error: *"Contractor is required."* Save blocked. |
| **Contract amount** | `0` or negative `-5000` | Blocked or flags error. Contract amount must be positive. |

##### 3. BOUNDARY Data Set
| Scenario | Field | Value | Expected Behaviour |
| :--- | :--- | :--- | :--- |
| **Large Contract** | Contract amount | `95000000` (₹9.5 Crores) | Displays as `₹9,50,00,000.00` with correct Indian comma grouping. |
| **Optional Dates Blank** | Start & End date | *(Leave empty)* | Saves successfully; stored as `null`. |
| **Rate × Qty ≠ Amount** | Rate: 400, Qty: 1000, Contract: 450000 | Custom milestone amount | Allowed; contract amount takes precedence as total binding sum. |

---

#### Form 2: Record Measurement Book (`mb`)
Opened by clicking **"New MB"** on the Measurement books tab.

##### 1. VALID Data Set
| Field | Valid Set 1 (Masonry Progress) |
| :--- | :--- |
| **MB number** | `MB-2026-041` (or auto-generated) |
| **Project** | `Site 637` |
| **Contractor** | `Sri Lakshmi Constructions` |
| **Against work order** | Select `WO-2026-081` |
| **MB date** | Today (`2026-09-25`) |
| **Measured value (₹)** | `185000` |
| **Status** | `verified` |
| **Remarks** | `Completed 410 sq.ft brickwork on northern grid line.` |
| **Expected Result** | MB saved. MB Measured column in Flow Tracker updates to `₹1,85,000.00`. |

---

#### Form 3: Raise Contractor Bill (`bills`)
Opened by clicking **"New bill"** on the Bills tab.

##### 1. VALID Data Sets (Gross, Deductions & Net Calculation)
| Field | Valid Set 1 (Standard Bill with Retention) | Valid Set 2 (Clean Bill without Deductions) |
| :--- | :--- | :--- |
| **Bill number** | `CB-2026-015` | `CB-2026-016` |
| **Project** | `Site 637` | `Site 3033` |
| **Contractor** | `Sri Lakshmi Constructions` | `Kovai Steel & Fabrication` |
| **Against work order** | `WO-2026-081` | `WO-2026-082` |
| **Bill date** | Today (`2026-09-28`) | Today (`2026-09-28`) |
| **Gross amount (₹)** | `185000` | `120000` |
| **Deductions (₹)** | `9250` (5% retention & TDS) | `0` |
| **Net amount (auto-calculated)** | `185000 - 9250 = ₹1,75,750.00` | `120000 - 0 = ₹1,20,000.00` |
| **Status** | `approved` | `approved` |
| **Remarks** | `RA Bill 01 for ground floor masonry` | `Advance fabrication bill 01` |
| **Expected Calculations** | Billed (Net) card increases by `₹1,75,750.00`. Balance Due shows `₹1,75,750.00` in red. | Billed (Net) card increases by `₹1,20,000.00`. Balance Due shows `₹1,20,000.00` in red. |

##### 2. INVALID / BOUNDARY Data Sets
| Scenario | Field | Value | Expected Behaviour |
| :--- | :--- | :--- | :--- |
| **Deductions > Gross** | Gross: `50000`, Deductions: `60000` | Net = `-10000` | Negative net amount. UI displays warning or rejects negative net bill. |
| **Zero Gross Amount** | Gross amount | `0` | Blocked by validation; bill gross must be greater than zero. |
| **Missing Project / Contractor** | Project | *(Blank)* | Save blocked with validation error. |

---

#### Form 4: Record Individual Payment (`payments`)
Opened by clicking **"New payment"** on the Payments tab.

##### 1. VALID Data Sets
| Field | Valid Set 1 (Bank Payment against Bill) | Valid Set 2 (Petty Cash Part Payment) |
| :--- | :--- | :--- |
| **Project** | `Site 637` | `Site 637` |
| **Contractor** | `Sri Lakshmi Constructions` | `Sri Lakshmi Constructions` |
| **Against bill** | Select `CB-2026-015` | Select `CB-2026-015` |
| **Payment date** | Today (`2026-09-29`) | Today (`2026-09-30`) |
| **Amount (₹)** | `100000` | `75750` (Full clearance) |
| **Pay from (Source)** | `Bank Account` | `Petty Cash` |
| **Method** | `bank` (or NEFT/RTGS) | `cash` |
| **Reference number** | `NEFT-HDFC-9918204` | `PC-VOUCH-088` |
| **Remarks** | `Part payment for RA Bill 01` | `Final balance settlement for RA Bill 01` |
| **Expected Result** | Paid increases by `₹1,00,000`. Bill balance due becomes `₹75,750` in red. | Paid increases by `₹75,750`. Bill balance due becomes `₹0.00` and displays green **"Paid"** badge. |

##### 2. INVALID Data Sets
| Scenario | Field | Value | Expected Error Message |
| :--- | :--- | :--- | :--- |
| **Missing Pay From** | Pay from | *(Unselected)* | Form validation error: *"Pay from (Bank or Petty Cash) is required."* |
| **Zero Amount** | Amount | `0` | Validation error: *"Amount must be greater than 0."* |
| **Negative Amount** | Amount | `-15000` | Rejected by input validation. |

---

#### Form 5: Multi-Project Group Payment (`GroupPaymentDialog`)
Opened by clicking the purple/blue icon button next to "New payment" on the Payments tab.

##### 1. VALID Data Set
Suppose **Sri Lakshmi Constructions** has pending balances across two sites:
- `Site 637` (Bill `CB-2026-015`): Pending `₹75,750.00`
- `Site 3033` (Work Order `WO-2026-083`): Pending `₹50,000.00`

| Field | Input Value |
| :--- | :--- |
| **Contractor** | `Sri Lakshmi Constructions` |
| **Projects** | Auto-selects `Site 637` and `Site 3033` |
| **Payment Date** | Today's Date |
| **Total Payment Amount (₹)** | `125750` |
| **Pay From (Source)** | `Bank Account` |
| **Payment Method** | `Bank Transfer / NEFT` |
| **Bank Reference / UTR** | `UTR-SBIN-2026093001` |
| **Allocation Line 1 (`CB-2026-015`)** | Type or auto-fill: `75750` |
| **Allocation Line 2 (`WO-2026-083`)** | Type or auto-fill: `50000` |
| **Sum of Allocations** | `75750 + 50000 = 125750` (Matches Total Amount exactly) |
| **Expected Result** | Validation indicator turns green: *"Allocation matches total amount."* Group payment recorded. Both bills/orders updated. Bank balance deducted by `₹1,25,750.00`. |

##### 2. INVALID Allocation Sets
| Scenario | Action | Expected Behaviour |
| :--- | :--- | :--- |
| **Mismatched Allocation** | Total Amount: `125750`, Allocations sum to `100000` | Red alert: *"Sum of allocations (₹1,00,000) does not match total payment amount (₹1,25,750). Difference: ₹25,750."* Submit button disabled. |
| **Allocation Exceeds Item Due** | Type `90000` against bill with `75750` balance | Red error: *"Allocation for CB-2026-015 exceeds pending balance."* Submit blocked. |

---

#### Form 6: Other Payments / Subcontractors (`subpay`)
Opened on the **Other Payments** tab by clicking **"New other payment"**.

##### 1. VALID Data Set
| Field | Valid Set 1 (Site Painter Voucher) |
| :--- | :--- |
| **Name / Description** | `Anand Painters` |
| **Work details** | `Exterior primer and putty work for Site 637 boundary wall.` |
| **Payment date** | Today (`2026-09-30`) |
| **Week start (Monday)** | `2026-09-28` |
| **Project** | `Site 637` |
| **Amount (₹)** | `24500` |
| **Pay from (Source)** | `Petty Cash` |
| **Method** | `CASH` |
| **Reference number** | `VOUCH-PT-01` |
| **Status** | `job_done` |
| **Remarks** | `Settled at site office in presence of supervisor.` |
| **Expected Result** | Payment saved. Grand total under Other Payments increases by `₹24,500.00`. Appears live under Attendance page section *"3D. Other Separate Payments"*. |

---

## 4. Button-by-Button Guide

### Action 1: Filter Records by Project / Contractor / Job Type
- **Location:** Top shared filter bar above tabs.
- **Labels:** `Project`, `Contractor`, `Job Type`, `Reset`.
- **Steps:**
  1. Click **Project** dropdown; select `Site 637`.
  2. Notice all tables (`wo`, `mb`, `bills`, `payments`, `flow`) instantly filter to records under `Site 637`.
  3. Notice top Stat Cards update their totals to reflect only `Site 637`.
  4. Click **Reset** button.
  5. Filters clear back to `All Projects`, `All Contractors`, `All Job Types`.

---

### Action 2: Issue a Work Order
- **Location:** Tab **Work orders** → Top button **"New work order"** with `+` icon.
- **Steps:**
  1. Click **New work order**.
  2. Dialog opens: **"Issue work order"**.
  3. Fill fields using **Form 1 Valid Set 1**:
     - Project: `Site 637`
     - Contractor: `Sri Lakshmi Constructions`
     - Job Type: `Civil - Brickwork & Plastering`
     - Contract amount: `450000`
     - Rate: `450`, Quantity: `1000`, Unit: `Sq.Ft`
     - Scope of work: `Ground floor brick masonry`.
  4. Click **Save**.
- **Expected Result:**
  - Dialog closes.
  - Toast message appears: *"Work order created successfully."*
  - Row appears in Work Orders table with status badge `Draft` or `Approved`.
  - Top stat card **"Work order value"** increments by `+₹4,50,000.00`.
  - Tab **Flow** adds a new row for this work order with WO Value = `₹4,50,000.00`.

---

### Action 3: Edit a Work Order
- **Location:** Tab **Work orders** → Row action pencil icon.
- **Steps:**
  1. Locate `WO-2026-081` in the table.
  2. Click the **Pencil** icon on the right side of the row.
  3. Dialog opens: **"Edit work order"**.
  4. Change **Contract amount (₹)** to `480000` (e.g. scope increase).
  5. Click **Save**.
- **Expected Result:**
  - Table updates to display `₹4,80,000.00`.
  - Stat card updates by `+₹30,000.00`.
  - Database trigger `trg_track_row_edits` logs the edit and sends a notification to the MD.

---

### Action 4: Delete a Work Order (Dependency Check Verification)
- **Location:** Tab **Work orders** → Row action trash icon.
- **Steps:**
  1. Locate a work order that already has a Contractor Bill linked to it.
  2. Click the red **Trash** icon.
  3. Modal opens: **"Delete work order"**. Notice the blue alert box:
     *"Accountant Action: Deleting this record directly removes it from active views and balances. An automated notification will be sent to the MD."*
  4. Type reason: `Cancelled scope`.
  5. Click **Delete Record**.
- **Expected Result (Backend Protection):**
  - Toast error appears:
    *"Cannot delete Work Order: 1 Contractor Bill(s) are linked to it. Delete dependent bills first."*
  - Record is **not** deleted.
  6. Now test deleting an independent work order with NO linked bills:
     - Click Trash → Click Delete Record.
     - Toast confirms: *"Record deleted successfully."*
     - Row disappears from active table; WO Value stat card decreases accordingly.

---

### Action 5: Record Measurement Book (MB) Entry
- **Location:** Tab **Measurement books** → Button **"New MB"**.
- **Steps:**
  1. Click **New MB**.
  2. Select Project: `Site 637`.
  3. Select Contractor: `Sri Lakshmi Constructions`.
  4. Select Against work order: `WO-2026-081`.
  5. Enter Measured value: `185000`.
  6. Select Status: `verified`.
  7. Click **Save**.
- **Expected Result:**
  - Toast confirms MB recorded.
  - Row appears in Measurement Books table.
  - In the **Flow** tab, under `WO-2026-081`, **MB Measured** updates from `₹0.00` to `₹1,85,000.00`.

---

### Action 6: Raise Contractor Bill
- **Location:** Tab **Bills** → Button **"New bill"**.
- **Steps:**
  1. Click **New bill**.
  2. Select Project: `Site 637`.
  3. Select Contractor: `Sri Lakshmi Constructions`.
  4. Select Against work order: `WO-2026-081`.
  5. Enter Gross amount: `185000`.
  6. Enter Deductions: `9250` (5% retention).
  7. Status: `approved`.
  8. Click **Save**.
- **Expected Result:**
  - Dialog closes; toast confirms bill created.
  - Bill table displays:
    - Gross: `₹1,85,000.00`
    - Net: `₹1,75,750.00`
    - Paid: `₹0.00`
    - Balance due: `₹1,75,750.00` (in **bold red** font).
  - Stat card **"Billed (net)"** increments by `+₹1,75,750.00`.
  - Stat card **"Outstanding"** increments by `+₹1,75,750.00`.
  - Tab **Pending payments** badge count increments by 1.

---

### Action 7: Inspect Pending Payments & Aging Analysis
- **Location:** Tab **Pending payments** (`pending`).
- **Steps:**
  1. Click the **Pending payments** tab.
  2. Review table contents:
     - Columns: `Contractor (Party)`, `Project`, `Bill Date`, `Age`, `Net Bill`, `Paid`, `Balance Due`.
     - Observe the **Age** badge:
       - Green / Muted badge if ≤ 14 days old (e.g. `2 days`).
       - Amber badge if > 14 days old (e.g. `18 days`).
       - Red badge if > 30 days old (e.g. `45 days`).
     - Rows are strictly sorted descending by age (oldest unpaid bills at the top).
  3. Click **Export Excel** to download the aged contractor liability report.

---

### Action 8: Record Individual Payment against Bill
- **Location:** Tab **Payments** → Button **"New payment"**.
- **Steps:**
  1. Click **New payment**.
  2. Select Project: `Site 637`.
  3. Select Contractor: `Sri Lakshmi Constructions`.
  4. Select Against bill: Choose `CB-2026-015`.
  5. Enter Amount (₹): `100000`.
  6. Select **Pay from**: Choose `Bank Account` (Mandatory).
  7. Select Method: `bank`.
  8. Enter Reference number: `NEFT-9918204`.
  9. Click **Save**.
- **Expected Result:**
  - Payment record appears in Payments table with badge `🏦 Bank`.
  - Top Stat Card **"Paid"** increments by `+₹1,00,000.00`.
  - Top Stat Card **"Outstanding"** decrements by `-₹1,00,000.00`.
  - Switch to **Bills** tab: For `CB-2026-015`, Paid is now `₹1,00,000.00`, and Balance due is `₹75,750.00` (in red).
  - Switch to **Flow** tab: Paid shows `₹1,00,000.00`, Outstanding shows `₹75,750.00`.

---

### Action 9: Record Full Settlement & Green "Paid" Badge
- **Location:** Tab **Payments** → Button **"New payment"**.
- **Steps:**
  1. Click **New payment**.
  2. Fill same project, contractor, and bill `CB-2026-015`.
  3. Enter remaining Amount: `75750`.
  4. Pay from: `Petty Cash`.
  5. Method: `cash`.
  6. Click **Save**.
- **Expected Result:**
  - Switch to **Bills** tab:
    - Paid = `₹1,75,750.00`.
    - Balance due replaces the red number with a green pill badge: **"Paid"** (`bg-emerald-100 text-emerald-800`).
  - Switch to **Pending payments** tab: `CB-2026-015` disappears from the pending list; pending count badge decrements by 1.

---

### Action 10: Multi-Project Group Payment
- **Location:** Tab **Payments** → Button with layers icon **"Group Payment"** (next to New Payment).
- **Preconditions:** A contractor has multiple open bills or work orders across one or more projects.
- **Steps:**
  1. Click **Group Payment**.
  2. Modal opens: **"Record Group Payment"**.
  3. Select Contractor: `Sri Lakshmi Constructions`.
  4. Relevant projects and open payable items load automatically.
  5. Enter **Total Payment Amount (₹)**: `125750`.
  6. Pay from: Select `Bank Account`.
  7. In the allocations list:
     - Line 1: Click "Pay Full" or type `75750`.
     - Line 2: Type `50000`.
  8. Verify allocation indicator displays green: *"Allocation matches total amount."*
  9. Click **Confirm Group Payment**.
- **Expected Result:**
  - Dialog closes; toast confirms group payment recorded.
  - Two distinct payment records are generated and linked to their respective projects/bills in the database.
  - Bank balance reduces by `₹1,25,750.00`.

---

### Action 11: Add Other Payment (Subcontractors / Vendors)
- **Location:** Tab **Other Payments** (`subpay`) → Button **"New other payment"**.
- **Steps:**
  1. Click **New other payment**.
  2. Dialog opens: **"Add other payment"**.
  3. Name / Description: `Anand Painters`.
  4. Work details: `Boundary wall priming`.
  5. Payment date: Today.
  6. Week start (Monday): Current week's Monday.
  7. Project: `Site 637`.
  8. Amount (₹): `24500`.
  9. Pay from: `Petty Cash`.
  10. Method: `CASH`.
  11. Reference number: `VOUCH-PT-01`.
  12. Status: `job_done`.
  13. Click **Save**.
- **Expected Result:**
  - Record added to Other Payments table.
  - Bottom grand total bar updates to include `₹24,500.00`.
  - Navigating to `/attendance` reveals this voucher immediately visible in the right-hand panel *"3D. Other Separate Payments"*.

---

### Action 12: Export Reports to CSV
- **Location:** On each tab (`wo`, `mb`, `bills`, `pending`, `payments`, `subpay`).
- **Steps:**
  1. Click **Export Excel** button on any table.
  2. Browser downloads file named e.g. `brickweld-contractor-bills.csv` or `brickweld-contractor-pending-payments.csv`.
  3. Open CSV file; verify column headers and formatted figures match the UI.

---

## 5. Edge-Case and Negative Tests

| ID | Field / Scenario | Exact Input / Action | Expected Result |
| :--- | :--- | :--- | :--- |
| **EDG-CON-01** | Zero work order contract value | Contract amount: `0` | Form validation rejects or warns: Contract amount must be positive. |
| **EDG-CON-02** | Work order start date after end date | Start: `2026-11-01`, End: `2026-10-01` | Date sequence inconsistency flagged. |
| **EDG-CON-03** | Bill gross amount smaller than deductions | Gross: `10000`, Deductions: `15000` | Net amount calculates as `-₹5,000`. UI alerts user to negative net payable. |
| **EDG-CON-04** | Record payment with zero amount | Amount: `0` | Form validation blocks submit: *"Amount must be greater than 0."* |
| **EDG-CON-05** | Record payment without payment source | Amount: `50000`, Pay from: *(Empty)* | Submit blocked: *"Pay from (Bank or Petty Cash) is required."* |
| **EDG-CON-06** | Payment exceeding bill balance | Bill Net: `50000`, Existing Paid: `40000`. Type Amount: `20000` | System allows payment but Balance Due calculates negative (`-₹10,000`), indicating overpayment. |
| **EDG-CON-07** | Delete Work Order with dependent Bills | Delete WO that has active bills | **Blocked by Backend:** Error *"Cannot delete Work Order: X Contractor Bill(s) are linked to it. Delete dependent bills first."* |
| **EDG-CON-08** | Delete Contractor Bill with dependent Payments | Delete Bill that has recorded payments | **Blocked by Backend:** Error *"Cannot delete Contractor Bill: X Payment(s) are linked to it. Delete payments first."* |
| **EDG-CON-09** | Group payment allocation mismatch | Total: `100000`, Allocations sum: `90000` | Submit button disabled; red warning explains difference of `₹10,000`. |
| **EDG-CON-10** | Non-MD edit tracking trigger | Edit any WO, MB, Bill, or Payment as Accountant | Record saves successfully; `trg_track_row_edits` trigger writes audit entry and notifies MD. |

---

## 6. Permission Tests

Execute these tests to confirm role boundaries for the `accounts` role.

### Test PERM-CON-01: Accountant Write Capabilities
1. Log in as **Accountant** (`accounts` role).
2. Navigate to `/contractors`.
3. **Verify:**
   - Buttons **"New work order"**, **"New MB"**, **"New bill"**, **"New payment"**, **"Group Payment"**, and **"New other payment"** are all visible.
   - Creating, editing, and saving on all these entities succeeds without permission errors.

### Test PERM-CON-02: Accountant Direct Deletion with MD Notification
1. As Accountant, select a standalone payment (no dependencies).
2. Click the red trash icon.
3. Review modal text:
   *"Accountant Action: Deleting this record directly removes it from active views and balances. An automated notification will be sent to the MD."*
4. Click **Delete Record**.
5. **Verify:**
   - Operation succeeds (`soft_delete_record` authorizes `accounts` role).
   - Notification is queued for MD; audit log records action.

### Test PERM-CON-03: Supervisor View Boundary
1. Log out and log in as a **Supervisor** (`supervisor` role).
2. Navigate to `/contractors`.
3. **Verify:**
   - Buttons **"New work order"**, **"New bill"**, **"New payment"**, and Tab **"Other Payments"** are **hidden** (`canModifyFinance = false`).
   - Supervisor can only record **Measurement Books** ("New MB" button visible).
   - Action columns for editing and deleting work orders, bills, and payments are **hidden**.

---

## 7. Cross-Page Checks

Verify that financial entries made on `/contractors` update the corresponding modules:

1. **Bank Balance Deduction (`/accounts`):**
   - Record a Contractor Payment of **₹1,00,000.00** from `Bank Account`.
   - Navigate to `/accounts`.
   - **Verify:** Bank account running balance is deducted by exactly **₹1,00,000.00**.
   - **Verify:** Transactions / Cash Book table shows debit entry: *"Payment to Sri Lakshmi Constructions against bill CB-2026-015"*.

2. **Petty Cash Balance Deduction (`/accounts`):**
   - Record an Other Payment of **₹24,500.00** from `Petty Cash`.
   - Navigate to `/accounts`.
   - **Verify:** Petty Cash balance decreases by **₹24,500.00**.

3. **Live Subcontractor Feed on Attendance (`/attendance`):**
   - Add a voucher under **Other Payments** for week starting `2026-09-28`.
   - Navigate to `/attendance` and select week of `28 Sep 2026`.
   - **Verify:** Section *"3D. Other Separate Payments"* lists `Anand Painters`, amount `₹24,500.00`, status `Job done`.

4. **Project Financials Rollup (`/projects/$projectId`):**
   - Navigate to `/projects`.
   - Select `Site 637`.
   - **Verify:** Contractor cost totals and committed work order liabilities match the sum of bills and work orders issued for `Site 637`.

---

## 8. Test Results Checklist

| ID | Test Description | Data Set Used | Expected Result | Pass / Fail | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-CON-01** | Load Contractors Page & Tabs | Default view | 4 stat cards, 6 tabs render with full data. | | |
| **TC-CON-02** | Filter by Project | `Site 637` | Tables and stat cards filter to Site 637 only. | | |
| **TC-CON-03** | Reset Filters | Click Reset | Filters restore to "All". | | |
| **TC-CON-04** | Issue New Work Order | WO-2026-081, ₹4,50,000 | WO created; WO Value card increases by ₹4,50,000. | | |
| **TC-CON-05** | Edit Work Order Amount | Increase amount to ₹4,80,000 | Value updates; edit logged for MD. | | |
| **TC-CON-06** | Delete WO with Dependent Bills | WO linked to CB-2026-015 | Backend blocks deletion: error lists dependent bills. | | |
| **TC-CON-07** | Delete Independent WO | WO with no bills | Deletion succeeds; WO Value card decrements. | | |
| **TC-CON-08** | Record Measurement Book (MB) | MB-2026-041, ₹1,85,000 | MB created; Flow tracker MB Measured shows ₹1,85,000. | | |
| **TC-CON-09** | Raise Contractor Bill | Gross 185000, Deductions 9250 | Net = ₹1,75,750; Billed and Outstanding cards update. | | |
| **TC-CON-10** | Verify Pending Payments Aging | CB-2026-015 | Row shows in Pending tab with age badge and balance. | | |
| **TC-CON-11** | Record Bank Part Payment | ₹1,00,000 against bill | Paid card increases; Bill balance reduces to ₹75,750 (red). | | |
| **TC-CON-12** | Record Full Settlement Payment | Remaining ₹75,750 | Bill balance shows green "Paid" badge; removed from pending. | | |
| **TC-CON-13** | Payment Missing Source Validation | Submit with empty "Pay from" | Form validation error: Pay from is mandatory. | | |
| **TC-CON-14** | Delete Bill with Linked Payments | Bill has active payment | Backend blocks deletion: error lists dependent payments. | | |
| **TC-CON-15** | Multi-Project Group Payment | ₹1,25,750 across 2 sites | Group payment allocated; balances updated across projects. | | |
| **TC-CON-16** | Group Payment Allocation Mismatch | Allocations ≠ Total | Submit blocked; red error indicates difference. | | |
| **TC-CON-17** | Add Subcontractor Payment | Anand Painters, ₹24,500 | Record saved; grand total updates. | | |
| **TC-CON-18** | Verify Subcontractor on Attendance | Check `/attendance` section 3D | Voucher appears in real-time under weekly other payments. | | |
| **TC-CON-19** | Flow Tracker Reconciliation | Compare WO vs MB vs Bill vs Paid | Columns match actual totals; outstanding math correct. | | |
| **TC-CON-20** | Export CSV Reports | Click Export Excel on all tabs | Valid CSV files download with formatted data. | | |
| **TC-CON-21** | Bank Balance Sync | Check `/accounts` after bank pay | Running bank balance decremented by payment amount. | | |
| **TC-CON-22** | Petty Cash Balance Sync | Check `/accounts` after cash pay | Petty cash balance decremented by payment amount. | | |

---

## 9. Open Questions, UNVERIFIED Items & Observations

1. **Delete Permissions for Accountant Role:**
   - **Verification:** In `supabase/migrations/20261114000000_core_updates_and_powers.sql`, the `soft_delete_record` function was explicitly updated to authorize both MD and Accountant:
     ```sql
     SELECT (public.is_md() OR public.has_role(v_user_id, 'accounts')) INTO v_is_authorized;
     ```
   - In `src/components/ConfirmDeleteDialog.tsx`, `canDirectDelete` is defined as `isMD || roles.includes("accounts")`.
   - **Conclusion:** On the Contractors page, the Accountant **CAN directly delete records** (unlike earlier baseline versions where it was MD-only). However, strict backend dependency checks block deletion if child records exist (e.g. Work Orders with bills, Bills with payments). This is intentional and properly protected.

2. **Negative Balance on Overpayment:**
   - In `contractor_bills` table, if total payments recorded against a bill exceed the net bill amount, `balanceDue` becomes negative (e.g., `-₹5,000.00`).
   - The UI does not crash or block this; it renders the negative balance in destructive red font. If this represents an advance against future work, testers should note whether a configurable credit balance workflow is expected.
