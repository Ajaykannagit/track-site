# Manual Test Guide: Accounts & Cash (Accountant Role)

**Document ID:** `05-accounts-accountant`  
**Page Name:** Accounts & Cash (`/accounts`)  
**Target User Role:** Accountant (`accounts`)  
**Verification Target:** Running Account Balances (Bank vs. Petty Cash), Account Summary / Trial Balance, Unified Financial Ledger, Site & Office Expenses (Single & Multi-Expense), Client Inward Receipts & Printable Vouchers, Daily Cash Closing, Contra Fund Transfers, MD Capital Investments & Drawings, Opening Balances configuration, Void system, and backend RLS auditing.

---

## 1. Page Overview

- **Purpose:** Central treasury and financial control hub for Brickweld: tracking live running balances for Bank Accounts and Site Petty Cash, maintaining initial opening balances, recording site and head office expenses (with multi-line entry), issuing and printing formal Client Payment Receipts, logging daily cash closings, managing contra transfers between Bank and Petty Cash, tracking Owner/MD Capital infusions and drawings, and viewing a real-time consolidated financial ledger without double-counting.
- **Menu Path:** Click **Accounts** in the left sidebar navigation menu, or navigate directly to `http://localhost:5173/accounts` (or hosted domain equivalent).
- **Login Used:** User account assigned the `accounts` role in `user_roles`.
- **Route Guard:** Guarded by `<RequirePermission permission="canViewMaterialContractorCosts" label="Accounts & Cash">`. Because the `accounts` role has `canViewMaterialContractorCosts = true`, the page loads completely without redirection.

---

## 2. Access Matrix

| Action / Tab / Element | Accountant Allowed? | How It Shows in UI | Backend Enforced? (RLS / DB) |
| :--- | :---: | :--- | :--- |
| **View Accounts & Cash Page** | Yes | Full page loads; sidebar link "Accounts" visible. | Session authenticated & `canViewMaterialContractorCosts`. |
| **Date Range Filter (From / To)** | Yes | Date inputs at top left, defaults to month start to today. | Reactive TanStack Query filter parameters. |
| **Top Stat Cards (Total Expenses, Money Received, Petty Cash Balance, Bank Balance)** | Yes | 4 live metric cards displayed at top with inflow/outflow breakdown. | Backed by `get_account_balances()` database RPC. |
| **Account Summary Tab (`summary`)** | Yes | Tab visible. Displays categorized Trial Balance (Equity, Income, Expense, Bank/Cash). | Computed from transactions mapped to standardized heads. |
| **Unified Ledger Tab (`ledger`)** | Yes | Tab visible. Displays all cash/bank movements with party, source, inflow/outflow. | Aggregates all non-voided receipts, payments, and expenses. |
| **Expenses Tab (`expenses`)** | Yes | Tab visible. Shows table of site/office expenses with category and payment source. | `expenses` table readable. |
| **Add Expenses ("+ Add More Expenses (Bulk)")** | Yes | Green button visible (`canModify = true`). Opens `MultiExpenseDialog`. | `finance write` policy on `expenses` (`can_write_finance()` allows MD & accounts). |
| **Add Single Expense** | Yes | Outline button visible. Opens `FormDialog`. | `finance write` policy on `expenses`. |
| **Edit Expense** | Yes | Pencil icon button on row. Enforces mandatory "Reason for edit" and verification status. | Field diff logged to `audit_logs` via `logRecordFieldDiffs`. |
| **Void Expense** | Yes | Amber `Ban` icon. Opens `ConfirmVoidDialog`. | `void_record` RPC (`is_md() OR has_role('accounts')`). |
| **Delete Expense** | Yes | Red trash icon button. Opens `ConfirmDeleteDialog`. | `soft_delete_record` RPC. Directly deletes record and notifies MD. |
| **Client Receipts Tab (`client_receipts`)** | Yes | Tab visible. Lists client remittances with receipt numbers and categories. | `client_payments` table readable. |
| **Add Client Receipt ("+ Add Client Receipt")** | Yes | Button visible. Opens form dialog with auto-generated receipt number (`RCP-XXXXXX`). | Insert policy on `client_payments`. |
| **Print Client Receipt** | Yes | Blue printer icon button (`Printer`). Opens `PrintableClientReceipt` modal with print layout. | Client-side formatted printable document. |
| **Edit / Void Client Receipt** | Yes | Pencil and Ban icon buttons. Edits log audit diffs; voids exclude from receipts. | Handled via `saveClientPayment` and `void_record` RPC. |
| **Cash Closing Tab (`cash`)** | Yes | Tab visible. Lists daily muster reconciliation entries. | `cash_closing` table readable. |
| **Close Cash ("Close cash")** | Yes | Button visible. Opens dialog calculating closing = opening + received - spent + other. | Insert policy on `cash_closing`. |
| **Edit / Delete Cash Closing** | Yes | Pencil and trash buttons in row actions. | `finance write` policy & `soft_delete_record` RPC. |
| **Transfers (Contra) Tab (`transfers`)** | Yes | Tab visible. Tracks contra movements (Bank → Petty Cash or vice-versa). | `account_transfers` table readable. |
| **Record Transfer ("New Transfer")** | Yes | Button visible. Enforces source, destination, and amount. | Insert policy on `account_transfers`. |
| **MD Investments & Drawings Tab (`md_investments`)** | Yes | Tab visible (`isMD || canWriteFinance` allows accounts). Lists owner capital movements. | `md_investments` table readable. |
| **Record MD Investment ("+ MD Investment")** | Yes | Button visible. Opens `MdInvestmentDialog` for capital infusion or owner drawing. | Insert policy on `md_investments`. |
| **Opening Balances Tab (`opening_balances`)** | Yes | Tab visible (`canEdit = true`). Shows starting Bank & Petty Cash figures with edit buttons. | `aob_write` policy on `account_opening_balances` (MD or accounts). |
| **Restore Voided Records** | **MD Only** | Restore button appears when "Show Voided" is toggled ON. | `unvoid_record` RPC strictly enforces `is_md()`. Blocked for accountant. |
| **Export Excel / CSV** | Yes | Export buttons visible on every tab table. | Pure client-side CSV generator. |

---

## 3. Test Data Pack

All test data uses realistic Tamil Nadu construction transactions, vendors, and INR amounts.

### A. Seed Data Required Before Starting
Ensure the following base records exist:

#### 1. Projects
| Project Name | Code | Location |
| :--- | :--- | :--- |
| **Site 637** | `PRJ-637` | Coimbatore Civil Site |
| **Site 3033** | `PRJ-3033` | Pollachi Commercial Hub |

#### 2. Master Opening Balances (`account_opening_balances`)
| Account Type | Opening Balance (₹) | As of Date | Description |
| :--- | :--- | :--- | :--- |
| **Bank Account** | `₹5,00,000.00` | `2026-09-01` | HDFC Current Account starting balance |
| **Petty Cash** | `₹50,000.00` | `2026-09-01` | Site office cash in chest |

---

### B. Form Data Sets

#### Form 1: Add Single / Bulk Expense (`expenses`)
Opened by clicking **"Single Expense"** or **"+ Add More Expenses (Bulk)"** on the Expenses tab.

##### 1. VALID Data Sets
| Field | Valid Set 1 (Site Consumables - Cash) | Valid Set 2 (Machinery Fuel - Bank) |
| :--- | :--- | :--- |
| **Expense Date** | Today (`2026-09-22`) | Today (`2026-09-22`) |
| **Project** | `Site 637` | `Site 3033` |
| **Category** | `Site Consumables` | `Fuel` |
| **Material Name (optional)** | `Binding Wire & Nails` | `Diesel for JCB Excavator` |
| **Payment Method** | `cash` | `upi` |
| **Pay from (Source) \*** | `Petty Cash` | `Bank Account` |
| **Amount (₹)** | `3500` | `12000` |
| **Description** | `Urgent purchase from local hardware store.` | `200 Litres diesel delivered to site.` |
| **Expected Result** | Total expenses increases by `₹3,500`. Petty Cash balance decreases by `₹3,500.00`. | Total expenses increases by `₹12,000`. Bank balance decreases by `₹12,000.00`. |

##### 2. INVALID / BOUNDARY Data Sets
| Scenario | Field | Value | Expected Behaviour |
| :--- | :--- | :--- | :--- |
| **Missing Pay From** | Pay from | *(Unselected)* | Form validation error: *"Pay from (Bank or Petty Cash) is required."* |
| **Zero Amount** | Amount | `0` | Blocked by validation; expense must be greater than zero. |
| **Negative Amount** | Amount | `-1500` | Rejected by validation. |
| **Mandatory Edit Reason** | Edit Expense form | Leave "Reason for edit" empty | Submit blocked: *"Please provide a mandatory reason for this edit."* |

---

#### Form 2: Add Client Receipt (`client_payments`)
Opened by clicking **"+ Add Client Receipt"** on the Client Receipts tab.

##### 1. VALID Data Sets
| Field | Valid Set 1 (Milestone Progress via Bank) | Valid Set 2 (Site Advance via Cash) |
| :--- | :--- | :--- |
| **Receipt Number** | Auto (`RCP-2026-081`) | Auto (`RCP-2026-082`) |
| **Project \*** | `Site 637` | `Site 3033` |
| **Receipt Date \*** | Today (`2026-09-23`) | Today (`2026-09-23`) |
| **Payment Mode \*** | `Bank Transfer (NEFT/RTGS/IMPS)` | `Cash` |
| **Reference / UTR No.** | `UTR-HDFC-9918206` | `CASH-REC-01` |
| **Amount Received (₹) \*** | `250000` (₹2.5 Lakhs) | `25000` |
| **Payment Category \*** | `Progress Payment` | `Advance` |
| **Credited To \*** | `Bank Account` | `Petty Cash` |
| **Invoice / Bill Reference** | `INV-2026-011` | `MOU-ADV-01` |
| **Remarks** | `2nd slab casting milestone payment received.` | `Token advance from client at site office.` |
| **Expected Result** | Bank Running Balance increments by `+₹2,50,000.00`. Appears in Unified Ledger as Inflow. | Petty Cash Running Balance increments by `+₹25,000.00`. Inflow recorded. |

##### 2. BOUNDARY / SPECIAL Data Sets
| Scenario | Field | Value | Expected Behaviour |
| :--- | :--- | :--- | :--- |
| **Reversal / Correction** | Payment Category | `Reversal / Correction`, Amount: `50000` | Displays as negative amount (`-₹50,000.00`) in **destructive red** font. Corrects bank balance downwards. |
| **Large Client Remittance** | Amount | `5000000` (₹50 Lakhs) | Formats cleanly as `₹50,00,000.00` in Indian numbering system. |

---

#### Form 3: Daily Cash Closing (`cash_closing`)
Opened by clicking **"Close cash"** on the Cash closing tab.

##### 1. VALID Data Set (End-of-Day Site Petty Cash Reconciliation)
| Field | Input Value | Calculation Logic |
| :--- | :--- | :--- |
| **Date \*** | Today (`2026-09-23`) | — |
| **Account \*** | `Petty Cash` | — |
| **Project** | `Site 637` | — |
| **Opening balance (₹)** | `50000` | Starting cash in box |
| **Cash / money received (₹)** | `25000` (Client token received) | `+ 25000` |
| **Expenses paid (₹)** | `3500` (Hardware purchase) | `- 3500` |
| **Other transactions (₹)** | `0` | `+ 0` |
| **Calculated Closing Cash** | `50000 + 25000 - 3500 = ₹71,500.00` | System auto-computes: `Opening + Rec - Spent + Other`. |
| **Remarks** | `Physical cash in hand counted and matches ₹71,500.` | Verified by site accountant. |

---

#### Form 4: Contra Fund Transfer (`account_transfers`)
Opened by clicking **"New Transfer"** on the Transfers (Contra) tab.

##### 1. VALID Data Set (Bank ATM Withdrawal to Replenish Petty Cash)
| Field | Input Value |
| :--- | :--- |
| **Date \*** | Today (`2026-09-24`) |
| **Project** | `Site 637` |
| **From Account \*** | `Bank Account` |
| **To Account \*** | `Petty Cash` |
| **Transfer Amount (₹) \*** | `30000` |
| **Reference / Cheque #** | `CHQ-448105` |
| **Remarks** | `Cash withdrawal for site wage disbursement & imprest.` |
| **Expected Calculations** | - **Bank Balance:** Decreases by `₹30,000.00`.<br>- **Petty Cash Balance:** Increases by `₹30,000.00`.<br>- **Total Net Company Cash:** Remains perfectly unchanged (Zero double-counting). |

---

#### Form 5: MD Capital Investment & Drawing (`MdInvestmentDialog`)
Opened by clicking **"+ MD Investment"** on the MD Investments tab.

##### 1. VALID Data Sets
| Field | Valid Set 1 (Capital Infusion) | Valid Set 2 (Owner Drawing) |
| :--- | :--- | :--- |
| **Transaction Type** | `Capital Infusion (Investment)` | `Owner Drawing / Personal Withdrawal` |
| **Investment / Withdrawal Date** | Today (`2026-09-25`) | Today (`2026-09-25`) |
| **Received In / Paid From \*** | `Bank Account` | `Bank Account` |
| **Amount (₹) \*** | `1000000` (₹10 Lakhs) | `100000` (₹1 Lakh) |
| **Reference Number** | `RTGS-MD-PERSONAL-01` | `CHQ-MD-DRAW-01` |
| **Remarks** | `MD personal funds infused for working capital.` | `Quarterly director drawing.` |
| **Expected Calculations** | Bank Running Balance increases by `+₹10,00,000.00`. Inflow logged under Equity. | Bank Running Balance decreases by `-₹1,00,000.00`. Outflow logged under Drawings. |

---

## 4. Button-by-Button Guide

### Action 1: Adjust Date Range Filter
- **Location:** Top left controls (`From` and `To` date pickers).
- **Steps:**
  1. Set **From**: `2026-09-01`.
  2. Set **To**: `2026-09-30`.
  3. Notice all transaction lists, Unified Ledger, and stat cards instantly update to include transactions strictly falling within September 2026.

---

### Action 2: Inspect Account Summary / Trial Balance
- **Location:** Tab **Account Summary** (`summary`).
- **Steps:**
  1. Click **Account Summary** tab.
  2. Review the structured summary grid:
     - **Equity:** Shows MD Investments (`+₹10,00,000`) and Drawings (`-₹1,00,000`).
     - **Income:** Displays Client Sales Remittances.
     - **Expenses:** Categorized into standardized heads (*Raw Materials, Subcontractor, Salaries and Employee Wages, Site Consumables, Fuel/Mileage*).
     - **Closing Balances:** Displays Bank and Petty Cash net positions.
  3. Verify mathematical identity: `Opening Balances + Inflows - Outflows = Current Cash/Bank Balances`.

---

### Action 3: Add Multi-Item Expenses (Bulk Entry)
- **Location:** Tab **Expenses** → Green button **"+ Add More Expenses (Bulk)"**.
- **Steps:**
  1. Click **+ Add More Expenses (Bulk)**.
  2. Modal opens: **"Add Multiple Expenses"**.
  3. Row 1:
     - Project: `Site 637`, Category: `Fuel`, Amount: `4500`, Pay from: `Petty Cash`, Method: `cash`, Description: `Generator diesel`.
  4. Click button **"+ Add Row"**.
  5. Row 2:
     - Project: `Site 637`, Category: `Food`, Amount: `1200`, Pay from: `Petty Cash`, Method: `cash`, Description: `Night shift team tea & snacks`.
  6. Click **Save 2 Expenses**.
- **Expected Result:**
  - Dialog closes; toast confirms: *"2 expenses recorded successfully."*
  - Both rows appear in Expenses table.
  - Total Expenses card increases by `₹5,700.00`.
  - Petty Cash Running Balance decrements by `₹5,700.00`.

---

### Action 4: Edit Expense with Audit Reason Tracking
- **Location:** Tab **Expenses** → Pencil icon on expense row.
- **Steps:**
  1. Click **Pencil** on generator diesel expense.
  2. Change amount from `4500` to `4800`.
  3. In the mandatory field **Reason for edit \***, enter: `Bill voucher revised after physical receipt verification`.
  4. Select **Verification status**: `verified`.
  5. Click **Save**.
- **Expected Result:**
  - Expense updates to `₹4,800.00`.
  - Click the **History** clock icon on that row:
  - Change history modal displays exact diff: `amount: 4500 -> 4800`, reason: *"Bill voucher revised..."*, status: `verified`.

---

### Action 5: Record Client Receipt & Generate Printable Voucher
- **Location:** Tab **Client Receipts** → Button **"+ Add Client Receipt"**.
- **Steps:**
  1. Click **+ Add Client Receipt**.
  2. Fill form using **Form 2 Valid Set 1**:
     - Project: `Site 637`
     - Receipt Date: Today
     - Payment Mode: `Bank Transfer`
     - Reference / UTR: `UTR-HDFC-9918206`
     - Amount: `250000`
     - Category: `Progress Payment`
     - Credited To: `Bank Account`.
  3. Click **Save**.
- **Expected Result:**
  - Toast confirms receipt created.
  - Receipt appears in table with green font `+₹2,50,000.00`.
  - Bank Account Running Balance increments by `₹2,50,000.00`.
  4. Click the blue **Printer icon** on that receipt row:
  5. **PrintableClientReceipt** modal opens displaying formal Brickweld remittance voucher with company header, receipt number, project, date, amount in numbers and words, and authorized signature space.
  6. Click **Print** → browser print preview opens cleanly.

---

### Action 6: Record Daily Cash Closing
- **Location:** Tab **Cash closing** → Button **"Close cash"**.
- **Steps:**
  1. Click **Close cash**.
  2. Fill form using **Form 3 Valid Set 1**:
     - Date: Today
     - Account: `Petty Cash`
     - Project: `Site 637`
     - Opening balance: `50000`
     - Cash received: `25000`
     - Expenses paid: `3500`.
  3. Notice Closing cash computes to `₹71,500.00`.
  4. Click **Save**.
- **Expected Result:**
  - Row saved in `cash_closing` table.
  - Serves as the official daily audit closing record for site cash reconciliation.

---

### Action 7: Execute Contra Fund Transfer (Bank → Petty Cash)
- **Location:** Tab **Transfers (Contra)** → Button **"New Transfer"**.
- **Steps:**
  1. Click **New Transfer**.
  2. Select From Account: `Bank Account`.
  3. Select To Account: `Petty Cash`.
  4. Project: `Site 637`.
  5. Amount: `30000`.
  6. Reference / Cheque #: `CHQ-448105`.
  7. Remarks: `Cash withdrawal for site imprest`.
  8. Click **Save**.
- **Expected Result:**
  - Row added to Transfers table.
  - Review top Stat Cards:
    - **Bank Account Running Balance:** Decreases by `₹30,000.00`.
    - **Petty Cash Running Balance:** Increases by `₹30,000.00`.
  - Notice the transfer has zero net impact on total company funds; it accurately moves money between heads.

---

### Action 8: Record MD Capital Investment
- **Location:** Tab **MD Investments & Drawings** → Button **"+ MD Investment"**.
- **Steps:**
  1. Click **+ MD Investment**.
  2. Modal opens: **"Owner Capital: Investment or Drawing"**.
  3. Choose **Transaction Type**: `Capital Infusion (Investment)`.
  4. Received in: Select `Bank Account`.
  5. Amount (₹): `1000000`.
  6. Reference: `RTGS-MD-PERSONAL-01`.
  7. Remarks: `Personal equity introduced for site materials`.
  8. Click **Record Capital Movement (₹10,00,000.00)**.
- **Expected Result:**
  - Dialog closes; toast confirms capital infusion.
  - Row appears in MD Investments table with green amount `+₹10,00,000.00`.
  - Bank Running Balance stat card increments by `+₹10,00,000.00`.
  - Appears in Unified Ledger and Account Summary under `Equity: Investments`.

---

### Action 9: Void System & MD-Only Unvoid Protection
- **Location:** Amber **Ban icon** on Expense or Receipt rows.
- **Steps:**
  1. On the Expenses tab, locate an erroneous expense.
  2. Click the amber **Ban icon**.
  3. Dialog opens: **"Void Expense"**.
  4. Type mandatory reason: `Accidental duplicate entry by site intern`.
  5. Click **Mark as Void**.
  6. Toast confirms: *"Expense marked as VOID."*
  7. Record vanishes from active table and its amount is subtracted from Total Expenses.
  8. Click **Show Voided** toggle:
     - The voided expense appears with amber `VOID` badge.
  9. Click the restore button (as Accountant):
     - Click **Restore Record**.
     - **Backend Blocked:** Toast error appears: *"Only the MD can unvoid records."*

---

### Action 10: Configure Account Opening Balances
- **Location:** Tab **Opening Balances** (`opening_balances`).
- **Steps:**
  1. Click **Opening Balances** tab.
  2. Notice the two master cards: `Bank Account` and `Petty Cash`.
  3. Click **Edit** on the Petty Cash card.
  4. Update opening balance from `50000` to `60000`.
  5. Click **Save**.
- **Expected Result:**
  - Card updates to `₹60,000.00`.
  - Notice the top **Petty Cash Running Balance** stat card immediately increases by `+₹10,000.00` because the live balance formula uses `Opening + Inflows - Outflows`.

---

## 5. Edge-Case and Negative Tests

| ID | Field / Scenario | Exact Input / Action | Expected Result |
| :--- | :--- | :--- | :--- |
| **EDG-ACC-01** | Zero expense amount | Amount: `0` | Form validation rejects: Amount must be greater than zero. |
| **EDG-ACC-02** | Contra transfer between same accounts | From: `Bank Account`, To: `Bank Account` | Blocked or flags error: Source and destination accounts cannot be identical. |
| **EDG-ACC-03** | Missing payment source on expense | Category: `Fuel`, Pay from: *(Empty)* | Submit blocked: *"Pay from (Bank or Petty Cash) is required."* |
| **EDG-ACC-04** | Client receipt reversal category | Category: `Reversal / Correction`, Amount: `25000` | Displays as `-₹25,000.00` (red); reduces total money received and bank balance. |
| **EDG-ACC-05** | Voiding record without reason | Leave mandatory reason empty | Submit blocked: *"Please enter a mandatory reason."* |
| **EDG-ACC-06** | Accountant attempt to unvoid | Click restore on voided receipt as accounts | Blocked: Toast error *"Only the MD can unvoid records."* |
| **EDG-ACC-07** | Deleting expense as Accountant | Click trash icon on expense | Succeeded: `soft_delete_record` deletes row and sends MD notification. |
| **EDG-ACC-08** | Cash closing mathematical consistency | Opening: `10000`, In: `5000`, Out: `3000` | Closing cash accurately computes to `₹12,000.00`. |
| **EDG-ACC-09** | Owner drawing exceeding balance | Drawing amount > bank balance | System permits entry, but running balance goes negative and displays in destructive red. |
| **EDG-ACC-10** | Date range filter inverted | From: `2026-10-30`, To: `2026-10-01` | Tables display empty state without crashing. |

---

## 6. Permission Tests

Execute these tests to confirm role boundaries for the `accounts` role.

### Test PERM-ACC-01: Accountant Full Treasury Write Access
1. Log in as **Accountant** (`accounts` role).
2. Navigate to `/accounts`.
3. **Verify:**
   - Tabs **Unified Ledger**, **Expenses**, **Client Receipts**, **Cash closing**, **Transfers (Contra)**, **MD Investments**, and **Opening Balances** are all visible and functional.
   - Accountant can create, edit, and void entries across all these tabs.

### Test PERM-ACC-02: Accountant Soft Deletion with MD Notification
1. As Accountant, select an expense or transfer.
2. Click the red trash icon.
3. Review modal message:
   *"Accountant Action: Deleting this record directly removes it from active views and balances. An automated notification will be sent to the MD."*
4. Click **Delete Record**.
5. **Verify:**
   - Deletion succeeds.
   - Running balance adjusts instantly.
   - MD receives system notification; audit log is generated.

### Test PERM-ACC-03: Supervisor Access Restricted
1. Log out and log in as a **Supervisor** (`supervisor` role).
2. Observe sidebar: link **Accounts** is **hidden** (`canViewMaterialContractorCosts = false` for supervisors).
3. Type URL `http://localhost:5173/accounts` directly into browser address bar.
4. **Verify:** Page does not load. Displays padlock icon: *"Access Restricted — Accounts & Cash is not available for your role. Contact the MD to request access."*

---

## 7. Cross-Page Checks

Verify that financial movements on `/accounts` reconcile across the application:

1. **Reconciliation with Attendance Wages (`/attendance`):**
   - Execute a Team Wage payment of `₹4,750.00` from Petty Cash on `/attendance`.
   - Return to `/accounts` → Tab **Unified Ledger**.
   - **Verify:** A row exists: `Wage Payment`, Amount: `-₹4,750.00`, Source: `💵 Petty Cash`.
   - **Verify:** Top Stat Card `Petty Cash Running Balance` decrements by `₹4,750.00`.

2. **Reconciliation with Contractor Payments (`/contractors`):**
   - Record a Contractor Payment of `₹1,00,000.00` from Bank on `/contractors`.
   - Return to `/accounts` → Tab **Unified Ledger**.
   - **Verify:** Row exists: `Contractor Payment`, Party: `Sri Lakshmi Constructions`, Outflow: `-₹1,00,000.00`, Source: `🏦 Bank`.
   - **Verify:** `Bank Account Running Balance` decrements by `₹1,00,000.00`.

3. **Reconciliation with Supplier Payments (`/materials`):**
   - Record a Supplier Payment of `₹60,000.00` from Bank on `/materials`.
   - Return to `/accounts` → Tab **Unified Ledger**.
   - **Verify:** Row exists: `Supplier Payment`, Party: `UltraTech Cement Agency`, Outflow: `-₹60,000.00`.

4. **Audit Trail Verification (`/audit`):**
   - Navigate to `/audit`.
   - **Verify:** Every expense creation, client receipt, contra transfer, cash closing, and field edit performed on `/accounts` is logged with user email, timestamp, and field diffs.

---

## 8. Test Results Checklist

| ID | Test Description | Data Set Used | Expected Result | Pass / Fail | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-ACC-01** | Load Accounts Page & Tabs | Default view | 4 stat cards, 7 tabs load with live balances. | | |
| **TC-ACC-02** | Date Range Filter | 01 Sep 2026 to 30 Sep 2026 | All ledger and expense lists filter to selected month. | | |
| **TC-ACC-03** | Account Summary / Trial Balance | Current month | Consolidated Trial Balance reconciles inflows vs outflows. | | |
| **TC-ACC-04** | Unified Ledger Reconciliation | Consolidated transactions | Shows all cash/bank movements without double-counting. | | |
| **TC-ACC-05** | Add Bulk Expenses | 2 items (Fuel ₹4,500 + Food ₹1,200) | Expenses created; Petty Cash decrements by ₹5,700. | | |
| **TC-ACC-06** | Edit Expense with Audit Reason | Increase fuel to ₹4,800 with reason | Amount updates; change history logs diff and reason. | | |
| **TC-ACC-07** | Add Single Expense | Material nails ₹3,500 from Petty Cash | Expense recorded; Petty Cash balance decrements. | | |
| **TC-ACC-08** | Add Client Progress Receipt | ₹2,50,000 via Bank Transfer | Receipt created; Bank running balance increments. | | |
| **TC-ACC-09** | Print Client Remittance Voucher | Click Printer icon on receipt | PrintableClientReceipt modal opens with formal voucher. | | |
| **TC-ACC-10** | Client Receipt Reversal | Reversal category, ₹50,000 | Negative amount recorded; corrects bank balance. | | |
| **TC-ACC-11** | Daily Cash Closing | Opening ₹50k, In ₹25k, Out ₹3.5k | Closing cash auto-computes to ₹71,500; saves successfully. | | |
| **TC-ACC-12** | Contra Transfer (Bank → Petty Cash) | ₹30,000 via cheque | Bank decrements ₹30k; Petty Cash increments ₹30k. | | |
| **TC-ACC-13** | Record MD Capital Infusion | ₹10,00,000 via RTGS to Bank | Bank balance increments by ₹10 Lakhs; logged under Equity. | | |
| **TC-ACC-14** | Record MD Personal Drawing | ₹1,00,000 withdrawal | Bank balance decrements by ₹1 Lakh; logged under Drawings. | | |
| **TC-ACC-15** | Configure Account Opening Balances | Set Petty Cash to ₹60,000 | Opening balance updates; running balance recalculates. | | |
| **TC-ACC-16** | Void Expense with Mandatory Reason | Click Ban icon with reason | Record marked VOID; excluded from running balances. | | |
| **TC-ACC-17** | Blocked Unvoid for Accountant | Attempt restore on voided record | Backend blocks unvoid: Only MD can restore records. | | |
| **TC-ACC-18** | Delete Expense with MD Notification | Click trash icon as Accountant | Soft delete succeeds; MD receives notification. | | |
| **TC-ACC-19** | Export CSV Reports | Click Export on all tabs | Valid CSV files download with formatted financial data. | | |
| **TC-ACC-20** | Cross-Page Wage Reconciliation | Check wage paid on `/attendance` | Appears in Unified Ledger as Petty Cash Outflow. | | |
| **TC-ACC-21** | Cross-Page Contractor Reconciliation| Check payment on `/contractors` | Appears in Unified Ledger as Bank Outflow. | | |
| **TC-ACC-22** | Supervisor Access Guard | Login as supervisor | Route guard locks page: Access Restricted shown. | | |

---

## 9. Open Questions, UNVERIFIED Items & Observations

1. **Running Balances Formula (Zero Double-Counting):**
   - Live account balances are computed directly by database function `get_account_balances()` in `supabase/migrations/20261114000000_core_updates_and_powers.sql`:
     ```text
     Running Balance = Opening Balance (account_opening_balances)
                     + Client Receipts (client_payments where is_void = false)
                     + MD Investments (md_investments where is_void = false and type != 'drawing')
                     + Contra Transfers IN (account_transfers where to_account = target)
                     - Expenses (expenses where is_void = false)
                     - Supplier Payments (supplier_payments where is_void = false)
                     - Contractor Payments (contractor_payments where is_void = false)
                     - Subcontractor Payments (subcontractor_payments where is_void = false)
                     - Group Payments (group_payments where is_void = false)
                     - Labour Wages (labour_wage_payments where is_void = false)
                     - MD Drawings (md_investments where type = 'drawing')
                     - Contra Transfers OUT (account_transfers where from_account = target)
     ```
   - **Cash Closing Records** are separate daily reconciliation snapshots and do not alter the continuous running ledger balances. This avoids double-counting and is fully verified from code.

2. **Accountant Unvoid Restrictions:**
   - As in the Materials module, an Accountant can mark any expense, client receipt, or transfer as VOID with a mandatory reason, but **cannot restore / unvoid** it. That action strictly requires `isMD`.
