# Manual Test Guide — Projects Page
**Role under test:** Accountant (`accounts`)
**App:** Brickweld Pvt Ltd — Construction Project Control
**Guide version:** 2026-11-20
**Author:** QA Lead
**Status:** Ready for execution

---

> [!IMPORTANT]
> Read this whole guide once before you start clicking anything. Set up **all seed data in Section 3A** before running any test. Use the exact values given — do not substitute.

---

## 1. Page Overview

### What this page does
The Projects page has two levels:

| Level | URL | What you see |
|---|---|---|
| Projects list | `/projects` | All projects in a table with status tabs and filters |
| Project detail | `/projects/<id>` | One project's full picture: financials, tabs for quotations, payments, attendance, materials, contractors, budget, expenses |

### How to reach it
1. Log in with your accountant email and password at `/auth`.
2. In the left sidebar, click **Projects** (building icon). You land on `/projects`.
3. Click any project name (blue underlined link) or the eye icon to open the detail page.

### Login to use for all tests
| Field | Value |
|---|---|
| Email | The accountant's email address set up in Supabase |
| Password | The accountant's password |
| Expected role label shown in top bar | "Accounts / Back Office" |

---

## 2. Access Matrix

### What the accountant CAN do on the Projects list page

| Action | Accountant allowed? | How it shows in the UI | Backend enforced? |
|---|---|---|---|
| View the Projects list page | ✅ Yes | "Projects" appears in left sidebar | `permissions.canViewProjects = true`; nav filter passes |
| View all project rows (name, code, client, status, contract value, start, target) | ✅ Yes | All columns visible including Contract value column | RLS: `projects_view` readable by all authenticated users; `canViewProjectFinancials = true` |
| Filter by status tab (All / Active / Planning / Completed) | ✅ Yes | Tabs shown above the table | Client-side filter only |
| Filter by client (dropdown) | ✅ Yes | "All Clients" dropdown shown | Client-side filter only |
| Reset filters (RotateCcw button) | ✅ Yes | Appears only when a filter is active | Client-side only |
| Export table to CSV/Excel | ✅ Yes | Export button in DataTable component | Client-side only |
| Click project name to open detail | ✅ Yes | Name is a blue link | Client-side navigation |
| Click eye icon to open detail | ✅ Yes | Eye icon visible for every row | Client-side navigation |
| Click pencil icon to edit a project | ✅ Yes | Pencil icon visible (gated by `canManageQuotations`) | RLS: `projects update policy` allows `can_manage_masters()` = MD or Accounts |
| Click **+ New project** button | ✅ Yes | Shown in page header (gated by `canManageQuotations`) | RLS: `projects insert policy` allows `can_manage_masters()` |
| Click trash icon to delete a project | ⚠️ **UI shows it, backend blocks it** — see Section 9 | Trash icon visible (gated by `canManageQuotations`) | `soft_delete_record` RPC checks `is_md()` only → will throw error for accountant |

### What the accountant CAN do on the Project detail page

| Action | Allowed? | UI | Backend |
|---|---|---|---|
| View all 6 stat cards (Contract Value, Received, Pending Receivables, Total Cost, Profit, Budget) | ✅ Yes | All 6 cards shown | `canViewProjectFinancials = true` |
| View operational highlight cards (Labour & Attendance, Materials, Contractors) | ✅ Yes | All 3 cards shown | `canEnterAttendance`, `canViewMaterialsAndContractors` both true |
| View Cost composition pie chart | ✅ Yes | Chart shown | `canViewProjectFinancials = true` |
| View Details tab | ✅ Yes | Always shown | No gate |
| View Quotations tab | ✅ Yes | Tab shown | `canViewProjectFinancials = true` |
| View Payments & Receivables tab | ✅ Yes | Tab shown | `canViewProjectFinancials = true` |
| View Labour & Attendance tab | ✅ Yes | Tab shown | `canEnterAttendance = true` |
| View Materials tab | ✅ Yes | Tab shown | `canViewMaterialsAndContractors = true` |
| View Contractor Bills tab | ✅ Yes | Tab shown | `canViewMaterialContractorCosts = true` |
| View Budget tab | ✅ Yes | Tab shown | `canViewProjectFinancials = true` |
| View Expenses tab | ✅ Yes | Tab shown | `canViewProjectFinancials = true` |
| Click **+ Add Quotation** (header button) | ✅ Yes | Button shown | `canManageQuotations = true`; RLS: `is_finance_user()` |
| Click **+ Add Quotation** (Quotations tab button) | ✅ Yes | Button shown | Same |
| Delete a quotation (trash in Quotations tab) | ⚠️ **UI shows it, backend blocks it** — see Section 9 | Trash shown for `isMD or canManageQuotations` | `soft_delete_record` checks `is_md()` only |
| Click **+ Record Client Payment** | ✅ Yes | Button shown (green) | `canManageQuotations = true`; RLS: `is_finance_user()` |
| Click **+ Add Milestone** | ✅ Yes | Button shown | `canManageQuotations = true` |
| Edit a client payment (pencil icon in payments table) | ✅ Yes | Edit button shown | RLS write policy allows `is_finance_user()` |
| Click reversal button (RotateCcw icon) on a payment | ✅ Yes | Shown for non-reversal rows | `canManageQuotations = true` |
| Delete a client payment (trash in payments table) | ⚠️ **UI shows it, backend blocks it** — see Section 9 | Trash shown | `soft_delete_record` checks `is_md()` only |
| Edit a milestone (file icon in milestones table) | ✅ Yes | Shown | `canManageQuotations = true` |
| Delete a milestone (trash in milestones table) | ⚠️ **UI shows it, backend blocks it** — see Section 9 | Trash shown | `soft_delete_record` checks `is_md()` only |
| Print / Save as PDF | ✅ Yes | "Print / PDF" button always shown | Client-side `window.print()` |

### What the accountant CANNOT do

| Action | Expected behaviour |
|---|---|
| Open the **Dashboard** page via sidebar | "Dashboard" link does not appear in the left sidebar. The nav filter returns `isMD` only for `/dashboard`. |
| Type `/dashboard` directly in the URL bar | The route loads but shows only "Active projects" stat card and a role-notice banner: *"Role-based View: Showing operational view according to your role permissions."* No financial figures (contract value, spend, cash on hand, etc.) are shown. This is a partial access, not a redirect. |
| Open the **Reports & P&L** page | "Reports & P&L" does not appear in the sidebar (`canViewProfitAndLoss = false`). Typing `/reports` directly: UNVERIFIED — the route guard has not been traced to confirm it redirects or shows an empty/error state. |
| See Profit and Margin figures | Profit stat card is visible on project detail but shown to accountant — UNVERIFIED if margin is intentionally shown (code shows `canViewProjectFinancials` gates it; accountant has this permission). See Section 9. |

---

## 3. Test Data Pack

### 3A. Seed data — create these records first

Create the following records **before running any test**. Use the exact names and codes shown. You will create most of them through the app's own forms on other pages (Clients under Masters, etc.).

#### Clients (create in Masters → Clients)

| # | Client Name | Phone | Notes |
|---|---|---|---|
| C1 | Murugan Constructions Pvt Ltd | 9876543210 | Main client for most tests |
| C2 | Senthil Kumar | 9865432100 | Individual client for boundary tests |

#### Projects (created during tests — no pre-seed needed; the tests create them)

#### Quotations (supplementary) — created during tests

#### Client payments, milestones — created during tests

---

### 3B. Form data sets — New Project form

Fields in the New project / Edit project form:

| Field | Type | Required? | Notes |
|---|---|---|---|
| Project name | Text | ✅ Yes | Free text |
| Project code | Text | ✅ Yes | Must be unique |
| Client | Select | No | List from Clients table |
| Status | Select | No | planning / active / on_hold / completed / cancelled; default = planning |
| Contract value (₹) | Number | No | Stored as `quotation_amount`; visible because `canViewProjectFinancials = true` |
| Start date | Date | No | |
| Expected completion | Date | No | |
| House / plot number | Text | No | |
| Site address | Textarea | No | |
| Agreement details | Textarea | No | |
| Scope / notes | Textarea | No | |

---

#### Data Set P-VALID — Valid new project

| Field | Value to type | Expected behaviour |
|---|---|---|
| Project name | Senthilnagar Duplex House | Accepted |
| Project code | BWD-2026-001 | Accepted; must be unique |
| Client | Murugan Constructions Pvt Ltd | Dropdown selection |
| Status | active | Dropdown selection |
| Contract value (₹) | 4500000 | Accepted; shown as ₹45,00,000 in table |
| Start date | 2026-04-01 | Accepted (past date) |
| Expected completion | 2027-03-31 | Accepted (future date) |
| House / plot number | Plot 14-B, Anna Nagar | Accepted |
| Site address | 14-B, Anna Nagar East, Chennai – 600 102, Tamil Nadu | Accepted |
| Agreement details | Agreement dated 25-Mar-2026 | Accepted |
| Scope / notes | G+1 duplex with ground-floor retail and first-floor 3BHK. RCC frame, AAC block masonry. | Accepted |

**Expected result on Save:**
- Dialog closes.
- Toast shows: **"Project saved"**
- New row appears at top of the table (sorted by `created_at DESC`).
- Project name is a clickable link.
- Contract value column shows **₹45,00,000**.
- Status badge shows **active**.

---

#### Data Set P-INVALID — Invalid inputs

| Field | Value to type | Expected behaviour |
|---|---|---|
| Project name | *(leave blank)* | Red error under field: "Project name is required". Form does not submit. |
| Project code | *(leave blank)* | Red error under field: "Project code is required". Form does not submit. |
| Contract value (₹) | abc | Red error under field: "Please enter a valid number". Form does not submit. |
| Contract value (₹) | 12.34.56 | Red error: "Please enter a valid number". |

> [!NOTE]
> The form validates required fields in the browser before sending anything to the server. The errors appear in red text below the field label. The Save button stays enabled until you click it; validation runs on submit.

---

#### Data Set P-BOUNDARY — Boundary inputs

| Field | Value to type | Expected behaviour |
|---|---|---|
| Project code | BWD-2026-001 (same as P-VALID) | Save clicked → toast error: **"Project code 'BWD-2026-001' already exists. Please use a different number."** |
| Contract value (₹) | 0 | Accepted (no minimum enforced by the form; stored as 0). Contract value column shows ₹0. |
| Contract value (₹) | -1 | Accepted by the form (no negative check in the form itself); stored as -1. UNVERIFIED if the database has a check constraint on `quotation_amount`. Contract value column would show -₹1. |
| Contract value (₹) | 99999999 | Accepted; shown as ₹9,99,99,999. |
| Contract value (₹) | 1250.50 | Accepted; shown as ₹1,250.50. |
| Project name | A name exactly 500 characters long (type 500 'A's) | Accepted (no max-length in the form or schema traced). |
| Project name | Senthil@Kumar#2026! | Accepted (no special-character restriction). |
| Start date | 2000-01-01 (far past) | Accepted. |
| Start date | 2099-12-31 (far future) | Accepted. |
| Expected completion | 2026-01-01 (earlier than start date 2026-04-01) | Accepted — no date-ordering validation in the form. The tester must verify this manually. |

---

### 3C. Form data sets — Add Mid-Project Quotation form

Fields in the Add Quotation form:

| Field | Type | Required? | Notes |
|---|---|---|---|
| Quotation Title / Scope | Text | ✅ Yes | |
| Quotation Number / Ref | Text | No | Auto-suggested e.g. QTN-2 |
| Quotation Amount (₹) | Number | ✅ Yes | |
| Quotation Date | Date | ✅ Yes | Defaults to today |
| Status | Select | No | approved / draft / under_review / rejected; default = approved |
| Detailed Scope of Work | Textarea | No | |

---

#### Data Set Q-VALID — Valid supplementary quotation

Precondition: Project BWD-2026-001 (Senthilnagar Duplex) must exist.

| Field | Value to type | Expected behaviour |
|---|---|---|
| Quotation Title / Scope | Extra Bathroom and Utility Room | Accepted |
| Quotation Number / Ref | QTN-002 | Accepted |
| Quotation Amount (₹) | 185000 | Accepted |
| Quotation Date | 2026-07-15 | Accepted |
| Status | approved | Select "Approved / Added to Contract" |
| Detailed Scope of Work | Adding one bathroom and utility room on first floor as per revised plan. | Accepted |

**Expected calculated results:**
- Base contract value: ₹45,00,000
- Supplementary quotation (approved): ₹1,85,000
- **Revised Total Contract Value = ₹45,00,000 + ₹1,85,000 = ₹46,85,000**
- The "Total Contract Value" stat card on the detail page should update to **₹46,85,000**.
- The hint text under the card should read: *"Base ₹45,00,000 + ₹1,85,000 (1 additions)"*
- In the Quotations tab, the "Base Project Agreement Quotation" row shows ₹45,00,000 and the new row shows ₹1,85,000 with status badge "approved".

---

#### Data Set Q-INVALID — Invalid quotation inputs

| Field | Value to type | Expected behaviour |
|---|---|---|
| Quotation Title / Scope | *(leave blank)* | Error: "Quotation Title / Scope is required". No submit. |
| Quotation Amount (₹) | *(leave blank)* | Error: "Quotation Amount is required". No submit. |
| Quotation Date | *(leave blank)* | Error: "Quotation Date is required". No submit. |
| Quotation Amount (₹) | xyz | Error: "Please enter a valid number". |

---

#### Data Set Q-BOUNDARY — Boundary quotation inputs

| Field | Value to type | Expected behaviour |
|---|---|---|
| Quotation Amount (₹) | 0 | Accepted by form; stored as ₹0. Contract value does not change because only "approved" status rows add to contract. |
| Quotation Amount (₹) | -50000 | Accepted by form. If status = approved, the contract value DECREASES. UNVERIFIED — no form-level negative check found. |
| Quotation Amount (₹) | 99999999 | Accepted; shown as ₹9,99,99,999. |
| Status | draft | Quotation saved with status "draft". Amount does NOT add to contract value (only "approved" rows are summed). |
| Status | rejected | Quotation saved; amount not added to contract value. |
| Quotation Date | 2000-01-01 | Accepted (past date). |
| Quotation Date | 2099-12-31 | Accepted (future date). |

---

### 3D. Form data sets — Record Client Payment form

Fields in the Record Client Payment form:

| Field | Type | Required? | Notes |
|---|---|---|---|
| Amount Received (₹) | Number | ✅ Yes | DB CHECK: amount > 0 |
| Receipt Date | Date | ✅ Yes | Defaults to today |
| Payment Method | Select | ✅ Yes | Bank Transfer / UPI / Cheque / Cash / Other |
| Payment Category | Select | ✅ Yes | Advance / Running Bill (Progress) / Final Settlement / Other |
| Transaction / UTR / Cheque Ref # | Text | No | |
| Invoice / RA Bill Reference | Text | No | |
| Account Credited | Select | ✅ Yes | Bank Account / Petty Cash |
| Notes / Remarks | Textarea | No | |

> [!NOTE]
> Receipt number is auto-generated client-side: `RCP-{project_code}-{last-6-digits-of-timestamp}`. Example: `RCP-BWD-2026-001-123456`. It is not shown in the form; it appears in the payments table after save.

---

#### Data Set CP-VALID-1 — Advance payment via Bank Transfer

Precondition: Project BWD-2026-001 must exist with contract value ₹46,85,000 (after Q-VALID quotation).

| Field | Value to type | Expected behaviour |
|---|---|---|
| Amount Received (₹) | 500000 | Accepted |
| Receipt Date | 2026-05-10 | Accepted |
| Payment Method | Bank Transfer (NEFT/RTGS/IMPS) | Select |
| Payment Category | Advance Payment | Select |
| Transaction / UTR / Cheque Ref # | UTR-998241567 | Accepted |
| Invoice / RA Bill Reference | *(leave blank)* | Optional; no error |
| Account Credited | Bank Account | Select |
| Notes / Remarks | Mobilisation advance for Senthilnagar Duplex project | Accepted |

**Expected calculated results after Save:**
- Toast: **"Client Payment saved"**
- Payments table: new row with auto-generated receipt number (e.g. `RCP-BWD-2026-001-xxxxxx`), date 10 May 2026, category badge "advance", method "bank", ref "UTR-998241567", account badge "Bank", amount in green: **₹5,00,000**.
- Stat cards update:
  - **Received Amount: ₹5,00,000** (tone: success/green)
  - **Pending Receivables: ₹46,85,000 − ₹5,00,000 = ₹41,85,000** (tone: warning/amber)
  - **Advance Status: ₹5,00,000**
  - Recovery achieved: `Math.round((500000 / 4685000) * 100)` = **10%**

---

#### Data Set CP-VALID-2 — Progress payment via UPI

Precondition: Advance already recorded (CP-VALID-1 done).

| Field | Value to type | Expected behaviour |
|---|---|---|
| Amount Received (₹) | 1500000 | Accepted |
| Receipt Date | 2026-09-20 | Accepted |
| Payment Method | UPI | Select |
| Payment Category | Running Bill / Progress Payment | Select |
| Transaction / UTR / Cheque Ref # | *(leave blank)* | Optional |
| Invoice / RA Bill Reference | RA-01 | Accepted |
| Account Credited | Bank Account | Select |
| Notes / Remarks | First running bill payment for slab completion | Accepted |

**Expected calculated results after Save:**
- New row appears with category "progress", method "upi", amount green: **₹15,00,000**.
- Stat cards update:
  - **Total Received: ₹5,00,000 + ₹15,00,000 = ₹20,00,000**
  - **Pending Receivables: ₹46,85,000 − ₹20,00,000 = ₹26,85,000**
  - Recovery: `Math.round((2000000 / 4685000) * 100)` = **42%**

---

#### Data Set CP-VALID-3 — Final settlement via Cheque

| Field | Value to type | Expected behaviour |
|---|---|---|
| Amount Received (₹) | 2685000 | Accepted |
| Receipt Date | 2027-03-25 | Accepted |
| Payment Method | Cheque | Select |
| Payment Category | Final Settlement | Select |
| Transaction / UTR / Cheque Ref # | CHQ-1048 | Accepted |
| Invoice / RA Bill Reference | INV-2027-FINAL | Accepted |
| Account Credited | Bank Account | Select |
| Notes / Remarks | Final settlement cheque for Senthilnagar Duplex | Accepted |

**Expected calculated results after Save:**
- **Total Received: ₹20,00,000 + ₹26,85,000 = ₹46,85,000**
- **Pending Receivables: ₹46,85,000 − ₹46,85,000 = ₹0** (tone: default/no warning)
- Recovery: 100%

---

#### Data Set CP-VALID-4 — Cash payment to Petty Cash account

| Field | Value to type | Expected behaviour |
|---|---|---|
| Amount Received (₹) | 25000 | Accepted |
| Receipt Date | 2026-06-01 | Accepted |
| Payment Method | Cash | Select |
| Payment Category | Other | Select |
| Transaction / UTR / Cheque Ref # | *(leave blank)* | |
| Invoice / RA Bill Reference | *(leave blank)* | |
| Account Credited | Petty Cash | Select |
| Notes / Remarks | Sundry cash collection | Accepted |

**Expected:** Account badge shows "Petty Cash". Amount in green.

---

#### Data Set CP-INVALID — Invalid payment inputs

| Field | Value to type | Expected behaviour |
|---|---|---|
| Amount Received (₹) | *(leave blank)* | Error: "Amount Received is required". No submit. |
| Amount Received (₹) | abc | Error: "Please enter a valid number". |
| Receipt Date | *(leave blank)* | Error: "Receipt Date is required". |
| Payment Method | *(leave blank / not selected)* | Error: "Payment Method is required". |
| Payment Category | *(leave blank / not selected)* | Error: "Payment Category is required". |
| Account Credited | *(leave blank / not selected)* | Error: "Account Credited is required". |

---

#### Data Set CP-BOUNDARY — Boundary payment inputs

| Field | Value to type | Expected behaviour |
|---|---|---|
| Amount Received (₹) | 0 | Form submits (no form-level zero check). Backend DB check `amount > 0` triggers. Toast error: "The entry entered violates validation rules. Please check values and try again." |
| Amount Received (₹) | -1 | Likely accepted by form. DB check `amount > 0` will reject. Same toast error. |
| Amount Received (₹) | 0.01 | Accepted (smallest positive decimal). Passes DB check. |
| Amount Received (₹) | 99999999 | Accepted by form and DB (column type numeric(14,2)). |
| Amount Received (₹) | 1250.50 | Accepted. Shown as ₹1,250.50. |
| Receipt Date | 2000-01-01 | Accepted (past date — no restriction). |
| Receipt Date | 2099-12-31 | Accepted (future date). |

---

### 3E. Form data sets — Add Payment Milestone form

Fields in the Add Payment Milestone form:

| Field | Type | Required? | Notes |
|---|---|---|---|
| Milestone Title | Text | ✅ Yes | |
| Expected Amount (₹) | Number | ✅ Yes | DB CHECK: expected_amount >= 0 |
| Due Date | Date | ✅ Yes | Defaults to today |
| Milestone Status | Select | ✅ Yes | Pending / Partially Paid / Fully Paid / Cancelled; default = Pending |
| Scope / Stage Description | Textarea | No | |

---

#### Data Set M-VALID — Valid milestone

Precondition: Project BWD-2026-001 must exist.

| Field | Value to type | Expected behaviour |
|---|---|---|
| Milestone Title | Foundation & Plinth Completion | Accepted |
| Expected Amount (₹) | 500000 | Accepted |
| Due Date | 2026-07-31 | Accepted |
| Milestone Status | Pending | Select |
| Scope / Stage Description | Foundation excavation, PCC, footing, plinth beam and backfill complete. | Accepted |

**Expected result on Save:**
- Toast: **"Payment Milestone saved"**
- Milestones table: new row with title "Foundation & Plinth Completion", due date 31 Jul 2026, expected amount ₹5,00,000, status badge "pending" (amber).

---

#### Data Set M-VALID-2 — Overdue milestone

| Field | Value to type | Expected behaviour |
|---|---|---|
| Milestone Title | Roof Slab Casting | Accepted |
| Expected Amount (₹) | 750000 | Accepted |
| Due Date | 2026-01-15 | A date in the past |
| Milestone Status | Pending | |
| Scope / Stage Description | *(leave blank)* | |

**Expected result:** Row shows due date in **red** text with an **"Overdue"** red badge (the code checks `r.status === "pending" && r.due_date < today()`).

---

#### Data Set M-INVALID — Invalid milestone inputs

| Field | Value to type | Expected behaviour |
|---|---|---|
| Milestone Title | *(leave blank)* | Error: "Milestone Title is required". |
| Expected Amount (₹) | *(leave blank)* | Error: "Expected Amount is required". |
| Due Date | *(leave blank)* | Error: "Due Date is required". |
| Milestone Status | *(leave blank / not selected)* | Error: "Milestone Status is required". |
| Expected Amount (₹) | xyz | Error: "Please enter a valid number". |

---

#### Data Set M-BOUNDARY — Boundary milestone inputs

| Field | Value to type | Expected behaviour |
|---|---|---|
| Expected Amount (₹) | 0 | Accepted — DB check is `>= 0`, so zero is allowed. Row shows ₹0. |
| Expected Amount (₹) | -1 | Form submits (no form-level negative check). DB check `expected_amount >= 0` rejects it. Toast error. |
| Expected Amount (₹) | 99999999 | Accepted. |
| Due Date | 2000-01-01 | Accepted (past date — will show Overdue badge if status is Pending). |

---

### 3F. Special cases — Payment reversals

| Scenario | Steps | Expected result |
|---|---|---|
| Reverse a progress payment | Record CP-VALID-2 first. Click the amber RotateCcw icon on that row. Confirm in dialog. | New row appears with category badge "reversal" (red), amount shown as **−₹15,00,000** (red text). Total Received decreases by ₹15,00,000. |
| Reverse an advance payment | Record CP-VALID-1 first. Click RotateCcw. Confirm. | New row with amount **−₹5,00,000** (red). Advance Status drops to ₹0. |
| Cannot reverse a reversal row | A row with category "reversal" has no RotateCcw icon. | RotateCcw icon absent. No action possible. |

---

## 4. Button-by-Button Guide

### 4.1 Projects List Page (`/projects`)

---

#### Button: **+ New project** (top-right of page header)

**Where:** Top-right corner of the Projects page, inside the page header actions area.
**Preconditions:** You are logged in as the accountant. At least one client exists (create C1 first).

**Steps:**
1. Navigate to `/projects`.
2. Click the **+ New project** button (blue, with a plus icon).
3. A dialog titled "New project" opens. Confirm you can see all 10 fields.
4. Fill in Data Set **P-VALID**.
5. Click **Save**.

**Expected on Save:**
- Dialog closes automatically.
- Toast (bottom-right corner) shows: **"Project saved"**
- The table refreshes. A new row for "Senthilnagar Duplex House" appears at the top.
- Contract value column shows **₹45,00,000**.
- Status badge shows "active" (green).

**Expected on Cancel (before saving):**
1. After step 3, click **Cancel** (outline button in the dialog footer).
2. Dialog closes. No new project is created. Table unchanged.

**Expected with P-INVALID:**
1. Leave Project name blank. Leave Project code blank. Enter `abc` in Contract value.
2. Click Save.
3. Three error messages appear below the respective fields (red text).
4. Dialog stays open. Nothing is saved.

**Expected with P-BOUNDARY (duplicate code):**
1. After creating BWD-2026-001 with P-VALID, open + New project again.
2. Enter project code **BWD-2026-001** (same as existing).
3. Click Save.
4. Toast error: **"Project code 'BWD-2026-001' already exists. Please use a different number. This is not a system error."**
5. Dialog stays open.

---

#### Button: **Pencil (Edit) icon** — per row in the Actions column

**Where:** Rightmost column of each project row, the pencil icon.
**Preconditions:** At least one project exists (BWD-2026-001 from above).

**Steps:**
1. Find the row for "Senthilnagar Duplex House".
2. Click the **pencil icon** in that row's Actions column.
3. The "Edit project" dialog opens. Verify all current field values are pre-filled.
4. Change **Status** from "active" to "on hold".
5. Change **Contract value** to **5000000**.
6. Click **Save**.

**Expected on Save:**
- Toast: **"Project saved"**
- Row updates: Status badge changes to "on hold".
- Contract value column now shows **₹50,00,000**.
- An edit notification is sent to the MD (backend trigger `trg_track_row_edits`). You will not see this — the MD's notification bell gets it.

**Expected on Cancel:**
- Click pencil, then Cancel. Dialog closes. Row unchanged.

---

#### Button: **Trash (Delete) icon** — per row in the Actions column

> [!CAUTION]
> **UI-vs-RLS mismatch. Run this test to confirm the bug. Do NOT expect the delete to succeed.**

**Where:** Rightmost column, red trash icon.
**Preconditions:** At least one project exists.

**Steps:**
1. Find any project row.
2. Click the **trash icon**.
3. The "Delete project" dialog opens. Read the blue notice banner which says: *"Accountant Action: Deleting this record directly removes it from active views and balances. An automated notification will be sent to the MD."*
4. Optionally type a reason.
5. Click **Delete Record** (red button).

**Expected:**
- Toast error appears: **"Permission denied. Only Managing Director (MD) can delete records."**
- The project remains in the table.
- Dialog closes after the error.

**Expected on Cancel:**
- Click Cancel at any point. Dialog closes. No change.

---

#### Filter: **Status tabs** (All / Active / Planning / Completed)

**Where:** Below the page header, row of tabs.

**Steps:**
1. Click **Active** tab.
2. Table shows only projects with status "active". The count in the tab label matches.
3. Click **Planning** tab. Same for planning projects.
4. Click **Completed** tab. Same for completed.
5. Click **All** tab. All projects reappear.

**Expected:** Each tab filters instantly. No server call. The count in parentheses is live.

---

#### Filter: **All Clients dropdown**

**Where:** To the right of the status tabs.

**Steps:**
1. Click the "All Clients" dropdown.
2. Select "Murugan Constructions Pvt Ltd".
3. Table shows only projects linked to that client.
4. The **Reset** button (RotateCcw icon) appears.
5. Click **Reset**.
6. All projects reappear. Reset button disappears.

---

#### Button: **Reset** (RotateCcw, next to client filter)

**When it appears:** Only when at least one filter is active.
**Steps:** Apply any filter, then click Reset.
**Expected:** Both status and client filters reset to "all". Table shows all projects. Reset button disappears.

---

#### Row click (anywhere on a project row)

**Steps:**
1. Click anywhere on a project row (not on an action icon).
2. You navigate to `/projects/<project-id>` — the project detail page.

---

#### Link: Project name (blue underlined text)

**Steps:**
1. Click the blue project name link.
2. Navigate to the project detail page.

---

### 4.2 Project Detail Page (`/projects/<id>`)

Navigate to the detail page for BWD-2026-001 (Senthilnagar Duplex House).

---

#### Button: **+ Add Quotation** (page header, top-right)

**Where:** Next to the Print/PDF button in the top-right of the detail page.
**Preconditions:** You are on the detail page. Project BWD-2026-001 exists.

**Steps:**
1. Click **+ Add Quotation** (blue button with plus icon).
2. Dialog "Add Mid-Project Quotation" opens.
3. Fill in Data Set **Q-VALID**.
4. Click **Save**.

**Expected on Save:**
- Toast: **"Quotation saved"**
- Stat card "Total Contract Value" updates to **₹46,85,000**.
- Hint text: *"Base ₹45,00,000 + ₹1,85,000 (1 additions)"*
- Quotations tab badge updates: "Quotations (1)".

**Expected on Cancel:** Dialog closes. No quotation added.
**Expected with Q-INVALID:** Error messages appear. Dialog stays open.

---

#### Button: **Print / PDF** (top-right of detail page)

**Where:** Outlined button labelled "Print / PDF" with printer icon.
**Steps:**
1. Click **Print / PDF**.
2. The browser's native print dialog opens.
3. Close the print dialog.

**Expected:** Browser print dialog opens. The printable summary section (Brickweld letterhead, project name, financial summary) is designed to be visible in print. No server call. No data change.

---

#### Tab: **Details**

**Where:** First tab in the tab bar.
**Steps:**
1. Click the **Details** tab.
2. Verify you can see: House / plot, Site address, Start date, Expected completion, Agreement, Scope / notes.

**Expected:** All 6 fields show the values you entered when creating the project. If a field was left blank, it shows "—".

---

#### Tab: **Quotations**

**Steps:**
1. Click the **Quotations** tab.
2. Verify the "Base Project Agreement Quotation" block shows ₹45,00,000.
3. Verify the Q-VALID quotation row appears with status "approved".
4. See the **+ Add Quotation** button in this tab as well.

**Delete quotation (trash icon in Quotations tab):**
> [!CAUTION]
> Same mismatch as project delete — backend blocks it.
1. Click the trash icon on the Q-VALID quotation row.
2. Confirm dialog opens.
3. Click **Delete Record**.
4. Expected: Toast error: **"Permission denied. Only Managing Director (MD) can delete records."** Quotation remains.

---

#### Tab: **Payments & Receivables**

**Steps:**
1. Click the **Payments & Receivables** tab.
2. Verify the 4 position cards at the top: Revised Contract Value, Total Received to Date, Pending Receivables, Advance Status.
3. Verify the Payment Milestones table is present (empty if no milestones yet).
4. Verify the Client Receipts table is present (empty if no payments yet).

---

#### Button: **+ Add Milestone** (Payments & Receivables tab)

**Where:** Outline button in the tab's header area.
**Steps:**
1. Click **+ Add Milestone**.
2. Dialog "Add Payment Milestone" opens.
3. Fill in Data Set **M-VALID**.
4. Click **Save**.

**Expected on Save:**
- Toast: **"Payment Milestone saved"**
- Milestones table shows new row: "Foundation & Plinth Completion", 31 Jul 2026, ₹5,00,000, status "pending" (amber badge).

**Expected on Cancel:** Dialog closes. No milestone saved.
**Expected with M-INVALID:** Errors shown. Dialog stays open.

---

#### Button: Edit milestone (file icon in milestones table row)

**Where:** Actions column of the milestones table (file/document icon).
**Steps:**
1. Find the M-VALID milestone row.
2. Click the **file icon**.
3. Edit milestone dialog opens with pre-filled values.
4. Change Status to "partially paid".
5. Click **Save**.

**Expected:**
- Toast: **"Payment Milestone saved"**
- Status badge in milestones table changes to "partially paid" (blue).

---

#### Button: Delete milestone (trash in milestones table)

> [!CAUTION]
> Same backend block as other delete buttons.

1. Click the trash icon on a milestone.
2. Confirm in dialog.
3. Expected: Toast error: **"Permission denied. Only Managing Director (MD) can delete records."**

---

#### Button: **+ Record Client Payment** (Payments & Receivables tab)

**Where:** Green button in the tab's header area.
**Steps:**
1. Click **+ Record Client Payment**.
2. Dialog "Record Client Payment" opens.
3. Notice the default values: Receipt Date = today, Payment Method = Bank Transfer, Payment Category = Running Bill / Progress Payment, Account Credited = Bank Account.
4. Fill in Data Set **CP-VALID-1**.
5. Click **Save**.

**Expected on Save:**
- Toast: **"Client Payment saved"**
- Receipts table updates with the new row.
- Stat cards update (see Section 3D for exact amounts).
- An audit log entry is written (you can verify in the Audit Log page).

**Expected on Cancel:** Dialog closes. No payment saved.

---

#### Button: Edit payment (pencil icon on a payment row)

> [!NOTE]
> The pencil icon appears in the Actions column of the receipts table when `canManageQuotations = true`. Click it to open the edit form with pre-filled values.

**Steps:**
1. Find a payment row (e.g. CP-VALID-1).
2. Click the **pencil icon** in the Actions column.
3. The "Edit Client Payment" dialog opens with pre-filled values.
4. Change Notes to "Updated: advance payment confirmed".
5. Click **Save**.

**Expected:**
- Toast: **"Client Payment saved"**
- Row updates in the table.

---

#### Button: Reversal (amber RotateCcw icon on a payment row)

**Where:** Actions column of each payment row (not shown for reversal-category rows).
**Steps:**
1. Find a payment row (e.g. CP-VALID-2, the progress payment of ₹15,00,000).
2. Click the **amber RotateCcw icon**.
3. The "Post Financial Reversal / Refund" confirmation dialog opens. Read the message: *"Post an authorized offsetting reversal of ₹15,00,000 against receipt RCP-…?"*
4. Click **Delete Record** (the confirm button — it uses the same ConfirmDeleteDialog component).

**Expected:**
- Toast: **"Client Payment saved"** (a new reversal record is inserted)
- A new row appears in the receipts table with category "reversal" (red badge), amount shown as **−₹15,00,000** (red text).
- Stat cards: Total Received decreases by ₹15,00,000.
- Audit log entry written.
- The original payment row still appears (the original is NOT deleted — it is preserved for audit compliance).

**Expected on Cancel:** Click Cancel in the dialog. No reversal created. Original payment unchanged.

---

#### Button: Delete payment (trash on a payment row)

> [!CAUTION]
> Same backend block.

1. Click trash icon on any payment row.
2. Click **Delete Record** in the dialog.
3. Expected toast error: **"Permission denied. Only Managing Director (MD) can delete records."**

---

#### Payments filter: Category dropdown

**Where:** Right-side of the receipts table header.
**Steps:**
1. Click the category dropdown (shows "All Categories").
2. Select **Advance**.
3. Only advance payments show.
4. Select **Reversals**.
5. Only reversal rows show.
6. Select **All Categories** to reset.

---

#### Payments filter: Method dropdown

**Steps:**
1. Click the method dropdown (shows "All Methods").
2. Select **UPI**. Only UPI payments show.
3. Select **All Methods** to reset.

---

#### Tab: **Labour & Attendance**

**Steps:**
1. Click **Labour & Attendance** tab.
2. Table shows attendance records for this project.
3. Columns: Date, Kind, Status, Headcount, Wage (visible because `canViewWagesAndPayments = true`), Remarks.
4. No add/edit buttons on this read-only view — attendance is entered on the Attendance page.

---

#### Tab: **Materials**

**Steps:**
1. Click **Materials** tab.
2. Table shows GRN (Goods Receipt Notes) for this project.
3. Columns: Receipt No, Date, Material / Item (always shows "General Material Supply"), Amount.

---

#### Tab: **Contractor Bills**

**Steps:**
1. Click **Contractor Bills** tab.
2. Table shows contractor bills for this project.
3. Columns: Bill No, Date, Status, Net Amount.

---

#### Tab: **Budget**

**Steps:**
1. Click **Budget** tab.
2. Table shows budget allocations by category.
3. Columns: Category, Budget, Notes.
4. No add/edit buttons on this read-only view.

---

#### Tab: **Expenses**

**Steps:**
1. Click **Expenses** tab.
2. Table shows site expenses for this project.
3. Columns: Date, Category, Description, Amount.

---

## 5. Edge-Case and Negative Tests Per Form

| ID | Field / Scenario | Exact Input | Expected Result |
|---|---|---|---|
| EC-01 | Project code | Duplicate of existing code | Toast error: "Project code '<value>' already exists…" |
| EC-02 | Project code | Blank spaces only: `   ` | Treated as empty after trim. Required error: "Project code is required". |
| EC-03 | Contract value | `1e5` (scientific notation) | The browser may interpret as 100000 for number inputs. Result: UNVERIFIED — depends on browser. |
| EC-04 | Start date + Completion date | Start = 2027-01-01, Completion = 2026-01-01 (earlier) | Accepted — no cross-field date validation in the form. |
| EC-05 | Quotation amount | `0` with status = approved | Accepted. Adds ₹0 to contract value. No error. |
| EC-06 | Quotation amount | Negative value with status = approved | Form accepts. If DB has no negative check on `project_quotations.amount`, it inserts and reduces contract value. UNVERIFIED — no check constraint found in migration. |
| EC-07 | Client payment amount | `0` | Form submits. DB check `amount > 0` fires. Toast: "The entry entered violates validation rules." |
| EC-08 | Client payment amount | `0.001` | Passes DB check (`> 0`). Stored and shown as ₹0.001 → may display as ₹0.00 depending on `currency()` formatter. UNVERIFIED. |
| EC-09 | Milestone expected amount | `0` | Accepted. DB check is `>= 0`. Row shows ₹0. |
| EC-10 | Milestone expected amount | Negative | Form submits. DB check `expected_amount >= 0` fires. Toast error. |
| EC-11 | Record payment, then immediately edit to change amount | Edit CP-VALID-1; change amount to 600000 | Toast: "Client Payment saved". Stat cards update to reflect ₹6,00,000. |
| EC-12 | Record two payments with identical amounts on the same date | Both CP-VALID-1 and a second ₹5,00,000 payment on same date | Allowed — no uniqueness constraint on (project_id, amount, date). Both rows appear. |
| EC-13 | Filter by a client who has no projects | Select C2 (Senthil Kumar) in client filter — if no projects linked | Table shows empty state: "No projects yet." |
| EC-14 | Reversal of a reversal-category row | No RotateCcw icon on reversal rows | Icon not rendered. No action possible. |
| EC-15 | Edit project — change code to an already-used code | Edit BWD-2026-001 and type the code of another existing project | Toast error on save: "Project code '<value>' already exists…" |

---

## 6. Permission Tests

### 6.1 Confirm accountant cannot delete (backend blocks even when UI allows it)

1. As the accountant, go to `/projects`.
2. Click the trash icon on any project row.
3. The ConfirmDeleteDialog opens. The blue banner reads: *"Accountant Action: Deleting this record directly removes it from active views…"*
4. Click **Delete Record**.
5. **Expected:** Toast error: *"Permission denied. Only Managing Director (MD) can delete records."*
6. The project is still in the list.
7. Record this as a **UI-vs-RLS mismatch**: the button and dialog appear, but the backend RPC `soft_delete_record` only allows MD.

Repeat the same test for:
- Trash icon on a quotation row (Quotations tab).
- Trash icon on a payment row (Payments & Receivables tab).
- Trash icon on a milestone row (Payments & Receivables tab).

**Expected result every time:** Same toast error. Record not deleted.

---

### 6.2 Confirm Dashboard is not in the accountant's sidebar

1. Log in as accountant.
2. Look at the left sidebar.
3. **Expected:** "Dashboard" is NOT listed.
4. The sidebar should show: Projects, Attendance, Accounts & Cash, Materials, Contractors, Masters, Audit Log, Settings.

---

### 6.3 Confirm typing `/dashboard` in the URL bar gives limited view

1. Type `http://<app-url>/dashboard` directly in the browser address bar and press Enter.
2. **Expected:** You are NOT redirected to `/auth`. The dashboard page loads.
3. You see only the **"Active projects"** stat card (a single card in a 3-column grid).
4. A blue notice banner appears at the top: *"Role-based View: Showing operational view according to your role permissions."*
5. No financial stat cards (Contract value, Spend, Cash on hand) appear.
6. The "Active projects list" card is shown below.
7. The "Pending approvals" card is shown (contractor bills and material requests that are pending).
8. No charts (bar chart or pie chart) appear.

---

### 6.4 Confirm Reports & P&L is not accessible

1. As accountant, look at the left sidebar.
2. **Expected:** "Reports & P&L" is NOT listed.
3. Type `/reports` directly in the URL bar.
4. **Expected (UNVERIFIED):** Either a redirect to `/auth` or an empty page. The route exists but financial data may not load because `canViewProfitAndLoss = false`. Record the actual behaviour here.

---

### 6.5 Confirm accountant cannot assign the MD role to anyone

1. Go to Settings (via sidebar).
2. Find the user role management section.
3. Try to change any user's role to "MD / Administrator".
4. **Expected:** The option is blocked at the backend. The RLS policy `user_roles_write_policy` rejects writes where `role = 'md'` for non-MD users. The UI may or may not hide the MD option — UNVERIFIED.

---

## 7. Cross-Page Checks

After performing the following actions on the Projects page, verify these effects on other pages.

| Action taken on Projects | Go to this page | What to check | Expected value |
|---|---|---|---|
| Record CP-VALID-1 advance of ₹5,00,000 | Accounts & Cash (`/accounts`) | Bank account inflows | Should increase by ₹5,00,000 |
| Record CP-VALID-4 cash of ₹25,000 to Petty Cash | Accounts & Cash (`/accounts`) | Petty Cash inflows | Should increase by ₹25,000 |
| Record a reversal of ₹15,00,000 | Accounts & Cash (`/accounts`) | Bank balance | Should decrease by ₹15,00,000 |
| Create project BWD-2026-001 with ₹45,00,000 contract value | Dashboard (`/dashboard`) — **as MD** | Contract value stat card | Should include ₹45,00,000 in the total across all projects |
| Record CP-VALID-1 and CP-VALID-2 | Dashboard (as MD) | Received amount stat card | Should include ₹20,00,000 (advance + progress) |
| Record any payment | Audit Log (`/audit`) | Audit trail | A new audit entry for `client_payments` with action "insert" and the receipt number |
| Edit a project | Audit Log (`/audit`) | Audit trail | An edit notification to MD (from the `trg_track_row_edits` trigger) — UNVERIFIED if visible in audit log or only as a notification |

---

## 8. Test Results Checklist

| ID | Test | Data Set | Expected | Actual | Pass/Fail | Notes |
|---|---|---|---|---|---|---|
| T-01 | Projects link appears in sidebar | — | "Projects" visible in left nav | | | |
| T-02 | Projects list page loads | — | Table with columns: Project, Code, Client, Status, Contract value, Start, Target, Actions | | | |
| T-03 | Contract value column visible | — | Column appears (canViewProjectFinancials = true) | | | |
| T-04 | Filter by Active tab | — | Only active projects shown | | | |
| T-05 | Filter by Planning tab | — | Only planning projects shown | | | |
| T-06 | Filter by Completed tab | — | Only completed projects shown | | | |
| T-07 | Filter by Client | — | Only projects for selected client shown | | | |
| T-08 | Reset filter | — | All projects shown; Reset button disappears | | | |
| T-09 | New project — valid | P-VALID | Toast "Project saved"; row in table with ₹45,00,000 | | | |
| T-10 | New project — blank required fields | P-INVALID | Error messages on Project name, Project code; no submit | | | |
| T-11 | New project — invalid contract value | P-INVALID | Error "Please enter a valid number" | | | |
| T-12 | New project — duplicate code | P-BOUNDARY | Toast error with duplicate code message | | | |
| T-13 | New project — zero contract value | P-BOUNDARY | Accepted; ₹0 shown | | | |
| T-14 | New project — Cancel | — | Dialog closes; no row added | | | |
| T-15 | Edit project — save | — | Toast "Project saved"; row updated | | | |
| T-16 | Edit project — duplicate code | P-BOUNDARY | Toast error | | | |
| T-17 | Delete project — confirm | — | Toast error "Permission denied…"; project remains | | | |
| T-18 | Delete project — cancel | — | Dialog closes; no change | | | |
| T-19 | Row click navigates to detail | — | URL changes to /projects/<id> | | | |
| T-20 | Detail page loads all 6 stat cards | — | Contract Value, Received, Pending, Cost, Profit, Budget visible | | | |
| T-21 | Details tab shows project fields | — | All 6 fields shown | | | |
| T-22 | Quotations tab visible | — | Tab appears; base amount shown | | | |
| T-23 | Add Quotation — valid | Q-VALID | Toast saved; contract value updates to ₹46,85,000 | | | |
| T-24 | Add Quotation — blank required fields | Q-INVALID | Errors; no submit | | | |
| T-25 | Add Quotation — draft status | Q-BOUNDARY | Saved; contract value does NOT increase | | | |
| T-26 | Delete quotation — confirm | — | Toast error "Permission denied…"; quotation remains | | | |
| T-27 | Payments tab visible with 4 position cards | — | Cards: Revised Contract Value, Total Received, Pending Receivables, Advance Status | | | |
| T-28 | Add Milestone — valid | M-VALID | Toast saved; row in table | | | |
| T-29 | Add Milestone — overdue date | M-VALID-2 | Row shows red date + "Overdue" badge | | | |
| T-30 | Add Milestone — blank required fields | M-INVALID | Errors; no submit | | | |
| T-31 | Add Milestone — zero amount | M-BOUNDARY | Accepted (DB allows ≥ 0) | | | |
| T-32 | Add Milestone — negative amount | M-BOUNDARY | Toast error (DB rejects < 0) | | | |
| T-33 | Edit milestone — change status | — | Toast saved; badge updated | | | |
| T-34 | Delete milestone — confirm | — | Toast error "Permission denied…" | | | |
| T-35 | Record Client Payment — advance bank | CP-VALID-1 | Toast saved; Received = ₹5,00,000; Pending = ₹41,85,000 | | | |
| T-36 | Record Client Payment — progress UPI | CP-VALID-2 | Toast saved; Received = ₹20,00,000; Pending = ₹26,85,000 | | | |
| T-37 | Record Client Payment — final cheque | CP-VALID-3 | Toast saved; Received = ₹46,85,000; Pending = ₹0 | | | |
| T-38 | Record Client Payment — cash to petty cash | CP-VALID-4 | Toast saved; account badge "Petty Cash" | | | |
| T-39 | Record Client Payment — blank required fields | CP-INVALID | Errors; no submit | | | |
| T-40 | Record Client Payment — amount = 0 | CP-BOUNDARY | Toast error (DB check amount > 0) | | | |
| T-41 | Record Client Payment — negative amount | CP-BOUNDARY | Toast error (DB check) | | | |
| T-42 | Edit payment — change notes | — | Toast saved; row updated | | | |
| T-43 | Delete payment — confirm | — | Toast error "Permission denied…" | | | |
| T-44 | Reversal of progress payment | Reversal section | New reversal row; amount shown as −₹15,00,000; Received decreases | | | |
| T-45 | Cannot reverse a reversal row | — | RotateCcw icon absent on reversal rows | | | |
| T-46 | Category filter — Advance | — | Only advance payments shown | | | |
| T-47 | Category filter — Reversals | — | Only reversal rows shown | | | |
| T-48 | Method filter — UPI | — | Only UPI payments shown | | | |
| T-49 | Print / PDF button opens print dialog | — | Browser print dialog opens | | | |
| T-50 | Dashboard not in sidebar | — | No "Dashboard" link visible | | | |
| T-51 | Typing /dashboard shows limited view | — | Role-based View banner; only Active projects stat card; no financial figures | | | |
| T-52 | Reports & P&L not in sidebar | — | No "Reports & P&L" link visible | | | |
| T-53 | Cross-page: Advance payment reflected in Accounts & Cash | CP-VALID-1 | Bank inflows +₹5,00,000 | | | |
| T-54 | Cross-page: Reversal reflected in Accounts & Cash | Reversal test | Bank balance −₹15,00,000 | | | |
| T-55 | Audit log entry created after recording payment | CP-VALID-1 | Audit entry visible in /audit | | | |

---

## 9. Open Questions / UNVERIFIED Items / Suspected Bugs

### 🔴 Critical Bug — UI-vs-RLS Mismatch on Delete

**Affected buttons:** Trash icon on project list rows, trash icon on quotation rows, trash icon on payment rows, trash icon on milestone rows.

**Root cause confirmed from code:**
- `ConfirmDeleteDialog.tsx` line 46: `const canDirectDelete = isMD || roles.includes("accounts")` → accounts role gets the delete button and dialog.
- `useDeleteRow` in `db.ts` calls `supabase.rpc("soft_delete_record", ...)`.
- `soft_delete_record` in `20261026000000_security_and_approval_fixes.sql` lines 71–74: checks `is_md()` only → raises `'Permission denied. Only Managing Director (MD) can delete records.'` for the accountant.

**Result:** The accountant sees the trash icon and delete dialog with an "Accountant Action" banner, but every delete attempt fails with a toast error.

**What the tester should do:** Run test T-17, T-26, T-34, T-43, confirm the error message, and log it as a known defect.

---

### 🟡 UNVERIFIED — Profit stat card visible to accountant

The code on the detail page gates the profit stat card with `permissions.canViewProjectFinancials`. The accountant has `canViewProjectFinancials: true`. This means the accountant CAN see the Profit and Profit margin percentage. However, `permissions.ts` comments say "Accounts CANNOT see profit, loss or margin" and `canViewProfitAndLoss: false`.

**Discrepancy:** `canViewProfitAndLoss` controls the Reports & P&L page. `canViewProjectFinancials` controls individual project detail financials. The intent (from comments) may be that accountants should not see profit/margin at all, but the current code shows it on the project detail page.

**Tester action:** Open the project detail page and check if the Profit stat card and margin % hint text are visible. Record actual value.

---

### 🟡 UNVERIFIED — `/reports` URL behaviour when typed directly by accountant

The nav filter hides the link, but the route exists. Confirm whether typing `/reports` redirects to `/auth`, shows an empty page, or shows some partial content.

---

### 🟡 UNVERIFIED — Negative `quotation_amount` on the project

The New/Edit project form uses `type: "number"` for Contract value. The number input accepts negative values in browsers. No `CHECK` constraint on `projects.quotation_amount` was found in the migrations reviewed. If a negative value is saved, the contract value and all derived totals (pending receivables, profit) become negative. Tester should try entering -1 and check the result.

---

### 🟡 UNVERIFIED — Negative `amount` on `project_quotations`

No `CHECK` constraint found on `project_quotations.amount` in migration `20261010000002_project_quotations.sql`. An approved quotation with a negative amount would reduce the total contract value. This may be intentional (variation deduction) or a bug.

---

### 🟡 UNVERIFIED — `currency()` formatter with very small decimals

If `amount = 0.001` is stored (which passes the `> 0` DB check), the `currency()` formatter in `format.ts` has not been read. The display may round to ₹0.00. Tester should verify.

---

### 🟡 UNVERIFIED — Edit-trigger notification to MD

When the accountant edits a project or payment, the database trigger `trg_track_row_edits` fires and inserts a notification row for the MD. Tester should log in as MD after an accountant edit and verify the notification bell shows an "Edit in projects" notification.

---

### 🟡 UNVERIFIED — Audit log entry after client payment recorded

The code in `projects.$projectId.tsx` line 1210 calls `logAuditEntry(...)` after saving a client payment. Tester should navigate to `/audit` and confirm the entry appears.

---

### 🟡 UNVERIFIED — `on_hold` and `cancelled` status not in filter tabs

The status tabs on the Projects list page show: All, Active, Planning, Completed. Projects with status "on_hold" or "cancelled" are only visible under the "All" tab. Tester should confirm: if a project is set to "on_hold", it does not appear in any named tab, only in "All".

---

### 🟡 UNVERIFIED — Receipt number uniqueness when two payments are saved simultaneously

The receipt number is generated client-side: `RCP-{project_code}-{Date.now().slice(-6)}`. If two people save at the same millisecond, the `receipt_number` unique constraint on `client_payments` would cause a duplicate key error. This is a timing-dependent edge case.

---

### ℹ️ NOTE — Dashboard partial access

Typing `/dashboard` as an accountant does NOT redirect to login. The route guard (`_authenticated/route.tsx`) only checks for a valid session, not for role. The page renders with limited content. This is intentional design but may confuse the tester into thinking the dashboard is accessible.

---

## Suggested Next Page

After completing and signing off this Projects guide, the next recommended page is:

**`02-attendance-accountant.md`** — The Attendance page is rich with forms (clock-in/out, leave, weekly wages), role gates for wage visibility, and the same delete mismatch will likely reappear. It is the most complex operational page for the accountant role.

Subsequent order: Accounts & Cash → Materials → Contractors → Masters → Audit Log → Settings.
