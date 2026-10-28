import { type ReactNode } from "react";
import { Lock } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { type RolePermissions } from "@/lib/permissions";

interface RequirePermissionProps {
  /** The permission key that the user must have to see children. */
  permission: keyof RolePermissions;
  /** Optional custom label shown in the restricted message. */
  label?: string;
  children: ReactNode;
}

/**
 * Guards a section or route by permission.
 * If the user lacks the required permission, shows a "no access" message
 * instead of the children. This guards both the UI and direct URL access.
 */
export function RequirePermission({ permission, label, children }: RequirePermissionProps) {
  const { permissions } = useAuth();

  if (!permissions[permission]) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <Lock className="size-12 text-muted-foreground/40" />
        <div className="text-center">
          <h2 className="font-display text-xl font-bold">Access Restricted</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {label
              ? `${label} is not available for your role.`
              : "You do not have permission to view this page."}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Contact the MD to request access.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
