import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Ban, RotateCcw } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useVoidRow, useUnvoidRow } from "@/lib/db";

interface ConfirmVoidDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableName: string;
  recordId: string;
  recordTitle: string;
  isAlreadyVoid?: boolean;
  label?: string;
}

export function ConfirmVoidDialog({
  open,
  onOpenChange,
  tableName,
  recordId,
  recordTitle,
  isAlreadyVoid = false,
  label = "record",
}: ConfirmVoidDialogProps) {
  const { isMD } = useAuth();
  const [reason, setReason] = useState("");
  const voidMutation = useVoidRow(tableName, label);
  const unvoidMutation = useUnvoidRow(tableName, label);

  const isPending = voidMutation.isPending || unvoidMutation.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error("Please enter a mandatory reason.");
      return;
    }

    try {
      if (isAlreadyVoid) {
        if (!isMD) {
          toast.error("Only the MD can unvoid records.");
          return;
        }
        await unvoidMutation.mutateAsync({ id: recordId, reason: reason.trim() });
      } else {
        await voidMutation.mutateAsync({ id: recordId, reason: reason.trim() });
      }
      setReason("");
      onOpenChange(false);
    } catch {
      // toast error handled by mutation onError
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              {isAlreadyVoid ? (
                <>
                  <RotateCcw className="size-5 text-emerald-600" /> Restore Voided {label}
                </>
              ) : (
                <>
                  <Ban className="size-5 text-amber-600" /> Void {label}
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {isAlreadyVoid
                ? `Restore "${recordTitle}" back into active records and calculations? (Requires MD role).`
                : `Mark "${recordTitle}" as VOID. It will be excluded from all calculations, ledgers, and totals.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="void-reason" className="text-xs font-semibold">
              Mandatory Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="void-reason"
              required
              rows={3}
              placeholder={
                isAlreadyVoid
                  ? "Explain why this record is being restored..."
                  : "Explain why this entry is being voided (e.g. clerical error, wrong amount, duplicate)..."
              }
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="text-xs"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              variant={isAlreadyVoid ? "default" : "destructive"}
              className="gap-1.5"
            >
              {isAlreadyVoid ? (
                <>
                  <RotateCcw className="size-3.5" />
                  {isPending ? "Restoring..." : "Restore Record"}
                </>
              ) : (
                <>
                  <Ban className="size-3.5" />
                  {isPending ? "Voiding..." : "Mark as Void"}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
