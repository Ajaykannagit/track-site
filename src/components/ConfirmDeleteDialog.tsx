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
import { AlertTriangle, Send, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { submitDeletionRequest } from "@/lib/approvals";

export function ConfirmDeleteDialog({
  title = "Delete record",
  description = "Are you sure you want to delete this record? This action requires MD approval.",
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
  const { isMD } = useAuth();
  const [uncontrolled, setUncontrolled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");

  const open = controlledOpen ?? uncontrolled;
  const setOpen = onOpenChange ?? setUncontrolled;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error("Please enter a reason for deletion.");
      return;
    }

    try {
      setBusy(true);

      if (isMD && onConfirm) {
        // MD can execute deletion directly with audit
        await onConfirm(reason.trim());
        toast.success("Record deleted.");
      } else if (tableName && recordId) {
        // Submit deletion request to MD
        await submitDeletionRequest({
          tableName,
          recordId,
          recordTitle: recordTitle || title,
          recordData: recordData || {},
          reason: reason.trim(),
        });
        toast.info("Deletion request submitted to MD for approval. The data will remain unchanged until approved.");
      } else if (onConfirm) {
        // Fallback to onConfirm if tableName/recordId not explicitly provided
        await onConfirm(reason.trim());
      }

      setReason("");
      setOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Failed to process deletion request.");
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
            {!isMD && (
              <div className="rounded-md bg-amber-500/10 border border-amber-300 dark:border-amber-900/60 p-2.5 text-xs text-amber-800 dark:text-amber-300">
                <strong>MD Approval Required:</strong> Submitting this request sends the item details and your reason to the MD. It will only be permanently deleted after MD approves it.
              </div>
            )}

            <div>
              <Label htmlFor="del-reason" className="text-xs font-medium mb-1 block">
                Reason for deletion <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="del-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Explain why this record needs to be deleted..."
                required
                rows={3}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2 sm:gap-0">
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
              size="sm"
              variant="destructive"
              disabled={busy || !reason.trim()}
              className="bg-destructive hover:bg-destructive/90"
            >
              {busy ? (
                "Processing…"
              ) : isMD ? (
                <>
                  <Trash2 className="mr-1.5 size-3.5" /> Delete
                </>
              ) : (
                <>
                  <Send className="mr-1.5 size-3.5" /> Submit to MD for Approval
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
