# Manual Test Guide: Materials (Accountant Role)

**Document ID:** `04-materials-accountant`  
**Page Name:** Materials (`/materials`)  
**Target User Role:** Accountant (`accounts`)  
**Verification Target:** Multi-material Indents, Purchase Orders (PO) with GST/Transport, Goods Receipt Notes (GRN), Aged Pending Supplier Payments, Supplier Payments (Individual & Bulk Group Payment), Line Item Sheets, Void System, and RLS/Audit constraints.

---

## 1. Page Overview

- **Purpose:** Complete multi-material procurement and inventory flow for construction projects: raising multi-item material indents, issuing purchase orders with line-item GST rates (0%, 5%, 12%, 18%, 28%) and untaxed transport charges, recording on-site Goods Receipt Notes (GRN), tracking aging unpaid supplier liabilities, executing single and multi-project supplier payments with mandatory source classification (Bank Account vs. Petty Cash), and managing audit histories and void status.
- **Menu Path:** Click **Materials** in the left sidebar navigation menu, or navigate directly to `http://localhost:5173/materials` (or hosted domain equivalent).
- **Login Used:** User account assigned the `accounts` role in `user_roles`.
- **Route Guard:** Guarded by `<RequirePermission permission="canViewMaterialsAndContractors" label="Materials">`. Because the `accounts` role has `canViewMaterialsAndContractors = true`, the page loads completely without redirection.

---

## 2. Access Matrix

| Action / Tab / Element | Accountant Allowed? | How It Shows in UI | Backend Enforced? (RLS / DB) |
| :--- | :---: | :--- | :--- |
| **View Materials Page** | Yes | Full page renders; sidebar link "Materials" visible. | Enforced by session authentication & `canViewMaterialsAndContractors`. |
| **Top Stat Cards (Open Indents, PO Value, Received Value, Paid to Suppliers)** | Yes | 4 live metric cards displayed at top with summary calculations. | Backed by `SELECT` policies on `material_requests`, `purchase_orders`, `material_receipts`, `supplier_payments`. |
| **Shared Project Filter & Reset** | Yes | Dropdown selects visible and active in top filter bar across all tabs. | Client-side unified filter state. |
| **Indents Tab (`requests`)** | Yes | Tab visible. Shows table of material indents with status and amounts. | `material_requests_view` readable. |
| **Create Indent ("New Indent (+ Add More Material)")** | Yes | Button visible (`canModifySite = true`). Opens `MultiMaterialIndentDialog`. | `site write` policy on `material_requests` & `material_request_items` (`can_write_site()` allows MD, accounts, supervisor). |
| **Edit Indent** | Yes | Pencil icon button in row actions. | `site write` policy on `material_requests`. |
| **Inspect Indent Line Items ("Items" button)** | Yes | Blue text button and list icon. Opens `IndentItemsSheet` slide-over. | Read-only item query. |
| **Void Indent** | Yes | Amber prohibition icon button (`Ban`). Opens `ConfirmVoidDialog`. | `void_record` RPC (`is_md() OR has_role('accounts')`). Requires mandatory reason. |
| **Restore Voided Indent** | **MD Only** | Amber button switches to restore on voided records. | `unvoid_record` RPC strictly enforces `is_md()`. Accountant sees: *"Only the MD can unvoid records."* |
| **Delete Indent** | Yes | Red trash icon button. Opens `ConfirmDeleteDialog`. | `soft_delete_record` RPC allows MD & Accounts. Automated notification sent to MD. |
| **Purchase Orders Tab (`pos`)** | Yes | Tab visible. Shows POs, suppliers, total amounts, paid, and balance due. | `purchase_orders` table readable. |
| **Create PO ("New Purchase Order (+ Add More Material)")** | Yes | Button visible (`canModifyFinance = true`). Opens `MultiMaterialPoDialog`. | `finance write` policy on `purchase_orders` & `purchase_order_items` (`can_write_finance()` allows MD & accounts). |
| **Edit PO** | Yes | Pencil icon button in row actions. | `finance write` policy on `purchase_orders`. Requires mandatory edit reason for audit diff. |
| **Receive Materials Against PO (Direct GRN Shortcut)** | Yes | Green truck icon button (`Truck`) on PO row. Opens `MultiMaterialReceiptDialog` pre-filled with this PO. | `site write` policy on `material_receipts`. |
| **Inspect PO Line Items ("View Items" button)** | Yes | Blue text button. Opens `PoItemsSheet` slide-over showing itemized rates, quantities, and GST. | Read-only item query. |
| **Void PO** | Yes (Conditional) | Amber `Ban` icon. Opens `ConfirmVoidDialog`. | `void_record` RPC. **Blocked if active Goods Receipts or Payments exist**. |
| **Delete PO** | Yes (Conditional) | Red trash icon button. Opens `ConfirmDeleteDialog`. | `soft_delete_record` RPC. **Blocked if dependent GRNs or Payments exist**. |
| **Pending Supplier Payments Tab (`pending`)** | Yes | Tab visible with red badge showing count of unpaid POs. Sorted by age in days. | Computed client-side from `purchase_orders` and `supplier_payments`. |
| **Receipts (GRN) Tab (`receipts`)** | Yes | Tab visible. Lists all goods receipts. | `material_receipts_view` readable. |
| **Create Receipt ("New Receipt / GRN (+ Add More Material)")** | Yes | Button visible (`canModifySite = true`). Opens `MultiMaterialReceiptDialog`. | `site write` policy on `material_receipts` & `material_receipt_items`. |
| **Inspect Receipt Line Items** | Yes | Blue button in table. Opens `ReceiptItemsSheet` slide-over. | Read-only item query. |
| **Edit / Delete GRN** | Yes | Pencil and trash buttons in row actions. | `site write` policy & `soft_delete_record` RPC. |
| **Supplier Payments Tab (`payments`)** | Yes | Tab visible. Lists all payments with source tags (`🏦 Bank` / `💵 Petty Cash`). | `supplier_payments` table readable. |
| **Record Supplier Payment ("New payment")** | Yes | Button visible (`canModifyFinance = true`). Opens `FormDialog` with mandatory payment source selector. | `finance write` policy on `supplier_payments`. |
| **Supplier Group Payment ("Supplier Group Payment")** | Yes | Purple/blue icon button next to New Payment. Opens `SupplierGroupPaymentDialog` with multi-PO allocation. | Handled by `create_group_payment` RPC (`is_md() OR has_role('accounts')`). |
| **Edit Supplier Payment** | Yes | Pencil icon button. Form requires mandatory "Reason for edit" which logs audit diffs in `audit_logs`. | `finance write` policy. |
| **Void Supplier Payment** | Yes | Amber `Ban` icon button. Opens void dialog. | `void_record` RPC (`is_md() OR has_role('accounts')`). Excludes payment from balances. |
| **Delete Supplier Payment** | Yes | Red trash icon button. Directly removes payment; logs audit and notifies MD. | `soft_delete_record` RPC. |
| **Audit History Dialog ("ChangeHistoryDialog")** | Yes | History clock icon button on Indents, POs, GRNs, and Payments. Opens modal showing previous values and edit reasons. | Read-only query on `audit_logs`. |
| **Export Excel / CSV** | Yes | Export buttons visible on every tab. | Pure client-side CSV download. |

---

## 3. Test Data Pack

All test data uses realistic Tamil Nadu construction locations, suppliers, materials, and GST rates.

### A. Seed Data Required Before Starting
Ensure the following master records exist before testing:

#### 1. Projects
| Project Name | Code | Location |
| :--- | :--- | :--- |
| **Site 637** | `PRJ-637` | Coimbatore Civil Site |
| **Site 3033** | `PRJ-3033` | Pollachi Commercial Hub |

#### 2. Suppliers
| Supplier Name | GSTIN (Valid 15-char) | Contact Person | Phone | Supplies |
| :--- | :--- | :--- | :--- | :--- |
| **UltraTech Cement Agency** | `33AAACU1234F1Z1` | V. Senthil Kumar | 9842144001 | 53-Grade OPC / PPC Cement |
| **JSW Steel Coimbatore Yard** | `33AAACJ5678G2Z2` | K. Rajendran | 9842144002 | TMT Fe550D Steel Bars |
| **Kovai Blue Metal Quarries** | `33AAACK9012H3Z3` | M. Arumugam | 9842144003 | 20mm Aggregate & M-Sand |

---

### B. Form Data Sets

#### Form 1: Multi-Material Indent Dialog (`MultiMaterialIndentDialog`)
Opened by clicking **"New Indent (+ Add More Material)"** on the Indents tab.

##### 1. VALID Data Set (Multi-Item Cement & Sand Indent)
| Header Field | Value | Line Item 1 (Cement) | Line Item 2 (M-Sand) |
| :--- | :--- | :--- | :--- |
| **Indent #** | `REQ-2026-091` (auto) | **Material:** `53-Grade OPC Cement` | **Material:** `M-Sand (Plastering)` |
| **Project** | `Site 637` | **Specification:** `UltraTech 50kg Bags` | **Specification:** `Washed Zone-II` |
| **Request Date** | Today (`2026-09-15`) | **Unit:** `bag` | **Unit:** `cft` |
| **Required Date** | `2026-09-22` | **Quantity:** `200` | **Quantity:** `600` |
| **Status** | `approved` | **Estimated Rate:** `380` | **Estimated Rate:** `65` |
| **Remarks** | `Materials needed for beam casting.` | **Item Amount:** `200 × 380 = ₹76,000` | **Item Amount:** `600 × 65 = ₹39,000` |
| **Calculations** | **Total Indent Amount:** `₹76,000 + ₹39,000 = ₹1,15,000.00`. Open Indents counter increments by 1. | | |

##### 2. INVALID / BOUNDARY Data Sets
| Scenario | Action | Expected Behaviour |
| :--- | :--- | :--- |
| **Blank Material Name** | Add line item with quantity `10`, rate `500`, material blank | Submit blocked: *"Please provide a material name for all items."* |
| **Zero or Negative Quantity** | Quantity: `0` or `-5` | Submit blocked: *"Quantity must be greater than zero."* |
| **Delete All Line Items** | Delete the only row in table | Table resets with one empty row; cannot submit an empty indent. |

---

#### Form 2: Multi-Material Purchase Order Dialog (`MultiMaterialPoDialog`)
Opened by clicking **"New Purchase Order (+ Add More Material)"** on the Purchase orders tab.

##### 1. VALID Data Set (Cement PO with 28% GST & Untaxed Transport)
*Note on Indian Construction Taxation:* Cement attracts 28% GST, whereas separate freight/transport is typically untaxed or billed under RCM. The application cleanly calculates:
`Total Amount = Materials Subtotal + GST on Materials + Untaxed Transport`.

| Header / Item Field | Value / Line 1 | Value / Line 2 |
| :--- | :--- | :--- |
| **PO #** | `PO-2026-051` (auto-generated) | — |
| **Project** | `Site 637` | — |
| **Supplier** | `UltraTech Cement Agency` | — |
| **Against Indent** | Select `REQ-2026-091` (Imports Cement & Sand lines) | — |
| **PO Date** | Today (`2026-09-16`) | — |
| **Status** | `approved` | — |
| **Line 1: Material** | `53-Grade OPC Cement (UltraTech)` | — |
| **Line 1: Unit & Qty** | Unit: `bag`, Qty: `200` | — |
| **Line 1: Agreed Rate** | `₹380.00` | — |
| **Line 1: Amount** | `200 × 380 = ₹76,000.00` | — |
| **Line 1: GST %** | `28%` (Select 28%) | — |
| **Line 1: GST Amount** | `76,000 × 28% = ₹21,280.00` | — |
| **Line 2: Transport** | **+ Travel / Transport (Untaxed):** `3500` (₹3,500.00) | — |
| **Terms & Conditions** | `Delivery within 48 hours at Site 637 unloading point. Payment within 15 days.` | — |
| **Expected Calculations** | - **Materials Subtotal:** `₹76,000.00`<br>- **GST (28%):** `₹21,280.00`<br>- **Materials with GST:** `₹97,280.00`<br>- **Transport (Untaxed):** `₹3,500.00`<br>- **Total PO Value:** `₹1,00,780.00`<br>- **Balance Due:** Shows `₹1,00,780.00` in red. | — |

##### 2. BOUNDARY / SPECIAL Data Sets
| Scenario | Field | Value | Expected Behaviour |
| :--- | :--- | :--- | :--- |
| **0% GST (Nil-rated Sand/Bricks)** | GST % | `0%` | Tax amount = `₹0.00`. Subtotal equals total. |
| **18% GST (Standard Steel/Chemicals)** | Qty: `1000 kg`, Rate: `60`, GST: `18%` | Subtotal = `60,000`, GST = `10,800`, Total = `₹70,800.00`. |
| **Zero Transport** | Travel charges | `0` (or blank) | Transport = `₹0.00`. Total is strictly Subtotal + Tax. |
| **Edit Reason Enforcement** | Editing an existing PO | Leave "Reason for edit" empty | Submit blocked: *"Please provide a mandatory reason for this edit."* |

---

#### Form 3: Multi-Material Goods Receipt Note Dialog (`MultiMaterialReceiptDialog`)
Opened by clicking **"New Receipt / GRN"** on the Receipts tab, or clicking the green **Truck icon** on a PO row.

##### 1. VALID Data Set (Full Delivery against `PO-2026-051`)
| Field | Input Value |
| :--- | :--- |
| **Receipt / GRN #** | `GRN-2026-041` (auto-generated) |
| **Project** | `Site 637` |
| **Supplier** | `UltraTech Cement Agency` |
| **Against PO** | Select `PO-2026-051` (Auto-pulls 200 bags of cement @ ₹380) |
| **Receipt Date** | Today (`2026-09-18`) |
| **Received Line 1** | Quantity: `200`, Rate: `380`, Total: `₹76,000.00` |
| **Remarks** | `Received in good condition, batch test cert verified.` |
| **Expected Result** | GRN recorded. Received Value stat card increments by `+₹76,000.00`. |

##### 2. VALID Data Set (Partial Delivery)
| Field | Input Value | Expected Behaviour |
| :--- | :--- | :--- |
| **Received Line 1 (Partial)** | Quantity: `120` (out of 200 bags) | Receipt saves for `120 × 380 = ₹45,600.00`. Second GRN can be raised later for remaining 80 bags. |

---

#### Form 4: Record Supplier Payment (`supplier_payments`)
Opened by clicking **"New payment"** on the Supplier Payments tab.

##### 1. VALID Data Sets
| Field | Valid Set 1 (Bank Payment against PO) | Valid Set 2 (Petty Cash Final Settlement) |
| :--- | :--- | :--- |
| **Payment date** | Today (`2026-09-20`) | Today (`2026-09-25`) |
| **Project** | `Site 637` | `Site 637` |
| **Supplier** | `UltraTech Cement Agency` | `UltraTech Cement Agency` |
| **Against PO (optional)** | Select `PO-2026-051 (₹1,00,780.00)` | Select `PO-2026-051 (₹1,00,780.00)` |
| **Pay from (Source) \*** | `Bank Account` | `Petty Cash` |
| **Method** | `neft` (or `bank`) | `cash` |
| **Amount (₹)** | `60000` | `40780` (Full clearance) |
| **Reference number / UTR** | `UTR-SBIN-2026092004` | `PC-VOUCH-102` |
| **Remarks** | `1st instalment via NEFT` | `Final balance settlement` |
| **Expected Result** | Paid to Suppliers card increases by `₹60,000.00`. PO balance due reduces to `₹40,780.00` (red). | Paid to Suppliers card increases by `₹40,780.00`. PO balance due shows green **"Paid"** badge. |

##### 2. INVALID Data Sets
| Scenario | Field | Value | Expected Error Message |
| :--- | :--- | :--- | :--- |
| **Missing Pay From** | Pay from | *(Unselected)* | Form validation error: *"Pay from (Bank or Petty Cash) is required."* |
| **Zero Amount** | Amount | `0` | Form validation error: *"Amount must be greater than 0."* |
| **Negative Amount** | Amount | `-10000` | Rejected by input validation. |

---

#### Form 5: Supplier Group Payment Dialog (`SupplierGroupPaymentDialog`)
Opened by clicking the purple/blue button next to "New payment" on the Supplier Payments tab.

##### 1. VALID Data Set (Multi-PO Allocation)
Suppose **UltraTech Cement Agency** has two open purchase orders:
- `PO-2026-051` (Site 637): Balance Due `₹40,780.00`
- `PO-2026-052` (Site 3033): Balance Due `₹55,000.00`

| Field | Input Value |
| :--- | :--- |
| **Material Supplier** | `UltraTech Cement Agency` |
| **Payment Date** | Today's Date |
| **Total Payment Amount (₹)** | `95780` |
| **Pay From (Source)** | `Bank Account` |
| **Payment Method** | `Bank Transfer / NEFT` |
| **Reference / UTR #** | `NEFT-HDFC-9918205` |
| **Allocation Line 1 (`PO-2026-051`)** | `40780` (or click "Pay Full") |
| **Allocation Line 2 (`PO-2026-052`)** | `55000` (or click "Pay Full") |
| **Sum of Allocations** | `40780 + 55000 = 95780` (Exact match) |
| **Expected Result** | Validation passes green. Two payment records created in database. Bank balance decremented by `₹95,780.00`. Both POs marked as fully paid. |

---

#### Form 6: Confirm Void Dialog (`ConfirmVoidDialog`)
Opened by clicking the amber **Ban icon** on an Indent, PO, or Payment row.

##### 1. VALID Data Set (Voiding a Clerical Mistake Indent)
| Field | Value |
| :--- | :--- |
| **Action** | Click `Ban` icon on Indent `REQ-2026-091` |
| **Modal Title** | `Void Indent` |
| **Mandatory Reason \*** | `Duplicate indent entered by site supervisor in error.` |
| **Expected Result** | Row marked `is_void = true`. Hidden from active tables. Excluded from open indents count. Visible only when "Show Voided" toggle is ON. |

##### 2. INVALID / BLOCKED Data Set (Voiding PO with Linked Receipts)
| Scenario | Action | Expected Behaviour |
| :--- | :--- | :--- |
| **PO has Active GRN** | Click `Ban` icon on `PO-2026-051` (has `GRN-2026-041`) | **Blocked by Backend:** Error toast: *"Cannot void this Purchase Order because 1 Goods Receipt Note(s) are linked to it. Please void or delete the receipts first."* |
| **Blank Void Reason** | Submit void dialog with empty reason | Error toast: *"Please enter a mandatory reason."* Action blocked. |

---

## 4. Button-by-Button Guide

### Action 1: Create a Multi-Item Material Indent
- **Location:** Tab **Indents** → Button **"New Indent (+ Add More Material)"**.
- **Steps:**
  1. Click **New Indent (+ Add More Material)**.
  2. Dialog opens: **"New Material Indent"**.
  3. Select Project: `Site 637`.
  4. Line 1:
     - Material: `53-Grade OPC Cement`
     - Specification: `UltraTech 50kg Bags`
     - Unit: `bag`, Qty: `200`, Rate: `380`.
  5. Click button **"+ Add Another Material"**.
  6. Line 2 appears:
     - Material: `M-Sand (Plastering)`
     - Unit: `cft`, Qty: `600`, Rate: `65`.
  7. Notice bottom bar calculates: Total Estimated: `₹1,15,000.00`.
  8. Click **Submit Indent (2 items)**.
- **Expected Result:**
  - Dialog closes; toast confirms indent created.
  - Row appears in Indents table with material description and blue button `Items`.
  - Top stat card **"Open indents"** increments by 1.

---

### Action 2: Inspect Indent Line Items (Sheet Slide-Over)
- **Location:** Tab **Indents** → Click button **"Items"** or List icon on indent row.
- **Steps:**
  1. Locate `REQ-2026-091`.
  2. Click the blue **Items** button.
  3. Slide-over Sheet opens from the right titled: *"Material Indent Items — REQ-2026-091"*.
  4. Verify table shows all line items:
     - Line 1: `53-Grade OPC Cement`, 200 bag @ ₹380 = ₹76,000.
     - Line 2: `M-Sand (Plastering)`, 600 cft @ ₹65 = ₹39,000.
     - Total: `₹1,15,000.00`.
  5. Close sheet via `X` or outside click.

---

### Action 3: Issue Purchase Order with GST and Untaxed Transport
- **Location:** Tab **Purchase orders** → Button **"New Purchase Order (+ Add More Material)"**.
- **Steps:**
  1. Click **New Purchase Order (+ Add More Material)**.
  2. Dialog opens: **"New Purchase Order"**.
  3. Select Supplier: `UltraTech Cement Agency`.
  4. Select **Against Indent**: Select `REQ-2026-091`.
  5. Notice a toast appears: *"Imported 2 materials from Indent REQ-2026-091"*.
  6. In the line items table, delete Line 2 (M-Sand) by clicking its trash icon (cement supplier only supplies cement).
  7. For Line 1 (`53-Grade OPC Cement`), set **GST %** dropdown to `28%`.
  8. Enter **+ Travel / Transport (Untaxed)**: `3500`.
  9. Review calculations box on the right:
     - Materials Subtotal: `₹76,000.00`
     - GST (28%): `₹21,280.00`
     - Materials with GST: `₹97,280.00`
     - Travel / Transport: `₹3,500.00`
     - **Grand Total: ₹1,00,780.00**
  10. Click **Issue Purchase Order (1 items)**.
- **Expected Result:**
  - Dialog closes; toast confirms PO created.
  - PO table shows `PO-2026-051` with Total Value = `₹1,00,780.00`, Paid = `₹0.00`, Balance due = `₹1,00,780.00` (red).
  - Stat card **"PO value"** increments by `+₹1,00,780.00`.
  - Tab **Pending supplier payments** badge increments by 1.

---

### Action 4: Edit Purchase Order & Mandatory Audit Reason
- **Location:** Tab **Purchase orders** → Pencil icon on PO row.
- **Steps:**
  1. Click **Pencil** on `PO-2026-051`.
  2. Change travel charges from `3500` to `4000`.
  3. Notice an input appears at the bottom: **Reason for edit \*** (mandatory).
  4. Type reason: `Transport revision agreed with supplier`.
  5. Click **Update Purchase Order**.
- **Expected Result:**
  - Total updates to `₹1,01,280.00`.
  - Click the **History** clock icon on that row:
  - Audit modal opens showing exact field diff: `travel_charges: 3500 -> 4000`, `total_amount: 100780 -> 101280`, reason: *"Transport revision agreed with supplier"*, changed by accountant email.

---

### Action 5: Direct GRN Shortcut (Green Truck Button)
- **Location:** Tab **Purchase orders** → Green **Truck icon** on PO row.
- **Steps:**
  1. On `PO-2026-051`, click the green **Truck icon** (`Receive materials against this PO`).
  2. Dialog opens: **"New Goods Receipt Note (GRN)"**.
  3. Notice Project, Supplier, and Against PO are pre-selected to `Site 637`, `UltraTech Cement Agency`, and `PO-2026-051`.
  4. Line items are pre-loaded: `200 bags of 53-Grade OPC Cement @ ₹380 = ₹76,000.00`.
  5. Enter Remarks: `Received at Site 637 central cement godown.`
  6. Click **Confirm & Save GRN (1 items)**.
- **Expected Result:**
  - Dialog closes. If current filter hid the project, auto-toast clarifies: *"Switched filter to All Projects so your new receipt is visible."*
  - Switch to **Receipts (GRN)** tab: `GRN-2026-041` is listed with Received Value = `₹76,000.00`.
  - Stat card **"Received value"** increments by `+₹76,000.00`.

---

### Action 6: Record Single Supplier Payment
- **Location:** Tab **Supplier Payments** → Button **"New payment"**.
- **Steps:**
  1. Click **New payment**.
  2. Dialog opens: **"Record supplier payment"**.
  3. Fill using **Form 4 Valid Set 1**:
     - Project: `Site 637`
     - Supplier: `UltraTech Cement Agency`
     - Against PO: `PO-2026-051`
     - Pay from: `Bank Account` (Mandatory)
     - Method: `neft`
     - Amount (₹): `60000`
     - Reference number: `UTR-SBIN-2026092004`.
  4. Click **Save**.
- **Expected Result:**
  - Row added to Supplier Payments table with badge `🏦 Bank`.
  - Stat card **"Paid to suppliers"** increments by `+₹60,000.00`.
  - Switch to **Purchase orders** tab: On `PO-2026-051`, Paid shows `₹60,000.00`, Balance due reduces to `₹41,280.00` (red).

---

### Action 7: Execute Supplier Group Payment
- **Location:** Tab **Supplier Payments** → Button **"Supplier Group Payment"**.
- **Steps:**
  1. Click **Supplier Group Payment**.
  2. Select Supplier: `UltraTech Cement Agency`.
  3. Open POs for this supplier render in the allocation table.
  4. Enter Total Amount: `41280`.
  5. Pay from: `Petty Cash`.
  6. Method: `Cash`.
  7. On line for `PO-2026-051`, click **Pay Full** (`41280`).
  8. Allocation indicator turns green.
  9. Click **Confirm Group Payment**.
- **Expected Result:**
  - Group payment recorded; dialog closes.
  - Switch to **Purchase orders** tab: `PO-2026-051` shows green **"Paid"** badge (`bg-emerald-100 text-emerald-800`).
  - Switch to **Pending supplier payments** tab: `PO-2026-051` is removed from the pending list; count badge decrements.

---

### Action 8: Void Workflow & Void Filter Toggle
- **Location:** Amber **Ban icon** on row actions and top **Void Toggle** switch.
- **Steps:**
  1. On the Indents tab, locate an indent that has no PO linked to it.
  2. Click the amber **Ban icon**.
  3. Modal opens: **"Void Indent"**.
  4. Enter Mandatory Reason: `Client cancelled this construction block`.
  5. Click **Mark as Void**.
  6. Toast confirms: *"Indent marked as VOID."*
  7. Notice the record disappears from the active table.
  8. In the header bar, notice the toggle button: **"Show Voided (1)"**.
  9. Click **Show Voided**.
  10. The table now displays the voided indent with an amber badge: `VOID`.
  11. Hover over the `VOID` badge to view tooltip: *"Client cancelled this construction block"*.
  12. Click the restore button (as Accountant):
      - Modal opens: Click "Restore Record".
      - **Backend Blocked:** Toast error: *"Only the MD can unvoid records."* Restoration is strictly restricted to MD.

---

### Action 9: Delete Protection on Purchase Orders (Dependency Check)
- **Location:** Tab **Purchase orders** → Red trash icon.
- **Steps:**
  1. On `PO-2026-051` (which has `GRN-2026-041` and payments linked), click the red **Trash icon**.
  2. In the confirmation dialog, click **Delete Record**.
- **Expected Result (Backend Protection):**
  - Toast error appears:
    *"Cannot delete Purchase Order: 1 Goods Receipt(s) and 2 Supplier Payment(s) are linked to it. Delete or reassign dependent records first."*
  - Record is **not** deleted.

---

### Action 10: Export CSV Reports
- **Location:** On each tab (`requests`, `pos`, `pending`, `receipts`, `payments`).
- **Steps:**
  1. Click **Export Excel** button on any table.
  2. Browser downloads file named e.g. `brickweld-purchase-orders.csv` or `brickweld-supplier-pending-payments.csv`.
  3. Verify calculations, quantities, GST amounts, and balances match the screen.

---

## 5. Edge-Case and Negative Tests

| ID | Field / Scenario | Exact Input / Action | Expected Result |
| :--- | :--- | :--- | :--- |
| **EDG-MAT-01** | Zero quantity line item on Indent | Qty: `0`, Rate: `500` | Submit blocked: *"Quantity must be greater than zero."* |
| **EDG-MAT-02** | Mixed GST rates on same PO | Item 1 (Cement @ 28%), Item 2 (Aggregates @ 5%) | Math accurately calculates item-wise GST and sums total correctly. |
| **EDG-MAT-03** | PO with transport but no items | Delete all items, enter transport `2000` | Submit blocked: At least one material line item is required. |
| **EDG-MAT-04** | GRN quantity exceeding PO quantity | PO has 200 bags. Receive: `250 bags` | System permits receipt with overage, but audit diff logs delivery discrepancy. |
| **EDG-MAT-05** | Payment without selecting payment source | Fill amount, leave "Pay from" empty | Validation error: *"Pay from (Bank or Petty Cash) is required."* |
| **EDG-MAT-06** | Supplier group payment allocation difference | Total: `50000`, Allocations sum to `45000` | Submit disabled: Difference alert shows `₹5,000` unallocated. |
| **EDG-MAT-07** | Void PO with linked GRN | Click Ban on PO that has active GRN | Blocked by backend: *"Cannot void this Purchase Order because X Goods Receipt Note(s) are linked to it."* |
| **EDG-MAT-08** | Unvoid / Restore record as Accountant | Click Restore on voided record as accounts role | Blocked: Toast error *"Only the MD can unvoid records."* |
| **EDG-MAT-09** | Delete PO with linked payments | Click Delete on PO with active payments | Blocked by `soft_delete_record` dependency check: error lists dependent records. |
| **EDG-MAT-10** | Edit payment without reason | Edit payment, leave "Reason for edit" blank | Form blocks submit: Mandatory edit reason required for audit trail. |

---

## 6. Permission Tests

Execute these tests to confirm role boundaries for the `accounts` role.

### Test PERM-MAT-01: Accountant Financial Operations
1. Log in as **Accountant** (`accounts` role).
2. Navigate to `/materials`.
3. **Verify:**
   - Buttons **"New Purchase Order"**, **"New payment"**, and **"Supplier Group Payment"** are visible.
   - Accountant can create POs, edit line items, record payments, and void entries.

### Test PERM-MAT-02: Accountant Site Operations
1. As Accountant on `/materials`:
2. **Verify:**
   - Buttons **"New Indent"** and **"New Receipt / GRN"** are visible (`canModifySite = true` since accounts has site write rights).
   - Accountant can create indents and goods receipts directly.

### Test PERM-MAT-03: Supervisor View Boundary
1. Log out and log in as a **Supervisor** (`supervisor` role).
2. Navigate to `/materials`.
3. **Verify:**
   - Buttons **"New Purchase Order"**, **"New payment"**, and **"Supplier Group Payment"** are **hidden** (`canModifyFinance = false`).
   - Supervisor cannot see edit or delete action buttons on Purchase Orders or Payments.
   - Supervisor can create Indents and record Goods Receipts.

### Test PERM-MAT-04: Unvoid Restriction
1. Log in as **Accountant**.
2. Locate a voided indent or payment.
3. Attempt to restore it.
4. **Verify:** Action is blocked with message: *"Only the MD can unvoid records."*

---

## 7. Cross-Page Checks

Verify data updates flow accurately to related modules:

1. **Bank Balance Deduction (`/accounts`):**
   - Record a Supplier Payment of **₹60,000.00** from `Bank Account`.
   - Navigate to `/accounts`.
   - **Verify:** Bank running balance is deducted by exactly **₹60,000.00**.
   - **Verify:** Transactions / Cash Book table displays debit entry: *"Payment to UltraTech Cement Agency against PO-2026-051"*.

2. **Petty Cash Balance Deduction (`/accounts`):**
   - Record a Supplier Payment of **₹41,280.00** from `Petty Cash`.
   - Navigate to `/accounts`.
   - **Verify:** Petty Cash balance decrements by **₹41,280.00**.

3. **Project Material Costs on Projects Page (`/projects/$projectId`):**
   - Navigate to `/projects`.
   - Open details for `Site 637`.
   - **Verify:** Material costs reflect the received values and purchase orders issued for `Site 637`.

4. **Audit Trail Verification (`/audit`):**
   - Navigate to `/audit`.
   - **Verify:** Audit log entries exist for every material request, purchase order, receipt, payment, and void action executed by the accountant.

---

## 8. Test Results Checklist

| ID | Test Description | Data Set Used | Expected Result | Pass / Fail | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-MAT-01** | Load Materials Page & Tabs | Default view | 4 stat cards, 5 tabs render with full data. | | |
| **TC-MAT-02** | Unified Project Filter | `Site 637` | All tabs filter consistently to Site 637. | | |
| **TC-MAT-03** | Reset Shared Filter | Click Reset | Project filter restores to "All Projects". | | |
| **TC-MAT-04** | Create Multi-Material Indent | 2 items (Cement + Sand), ₹1,15,000 | Indent created; Open Indents count increments by 1. | | |
| **TC-MAT-05** | Inspect Indent Line Items | Click "Items" button | Slide-over Sheet shows items, quantities, and rates. | | |
| **TC-MAT-06** | Issue PO with 28% GST & Freight | Cement ₹76k + GST ₹21,280 + Freight ₹3,500 | Total PO Value = ₹1,00,780; PO Value card updates. | | |
| **TC-MAT-07** | Import Indent Items into PO | Select REQ-2026-091 | Line items auto-populate into PO table. | | |
| **TC-MAT-08** | Edit PO with Mandatory Audit Reason | Update freight to ₹4,000 with reason | PO updates to ₹1,01,280; change logged in audit diffs. | | |
| **TC-MAT-09** | Direct GRN via Truck Icon | Click Truck on PO-2026-051 | GRN dialog pre-fills PO lines; saves successfully. | | |
| **TC-MAT-10** | Verify Pending Payments Aging | PO-2026-051 | Displays in Pending tab with age badge and balance. | | |
| **TC-MAT-11** | Record Bank Supplier Payment | ₹60,000 from Bank against PO | Paid to Suppliers increments; PO balance updates. | | |
| **TC-MAT-12** | Record Supplier Group Payment | ₹41,280 from Petty Cash (Full clearance) | Payment records; PO displays green "Paid" badge. | | |
| **TC-MAT-13** | Payment Missing Source Validation | Submit with empty "Pay from" | Form validation blocks submit: Pay from is mandatory. | | |
| **TC-MAT-14** | Group Payment Allocation Mismatch | Allocations ≠ Total | Submit disabled; error clarifies difference. | | |
| **TC-MAT-15** | Void Indent with Mandatory Reason | Click Ban icon with reason | Record marked VOID; hidden unless Show Voided is ON. | | |
| **TC-MAT-16** | Blocked Void on PO with GRN | Void PO with linked GRN | Backend error blocks voiding: GRN must be handled first. | | |
| **TC-MAT-17** | Blocked Restore for Accountant | Attempt unvoid as accounts role | Error toast: Only the MD can unvoid records. | | |
| **TC-MAT-18** | Delete PO with Linked GRN/Payments | Attempt delete on PO with children | Backend dependency check blocks deletion. | | |
| **TC-MAT-19** | Audit History Inspection | Click History clock icon | Change history modal displays exact field diffs. | | |
| **TC-MAT-20** | Export CSV Reports | Click Export Excel on all tabs | Valid CSV files download with formatted data. | | |
| **TC-MAT-21** | Bank Balance Sync | Check `/accounts` after bank pay | Running bank balance decremented by payment amount. | | |
| **TC-MAT-22** | Petty Cash Balance Sync | Check `/accounts` after cash pay | Petty cash balance decremented by payment amount. | | |

---

## 9. Open Questions, UNVERIFIED Items & Observations

1. **GST Calculation on Transport / Freight:**
   - In `src/components/MultiMaterialPoDialog.tsx` line 227–237, GST is calculated strictly on material line items, and `travel_charges` is added untaxed:
     ```typescript
     const subtotalWithGst = Math.round((subtotal + taxAmount) * 100) / 100;
     const totalAmount = Math.round((subtotalWithGst + Number(travelCharges)) * 100) / 100;
     ```
   - This matches Indian construction practice where GTA / freight is either untaxed or handled under Reverse Charge Mechanism (RCM). The calculation is fully verified and consistent with the codebase.

2. **Unvoid / Restore Rights Restricted to MD:**
   - In `ConfirmVoidDialog.tsx` line 52–56 and `unvoid_record` RPC, restoring a previously voided record strictly requires the `isMD` role. Even though the Accountant can mark a record as VOID, they **cannot** unvoid it. This is by design to ensure executive oversight over resurrected financial documents.

3. **Audit Reason Requirement on Payments & POs:**
   - When editing an existing supplier payment (`editingPayment`) or purchase order, the form enforces a mandatory `edit_reason` field. This reason is stored in `audit_logs` via `logRecordFieldDiffs`. Testers should ensure they never skip this field during negative testing.
