import { useState, useEffect } from "react";
import {
  Bell,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  History,
  Trash2,
  ArrowRight,
  Clock,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dateFmt } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import {
  fetchMdNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type NotificationItem,
} from "@/lib/notifications";
import {
  fetchDeletionRequests,
  approveDeletionRequest,
  rejectDeletionRequest,
  type DeletionRequest,
} from "@/lib/approvals";
import { useQueryClient } from "@tanstack/react-query";

export function NotificationCenter() {
  const { isMD, user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [deletions, setDeletions] = useState<DeletionRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [notifs, dels] = await Promise.all([
        fetchMdNotifications(),
        fetchDeletionRequests(),
      ]);
      setNotifications(notifs);
      setDeletions(dels);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 10000);
    return () => clearInterval(timer);
  }, []);

  const unreadNotifs = notifications.filter((n) => !n.is_read).length;
  const pendingDeletions = deletions.filter((d) => d.status === "pending").length;
  const totalBadge = unreadNotifs + pendingDeletions;

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead();
    await loadData();
    toast.success("All notifications marked as read");
  };

  const handleApproveDelete = async (req: DeletionRequest) => {
    try {
      setActionBusy(req.id);
      const res = await approveDeletionRequest(req.id);
      if (res.success) {
        toast.success(`Deletion approved: "${req.record_title}" deleted permanently.`);
        qc.invalidateQueries({ queryKey: [req.table_name] });
        await loadData();
      } else {
        toast.error(`Approval failed: ${res.error}`);
      }
    } finally {
      setActionBusy(null);
    }
  };

  const handleRejectDelete = async (req: DeletionRequest) => {
    try {
      setActionBusy(req.id);
      const res = await rejectDeletionRequest(req.id);
      if (res.success) {
        toast.info(`Deletion request rejected for "${req.record_title}". Data remains unchanged.`);
        await loadData();
      } else {
        toast.error(`Rejection failed: ${res.error}`);
      }
    } finally {
      setActionBusy(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative size-8 rounded-full border-muted-foreground/30 hover:bg-accent"
          aria-label="Notifications and MD Approvals"
          title={isMD ? "MD Notifications & Approvals" : "Notifications"}
        >
          <Bell className="size-4" />
          {totalBadge > 0 && (
            <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-pulse">
              {totalBadge > 9 ? "9+" : totalBadge}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-md sm:max-w-lg flex flex-col p-0">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between pr-6">
            <SheetTitle className="text-base flex items-center gap-2 font-display">
              <Bell className="size-4 text-primary" />
              {isMD ? "MD Review & Notification Center" : "Activity Notifications"}
            </SheetTitle>
            {unreadNotifs > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleMarkAllRead}
              >
                <Check className="mr-1 size-3" /> Mark all read
              </Button>
            )}
          </div>
          <SheetDescription className="text-xs">
            {isMD
              ? "Review live field-level edits and approve or reject deletion requests."
              : "Recent updates and notifications across site records."}
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue={pendingDeletions > 0 && isMD ? "deletions" : "edits"} className="flex-1 flex flex-col">
          <div className="px-4 pt-2 border-b bg-muted/30">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="edits" className="text-xs relative">
                Edit Alerts
                {unreadNotifs > 0 && (
                  <Badge variant="destructive" className="ml-1.5 px-1 py-0 text-[10px] h-4">
                    {unreadNotifs}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="deletions" className="text-xs relative">
                Delete Requests
                {pendingDeletions > 0 && (
                  <Badge variant="default" className="ml-1.5 px-1 py-0 text-[10px] h-4 bg-amber-600">
                    {pendingDeletions}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ================= EDIT NOTIFICATIONS TAB ================= */}
          <TabsContent value="edits" className="flex-1 overflow-y-auto p-4 space-y-3 m-0">
            {notifications.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <History className="mx-auto size-8 mb-2 opacity-40" />
                No edit notifications yet.
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`rounded-lg border p-3 text-xs transition-colors ${
                    notif.is_read ? "bg-card border-border/60" : "bg-red-500/5 border-red-300 dark:border-red-900/60"
                  }`}
                  onClick={() => {
                    if (!notif.is_read) markNotificationAsRead(notif.id);
                  }}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 font-semibold text-foreground">
                      {!notif.is_read && (
                        <span className="size-2 rounded-full bg-red-500 shrink-0" />
                      )}
                      <span>{notif.title}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {dateFmt(notif.created_at)}
                    </span>
                  </div>

                  {notif.field_name && (
                    <div className="bg-muted/50 rounded p-2 my-1.5 space-y-1 font-mono text-[11px]">
                      <div className="text-muted-foreground text-[10px] uppercase font-sans tracking-wide">
                        Field: <span className="font-semibold text-foreground">{notif.field_name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="line-through text-red-600 bg-red-100 dark:bg-red-950/60 px-1 rounded">
                          {notif.old_value ?? "—"}
                        </span>
                        <ArrowRight className="size-3 text-muted-foreground shrink-0" />
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-100 dark:bg-emerald-950/60 px-1 rounded">
                          {notif.new_value ?? "—"}
                        </span>
                      </div>
                    </div>
                  )}

                  {notif.reason && (
                    <p className="text-[11px] text-muted-foreground">
                      <strong className="text-foreground">Reason:</strong> {notif.reason}
                    </p>
                  )}

                  <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground border-t pt-1.5">
                    <span>By: {notif.created_by_email || "User"}</span>
                    <span className="capitalize">{notif.table_name?.replace(/_/g, " ")}</span>
                  </div>
                </div>
              ))
            )}
          </TabsContent>

          {/* ================= DELETION APPROVALS TAB ================= */}
          <TabsContent value="deletions" className="flex-1 overflow-y-auto p-4 space-y-3 m-0">
            {deletions.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <Trash2 className="mx-auto size-8 mb-2 opacity-40" />
                No deletion requests recorded.
              </div>
            ) : (
              deletions.map((req) => {
                const isPending = req.status === "pending";
                return (
                  <div
                    key={req.id}
                    className={`rounded-lg border p-3.5 text-xs ${
                      isPending
                        ? "bg-amber-500/5 border-amber-300 dark:border-amber-900/60 shadow-sm"
                        : req.status === "approved"
                        ? "bg-muted/40 border-border opacity-70"
                        : "bg-red-500/5 border-red-200 opacity-70"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div>
                        <Badge
                          variant={isPending ? "default" : req.status === "approved" ? "secondary" : "destructive"}
                          className={`text-[10px] uppercase font-bold mb-1 ${
                            isPending ? "bg-amber-600 hover:bg-amber-700" : ""
                          }`}
                        >
                          {req.status === "pending" ? "Pending MD Approval" : req.status}
                        </Badge>
                        <h4 className="font-semibold text-foreground text-sm">{req.record_title}</h4>
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {dateFmt(req.requested_at)}
                      </span>
                    </div>

                    <div className="bg-muted/60 rounded p-2 my-2 space-y-1 text-[11px]">
                      <div>
                        <span className="text-muted-foreground">Module:</span>{" "}
                        <span className="font-medium text-foreground capitalize">
                          {req.table_name.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Requested by:</span>{" "}
                        <span className="font-medium text-foreground">{req.requested_by_email || "User"}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Reason for deletion:</span>{" "}
                        <span className="font-semibold text-destructive">{req.reason}</span>
                      </div>
                    </div>

                    {isPending ? (
                      isMD ? (
                        <div className="mt-3 flex items-center justify-end gap-2 border-t pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/50"
                            disabled={actionBusy === req.id}
                            onClick={() => handleRejectDelete(req)}
                          >
                            <XCircle className="mr-1 size-3.5" /> Reject
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-7 text-xs bg-red-600 hover:bg-red-700"
                            disabled={actionBusy === req.id}
                            onClick={() => handleApproveDelete(req)}
                          >
                            <CheckCircle2 className="mr-1 size-3.5" /> Approve & Delete
                          </Button>
                        </div>
                      ) : (
                        <p className="text-[11px] text-amber-700 dark:text-amber-400 italic">
                          Awaiting MD review. Record remains safe until approved.
                        </p>
                      )
                    ) : (
                      <div className="text-[10px] text-muted-foreground border-t pt-1.5 flex justify-between">
                        <span>Reviewed by: {req.reviewed_by_email || "MD"}</span>
                        <span>{req.reviewed_at ? dateFmt(req.reviewed_at) : ""}</span>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
