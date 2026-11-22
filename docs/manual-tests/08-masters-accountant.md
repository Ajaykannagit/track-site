# Manual Test Guide: Masters (Accountant Role)

**Document ID:** `docs/manual-tests/08-masters-accountant.md`  
**Page Name:** Masters  
**Target Route:** `/_authenticated/masters` (Page URL: `/masters`)  
**Tester Persona:** Accountant (`role: "accounts"`)  
**Author:** QA Lead  
**Application:** Brickweld Construction Project Control Web App  

---

## 1. Page Overview

### Purpose
The **Masters** page serves as the centralized master data registry for the entire enterprise. It manages fundamental business entities that are referenced across all operational workflows:
1. **Clients** (Owners / Developers for whom projects are built)
2. **Employees** (Labourers, site supervisors, and officers with daily/monthly/hourly wage bases and OT rates)
3. **Contractors** (Subcontractors categorized by trade/type, e.g., Masonry, Steel, Electrical, with bank details)
4. **Suppliers** (Vendors supplying construction materials, cement, steel, sand, with GSTIN tracking)
5. **Machines** (Heavy equipment, machinery, concrete mixers, batching plants, and earth movers)
6. **Job Types** (Tab present in navigation bar)

Master data established here directly populates dropdown pickers in:
- **Projects Page** (`/projects`): Client selection when registering projects.
- **Attendance Page** (`/attendance`): Workers in Daily Muster, Weekly Grid, and Wage Disbursals.
- **Contractors Page** (`/contractors`): Contractor pickers for Work Orders, Measurement Books, and Subcontractor Bills.
- **Materials Page** (`/materials`): Suppliers for Purchase Orders and GRNs.
- **Accounts Page** (`/accounts`): Party payee/payer selectors for direct vouchers and contra accounts.

### How the Accountant Reaches This Page
- **Menu Path:** Click **Masters** in the main sidebar navigation under the Management / Configuration section.
- **Direct URL:** Navigate to `http://localhost:5173/masters` (or your staging domain equivalent).
- **Login Credentials:** Log in as an user assigned the `accounts` role (e.g., `accountant@brickweld.com`).

---

## 2. Access Matrix

| Entity / Action | Accountant Allowed? | How It Shows in UI | Backend Enforced? (RLS / RPC) | Notes |
| :--- | :---: | :--- | :--- | :--- |
| **View All Masters Tabs** | **YES** | All 6 tab triggers (`Clients`, `Employees`, `Contractors`, `Suppliers`, `Machines`, `Job Types`) visible | Enforced via `authenticated` SELECT policies | Accountant can inspect all master lists. |
| **Add Client** | **YES** | `+ Add client` button visible above data table | Enforced (`canManageMasters: true`) | Accountant has permission to maintain business counterparties. |
| **Edit Client** | **YES** | Pencil icon button in row action column | Enforced (`clients` update policy) | Modal opens pre-filled with client contact details. |
| **Delete Client** | **YES** *(Soft-Delete)* | Red Trash icon button in row action column | Enforced via `soft_delete_record` RPC | Executes soft-deletion; audit log entry recorded. Dependent active projects block deletion. |
| **Add Employee** | **YES** | `+ Add employee` button visible above table | Enforced (`canManageMasters: true`) | Mandatory Staff Classification: Labour, Supervisor, Officer. |
| **Edit Employee** | **YES** | Pencil icon button in row action column | Enforced (`employees` update policy) | Can modify wage rates, wage type, status, OT rates. |
| **Delete Employee** | **YES** *(Soft-Delete)* | Red Trash icon button in row action column | Enforced via `soft_delete_record` RPC | Soft-deletes worker. Blocked if worker has historical attendance/wage rows. |
| **Filter Employees** | **YES** | Type (`Labour`, `Supervisor`, `Officer`, `Office Staff`) and Status (`Active`, `Inactive`) dropdowns | Client-side reactive filter | Allows instant filtering of roster. |
| **Add Contractor** | **YES** | `+ Add contractor` button visible above table | Enforced (`canManageMasters: true`) | Captures code, trade type, bank details, contact details. |
| **Edit Contractor** | **YES** | Pencil icon button in row action column | Enforced (`contractors` update policy) | Can update banking and active status. |
| **Delete Contractor** | **YES** *(Soft-Delete)* | Red Trash icon button in row action column | Enforced via `soft_delete_record` RPC | Soft-deletes contractor record. |
| **Filter Contractors** | **YES** | Trade dynamic dropdown and Status dropdown | Client-side reactive filter | Trade list auto-populated from unique trade entries. |
| **Add Supplier** | **YES** | `+ Add supplier` button visible above table | Enforced (`canManageMasters: true`) | Captures GSTIN, contact details, address. |
| **Edit Supplier** | **YES** | Pencil icon button in row action column | Enforced (`suppliers` update policy) | Can update address, GSTIN, and active status. |
| **Delete Supplier** | **YES** *(Soft-Delete)* | Red Trash icon button in row action column | Enforced via `soft_delete_record` RPC | Soft-deletes supplier record. |
| **Filter Suppliers** | **YES** | Status dropdown (`All Status`, `Active`, `Inactive`) | Client-side reactive filter | Allows quick isolation of inactive vendors. |
| **Add Machine** | **YES** | `+ Add machine` button visible above table | Enforced (`canManageMachines: true`) | `canWriteSite = true` grants machine management. |
| **Edit Machine** | **YES** | Pencil icon button in row action column | Enforced (`machines` update policy) | Machine code, name, and description. |
| **Delete Machine** | **YES** *(Soft-Delete)* | Red Trash icon button in row action column | Enforced via `soft_delete_record` RPC | Soft-deletes machine record. |
| **Job Types Tab** | **PARTIAL** | Tab trigger is visible in the tab bar | **UI INCOMPLETE / UNVERIFIED** | Tab content panel is missing from JSX (`<TabsContent value="job_types">` is not implemented). |
| **Export Master Reports** | **YES** | `Export CSV` / `Print` buttons on every master table | Client-side export helper | Exports cleanly formatted CSVs with applied filter tags. |

---

## 3. Test Data Pack

### A. Prerequisite Seed Data (Realistic Tamil Nadu Master Records)

Ensure the following seed records exist or are created first:

#### 1. Clients Seed Table
| Client Name | Contact Person | Phone | Email | Address |
| :--- | :--- | :--- | :--- | :--- |
| **Chennai Metro Rail Ltd (CMRL)** | Er. K. Rajendran | 9444123450 | rajendran.k@cmrl.gov.in | CMRL Depot, Poonamallee High Road, Koyambedu, Chennai 600107 |
| **TIDCO Industrial Parks** | Thiru S. Murugan | 9841023451 | murugan@tidco.tn.gov.in | No. 19, Rukmani Lakshmipathi Salai, Egmore, Chennai 600008 |
| **KG Foundations Pvt Ltd** | Rajesh Gnanavel | 9840134562 | rajesh@kgbuilders.in | 5th Floor, Marble Arch, 22 Bishop Garden, Raja Annamalaipuram, Chennai 600028 |

#### 2. Employees Seed Table
| Code | Full Name | Staff Classification | Payroll Category | Designation | Wage Type | Wage Rate (₹) | OT Rate (₹/hr) | Phone | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **EMP-001** | K. Karuppasamy | Labour | labour | Bar Bender (Head) | daily | 1,000.00 | 125.00 | 9789012345 | Active |
| **EMP-002** | M. Muthuvel | Labour | labour | Mason (First Class) | daily | 950.00 | 118.75 | 9842112346 | Active |
| **EMP-003** | R. Senthamizhan | Supervisor | labour | RCC Site Supervisor | monthly | 32,000.00 | 0.00 | 9443212347 | Active |
| **EMP-004** | Priya Balakrishnan | Officer | office | Junior Billing Engineer | monthly | 42,000.00 | 0.00 | 9840112348 | Active |

#### 3. Contractors Seed Table
| Code | Name | Trade / Type | Phone | Email | Bank Details | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **CON-001** | Madurai Meenakshi Civil Works | Masonry & Shuttering | 9842154321 | mmcivil@gmail.com | Canara Bank, A/C: 110023456789, IFSC: CNRB0001234 | Active |
| **CON-002** | Kongu Structural Fabrication | Steel & Welding | 9443154322 | kongusteel@yahoo.com | SBI, A/C: 30894561234, IFSC: SBIN0004567 | Active |
| **CON-003** | Pandian Electricals & Plumbing | Electrical | 9789154323 | pandian.elec@rediffmail.com | Indian Bank, A/C: 50012345678, IFSC: IDIB000M023 | Inactive |

#### 4. Suppliers Seed Table
| Supplier Name | GST Number (15-char) | Phone | Email | Address | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Dalmia Cement Agencies** | 33AAACD1234A1Z5 | 9444012341 | sales@dalmiatn.com | 142/1 Trichy Road, Ariyalur, Tamil Nadu 621704 | Active |
| **Cauvery Blue Metals & Aggregates** | 33ABCFG5678K1Z9 | 9842012342 | cauveryquarry@gmail.com | SF No 45, Paramathi Road, Namakkal 637001 | Active |
| **Tiruvallur Steels & TMT** | 33AABCT9988H1Z2 | 9789012343 | tmt@tiruvallursteels.in | NH 205 Bypass Road, Tiruvallur 602001 | Active |

#### 5. Machines Seed Table
| Machine Code | Machine Name | Description |
| :--- | :--- | :--- |
| **MCH-MIX-01** | Schwing Stetter 10/7 Concrete Mixer | Diesel engine driven tilting drum batch mixer |
| **MCH-JCB-02** | JCB 3DX Backhoe Loader | Earthmoving and trench excavation unit with 4x4 drive |
| **MCH-BAR-03** | Bar Bending Machine 32mm | Automatic electric rebar bending workbench |

---

### B. Form Test Data Sets

#### Form 1: Add/Edit Client Form
- **Valid Data Set:**
  | Field | Value to Type | Expected Behaviour |
  | :--- | :--- | :--- |
  | Client name * | **Tamil Nadu Urban Habitat Development Board** | Accepted |
  | Contact person | **Er. M. Sangeetha** | Accepted |
  | Phone | **9444567890** | Accepted (tel type) |
  | Email | **sangeetha.ee@tnuhdb.in** | Accepted (email type) |
  | Address | **No. 5, Kamarajar Salai, Triplicane, Chennai 600005** | Accepted (textarea) |
- **Invalid Data Set:**
  | Field | Value to Type | Expected Behaviour |
  | :--- | :--- | :--- |
  | Client name * | *(Leave blank)* | Form validation prevents submission. "Client name is required" |
  | Email | `invalid-email-address` | HTML5 email validation error stops submission. |
- **Boundary Data Set:**
  | Field | Value to Type | Expected Behaviour |
  | :--- | :--- | :--- |
  | Client name * | Single letter: `X` | Successfully creates record with 1-character name. |
  | Client name * | Very long name: 150 characters | Correctly wraps in table cell without UI overflow. |
  | Phone | Special chars: `+91 (044) 2854-1234` | Accepted as string. |

---

#### Form 2: Add/Edit Employee Form
- **Valid Data Set:**
  | Field | Value to Type | Expected Behaviour |
  | :--- | :--- | :--- |
  | Employee code * | **EMP-105** | Accepted (unique identifier) |
  | Full name * | **S. Thangaraj** | Accepted |
  | Staff Classification * | Select **Labour (Worker / Helper)** | Value `labour` saved |
  | Payroll category | Select **labour** | Value `labour` saved |
  | Designation | **Senior Mason** | Optional text accepted |
  | Wage type | Select **daily** | Accepted (`daily`, `monthly`, `hourly`) |
  | Wage rate (₹) * | **950.00** | Numeric value parsed to `950` |
  | OT rate (₹/hr) | **120.00** | Numeric value parsed to `120` |
  | Phone | **9841239876** | Accepted |
  | Status | Select **Active** | Boolean `true` |
  | Address | **45, Mariamman Koil Street, Salem 636001** | Multi-line text accepted |
- **Invalid Data Set:**
  | Field | Value to Type | Expected Behaviour |
  | :--- | :--- | :--- |
  | Employee code * | *(Leave blank)* | Validation blocks submission. |
  | Full name * | *(Leave blank)* | Validation blocks submission. |
  | Wage rate (₹) * | *(Leave blank or enter `-500`)* | If blank, blocks submission. If negative, accepted unless backend DB constraint catches it. |
- **Boundary Data Set:**
  | Field | Value to Type | Expected Behaviour |
  | :--- | :--- | :--- |
  | Wage rate (₹) | `0` | Saved as `₹0 / daily` (e.g. trainee or volunteer). |
  | Wage rate (₹) | Decimal: `1250.75` | Displays as `₹1,250.75 / daily`. |
  | OT rate (₹/hr) | *(Leave blank)* | Saved as `null`, displays as `—`. |
  | Status | Select **Inactive** | Displays grey `Inactive` badge; employee hidden when "Active" filter applied. |

---

#### Form 3: Add/Edit Contractor Form
- **Valid Data Set:**
  | Field | Value to Type | Expected Behaviour |
  | :--- | :--- | :--- |
  | Contractor code * | **CON-088** | Accepted |
  | Name * | **Coimbatore Precast Solutions** | Accepted |
  | Trade / type | **Precast & Pavers** | String accepted, adds new dynamic trade option to filter |
  | Phone | **9842233445** | Accepted |
  | Email | **contact@coimbatoreprecast.com** | Accepted |
  | Status | Select **Active** | Boolean `true` |
  | Bank details | **HDFC Bank, R.S. Puram, A/C: 50100234125678, IFSC: HDFC0000069** | Multi-line bank text accepted |
  | Address | **Sf No. 204, Thadagam Road, Coimbatore 641002** | Multi-line address accepted |
- **Invalid Data Set:**
  | Field | Value to Type | Expected Behaviour |
  | :--- | :--- | :--- |
  | Contractor code * | *(Leave blank)* | Validation blocks submission. |
  | Name * | *(Leave blank)* | Validation blocks submission. |
  | Email | `coimbatore-email-no-at` | Browser standard email validation triggers. |
- **Boundary Data Set:**
  | Field | Value to Type | Expected Behaviour |
  | :--- | :--- | :--- |
  | Trade / type | *(Leave blank)* | Displays `—` in table; does not break trade filter. |
  | Bank details | Special chars: `A/C # 1234 & 5678 (IFSC: ICIC0001); MICR: 600229002` | Stored and displayed cleanly without stripping formatting. |

---

#### Form 4: Add/Edit Supplier Form
- **Valid Data Set:**
  | Field | Value to Type | Expected Behaviour |
  | :--- | :--- | :--- |
  | Supplier name * | **Chettinad Cement Corporation Pvt Ltd** | Accepted |
  | GST number | **33AAACC1234M1Z8** | Valid 15-character Tamil Nadu GSTIN accepted |
  | Phone | **9443312345** | Accepted |
  | Email | **sales@chettinad.com** | Accepted |
  | Status | Select **Active** | Boolean `true` |
  | Address | **Rani Seethai Achi Building, 603 Anna Salai, Chennai 600006** | Accepted |
- **Invalid Data Set:**
  | Field | Value to Type | Expected Behaviour |
  | :--- | :--- | :--- |
  | Supplier name * | *(Leave blank)* | Required validation triggers. |
  | GST number | `12345` (5 chars) | **UNVERIFIED:** Form has no strict regex enforcing 15 characters; string saved as entered. |
- **Boundary Data Set:**
  | Field | Value to Type | Expected Behaviour |
  | :--- | :--- | :--- |
  | GST number | *(Leave blank)* | Supplier saved without GSTIN (unregistered vendor/composition dealer). Displays `—`. |
  | Status | Select **Inactive** | Vendor marked inactive; does not appear when filter is set to "Active". |

---

#### Form 5: Add/Edit Machine Form
- **Valid Data Set:**
  | Field | Value to Type | Expected Behaviour |
  | :--- | :--- | :--- |
  | Machine code | **MCH-GEN-04** | Optional code accepted |
  | Machine name * | **Kirloskar 62.5 kVA Silent DG Set** | Accepted |
  | Description | **Caterpillar powered standby diesel generator for site power** | Accepted |
- **Invalid Data Set:**
  | Field | Value to Type | Expected Behaviour |
  | :--- | :--- | :--- |
  | Machine name * | *(Leave blank)* | Required field blocks dialog submission. |
- **Boundary Data Set:**
  | Field | Value to Type | Expected Behaviour |
  | :--- | :--- | :--- |
  | Machine code | *(Leave blank)* | Saved with `null` code; displays `—` in table. |

---

## 4. Button-by-Button Guide

### Common Tab Bar
The top of the page displays a horizontal tab switcher with 6 tabs:
1. `Clients`
2. `Employees`
3. `Contractors`
4. `Suppliers`
5. `Machines`
6. `Job Types`

---

### TAB 1: CLIENTS

#### Action 1: Add Client Button (`+ Add client`)
- **Where It Is:** Above the Clients data table, top-left.
- **Preconditions:** None.
- **Data Set:** Use Form 1 Valid Set (`Tamil Nadu Urban Habitat Development Board`).
- **Steps:**
  1. Click `+ Add client`. A dialog titled "Add client" opens.
  2. Type `Tamil Nadu Urban Habitat Development Board` into **Client name**.
  3. Type `Er. M. Sangeetha` into **Contact person**.
  4. Type `9444567890` into **Phone**.
  5. Type `sangeetha.ee@tnuhdb.in` into **Email**.
  6. Type `No. 5, Kamarajar Salai, Triplicane, Chennai 600005` into **Address**.
  7. Click `Save`.
- **Expected Result on Save:**
  - Dialog closes.
  - Success toast appears: `"Client created"` (or `"Saved"`).
  - The new client appears alphabetically in the Clients table.
- **Expected Result on Cancel:**
  - Click `Cancel` (or click outside/press Escape).
  - Dialog closes without creating any record.
- **Expected Result on Invalid Data:**
  - Clear **Client name** and click `Save`.
  - Dialog remains open; required field tooltip/error highlights the name input.

#### Action 2: Edit Client Button (Pencil Icon)
- **Where It Is:** In the row action column on the right side of any client row.
- **Preconditions:** At least one client exists (e.g., `KG Foundations Pvt Ltd`).
- **Steps:**
  1. Locate the row for `KG Foundations Pvt Ltd`.
  2. Click the Pencil icon.
  3. Dialog opens titled "Edit client" with all current values pre-populated.
  4. Update **Phone** to `9840199999`.
  5. Click `Save`.
- **Expected Result on Save:**
  - Dialog closes.
  - Success toast: `"Client updated"`.
  - Phone column for `KG Foundations Pvt Ltd` immediately updates to `9840199999`.

#### Action 3: Delete Client Button (Trash Icon)
- **Where It Is:** Next to the Pencil icon in the row action column.
- **Preconditions:** Select a test client that has **no linked projects** (e.g., newly added `Tamil Nadu Urban Habitat Development Board`).
- **Steps:**
  1. Click the red Trash icon on the row.
  2. A modal dialog opens: `"Delete client"`.
  3. Description reads: `Delete client "Tamil Nadu Urban Habitat Development Board"? This action will be logged and the MD will be notified.`
  4. Click `Delete` (destructive button).
- **Expected Result on Confirm:**
  - Record is removed from the visible table.
  - Toast: `"Client deleted"`.
  - In Audit Log (`/audit`), a `DELETE` log entry is recorded under `clients` table by the accountant.
- **Expected Result when Client has Linked Projects:**
  - Try deleting `Chennai Metro Rail Ltd (CMRL)` which is assigned to active projects.
  - Backend foreign key constraint or RPC dependency check halts the action with an error toast: `"Cannot delete client with active project references"`.

---

### TAB 2: EMPLOYEES

#### Action 4: Add Employee Button (`+ Add employee`)
- **Where It Is:** Above the Employees table, top-left.
- **Preconditions:** None.
- **Data Set:** Use Form 2 Valid Set (`EMP-105`, `S. Thangaraj`, Labour, Daily, ₹950).
- **Steps:**
  1. Click the `Employees` tab.
  2. Click `+ Add employee`. Dialog titled "Add employee" opens.
  3. Notice default field values: `staff_type = labour`, `employee_type = labour`, `wage_type = daily`, `active = Active`.
  4. Enter `EMP-105` in **Employee code**.
  5. Enter `S. Thangaraj` in **Full name**.
  6. Verify **Staff Classification** is `Labour (Worker / Helper)`.
  7. Enter `Senior Mason` in **Designation**.
  8. Enter `950` in **Wage rate (₹)**.
  9. Enter `120` in **OT rate (₹/hr)**.
  10. Enter `9841239876` in **Phone**.
  11. Click `Save`.
- **Expected Result on Save:**
  - Dialog closes.
  - Toast: `"Employee created"`.
  - Row appears in table:
    - Code: `EMP-105`
    - Name: `S. Thangaraj`
    - Staff Type: Outline badge `Labour`
    - Type: `labour`
    - Designation: `Senior Mason`
    - Wage: `₹950.00 / daily`
    - Status: Green badge `Active`

#### Action 5: Filter Employees by Staff Type & Status
- **Where It Is:** Top-right controls above the Employees table.
- **Steps:**
  1. Click the **Type** dropdown (currently `All Types`).
  2. Select `Supervisor`.
  3. Table filters instantly to show only supervisors (e.g., `R. Senthamizhan`).
  4. Notice a **Reset** button appears with a counter-clockwise arrow icon.
  5. Select **Status** dropdown and change from `All Status` to `Inactive`.
  6. Table shows only Inactive Supervisors (or empty table if none exist).
  7. Click the **Reset** button.
  8. Filters return to `All Types` and `All Status`, and all employees reappear.

#### Action 6: Edit Employee Button (Pencil Icon)
- **Where It Is:** Row action column on the Employees table.
- **Steps:**
  1. Click Pencil icon on `EMP-105` (`S. Thangaraj`).
  2. Change **Wage rate (₹)** from `950` to `1000`.
  3. Change **OT rate (₹/hr)** to `130`.
  4. Click `Save`.
- **Expected Result:**
  - Wage updates to `₹1,000.00 / daily`.
  - Changes instantly reflect when marking daily attendance on `/attendance`.

#### Action 7: Delete Employee Button (Trash Icon)
- **Where It Is:** Row action column on the Employees table.
- **Steps:**
  1. Click Trash icon on `EMP-105`.
  2. Confirm dialog opens: `"Delete employee S. Thangaraj? This action will be logged and the MD will be notified."`
  3. Click `Delete`.
- **Expected Result:**
  - Record is soft-deleted.
  - Toast: `"Employee deleted"`.

---

### TAB 3: CONTRACTORS

#### Action 8: Add Contractor Button (`+ Add contractor`)
- **Where It Is:** Above the Contractors table, top-left.
- **Preconditions:** None.
- **Data Set:** Use Form 3 Valid Set (`CON-088`, `Coimbatore Precast Solutions`).
- **Steps:**
  1. Switch to `Contractors` tab.
  2. Click `+ Add contractor`. Dialog opens with default `Status = Active`.
  3. Enter `CON-088` in **Contractor code**.
  4. Enter `Coimbatore Precast Solutions` in **Name**.
  5. Enter `Precast & Pavers` in **Trade / type**.
  6. Enter `9842233445` in **Phone**.
  7. Enter `contact@coimbatoreprecast.com` in **Email**.
  8. Enter `HDFC Bank, R.S. Puram, A/C: 50100234125678, IFSC: HDFC0000069` in **Bank details**.
  9. Enter `Sf No. 204, Thadagam Road, Coimbatore 641002` in **Address**.
  10. Click `Save`.
- **Expected Result on Save:**
  - Dialog closes; toast `"Contractor created"`.
  - Row added to table with active badge.
  - The trade `Precast & Pavers` is automatically added to the **Trade** filter dropdown.

#### Action 9: Filter Contractors by Trade & Status
- **Where It Is:** Top-right controls above Contractors table.
- **Steps:**
  1. Click **Trade** filter dropdown.
  2. Notice options derived dynamically from existing contractor trades: `Masonry & Shuttering`, `Steel & Welding`, `Electrical`, `Precast & Pavers`.
  3. Select `Electrical`. Only `Pandian Electricals & Plumbing` displays.
  4. Click `Reset`. All contractors display.

#### Action 10: Edit & Delete Contractor
- **Steps:**
  1. Click Pencil icon to modify bank details or trade name.
  2. Click Trash icon to soft-delete unused contractor records.

---

### TAB 4: SUPPLIERS

#### Action 11: Add Supplier Button (`+ Add supplier`)
- **Where It Is:** Above the Suppliers table, top-left.
- **Preconditions:** None.
- **Data Set:** Use Form 4 Valid Set (`Chettinad Cement Corporation Pvt Ltd`).
- **Steps:**
  1. Switch to `Suppliers` tab.
  2. Click `+ Add supplier`. Dialog opens with default `Status = Active`.
  3. Enter `Chettinad Cement Corporation Pvt Ltd` in **Supplier name**.
  4. Enter `33AAACC1234M1Z8` in **GST number**.
  5. Enter `9443312345` in **Phone**.
  6. Enter `sales@chettinad.com` in **Email**.
  7. Enter `Rani Seethai Achi Building, 603 Anna Salai, Chennai 600006` in **Address**.
  8. Click `Save`.
- **Expected Result on Save:**
  - Dialog closes; toast `"Supplier created"`.
  - Row appears in table displaying Name, GSTIN, Phone, and Active status badge.

#### Action 12: Filter Suppliers by Status
- **Where It Is:** Top-right above the Suppliers table.
- **Steps:**
  1. Change Status from `All Status` to `Active` or `Inactive`.
  2. Click `Reset` to clear.

#### Action 13: Edit & Delete Supplier
- **Steps:**
  1. Click Pencil icon to update phone or GSTIN.
  2. Click Trash icon to soft-delete inactive or erroneous supplier records.

---

### TAB 5: MACHINES

#### Action 14: Add Machine Button (`+ Add machine`)
- **Where It Is:** Above the Machines table, top-left.
- **Preconditions:** None.
- **Data Set:** Use Form 5 Valid Set (`MCH-GEN-04`, `Kirloskar 62.5 kVA Silent DG Set`).
- **Steps:**
  1. Switch to `Machines` tab.
  2. Click `+ Add machine`.
  3. Enter `MCH-GEN-04` in **Machine code**.
  4. Enter `Kirloskar 62.5 kVA Silent DG Set` in **Machine name**.
  5. Enter `Standby diesel generator for site power` in **Description**.
  6. Click `Save`.
- **Expected Result on Save:**
  - Dialog closes; toast `"Machine created"`.
  - Machine table lists Code, Name, and Description.

#### Action 15: Edit & Delete Machine
- **Steps:**
  1. Click Pencil icon to edit machine specs.
  2. Click Trash icon to remove retired machinery.

---

### TAB 6: JOB TYPES

#### Action 16: Click `Job Types` Tab Trigger
- **Where It Is:** Far-right tab trigger in the top tab navigation bar.
- **Preconditions:** None.
- **Steps:**
  1. Click `Job Types` tab trigger.
- **Expected Result / Bug Observation:**
  - The tab activates, but the area below the tab bar displays **blank / empty space**.
  - **Reason:** In `src/routes/_authenticated/masters.tsx`, lines 516 defines `<TabsTrigger value="job_types">Job Types</TabsTrigger>`, but there is no corresponding `<TabsContent value="job_types">` block implemented in the file.
  - This is documented as an **UNVERIFIED / Incomplete Feature** in Section 9.

---

## 5. Edge-Case and Negative Tests

| ID | Field / Scenario | Exact Input / Action | Expected Result | Pass/Fail | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **EC-MST-01** | Client: Blank required name | Leave Client Name empty and submit | Form validation error stops submission | | Required field check |
| **EC-MST-02** | Client: Malformed email | Type `cmrl-finance.com` without `@` | Browser email validation halts submit | | HTML5 email validation |
| **EC-MST-03** | Employee: Missing Employee Code | Leave Employee Code blank | Form validation halts submit | | Required field check |
| **EC-MST-04** | Employee: Missing Wage Rate | Leave Wage Rate blank | Form validation halts submit | | Required field check |
| **EC-MST-05** | Employee: Negative wage rate | Type `-850` in Wage rate | Accepted by UI unless backend constraint catches it | | Review backend schema constraint |
| **EC-MST-06** | Employee: Zero wage rate | Type `0` in Wage rate | Accepted; displays `₹0.00 / daily` | | Valid for unpaid apprentices |
| **EC-MST-07** | Employee: High decimal wage | Type `1250.875` in Wage rate | Stored and formatted as `₹1,250.88 / daily` | | Rounding to 2 decimal places |
| **EC-MST-08** | Contractor: Blank name | Leave Name empty | Form validation halts submit | | Required field check |
| **EC-MST-09** | Contractor: Duplicate code | Use code `CON-001` which already exists | Backend unique constraint error toast | | Code uniqueness check |
| **EC-MST-10** | Supplier: Invalid GSTIN format | Enter `33ABC` (5 chars) | Stored as entered (no regex validation in UI) | | UI does not enforce 15-char regex |
| **EC-MST-11** | Supplier: Blank GSTIN | Leave GSTIN blank | Allowed; displays `—` | | Unregistered vendor case |
| **EC-MST-12** | Machine: Blank Machine Code | Leave Machine Code blank | Allowed; code displays as `—` | | Machine code is optional |
| **EC-MST-13** | Machine: Blank Machine Name | Leave Machine Name blank | Form validation halts submit | | Machine name is required |
| **EC-MST-14** | Delete Active Master Record | Delete client `CMRL` with active projects | Soft delete halts with dependency error toast | | Integrity constraint |
| **EC-MST-15** | Soft delete confirmation modal | Click Cancel in ConfirmDeleteDialog | Modal closes; record remains intact | | Safe cancel test |
| **EC-MST-16** | Export CSV with applied filter | Set Employee filter to `Supervisor`, click Export CSV | Generated CSV includes only Supervisors with applied filter tag | | Filtered export test |

---

## 6. Permission Tests

### Test PERM-MST-01: Accountant Master Management Verification
- **Goal:** Verify that the Accountant role has full access to add and edit master records.
- **Steps:**
  1. Log in as an Accountant (`role: "accounts"`).
  2. Navigate to `/masters`.
  3. Verify `+ Add client`, `+ Add employee`, `+ Add contractor`, `+ Add supplier`, and `+ Add machine` buttons are all visible and clickable.
  4. Verify Pencil (Edit) and Trash (Delete) icon buttons appear on every row.
- **Expected Result:**
  - All creation and edit controls are visible and operational.
  - In `src/lib/permissions.ts`, `accounts` has `canManageMasters: true` and `canWriteSite: true`.

### Test PERM-MST-02: Accountant Soft-Delete Permissions
- **Goal:** Verify backend execution when an Accountant triggers a deletion.
- **Steps:**
  1. Click Trash icon on an unused test supplier (e.g., `Chettinad Cement`).
  2. Confirm the deletion in the dialog.
- **Expected Result:**
  - Deletion succeeds via the `soft_delete_record` RPC function.
  - The migration `20261114000000_core_updates_and_powers.sql` explicitly permits `is_md() OR has_role(auth.uid(), 'accounts')` to soft-delete rows in `clients`, `employees`, `contractors`, `suppliers`, `machines`.

### Test PERM-MST-03: Direct Route Access
- **Goal:** Ensure direct access to `/masters` is granted for `accounts`.
- **Steps:**
  1. Paste `http://localhost:5173/masters` directly into the browser URL bar.
  2. Press Enter.
- **Expected Result:**
  - Page loads directly without redirection.

---

## 7. Cross-Page Checks

Whenever a master record is created, edited, or inactivated on the Masters page, its availability must update across operational modules:

### Check 1: Client Selection in Projects (`/projects`)
- **Action:** Add a new client `Tamil Nadu Urban Habitat Development Board` on `/masters`.
- **Verify on `/projects`:**
  1. Navigate to `/projects`.
  2. Click `+ New project`.
  3. Open the **Client** dropdown selector.
  4. Verify `Tamil Nadu Urban Habitat Development Board` is selectable in the dropdown list.

### Check 2: Employee in Attendance Muster (`/attendance`)
- **Action:** Add a new employee `EMP-105` (`S. Thangaraj`, Labour, ₹950/day) on `/masters`.
- **Verify on `/attendance`:**
  1. Navigate to `/attendance`.
  2. Open the Daily Muster for any active site.
  3. Verify `S. Thangaraj (EMP-105)` appears in the worker checklist.
  4. Mark Present with 1 Overtime hour.
  5. Verify wage calculation reflects `₹950.00` daily rate and `₹120.00` OT rate.

### Check 3: Contractor in Work Orders & Bills (`/contractors`)
- **Action:** Add contractor `Coimbatore Precast Solutions` on `/masters`.
- **Verify on `/contractors`:**
  1. Navigate to `/contractors`.
  2. Click `+ Issue work order`.
  3. Verify `Coimbatore Precast Solutions` is present in the Contractor dropdown.

### Check 4: Supplier in Purchase Orders (`/materials`)
- **Action:** Add supplier `Chettinad Cement Corporation Pvt Ltd` with GSTIN `33AAACC1234M1Z8` on `/masters`.
- **Verify on `/materials`:**
  1. Navigate to `/materials`.
  2. Click `+ Create purchase order`.
  3. Verify `Chettinad Cement Corporation Pvt Ltd` appears in the Supplier dropdown.
  4. Verify GSTIN automatically carries through to the Purchase Order document.

### Check 5: Deactivated Status Suppression
- **Action:** Edit contractor `Pandian Electricals` on `/masters` and set Status to **Inactive**.
- **Verify on Operational Pages:**
  1. Inactive contractor should be hidden or visually flagged as inactive in new Work Order creation dialogs, preventing accidental assignment to new jobs.

---

## 8. Test Results Checklist

| ID | Test Summary | Data Set Used | Expected Result | Actual Result | Pass/Fail | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-MST-01** | Access Masters page as Accountant | Direct navigation to `/masters` | Page loads with 6 tabs | | | |
| **TC-MST-02** | Add valid Client | Form 1 Valid Set (`TNUHDB`) | Client saved, appears in table | | | |
| **TC-MST-03** | Client required validation | Form 1 Invalid Set (Blank name) | Submission blocked | | | |
| **TC-MST-04** | Edit Client contact details | Form 1 Edit Set | Phone/Email updated immediately | | | |
| **TC-MST-05** | Delete unused Client | Form 1 Valid Set record | Soft-deleted, logged in audit | | | |
| **TC-MST-06** | Delete Client with active project | Seed CMRL Client | Deletion blocked with error toast | | | |
| **TC-MST-07** | Add valid Labour Employee | Form 2 Valid Set (`S. Thangaraj`) | Saved with daily wage basis | | | |
| **TC-MST-08** | Add Officer / Engineer Staff | Priya Balakrishnan | Saved with monthly wage basis | | | |
| **TC-MST-09** | Filter Employees by Staff Type | Type: `Supervisor` | Only supervisors shown in table | | | |
| **TC-MST-10** | Filter Employees by Status | Status: `Inactive` | Only inactive staff shown | | | |
| **TC-MST-11** | Reset Employee filters | Click Reset button | All employees reappear | | | |
| **TC-MST-12** | Edit Employee wage rate | Increase wage from ₹950 to ₹1000 | Table reflects new wage | | | |
| **TC-MST-13** | Add valid Contractor | Form 3 Valid Set (`Coimbatore Precast`) | Contractor saved with trade type | | | |
| **TC-MST-14** | Dynamic Trade Filter populated | Filter by `Precast & Pavers` | Only newly added contractor shown | | | |
| **TC-MST-15** | Add Supplier with valid 15-char GSTIN | Form 4 Valid Set (`Chettinad Cement`) | Supplier saved with GSTIN | | | |
| **TC-MST-16** | Add Supplier without GSTIN | Form 4 Boundary Set | Saved; GST column shows `—` | | | |
| **TC-MST-17** | Add Machine record | Form 5 Valid Set (`Kirloskar DG Set`) | Machine saved with code & specs | | | |
| **TC-MST-18** | Edit Machine specs | Modify description | Changes saved immediately | | | |
| **TC-MST-19** | Switch to `Job Types` tab | Click `Job Types` tab | Displays blank panel (Known bug) | | | See UNVERIFIED-01 |
| **TC-MST-20** | Export Employee Master to CSV | Filtered roster | Clean CSV downloaded with filters | | | |
| **TC-MST-21** | Cross-Page: Client in Projects | New client selected in `/projects` | Appears in dropdown picker | | | |
| **TC-MST-22** | Cross-Page: Supplier in POs | New supplier selected in `/materials` | Appears in PO supplier picker | | | |

---

## 9. Open Questions & UNVERIFIED Items

1. **[UNVERIFIED-01] Missing `<TabsContent value="job_types">` in UI:**
   - In `src/routes/_authenticated/masters.tsx`, line 516 renders `<TabsTrigger value="job_types">Job Types</TabsTrigger>`.
   - However, there is no corresponding `<TabsContent value="job_types">` block defined in the component. Clicking this tab renders an empty view even though the underlying table `job_types`, queries, and save hooks exist in lines 110–115.
   - *Recommendation:* Add the `TabsContent` markup for `job_types` with standard DataTable and FormDialog.

2. **[UNVERIFIED-02] GST Number Regex Validation on Suppliers:**
   - The Supplier form field `gst_number` is a generic text input without 15-character format validation (e.g., `33AAAAA0000A1Z5`). Invalid formats can currently be submitted unless restricted by database check constraints.

3. **[UNVERIFIED-03] Employee Negative Wage Rate Handling:**
   - The `wage_rate` field accepts negative numbers in the HTML input. Verify if backend schema constraints prevent saving negative wage values.
