import { supabase as typedSupabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = typedSupabase as any;

export type NotificationItem = {
  id: string;
  type: "edit" | "delete_request" | "delete_approved" | "delete_rejected";
  title: string;
  message?: string | null;
  table_name?: string | null;
  record_id?: string | null;
  field_name?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  reason?: string | null;
  target_role?: string | null;
  target_user_id?: string | null;
  created_by?: string | null;
  created_by_email?: string | null;
  /** Unread = no row in notification_reads for the current user. */
  is_read: boolean;
  details?: Record<string, unknown>;
  created_at: string;
};

export type SendEditNotificationParams = {
  tableName: string;
  recordId: string;
  recordTitle?: string;
  fieldName?: string | null;
  oldValue?: string | number | null;
  newValue?: string | number | null;
  reason?: string | null;
  details?: Record<string, unknown>;
};

/**
 * Dispatch an edit notification to the MD.
 * Errors are logged — never silently swallowed.
 */
export async function sendEditNotification(params: SendEditNotificationParams): Promise<void> {
  const {
    tableName,
    recordId,
    recordTitle,
    fieldName = "Record details",
    oldValue = null,
    newValue = null,
    reason = "Data modified",
    details = {},
  } = params;

  const oldStr = oldValue !== null && oldValue !== undefined ? String(oldValue) : "—";
  const newStr = newValue !== null && newValue !== undefined ? String(newValue) : "—";
  const title = recordTitle
    ? `Edit in ${tableName.replace(/_/g, " ")}: ${recordTitle}`
    : `Edit in ${tableName.replace(/_/g, " ")}`;

  let userId: string | null = null;
  let userEmail = "Current User";
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    console.error("sendEditNotification: auth error", userError.message);
    return;
  }
  if (userData?.user) {
    userId = userData.user.id;
    userEmail = userData.user.email ?? "User";
  }

  const { error } = await supabase.from("notifications").insert({
    type: "edit",
    title,
    message: `Field "${fieldName}" changed from "${oldStr}" to "${newStr}". Reason: ${reason}`,
    table_name: tableName,
    record_id: recordId,
    field_name: fieldName,
    old_value: oldStr,
    new_value: newStr,
    reason: reason,
    target_role: "md",
    created_by: userId,
    created_by_email: userEmail,
    details,
  });

  if (error) {
    console.error("sendEditNotification: failed to insert notification:", error.message);
  }
}

/**
 * Fetch notifications visible to the current user.
 * RLS ensures each user only sees their own or role-targeted notifications.
 * Unread state is per-user via notification_reads table.
 */
export async function fetchNotificationsForCurrentUser(): Promise<NotificationItem[]> {
  // Get current user id for unread check
  const { data: userData } = await supabase.auth.getUser();
  const userId: string | null = userData?.user?.id ?? null;

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("fetchNotificationsForCurrentUser: error", error.message);
    return [];
  }

  if (!userId || !data?.length) return (data ?? []) as NotificationItem[];

  // Fetch which notifications the current user has read
  const ids = (data as { id: string }[]).map((n) => n.id);
  const { data: reads, error: readsError } = await supabase
    .from("notification_reads")
    .select("notification_id")
    .eq("user_id", userId)
    .in("notification_id", ids);

  if (readsError) {
    console.error("fetchNotificationsForCurrentUser: reads error", readsError.message);
    // Fallback: mark everything as unread
    return (data as NotificationItem[]).map((n) => ({ ...n, is_read: false }));
  }

  const readSet = new Set((reads ?? []).map((r: { notification_id: string }) => r.notification_id));
  return (data as NotificationItem[]).map((n) => ({ ...n, is_read: readSet.has(n.id) }));
}

/** @deprecated Use fetchNotificationsForCurrentUser instead */
export const fetchMdNotifications = fetchNotificationsForCurrentUser;

/**
 * Mark a single notification as read for the current user.
 */
export async function markNotificationAsRead(id: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId: string | null = userData?.user?.id ?? null;
  if (!userId) return;

  const { error } = await supabase
    .from("notification_reads")
    .upsert({ notification_id: id, user_id: userId }, { onConflict: "notification_id,user_id" });

  if (error) {
    console.error("markNotificationAsRead: error", error.message);
  }
}

/**
 * Mark all visible notifications as read for the current user only.
 * Does not affect other users' read state.
 */
export async function markAllNotificationsAsRead(): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId: string | null = userData?.user?.id ?? null;
  if (!userId) return;

  // Get all notification ids visible to this user
  const { data, error } = await supabase
    .from("notifications")
    .select("id")
    .limit(500);

  if (error) {
    console.error("markAllNotificationsAsRead: fetch error", error.message);
    return;
  }

  const rows = (data ?? []).map((n: { id: string }) => ({
    notification_id: n.id,
    user_id: userId,
  }));

  if (!rows.length) return;

  const { error: upsertError } = await supabase
    .from("notification_reads")
    .upsert(rows, { onConflict: "notification_id,user_id" });

  if (upsertError) {
    console.error("markAllNotificationsAsRead: upsert error", upsertError.message);
  }
}
