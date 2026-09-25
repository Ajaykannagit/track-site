import { supabase as typedSupabase } from "@/integrations/supabase/client";

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

const LOCAL_DELETIONS_KEY = "brickweld_deletion_requests_store";

function getLocalDeletionRequests(): DeletionRequest[] {
  try {
    const raw = localStorage.getItem(LOCAL_DELETIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalDeletionRequests(list: DeletionRequest[]) {
  try {
    localStorage.setItem(LOCAL_DELETIONS_KEY, JSON.stringify(list.slice(0, 200)));
  } catch {
    // Ignore storage errors
  }
}

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
 */
export async function submitDeletionRequest(params: RequestDeleteParams): Promise<DeletionRequest> {
  const { tableName, recordId, recordTitle, recordSummary, recordData = {}, reason } = params;

  let userEmail = "Current User";
  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user) {
      userId = data.user.id;
      userEmail = data.user.email ?? "User";
    }
  } catch {
    // ignore
  }

  const req: DeletionRequest = {
    id: `del-req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    table_name: tableName,
    record_id: recordId,
    record_title: recordTitle,
    record_summary: recordSummary ?? `${tableName.replace(/_/g, " ")}: ${recordTitle}`,
    record_data: recordData,
    reason: reason.trim(),
    status: "pending",
    requested_by: userId,
    requested_by_email: userEmail,
    requested_at: new Date().toISOString(),
  };

  const current = getLocalDeletionRequests();
  saveLocalDeletionRequests([req, ...current]);

  try {
    const { data: dbData } = await supabase
      .from("deletion_requests")
      .insert({
        table_name: tableName,
        record_id: recordId,
        record_title: recordTitle,
        record_summary: req.record_summary,
        record_data: recordData,
        reason: req.reason,
        status: "pending",
        requested_by: userId,
        requested_by_email: userEmail,
      })
      .select()
      .single();

    if (dbData?.id) {
      req.id = dbData.id;
    }
  } catch (err) {
    console.warn("Could not insert deletion request to database:", err);
  }

  // Also create a notification for MD
  try {
    await supabase.from("notifications").insert({
      type: "delete_request",
      title: `Deletion Approval Request: ${recordTitle}`,
      message: `User ${userEmail} requested to delete "${recordTitle}" from ${tableName.replace(/_/g, " ")}. Reason: ${reason}`,
      table_name: tableName,
      record_id: recordId,
      reason: reason,
      target_role: "md",
      created_by: userId,
      created_by_email: userEmail,
      is_read: false,
      details: { requestId: req.id, recordData },
    });
  } catch {
    // ignore
  }

  return req;
}

/**
 * Fetch all pending / historical deletion requests
 */
export async function fetchDeletionRequests(): Promise<DeletionRequest[]> {
  try {
    const { data, error } = await supabase
      .from("deletion_requests")
      .select("*")
      .order("requested_at", { ascending: false })
      .limit(100);

    if (!error && Array.isArray(data) && data.length > 0) {
      const local = getLocalDeletionRequests();
      const existingIds = new Set(data.map((d: any) => d.id));
      const combined = [...data, ...local.filter((l) => !existingIds.has(l.id))];
      combined.sort((a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime());
      return combined;
    }
  } catch {
    // ignore
  }

  return getLocalDeletionRequests();
}

/**
 * MD approves a deletion request.
 * This permanently deletes the underlying record from its table and marks the request as approved.
 */
export async function approveDeletionRequest(requestId: string): Promise<{ success: boolean; error?: string }> {
  let userEmail = "MD";
  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user) {
      userId = data.user.id;
      userEmail = data.user.email ?? "MD";
    }
  } catch {
    // ignore
  }

  const all = getLocalDeletionRequests();
  const req = all.find((r) => r.id === requestId);

  if (!req) {
    // Try fetching from supabase
    try {
      const { data } = await supabase.from("deletion_requests").select("*").eq("id", requestId).single();
      if (data) {
        return approveDeletionRequestInternal(data, userId, userEmail);
      }
    } catch {
      // ignore
    }
    return { success: false, error: "Deletion request not found." };
  }

  return approveDeletionRequestInternal(req, userId, userEmail);
}

async function approveDeletionRequestInternal(
  req: DeletionRequest,
  userId: string | null,
  userEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Delete the actual record from domain table
    const { error: delError } = await supabase
      .from(req.table_name)
      .delete()
      .eq("id", req.record_id);

    if (delError) {
      console.error("Failed to delete record:", delError);
      return { success: false, error: delError.message };
    }

    // 2. Update the deletion request status to approved
    const now = new Date().toISOString();
    req.status = "approved";
    req.reviewed_by = userId;
    req.reviewed_by_email = userEmail;
    req.reviewed_at = now;

    const current = getLocalDeletionRequests();
    const updated = current.map((r) => (r.id === req.id ? { ...r, status: "approved" as const, reviewed_at: now } : r));
    saveLocalDeletionRequests(updated);

    try {
      await supabase
        .from("deletion_requests")
        .update({
          status: "approved",
          reviewed_by: userId,
          reviewed_by_email: userEmail,
          reviewed_at: now,
        })
        .eq("id", req.id);
    } catch {
      // ignore
    }

    // 3. Log audit entry for the permanent deletion
    try {
      await supabase.from("audit_logs").insert({
        table_name: req.table_name,
        record_id: req.record_id,
        action: "delete",
        reason: `MD Approved Deletion: ${req.reason}`,
        user_role: "md",
        performed_by: userId,
        details: { approved_by: userEmail, original_request: req },
      });
    } catch {
      // ignore
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Unknown error approving deletion" };
  }
}

/**
 * MD rejects a deletion request. Data remains unchanged in the database.
 */
export async function rejectDeletionRequest(
  requestId: string,
  reviewNotes?: string
): Promise<{ success: boolean; error?: string }> {
  let userEmail = "MD";
  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user) {
      userId = data.user.id;
      userEmail = data.user.email ?? "MD";
    }
  } catch {
    // ignore
  }

  const now = new Date().toISOString();
  const current = getLocalDeletionRequests();
  const updated = current.map((r) =>
    r.id === requestId
      ? {
          ...r,
          status: "rejected" as const,
          reviewed_by: userId,
          reviewed_by_email: userEmail,
          reviewed_at: now,
          review_notes: reviewNotes ?? "Rejected by MD",
        }
      : r
  );
  saveLocalDeletionRequests(updated);

  try {
    await supabase
      .from("deletion_requests")
      .update({
        status: "rejected",
        reviewed_by: userId,
        reviewed_by_email: userEmail,
        reviewed_at: now,
        review_notes: reviewNotes ?? "Rejected by MD",
      })
      .eq("id", requestId);
  } catch {
    // ignore
  }

  return { success: true };
}
