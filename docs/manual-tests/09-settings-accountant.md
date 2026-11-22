# Manual Test Guide: Settings (Accountant Role)

**Document ID:** `docs/manual-tests/09-settings-accountant.md`  
**Page Name:** Settings  
**Target Route:** `/_authenticated/settings` (Page URL: `/settings`)  
**Tester Persona:** Accountant (`role: "accounts"`)  
**Author:** QA Lead  
**Application:** Brickweld Construction Project Control Web App  

---

## 1. Page Overview

### Purpose
The **Settings** page governs user access control, permission assignment, application configuration parameters, and company corporate identity.

For the **Accountant** role (`accounts`), this page grants operational administrative authority to:
1. **View Profiles & Role Assignments:** Inspect all registered user profiles and granted role assignments across the entire organization.
2. **Assign Non-MD Roles:** Assign roles (`supervisor`, `accounts`, `viewer`) to existing users.
3. **Revoke Non-MD Roles:** Remove non-MD role assignments from users.
4. **Configure Application Parameters (`app_settings`):** Review and edit business configuration JSON objects, such as `attendance_rules`, `payroll_rules`, `pnl_rules`, `tax_rules`, `budget_categories`, and `work_order_conditions`.
5. **View Company Information:** Review Brickweld Pvt Ltd registered business details (read-only presentation card).

### Crucial Security & Access Boundaries for Accountant
- **MD Role Shielding (UI & Backend Enforced):**
  - In the UI, the `md` option is filtered out of the role dropdown when assigning roles.
  - If an accountant attempts to assign an `md` role, the UI halts with: `"Only the MD can assign the MD role."`
  - In the role assignments table, the red Trash icon is hidden on rows where `role === "md"`.
  - At the backend level (via RLS policy `user_roles_write_policy` from migration `20261120000001`), any INSERT, UPDATE, or DELETE on `user_roles` where `role = 'md'` is rejected unless the active session user is an MD (`public.is_md() = true`).

### How the Accountant Reaches This Page
- **Menu Path:** Click **Settings** in the main sidebar navigation (gear icon).
- **Direct URL:** Navigate to `http://localhost:5173/settings`.
- **Login Credentials:** Log in as an user assigned the `accounts` role (e.g., `accountant@brickweld.com`).

---

## 2. Access Matrix

| Action / Element | Accountant Allowed? | How It Shows in UI | Backend Enforced? (RLS Policy) | Notes |
| :--- | :---: | :--- | :--- | :--- |
| **Access Settings Page** | **YES** | Sidebar item visible; page loads directly | Authenticated access allowed | Unrestricted route access. |
| **Current Role Badge** | **YES** | Header badge displays: `You: Accountant` | Evaluated from `useAuth().roles` | Visual confirmation of current session privileges. |
| **View Users Table** | **YES** | Table lists all user profiles (`Name`, `Email`, `Phone`, `Roles`) | `profiles` & `user_roles` SELECT policies | Accountant can inspect roster. |
| **Assign Non-MD Role** | **YES** | `+ Assign role` button visible; dialog offers `supervisor`, `accounts`, `viewer` | Enforced via `user_roles_write_policy` | Accountant can delegate operational roles. |
| **Assign MD Role** | **NO** | Option `Managing Director` is **filtered out** of the role dropdown | Enforced via RLS (`role != 'md'`) | Hard security boundary. Even if injected, RLS rejects. |
| **Revoke Non-MD Role** | **YES** | Red Trash icon visible on rows where `role !== "md"` | Enforced via `user_roles_write_policy` | Accountant can revoke staff access. |
| **Revoke MD Role** | **NO** | Trash icon is **omitted** on rows where `role === "md"` | Enforced via `user_roles_write_policy` | Protected row; accountant cannot demote MD. |
| **View App Settings** | **YES** | `App settings` tab displays key-value JSON table | `app_settings` SELECT policy | Can inspect all rule presets. |
| **Edit App Settings** | **YES** | `Edit` button visible on every setting row | Enforced via `settings_write_policy` | Updates require valid JSON. |
| **View Company Info** | **YES** | `Company info` tab displays corporate details | Static UI presentation card | Read-only details (Hosur registered office). |
| **Export Users Report** | **YES** | Export CSV / Print buttons above Users table | Client-side export helper | Clean CSV generation. |
| **Export Roles Report** | **YES** | Export CSV / Print buttons above Role Assignments | Client-side export helper | Clean CSV generation. |

---

## 3. Test Data Pack

### A. Prerequisite Seed Data

Ensure the following user accounts and settings exist in the system:

#### 1. User Profiles Seed Table
| Full Name | Email Address | Phone Number | Current Role(s) |
| :--- | :--- | :--- | :--- |
| **Rajesh Gnanavel** | `rajesh@brickweld.org.in` | `+91-9742255005` | Managing Director (`md`) |
| **Sundaram Ramakrishnan** | `accountant@brickweld.com` | `9840112233` | Accountant (`accounts`) *(Current Tester)* |
| **K. Senthil Kumar** | `senthil.site@brickweld.com` | `9444155667` | Site Supervisor (`supervisor`) |
| **M. Vignesh** | `vignesh.junior@brickweld.com` | `9789044556` | Viewer (`viewer`) |
| **Anitha Subramanian** | `anitha.new@brickweld.com` | `9842188990` | *No role assigned* (New hire) |

#### 2. App Settings Seed Table
| Key | Seed Value (JSON) | Description |
| :--- | :--- | :--- |
| `attendance_rules` | `{"standard_working_hours": 8, "half_day_hours": 4, "ot_minimum_hours": 1}` | Attendance cutoff and OT hours |
| `payroll_rules` | `{"ot_applicable_for_office": false, "ot_multiplier": null, "standard_working_hours_per_day": 8, "half_day_factor": 0.5, "monthly_working_days": null}` | Configurable wage/OT rules |
| `tax_rules` | `{"default_po_tax_percent": 18}` | Default purchase order GST rate |
| `budget_categories` | `["material", "labour", "contractor", "other"]` | Configurable budget categories |

---

### B. Form Test Data Sets

#### Form 1: Assign Role Form
- **Valid Data Set (Supervisor Assignment):**
  | Field | Value to Select | Expected Behaviour |
  | :--- | :--- | :--- |
  | User * | `Anitha Subramanian (anitha.new@brickweld.com)` | Selected user |
  | Role * | `Site Supervisor` (`supervisor`) | Valid role selected |
- **Valid Data Set (Secondary Role Assignment):**
  | Field | Value to Select | Expected Behaviour |
  | :--- | :--- | :--- |
  | User * | `M. Vignesh (vignesh.junior@brickweld.com)` | Existing user |
  | Role * | `Accountant` (`accounts`) | Grants dual role; both badges appear in table |
- **Invalid Data Set:**
  | Field | Value to Select | Expected Behaviour |
  | :--- | :--- | :--- |
  | User * | *(Leave unselected)* | Validation halts submission. |
  | Role * | *(Leave unselected)* | Validation halts submission. |
- **Security Boundary Set (MD Role Assignment Bypass Test):**
  | Field | Value to Select | Expected Behaviour |
  | :--- | :--- | :--- |
  | User * | `Anitha Subramanian` | Selected |
  | Role * | `Managing Director` | **NOT PRESENT** in dropdown. (Dropdown only shows: Site Supervisor, Accountant, Viewer). |

---

#### Form 2: Edit Application Setting Form
- **Valid Data Set (`tax_rules` update):**
  | Setting Key | Field | Value to Type | Expected Behaviour |
  | :--- | :--- | :--- | :--- |
  | `tax_rules` | Value (JSON) * | `{"default_po_tax_percent": 18}` | Parses as valid JSON; saved successfully |
  | `tax_rules` | Description | `Standard GST rate for material POs in Tamil Nadu` | Updated description saved |
- **Valid Data Set (`attendance_rules` update):**
  | Setting Key | Field | Value to Type | Expected Behaviour |
  | :--- | :--- | :--- | :--- |
  | `attendance_rules` | Value (JSON) * | `{"standard_working_hours": 8, "half_day_hours": 4, "ot_minimum_hours": 2}` | JSON parsed; changes OT threshold to 2 hours |
  | `attendance_rules` | Description | `Site labor attendance parameters` | Description saved |
- **Invalid Data Set (Malformed JSON):**
  | Setting Key | Field | Value to Type | Expected Behaviour |
  | :--- | :--- | :--- | :--- |
  | `tax_rules` | Value (JSON) * | `{default_po_tax_percent: 18` *(missing quote and bracket)* | Error toast: `"Value is not valid JSON"`; submission blocked |
  | `tax_rules` | Value (JSON) * | `True` *(capitalized unquoted string)* | Error toast: `"Value is not valid JSON"` |
- **Boundary Data Set:**
  | Setting Key | Field | Value to Type | Expected Behaviour |
  | :--- | :--- | :--- | :--- |
  | `payroll_rules` | Value (JSON) * | `null` | Allowed; parses as JSON `null` |
  | `budget_categories` | Value (JSON) * | `[]` *(empty array)* | Allowed; valid JSON array |
  | `custom_flag` | Value (JSON) * | `true` *(boolean)* | Allowed; valid JSON boolean |

---

## 4. Button-by-Button Guide

### Header Area
- **Page Title:** "Settings"
- **Page Description:** "Role-based access and business configuration."
- **Badge Indicator (Top-Right):** Displays `You: Accountant`. Confirms role is recognized by `useAuth()`.

---

### TAB 1: USERS & ROLES (`TabsContent value="roles"`)

#### Card 1: Users
Contains the complete list of registered users in the database (`DataTable`).

- **Columns:**
  1. `Name`: Full name of user.
  2. `Email`: Email address or `—`.
  3. `Phone`: Phone number or `—`.
  4. `Roles`: Badges indicating assigned roles (`Managing Director` has primary default badge; `Accountant`, `Site Supervisor`, `Viewer` have secondary badges. Users with no role display grey text: `No role`).

#### Action 1: Assign Role Button (`+ Assign role`)
- **Where It Is:** Top-right header of the **Users** card.
- **Preconditions:** At least one profile exists in the system without all roles (e.g., `Anitha Subramanian`).
- **Data Set:** Use Form 1 Valid Set (`Anitha Subramanian`, `Site Supervisor`).
- **Steps:**
  1. Click `+ Assign role`.
  2. Dialog opens: Title `"Assign role"`, description `"Grant a role to an existing user."`
  3. Click the **User** select box.
  4. Select `Anitha Subramanian (anitha.new@brickweld.com)`.
  5. Click the **Role** select box.
  6. **Security Observation:** Confirm that only three options appear:
     - `Site Supervisor`
     - `Accountant`
     - `Viewer`
     *(Verify `Managing Director` is NOT listed).*
  7. Select `Site Supervisor`.
  8. Click `Save`.
- **Expected Result on Save:**
  - Dialog closes.
  - Toast message: `"Role saved"` (or `"Role assigned"`).
  - In the **Users** table, `Anitha Subramanian` now displays a `Site Supervisor` badge.
  - In the **Role assignments** card below, a new row appears with:
    - User: `Anitha Subramanian`
    - Role: `Site Supervisor`
    - Granted: Current date & time (e.g., `20/11/2026, 10:05 pm`)
    - Action: Red Trash icon.
- **Expected Result on Cancel:**
  - Dialog closes without creating any record.

---

#### Card 2: Role Assignments
Contains the table of individual role grant records (`DataTable`).

- **Columns:**
  1. `User`: Name of the user holding the role.
  2. `Role`: Formatted role name (`Managing Director`, `Accountant`, `Site Supervisor`, `Viewer`).
  3. `Granted`: Timestamp of role grant formatted via `dateTimeFmt`.
  4. `Actions`: Trash icon for role removal.

#### Action 2: Remove Non-MD Role (Trash Icon Button)
- **Where It Is:** Action column on any non-MD role assignment row (e.g., `Site Supervisor` for `Anitha Subramanian`).
- **Preconditions:** A non-MD role assignment exists.
- **Steps:**
  1. Locate the row granting `Site Supervisor` to `Anitha Subramanian`.
  2. Verify the red Trash icon is visible and active.
  3. Click the Trash icon.
  4. Confirmation dialog opens: Title `"Remove role assignment"`, Description: `"Are you sure you want to remove the Site Supervisor role from Anitha Subramanian?"`
  5. Click `Delete` (red destructive confirm button).
- **Expected Result on Confirm:**
  - Toast: `"Role removed"`.
  - The row disappears from the **Role assignments** table.
  - In the **Users** table above, the badge `Site Supervisor` is removed from `Anitha Subramanian`. If she holds no other roles, her role column displays `No role`.
- **Expected Result on Cancel:**
  - Click `Cancel` in the dialog. Dialog closes; role remains active.

#### Action 3: Verify MD Role Protection (Absence of Trash Icon)
- **Where It Is:** Action column on the row for `Managing Director` (held by `Rajesh Gnanavel`).
- **Steps:**
  1. Locate the row where User is `Rajesh Gnanavel` and Role is `Managing Director`.
  2. Inspect the **Actions** column on that specific row.
- **Expected Result:**
  - The cell is **completely blank**. No Trash icon or button is rendered.
  - **Reason:** `settings.tsx` line 229 explicitly checks: `canManageRoles && (isMD || r.role !== "md")`. Since the current user is an Accountant (`isMD = false`), the delete button is suppressed.

---

### TAB 2: APP SETTINGS (`TabsContent value="config"`)

Contains the configuration parameters table (`DataTable`).

- **Columns:**
  1. `Key`: Configuration key string (e.g., `tax_rules`, `attendance_rules`).
  2. `Value`: JSON formatted in an inline code box `<code className="text-xs">`.
  3. `Description`: Human-readable summary of what the rule controls.
  4. `Updated`: Timestamp of last edit.
  5. `Actions`: Outline `Edit` button.

#### Action 4: Edit Application Setting (`Edit` Button)
- **Where It Is:** In the rightmost column of any setting row (e.g., `tax_rules`).
- **Preconditions:** Setting row exists.
- **Data Set:** Use Form 2 Valid Set (`tax_rules`).
- **Steps:**
  1. Click the `App settings` tab.
  2. Find the row with Key `tax_rules`. Current value is `{"default_po_tax_percent": 0}`.
  3. Click the `Edit` button.
  4. Modal opens titled `"Edit tax_rules"`. Description: `"Value must be valid JSON (for example 8, true, or {\"rate\": 500})."`
  5. In **Value (JSON)** textarea, replace content with:
     ```json
     {"default_po_tax_percent": 18}
     ```
  6. In **Description** text input, type:
     `Standard GST rate for material POs in Tamil Nadu`
  7. Click `Save`.
- **Expected Result on Save:**
  - Dialog closes.
  - Toast message: `"Setting saved"`.
  - The row immediately displays updated JSON: `{"default_po_tax_percent":18}`.
  - Description column displays: `Standard GST rate for material POs in Tamil Nadu`.
  - Updated timestamp reflects the current time.
- **Expected Result on Malformed JSON:**
  1. Click `Edit` on `tax_rules`.
  2. Type `{broken_json: true` in the textarea.
  3. Click `Save`.
  4. Error toast appears: `"Value is not valid JSON"`.
  5. Dialog stays open, allowing the tester to correct the syntax.

---

### TAB 3: COMPANY INFO (`TabsContent value="company"`)

Displays corporate contact details and registered office location in a 2-column grid.

#### Action 5: Inspect Company Information Presentation
- **Where It Is:** `Company info` tab.
- **Steps:**
  1. Click the `Company info` tab.
  2. Verify the 4 cards/data blocks displayed:
     - **Company name:** `Brickweld Pvt Ltd` / `Civil - Interior - Fabrication`
     - **Phone number:** `+91-9742255005`
     - **Email address:** `rajesh@brickweld.org.in`
     - **Registered address:** `No.106/A, G.K.D.Nagar, Sri Dhasappa Kalyana Mandapam, Avalapalli Road, Hosur, Tamil Nadu 635109`
- **Expected Result:**
  - All company information renders clearly.
  - This is a presentation tab; no input fields, edit buttons, or delete buttons are present.

---

## 5. Edge-Case and Negative Tests

| ID | Field / Scenario | Exact Input / Action | Expected Result | Pass/Fail | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **EC-SET-01** | Assign role: Missing user selection | Open Assign Role, select Role without selecting User | Validation prevents submit | | User dropdown required |
| **EC-SET-02** | Assign role: Missing role selection | Select User without selecting Role | Validation prevents submit | | Role dropdown required |
| **EC-SET-03** | Assign role: Duplicate role assignment | Assign `Site Supervisor` to user who already has `Site Supervisor` | Backend handles or primary key constraint halts duplicate | | Check unique constraint `(user_id, role)` |
| **EC-SET-04** | Security: MD role dropdown filtering | Inspect role dropdown in Assign Role | `Managing Director` option is absent | | UI roleOptionsFiltered check |
| **EC-SET-05** | Security: Injected MD role submission | Attempt to send payload `{ user_id: "...", role: "md" }` | UI toast: `"Only the MD can assign the MD role."`; Backend RLS halts submit | | Dual-layer protection |
| **EC-SET-06** | Security: Revoke MD role button absence | Inspect row action column for MD role | Button is completely omitted from DOM | | Row-level conditional check |
| **EC-SET-07** | Security: Injected MD role delete call | Attempt delete mutation with MD role ID | Mutation error: `"Only the MD can modify or delete the MD role."` | | Client mutation check line 62 |
| **EC-SET-08** | App Settings: Non-JSON plain text | Type `hello world` in JSON textarea | Error toast: `"Value is not valid JSON"` | | JSON.parse validation |
| **EC-SET-09** | App Settings: Number value | Type `45` in JSON textarea | Valid JSON number; saves as integer `45` | | Valid JSON primitive |
| **EC-SET-10** | App Settings: Boolean value | Type `false` in JSON textarea | Valid JSON boolean; saves as `false` | | Valid JSON primitive |
| **EC-SET-11** | App Settings: Empty string value | Type `""` in JSON textarea | Valid JSON string; saves as `""` | | Valid JSON string |
| **EC-SET-12** | App Settings: Clear description | Clear description input and save | Description updates to `null`, displays as `—` | | Optional field handling |
| **EC-SET-13** | Accountant self-role modification | Accountant assigns themselves `Site Supervisor` role | Role added; `refreshRoles()` called; header badge updates | | Self-role grant test |
| **EC-SET-14** | Export Users Report | Click Export CSV on Users table | Downloads `users-and-roles.csv` | | Export verification |
| **EC-SET-15** | Export Role Assignments Report | Click Export CSV on Role assignments table | Downloads `brickweld-role-assignments.csv` | | Export verification |

---

## 6. Permission & Security Tests

### Test PERM-SET-01: Accountant Administrative Authority
- **Goal:** Verify that the Accountant role has permission to access Settings and manage non-MD roles.
- **Steps:**
  1. Log in as `accountant@brickweld.com`.
  2. Navigate to `/settings`.
  3. Verify no warning banner `"Only an MD or Accountant can change roles..."` is displayed.
  4. Verify the `+ Assign role` button is visible.
- **Expected Result:**
  - Full administrative controls are accessible because `canManageRoles = isMD || permissions.canManageUsers` evaluates to `true` (`permissions.canManageUsers: true` for `accounts`).

### Test PERM-SET-02: Backend RLS MD Assignment Rejection
- **Goal:** Confirm that even if an attacker tampers with the client-side JavaScript to submit `role: "md"`, Supabase RLS rejects the write.
- **Steps:**
  1. Simulate or execute a Supabase insert query from the accountant session:
     ```javascript
     supabase.from("user_roles").insert({ user_id: "<some_id>", role: "md" })
     ```
- **Expected Result:**
  - Supabase returns error code `42501` (Row-Level Security violation).
  - The policy `user_roles_write_policy` requires: `public.is_md() OR (public.has_role(auth.uid(), 'accounts') AND role != 'md')`.
  - Since `role == 'md'`, the policy condition evaluates to `false` and Postgres rejects the transaction.

### Test PERM-SET-03: Backend RLS MD Role Deletion Rejection
- **Goal:** Confirm that Supabase RLS prevents an Accountant from deleting an existing MD role record.
- **Steps:**
  1. Attempt a delete call targeting the MD role record ID:
     ```javascript
     supabase.from("user_roles").delete().eq("id", "<md_role_id>")
     ```
- **Expected Result:**
  - Deletion fails with RLS permission error. MD role cannot be revoked by anyone other than an MD.

---

## 7. Cross-Page Checks

Role assignments made on the Settings page must instantly propagate to the target user's session and permissions:

### Check 1: Supervisor Role Grant Propagation
- **Action:** On `/settings`, assign `Site Supervisor` (`supervisor`) role to `Anitha Subramanian`.
- **Verification on Target Account:**
  1. Log out and log in as `anitha.new@brickweld.com`.
  2. Verify the navigation sidebar now displays:
     - `Attendance` (Daily Muster & Weekly Grid)
     - `Materials` (Indents & GRNs)
     - `Contractors` (Measurement Books)
  3. Verify `Reports` and `Accounts` remain restricted or hidden according to supervisor role definitions.

### Check 2: Revocation of Role
- **Action:** On `/settings`, revoke `Site Supervisor` role from `Anitha Subramanian`.
- **Verification on Target Account:**
  1. Refresh or re-log as `anitha.new@brickweld.com`.
  2. The site management navigation items disappear; user returns to restricted or default viewer state.

### Check 3: Purchase Order Tax Default (`tax_rules`)
- **Action:** On `/settings` > `App settings`, update `tax_rules` to:
  `{"default_po_tax_percent": 18}`.
- **Verification on Materials Page (`/materials`):**
  1. Navigate to `/materials`.
  2. Click `+ Create purchase order`.
  3. Inspect the default GST / Tax rate dropdown or pre-filled percentage.
  4. Verify the new Purchase Order defaults to `18%`.

---

## 8. Test Results Checklist

| ID | Test Summary | Data Set Used | Expected Result | Actual Result | Pass/Fail | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-SET-01** | Access Settings as Accountant | URL `/settings` | Page loads, header badge says `You: Accountant` | | | |
| **TC-SET-02** | View Users list | Profile seed data | All users displayed with current role badges | | | |
| **TC-SET-03** | Verify MD option excluded from Assign Role | Assign Role dialog | Dropdown contains only Supervisor, Accountant, Viewer | | | |
| **TC-SET-04** | Assign Supervisor role to user | Anitha Subramanian | Role assigned; badge appears in Users table | | | |
| **TC-SET-05** | Assign Accountant role to user | M. Vignesh | Dual role granted; both badges appear | | | |
| **TC-SET-06** | Remove non-MD role assignment | Anitha Subramanian | Confirmation modal confirms; role removed | | | |
| **TC-SET-07** | MD role row has no Trash icon | Rajesh Gnanavel (MD) | Delete button is absent from action cell | | | |
| **TC-SET-08** | Switch to App settings tab | `App settings` tab | Displays table of configuration keys and JSON | | | |
| **TC-SET-09** | Edit setting with valid JSON | `tax_rules` update | Setting saved; JSON updated in table | | | |
| **TC-SET-10** | Edit setting with invalid JSON | Broken JSON `{foo: 1` | Toast: `"Value is not valid JSON"`; save blocked | | | |
| **TC-SET-11** | Switch to Company info tab | `Company info` tab | Displays Hosur address and corporate details | | | |
| **TC-SET-12** | Export Users table to CSV | Export button | `users-and-roles.csv` generated | | | |
| **TC-SET-13** | Export Role assignments to CSV | Export button | `brickweld-role-assignments.csv` generated | | | |
| **TC-SET-14** | Cross-Page: Role propagation | Grant supervisor | Target user gains attendance and materials menu | | | |
| **TC-SET-15** | Cross-Page: PO tax default | Update `tax_rules` | Default tax applies in new Purchase Order dialog | | | |

---

## 9. Open Questions & UNVERIFIED Items

1. **[UNVERIFIED-01] Company Information Card is Hardcoded:**
   - In `src/routes/_authenticated/settings.tsx` (lines 305–343), the **Company information** card hardcodes Brickweld Pvt Ltd details directly in JSX, while an `app_settings` key named `company_info` also exists in database migrations (`20260918040000_production_enhancements.sql`).
   - Editing `company_info` in the App Settings tab currently does not dynamically update the Company Info tab card.
   - *Recommendation:* Connect the Company Info card to read and write directly to `app_settings.company_info` so the MD or Accountant can update company contact details dynamically.

2. **[UNVERIFIED-02] Duplicate Role Assignment Constraint Handling:**
   - When granting a role that the user already possesses (e.g. assigning `Site Supervisor` to a user who already has it), verify whether a user-friendly toast message is displayed or if a raw database unique constraint error code surfaces.
