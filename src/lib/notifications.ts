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
  created_by?: string | null;
  created_by_email?: string | null;
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

const LOCAL_NOTIFICATIONS_KEY = "brickweld_notifications_store";

function getLocalNotifications(): NotificationItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_NOTIFICATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalNotifications(list: NotificationItem[]) {
  try {
    localStorage.setItem(LOCAL_NOTIFICATIONS_KEY, JSON.stringify(list.slice(0, 200)));
  } catch {
    // Ignore storage quota issues
  }
}

/**
 * Dispatch an edit notification to the MD.
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

  const notificationObj: NotificationItem = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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
    is_read: false,
    details,
    created_at: new Date().toISOString(),
  };

  // Always store locally as fallback / sync
  const current = getLocalNotifications();
  saveLocalNotifications([notificationObj, ...current]);

  // Also push to Supabase table
  try {
    await supabase.from("notifications").insert({
      type: "edit",
      title: notificationObj.title,
      message: notificationObj.message,
      table_name: tableName,
      record_id: recordId,
      field_name: fieldName,
      old_value: oldStr,
      new_value: newStr,
      reason: reason,
      target_role: "md",
      created_by: userId,
      created_by_email: userEmail,
      is_read: false,
      details,
    });
  } catch (err) {
    console.warn("Could not save notification to remote table:", err);
  }
}

/**
 * Fetch all notifications for the MD
 */
export async function fetchMdNotifications(): Promise<NotificationItem[]> {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (!error && Array.isArray(data) && data.length > 0) {
      // Merge with any local ones not present
      const local = getLocalNotifications();
      const existingIds = new Set(data.map((d: any) => d.id));
      const combined = [...data, ...local.filter((l) => !existingIds.has(l.id))];
      combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return combined;
    }
  } catch {
    // ignore
  }

  return getLocalNotifications();
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(id: string): Promise<void> {
  const local = getLocalNotifications();
  const updated = local.map((n) => (n.id === id ? { ...n, is_read: true } : n));
  saveLocalNotifications(updated);

  try {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
  } catch {
    // ignore
  }
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead(): Promise<void> {
  const local = getLocalNotifications();
  const updated = local.map((n) => ({ ...n, is_read: true }));
  saveLocalNotifications(updated);

  try {
    await supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
  } catch {
    // ignore
  }
}
