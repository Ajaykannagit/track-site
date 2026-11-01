import { useState } from "react";
import { Eye, EyeOff, Ban, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface VoidToggleProps {
  showVoided: boolean;
  onToggle: (show: boolean) => void;
  voidCount?: number;
}

export function VoidToggle({ showVoided, onToggle, voidCount = 0 }: VoidToggleProps) {
  return (
    <Button
      variant={showVoided ? "secondary" : "outline"}
      size="sm"
      onClick={() => onToggle(!showVoided)}
      className="h-8 text-xs gap-1.5"
      title={showVoided ? "Hide voided records" : "Show voided records"}
    >
      {showVoided ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
      <span>{showVoided ? "Hide Voided" : "Show Voided"}</span>
      {voidCount > 0 && (
        <Badge
          variant="outline"
          className="ml-1 h-4 px-1 text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300"
        >
          {voidCount}
        </Badge>
      )}
    </Button>
  );
}

export function VoidBadge({ reason, isVoid }: { reason?: string | null; isVoid?: boolean }) {
  if (!isVoid) return null;
  return (
    <Badge
      variant="destructive"
      className="gap-1 text-[10px] font-mono font-bold bg-amber-600 hover:bg-amber-600 text-white"
      title={reason ? `Void Reason: ${reason}` : "Marked as VOID"}
    >
      <Ban className="size-2.5" /> VOID
    </Badge>
  );
}
