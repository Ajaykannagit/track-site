import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase as typedSupabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = typedSupabase as any;

export function ConfirmDeleteDialog({
  title = "Delete record",
  description = "Are you sure you want to delete this record? This action will remove it from active records.",
  tableName,
  recordId,
  recordTitle,
  recordData,
  trigger,
  open: controlledOpen,
  onOpenChange,
  onConfirm,
}: {
  title?: string;
  description?: string;
  tableName?: string;
  recordId?: string;
  recordTitle?: string;
  recordData?: Record<string, unknown>;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onConfirm?: (reason?: string) => Promise<void> | void;
}) {
  const { isMD, roles } = useAuth();
  const canDirectDelete = isMD || roles.includes("accounts");
  const [uncontrolled, setUncontrolled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");

  const open = controlledOpen ?? uncontrolled;
  const setOpen = onOpenChange ?? setUncontrolled;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setBusy(true);

      if (onConfirm) {
        // Direct deletion with audit logging and MD notification
        await onConfirm(reason.trim() || undefined);
      } else if (tableName && recordId) {
        const { error } = await supabase.rpc("soft_delete_record", {
          p_table_name: tableName,
          p_record_id: recordId,
          p_reason: reason.trim() || null,
        });
        if (error) throw error;
        toast.success("Record deleted successfully.");
      }

      setReason("");
      setOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to process deletion.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) { setOpen(v); if (!v) setReason(""); } }}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="mb-3">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5 shrink-0" />
              <DialogTitle className="font-display text-base text-foreground">{title}</DialogTitle>
            </div>
            <DialogDescription className="text-xs">{description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {!isMD && canDirectDelete && (
              <div className="rounded-md bg-blue-500/10 border border-blue-300 dark:border-blue-900/60 p-2.5 text-xs text-blue-800 dark:text-blue-300">
                <strong>Accountant Action:</strong> Deleting this record directly removes it from active views and balances. An automated notification will be sent to the MD.
              </div>
            )}

            <div>
              <Label htmlFor="del-reason" className="text-xs font-medium mb-1 block">
                Reason for deletion <span className="text-muted-foreground text-[10px]">(Optional)</span>
              </Label>
              <Textarea
                id="del-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Briefly state why this record is being removed..."
                className="text-xs resize-none"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              size="sm"
              disabled={busy}
              className="gap-1.5"
            >
              <Trash2 className="size-3.5" />
              {busy ? "Deleting..." : "Delete Record"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
