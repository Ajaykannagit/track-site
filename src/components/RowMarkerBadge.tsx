import { Badge } from "@/components/ui/badge";

export function RowMarkerBadge({
  marker,
  className = "",
}: {
  marker?: { edited: boolean; pending_delete: boolean };
  className?: string;
}) {
  if (!marker) return null;
  if (marker.pending_delete) {
    return (
      <Badge
        variant="destructive"
        className={`bg-red-500/20 text-red-700 dark:text-red-400 border border-red-500 text-[10px] px-1 py-0 h-4 font-semibold ${className}`}
      >
        Delete requested
      </Badge>
    );
  }
  if (marker.edited) {
    return (
      <Badge
        variant="secondary"
        className={`bg-orange-500/20 text-orange-700 dark:text-orange-400 border border-orange-500 text-[10px] px-1 py-0 h-4 font-semibold ${className}`}
      >
        Edited
      </Badge>
    );
  }
  return null;
}

export function RowMarkerLegend() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground my-2">
      <span className="font-semibold text-foreground">Status Markers:</span>
      <div className="flex items-center gap-1.5">
        <span className="inline-block size-2.5 rounded bg-orange-500" />
        <span>Orange = Edited</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block size-2.5 rounded bg-red-500" />
        <span>Red = Delete Requested</span>
      </div>
    </div>
  );
}
