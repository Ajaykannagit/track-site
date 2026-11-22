# Manual Test Guide: Reports & P&L (Accountant Role)

**Document ID:** `06-reports-accountant`  
**Page Name:** Reports & P&L (`/reports`)  
**Target User Role:** Accountant (`accounts`)  
**Verification Target:** Route access guard, UI navigation hiding, client-side permission lock, data query suppression, and permission test verification confirming that company Profit, Loss, and Margin data remain strictly MD-only.

---

## 1. Page Overview

- **Purpose:** Comprehensive executive profitability reporting: comparing total contract quotation values against accumulated costs (labor wages, material receipts, contractor works, and other site expenses) across customizable date ranges, calculating net profit and margin percentages at both the company-wide and single-project levels.
- **Menu Path:** In the left sidebar navigation menu, the link **"Reports & P&L"** is intended for the Managing Director (`md`). For the Accountant role (`accounts`), this link is **hidden from the navigation sidebar**.
- **Direct URL:** `http://localhost:5173/reports` (or hosted domain equivalent).
- **Route Guard & Security Boundary:**
  - In `src/lib/permissions.ts`, the Accountant role explicitly defines:
    ```typescript
    canViewProfitAndLoss: false // ← Accounts CANNOT see profit, loss or margin
    ```
  - In `src/components/AppShell.tsx`, the navigation link is filtered:
    ```typescript
    if (item.to === "/reports") return permissions.canViewProfitAndLoss;
    ```
  - In `src/routes/_authenticated/reports.tsx`, the page component executes an early security guard before running any data queries:
    ```typescript
    if (!permissions.canViewProfitAndLoss) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
          <Lock className="size-12 text-muted-foreground/40" />
          <div className="text-center">
            <h2 className="font-display text-xl font-bold">Restricted: MD Only</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Profit, loss and margin reports are visible only to the Managing Director.
            </p>
          </div>
        </div>
      );
    }
    ```
  - When an Accountant navigates directly to `/reports`, **zero financial queries are executed** (the hook queries for projects, expenses, attendance wages, receipts, and contractor bills are placed after this early return and do not fetch).

---

## 2. Access Matrix

| Action / Tab / Element | Accountant Allowed? | How It Shows in UI | Backend Enforced? (RLS / DB) |
| :--- | :---: | :--- | :--- |
| **Sidebar Navigation Link ("Reports & P&L")** | **No** | **Hidden** from left sidebar. Nav list filters `item.to === "/reports"` based on `canViewProfitAndLoss`. | Enforced in UI layout layer (`AppShell.tsx`). |
| **Direct URL Access (`/reports`)** | **Restricted** | Renders centered lock screen (`Lock` icon) with title: **"Restricted: MD Only"** and message: *"Profit, loss and margin reports are visible only to the Managing Director."* | Enforced by early component return guard. Underlying database queries are suppressed. |
| **P&L Metric Cards (Contract Value, Total Cost, Net Profit, Margin %)** | **No** | Completely hidden / unrendered for Accountant. | Guard stops execution prior to render. |
| **All Projects P&L Table** | **No** | Completely hidden / unrendered for Accountant. | No data rendered. |
| **Single Project Detailed Breakdown** | **No** | Completely hidden / unrendered for Accountant. | No data rendered. |
| **Print Complete P&L / Single Project P&L** | **No** | Print buttons and print layout unrendered. | No buttons present. |
| **Expense Breakdown by Category / Payment Method** | **No** | Completely hidden on this page. | (Accountant accesses raw expenses on `/accounts`, but aggregated P&L margins remain hidden). |
| **P&L Configuration Used (`app_settings`)** | **No** | Completely hidden on this page. | No data rendered. |

---

## 3. Test Data Pack

Because the Accountant is restricted from accessing the Reports & P&L page, the test data pack serves to verify the **access-lock behavior**, direct URL blocking, and comparing what an MD sees versus what an Accountant is prevented from seeing.

### A. Seed Data to Compare (When Logged in as MD vs. Accountant)
Ensure these representative project and cost records exist in your database:

#### 1. Projects & Contract Values
| Project Code | Project Name | Status | Contract Value / Quotation (₹) |
| :--- | :--- | :--- | :--- |
| `PRJ-637` | **Site 637** | `approved` | `₹15,00,000.00` (₹15 Lakhs) |
| `PRJ-3033` | **Site 3033** | `in_progress` | `₹8,50,000.00` (₹8.5 Lakhs) |

#### 2. Incurred Costs for Site 637
| Cost Category | Source Document | Incurred Cost (₹) |
| :--- | :--- | :--- |
| **Labour Wages** | Attendance Muster Roll (`attendance_view`) | `₹1,85,000.00` |
| **Materials Received** | Goods Receipt Notes (`material_receipts_view`) | `₹4,20,000.00` |
| **Contractor Works** | Net Contractor Bills (`contractor_bills`) | `₹3,15,000.00` |
| **Other Site Expenses** | Site Expenses (`expenses`) | `₹45,000.00` |
| **Total Incurred Cost** | Sum of above | **₹9,65,000.00** |
| **Expected Net Profit (MD Only)** | `₹15,00,000 - ₹9,65,000` | **+₹5,35,000.00** |
| **Expected Margin % (MD Only)** | `(5,35,000 / 15,00,000) × 100` | **35.7%** |

---

### B. Expected UI States

#### State 1: Accountant Logged In (Restricted State)
- **Sidebar:** Links visible: *Projects, Attendance, Contractors, Materials, Accounts, Audit, Masters, Settings*. Link **"Reports & P&L"** is **absent**.
- **Address Bar:** `http://localhost:5173/reports`
- **Center Canvas:**
  - Padlock icon (`Lock`) in muted gray.
  - Header: **"Restricted: MD Only"**
  - Subtext: *"Profit, loss and margin reports are visible only to the Managing Director."*
  - **Zero** tables, **zero** stat cards, **zero** filter pickers, **zero** print buttons.

#### State 2: Managing Director Logged In (Authorized State)
- **Sidebar:** Link **"Reports & P&L"** is visible.
- **Header:** Title *"Reports & P&L"*, subtitle *"Project-wise and company level profit & loss report across chosen date range."*
- **Action Buttons:** `"Print Complete P&L"`.
- **Stat Cards:** 4 cards showing *Contract value, Total cost, Net Profit (+₹5,35,000.00 | 35.7% profit margin), Unallocated cost*.
- **Tables:** Full interactive DataTable with columns: *Project, Code, Status, Contract value, Labour, Materials, Contractors, Other, Total cost, Profit, Margin %, Print*.

---

## 4. Button-by-Button Guide & Navigation Checks

### Action 1: Verify Absence of "Reports & P&L" from Navigation Sidebar
- **Location:** Left-hand navigation sidebar.
- **Preconditions:** User is logged in with role `accounts`.
- **Steps:**
  1. Look at the primary navigation menu on the left side of the screen.
  2. Read each navigation item in order:
     - `Projects`
     - `Attendance`
     - `Contractors`
     - `Materials`
     - `Accounts`
     - `Audit Log`
     - `Settings`
  3. Search for **"Reports & P&L"**.
- **Expected Result:**
  - The item **"Reports & P&L"** is **NOT** present in the menu.
  - The accountant cannot click or navigate to it from the UI navigation.

---

### Action 2: Direct URL Entry Test (`/reports`)
- **Location:** Browser address bar.
- **Steps:**
  1. Click into the browser address bar.
  2. Type the URL manually: `http://localhost:5173/reports` (or your staging/production URL).
  3. Press **Enter**.
- **Expected Result:**
  - The page does not crash.
  - The layout shell (top header, left navigation) remains functional.
  - The main content area does not render any P&L reports, cards, or tables.
  - A centered card displays:
    - Lock icon (`Lock` from lucide-react).
    - Heading: **"Restricted: MD Only"** (`font-display text-xl font-bold`).
    - Subtitle: *"Profit, loss and margin reports are visible only to the Managing Director."*
  - Open browser Developer Tools → Network tab:
    - Verify that no queries are dispatched to fetch company profit, margin, or contractor bill totals for this view.

---

### Action 3: Verify Single-Project P&L Isolation (Attempt Direct Parameter URL)
- **Location:** Browser address bar.
- **Steps:**
  1. Type URL attempting to pass project filters or deep links: `http://localhost:5173/reports?projectId=PRJ-637`.
  2. Press **Enter**.
- **Expected Result:**
  - The early guard check `if (!permissions.canViewProfitAndLoss)` triggers before any query parameters are evaluated.
  - The same **"Restricted: MD Only"** lock screen renders.
  - Project-level profit and margin remain inaccessible.

---

### Action 4: Verify Cross-Role Access (Compare with MD Login)
- **Location:** Authentication login / role switch.
- **Steps:**
  1. Log out of the `accounts` account.
  2. Log in as a user with the `md` role.
  3. Observe sidebar: **"Reports & P&L"** link is now visible with a chart icon (`BarChart3`).
  4. Click **Reports & P&L**.
  5. The full profitability dashboard renders:
     - Stat cards display Net Profit and Margin %.
     - All Projects P&L table shows Site 637 with Contract Value `₹15,00,000.00`, Total Cost `₹9,65,000.00`, Net Profit `₹5,35,000.00`, Margin `35.7%`.
     - Clicking **Print Complete P&L** triggers formal print preview.
  6. Log out and log back in as `accounts`.
  7. Return to `/reports` → Verify access returns immediately to the restricted lock screen.

---

## 5. Edge-Case and Negative Tests

| ID | Field / Scenario | Exact Action / URL | Expected Result |
| :--- | :--- | :--- | :--- |
| **EDG-REP-01** | Direct URL entry without navigation | Navigate directly to `/reports` | Centered lock screen: *"Restricted: MD Only"*. Zero financial tables shown. |
| **EDG-REP-02** | URL with project query parameter | Navigate to `/reports?project=PRJ-637` | Lock screen displayed. Parameter ignored. |
| **EDG-REP-03** | Browser Print shortcut on lock screen | Press `Ctrl + P` while on restricted screen | Prints the lock message: *"Restricted: MD Only"*. No hidden financial data appears in print CSS. |
| **EDG-REP-04** | Inspecting DOM elements | Inspect elements with DevTools | Confirm that P&L tables, stat cards, and totals are not rendered in the DOM (not merely hidden via `display: none`). |
| **EDG-REP-05** | Network tab inspection | Filter network requests on `/reports` | No API calls to `app_settings` for P&L rules or aggregate margin calculations are executed. |

---

## 6. Permission Tests

Execute these tests to confirm strict role-based separation between Accountant and Managing Director.

### Test PERM-REP-01: Accountant Role Permissions Check
1. Log in as **Accountant** (`accounts` role).
2. Open browser console and verify `useAuth().permissions`:
   - `canViewProfitAndLoss: false` (Verified)
   - `canViewMaterialContractorCosts: true` (Can see raw costs on `/contractors`, `/materials`, `/accounts`)
   - `canViewProjectFinancials: true` (Can see quotation amounts on `/projects`)
3. **Verify Business Policy:** While the accountant can see individual operational transactions (bills, receipts, expenses), the **aggregated executive profit, loss, and margin calculations** are strictly cordoned off.

### Test PERM-REP-02: Supervisor Role Comparison
1. Log in as **Supervisor** (`supervisor` role).
2. Navigate to `/reports`.
3. **Verify:** Supervisor also lacks `canViewProfitAndLoss`, and receives the identical **"Restricted: MD Only"** screen.

### Test PERM-REP-03: Managing Director Exclusive Access
1. Log in as **MD** (`md` role).
2. Navigate to `/reports`.
3. **Verify:** Full P&L dashboard loads without any restriction.

---

## 7. Cross-Page Checks

1. **Operational vs. Executive Financial Data Distinction:**
   - On `/projects/$projectId`, the accountant can view contract quotation values and project budgets (`canViewProjectFinancials = true`).
   - On `/contractors`, the accountant can view contractor bills and paid totals.
   - On `/materials`, the accountant can view PO values and receipt totals.
   - On `/accounts`, the accountant can view the Unified Ledger and cash positions.
   - **On `/reports`, however, the composite Profit & Loss and Net Margin percentages are strictly blocked.**

---

## 8. Test Results Checklist

| ID | Test Description | Role Used | Expected Result | Pass / Fail | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-REP-01** | Sidebar Navigation Link Check | `accounts` | Link "Reports & P&L" is completely hidden from the left navigation menu. | | |
| **TC-REP-02** | Direct URL Access Check | `accounts` | Navigating to `/reports` renders centered lock screen: "Restricted: MD Only". | | |
| **TC-REP-03** | Data Query Suppression | `accounts` | DevTools Network tab shows zero financial queries dispatched for P&L calculations. | | |
| **TC-REP-04** | DOM Inspection for Leaked Data | `accounts` | HTML inspection confirms tables and cards are unrendered, not merely hidden with CSS. | | |
| **TC-REP-05** | Browser Print Shortcut | `accounts` | Pressing `Ctrl + P` prints only the lock screen message; no financial data leaks. | | |
| **TC-REP-06** | Managing Director Authorized Access | `md` | Full P&L dashboard, stat cards, project tables, and print buttons render cleanly. | | |
| **TC-REP-07** | Supervisor Access Guard | `supervisor` | Supervisor is also blocked by the "Restricted: MD Only" screen. | | |

---

## 9. Open Questions, UNVERIFIED Items & Observations

1. **Client-Side vs. Route Gate:**
   - **Observation:** In `src/routes/_authenticated/reports.tsx`, the access check is performed inside the component body (`if (!permissions.canViewProfitAndLoss) return <LockScreen />`), rather than using the `<RequirePermission>` component wrapper or a route-level `beforeLoad` redirect.
   - **Effect:** The result is completely secure: the component returns immediately, preventing any React hooks or database queries from fetching P&L data. The user sees a clear, branded "Restricted: MD Only" screen rather than an abrupt redirect or broken page.
   - **Verification:** Fully confirmed from code lines 74–90 of `reports.tsx`.
