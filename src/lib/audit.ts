import { supabase as typedSupabase } from "@/integrations/supabase/client";
import { sendEditNotification } from "@/lib/notifications";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = typedSupabase as any;

export type AuditLogEntry = {
  id: string;
  table_name: string;
  record_id: string | null;
  action: "insert" | "update" | "delete" | "verify" | "lock";
  module: string | null;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  reason: string | null;
  user_role: string | null;
  verification_status: string | null;
  details: Record<string, unknown>;
  performed_by: string | null;
  performed_at: string;
};

export type LogChangeParams = {
  tableName: string;
  recordId: string;
  action: "insert" | "update" | "delete" | "verify" | "lock";
  module: "materials" | "expenses" | "attendance" | "accounts" | "contractors" | "payroll";
  fieldName?: string | null;
  oldValue?: string | number | null;
  newValue?: string | number | null;
  reason?: string | null;
  verificationStatus?: string | null;
  details?: Record<string, unknown>;
};

/**
 * Log a change to public.audit_logs via RPC (guarantees server-side auth & timestamp)
 * with a fallback to direct table insert.
 */
export async function logAuditEntry(params: LogChangeParams): Promise<void> {
  try {
    const {
      tableName,
      recordId,
      action,
      module,
      fieldName = null,
      oldValue = null,
      newValue = null,
      reason = null,
      verificationStatus = null,
      details = {},
    } = params;

    const oldStr = oldValue !== null && oldValue !== undefined ? String(oldValue) : null;
    const newStr = newValue !== null && newValue !== undefined ? String(newValue) : null;

    // Try RPC first (server-side security definer function)
    const { error: rpcError } = await supabase.rpc("record_audit_log", {
      p_table_name: tableName,
      p_record_id: recordId,
      p_action: action,
      p_module: module,
      p_field_name: fieldName,
      p_old_value: oldStr,
      p_new_value: newStr,
      p_reason: reason,
      p_verification_status: verificationStatus,
      p_details: details,
    });

    if (action === "update") {
      await sendEditNotification({
        tableName,
        recordId,
        fieldName: fieldName ?? "Record updated",
        oldValue,
        newValue,
        reason: reason ?? "Edit applied",
        details,
      });
    }

    if (!rpcError) return;

    // Fallback to direct insert if RPC not deployed yet
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id ?? null;

    await supabase.from("audit_logs").insert({
      table_name: tableName,
      record_id: recordId,
      action,
      module,
      field_name: fieldName,
      old_value: oldStr,
      new_value: newStr,
      reason,
      verification_status: verificationStatus,
      details,
      performed_by: userId,
    });
  } catch (err) {
    console.warn("Failed to record audit log entry:", err);
  }
}

/**
 * Compare two record objects and log all individual field modifications
 */
export async function logRecordFieldDiffs(
  tableName: string,
  recordId: string,
  module: LogChangeParams["module"],
  oldRecord: Record<string, unknown>,
  newRecord: Record<string, unknown>,
  trackedFields: string[],
  reason?: string | null,
  verificationStatus?: string | null
): Promise<string[]> {
  const changedFields: string[] = [];

  for (const field of trackedFields) {
    const oldVal = oldRecord[field];
    const newVal = newRecord[field];

    // Check if value actually changed
    const oldStr = oldVal !== null && oldVal !== undefined ? String(oldVal) : "";
    const newStr = newVal !== null && newVal !== undefined ? String(newVal) : "";

    if (oldStr !== newStr) {
      changedFields.push(field);
      await logAuditEntry({
        tableName,
        recordId,
        action: "update",
        module,
        fieldName: field,
        oldValue: oldVal as string | number | null,
        newValue: newVal as string | number | null,
        ...(reason !== undefined ? { reason } : {}),
        ...(verificationStatus !== undefined ? { verificationStatus } : {}),
      });
    }
  }

  return changedFields;
}

