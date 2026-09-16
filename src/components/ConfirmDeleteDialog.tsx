import { useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";

export function ConfirmDeleteDialog({
  title = "Delete record",
  description = "Are you sure you want to delete this record? This action cannot be undone.",
  trigger,
  open: controlledOpen,
  onOpenChange,
  onConfirm,
}: {
  title?: string;
  description?: string;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onConfirm: () => Promise<void> | void;
}) {
  const [uncontrolled, setUncontrolled] = useState(false);
  const [busy, setBusy] = useState(false);

  const open = controlledOpen ?? uncontrolled;
  const setOpen = onOpenChange ?? setUncontrolled;

  const handleConfirm = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      setBusy(true);
      await onConfirm();
      setOpen(false);
    } catch {
      // Errors are handled by mutation toasts in db.ts
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {trigger ? <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger> : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={busy}
            className={buttonVariants({ variant: "destructive" })}
          >
            {busy ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
