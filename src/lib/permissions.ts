export type AppRole = "md" | "supervisor" | "accounts" | "viewer";

export interface RolePermissions {
  // Dashboard & Company Level
  canViewCompanyFinancials: boolean; // Profit/Loss, Dashboard contract value & spend
  canViewCompanyCashOnHand: boolean; // Company-wide cash on hand & cash balance (MD only)
  canViewOfficeExpense: boolean;     // Office expense details & receipts (Accountant sees own, MD sees all)
  canManageUsers: boolean;           // User and role management in settings (MD only)
  canViewAuditLog: boolean;          // MD-only: audit trail and deleted-items restore

  // P&L — MD-only. Accounts keeps access to payments, bills, supplier/contractor costs and
  // client receipts (they need them for their job), but NO profit, loss or margin figure and
  // NO P&L page anywhere. Change the single value below if the MD wants accounts to also
  // lose cost totals.
  canViewProfitAndLoss: boolean;     // MD only: Profit/Loss/Margin figures and Reports page

  // Projects & Master Records
  canViewProjects: boolean;
  canViewProjectFinancials: boolean; // Contract value, quotation amount, project costs on project screens
  canManageQuotations: boolean;
  canManageMasters: boolean;         // Add/edit workers, contractors, clients, suppliers

  // Attendance & Wages
  canEnterAttendance: boolean;       // in/out time, site, leave
  canViewWagesAndPayments: boolean;  // wage per day, bus/petrol, advance, balance, team totals

  // Workers & Profiles
  canViewWorkerProfiles: boolean;
  canViewWorkerFinancials: boolean;

  // Materials & Contractors
  canViewMaterialsAndContractors: boolean;
  canViewMaterialContractorCosts: boolean;
}

/**
 * Centralized Role Permissions Matrix.
 * Configurable in one single location.
 */
export const ROLE_PERMISSIONS: Record<AppRole, RolePermissions> = {
  md: {
    canViewCompanyFinancials: true,
    canViewCompanyCashOnHand: true,
    canViewOfficeExpense: true,
    canManageUsers: true,
    canViewAuditLog: true,
    canViewProfitAndLoss: true,
    canViewProjects: true,
    canViewProjectFinancials: true,
    canManageQuotations: true,
    canManageMasters: true,
    canEnterAttendance: true,
    canViewWagesAndPayments: true,
    canViewWorkerProfiles: true,
    canViewWorkerFinancials: true,
    canViewMaterialsAndContractors: true,
    canViewMaterialContractorCosts: true,
  },
  accounts: {
    canViewCompanyFinancials: false, // MD-only high-level earnings/spend dashboard
    canViewCompanyCashOnHand: false, // MD-only company-wide cash balance
    canViewOfficeExpense: true,      // Accountant can view and enter office expenses
    canManageUsers: false,           // Strictly MD-only: cannot assign roles or supervisors
    canViewAuditLog: false,
    canViewProfitAndLoss: false,     // ← Accounts CANNOT see profit, loss or margin
    canViewProjects: true,
    canViewProjectFinancials: true,
    canManageQuotations: true,
    canManageMasters: true,          // Accountant can add & maintain worker, contractor & supplier records
    canEnterAttendance: true,
    canViewWagesAndPayments: true,
    canViewWorkerProfiles: true,
    canViewWorkerFinancials: true,
    canViewMaterialsAndContractors: true,
    canViewMaterialContractorCosts: true,
  },
  supervisor: {
    canViewCompanyFinancials: false,
    canViewCompanyCashOnHand: false,
    canViewOfficeExpense: false,
    canManageUsers: false,
    canViewAuditLog: false,
    canViewProfitAndLoss: false,
    canViewProjects: true,
    canViewProjectFinancials: false,
    canManageQuotations: false,
    canManageMasters: false,
    canEnterAttendance: true,
    canViewWagesAndPayments: false,
    canViewWorkerProfiles: true,
    canViewWorkerFinancials: false,
    canViewMaterialsAndContractors: true,
    canViewMaterialContractorCosts: false,
  },
  viewer: {
    canViewCompanyFinancials: false,
    canViewCompanyCashOnHand: false,
    canViewOfficeExpense: false,
    canManageUsers: false,
    canViewAuditLog: false,
    canViewProfitAndLoss: false,
    canViewProjects: true,
    canViewProjectFinancials: false,
    canManageQuotations: false,
    canManageMasters: false,
    canEnterAttendance: false,
    canViewWagesAndPayments: false,
    canViewWorkerProfiles: false,
    canViewWorkerFinancials: false,
    canViewMaterialsAndContractors: false,
    canViewMaterialContractorCosts: false,
  },
};

export function getEffectivePermissions(roles: AppRole[]): RolePermissions {
  // If no role assigned, default to viewer permissions
  if (!roles || roles.length === 0) {
    return { ...ROLE_PERMISSIONS.viewer };
  }

  // Combine permissions across all roles the user has (OR logic)
  const combined: RolePermissions = {
    canViewCompanyFinancials: false,
    canViewCompanyCashOnHand: false,
    canViewOfficeExpense: false,
    canManageUsers: false,
    canViewAuditLog: false,
    canViewProfitAndLoss: false,
    canViewProjects: false,
    canViewProjectFinancials: false,
    canManageQuotations: false,
    canManageMasters: false,
    canEnterAttendance: false,
    canViewWagesAndPayments: false,
    canViewWorkerProfiles: false,
    canViewWorkerFinancials: false,
    canViewMaterialsAndContractors: false,
    canViewMaterialContractorCosts: false,
  };

  for (const role of roles) {
    const p = ROLE_PERMISSIONS[role];
    if (!p) continue;
    for (const key of Object.keys(combined) as Array<keyof RolePermissions>) {
      if (p[key]) combined[key] = true;
    }
  }

  return combined;
}
