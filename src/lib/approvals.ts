import { supabase as typedSupabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = typedSupabase as any;

export type DeletionRequest = {
  id: string;
  table_name: string;
  record_id: string;
  record_title: string;
  record_summary?: string | null;
  record_data?: Record<string, unknown>;
  reason: string;
  status: "pending" | "approved" | "rejected";
  requested_by?: string | null;
  requested_by_email?: string | null;
  requested_at: string;
  reviewed_by?: string | null;
  reviewed_by_email?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
};

export type RequestDeleteParams = {
  tableName: string;
  recordId: string;
  recordTitle: string;
  recordSummary?: string;
  recordData?: Record<string, unknown>;
  reason: string;
};

/**
 * Submit a deletion request to the MD for approval.
 * The database is the sole source of truth — no localStorage fallback.
 * If the insert fails, throws an error so the caller can show a toast.
 */
export async function submitDeletionRequest(params: RequestDeleteParams): Promise<DeletionRequest> {
  const { tableName, recordId, recordTitle, recordSummary, recordData = {}, reason } = params;

  let userEmail = "Current User";
  let userId: string | null = null;
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error(`Auth error: ${userError.message}`);
  if (userData?.user) {
    userId = userData.user.id;
    userEmail = userData.user.email ?? "User";
  }

  const summary = recordSummary ?? `${tableName.replace(/_/g, " ")}: ${recordTitle}`;

  const { data: dbData, error: insertError } = await supabase
    .from("deletion_requests")
    .insert({
      table_name: tableName,
      record_id: recordId,
      record_title: recordTitle,
      record_summary: summary,
      record_data: recordData,
      reason: reason.trim(),
      status: "pending",
      requested_by: userId,
      requested_by_email: userEmail,
    })
    .select()
    .single();

  if (insertError) {
    throw new Error(`Failed to submit deletion request: ${insertError.message}`);
  }

  // Notify the MD
  const { error: notifError } = await supabase.from("notifications").insert({
    type: "delete_request",
    title: `Deletion Approval Request: ${recordTitle}`,
    message: `User ${userEmail} requested to delete "${recordTitle}" from ${tableName.replace(/_/g, " ")}. Reason: ${reason}`,
    table_name: tableName,
    record_id: recordId,
    reason: reason,
    target_role: "md",
    created_by: userId,
    created_by_email: userEmail,
    details: { requestId: dbData.id, recordData },
  });

  if (notifError) {
    console.error("Failed to send MD notification for deletion request:", notifError.message);
    // Non-fatal — the request itself was saved
  }

  return dbData as DeletionRequest;
}

/**
 * Fetch all pending / historical deletion requests.
 * MD can see all; non-MD can see only their own rows (enforced by RLS).
 */
export async function fetchDeletionRequests(): Promise<DeletionRequest[]> {
  const { data, error } = await supabase
    .from("deletion_requests")
    .select("*")
    .order("requested_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("Failed to fetch deletion requests:", error.message);
    return [];
  }
  return (data ?? []) as DeletionRequest[];
}

/**
 * MD approves a deletion request via server-side RPC.
 * The function performs the soft delete, updates the request, and notifies the requester.
 */
export async function approveDeletionRequest(
  requestId: string,
  notes?: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc("approve_deletion_request", {
    p_request_id: requestId,
    p_notes: notes ?? null,
  });

  if (error) {
    console.error("Failed to approve deletion request:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * MD rejects a deletion request via server-side RPC.
 * The record remains unchanged. The requester is notified.
 */
export async function rejectDeletionRequest(
  requestId: string,
  reviewNotes?: string,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc("reject_deletion_request", {
    p_request_id: requestId,
    p_notes: reviewNotes ?? null,
  });

  if (error) {
    console.error("Failed to reject deletion request:", error.message);
    return { success: false, error: error.message };
  }
  return { success: true };
}
