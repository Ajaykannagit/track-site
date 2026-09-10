import { Badge } from "@/components/ui/badge";

const TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-primary/15 text-primary",
  verified: "bg-primary/15 text-primary",
  approved: "bg-success/15 text-success",
  md_approved: "bg-success/15 text-success",
  payment_approved: "bg-success/15 text-success",
  ordered: "bg-warning/15 text-warning",
  partially_received: "bg-warning/15 text-warning",
  received: "bg-success/15 text-success",
  paid: "bg-success/15 text-success",
  closed: "bg-muted text-muted-foreground",
  rejected: "bg-destructive/15 text-destructive",
  planning: "bg-muted text-muted-foreground",
  active: "bg-success/15 text-success",
  on_hold: "bg-warning/15 text-warning",
  completed: "bg-primary/15 text-primary",
  cancelled: "bg-destructive/15 text-destructive",
  present: "bg-success/15 text-success",
  absent: "bg-destructive/15 text-destructive",
  half_day: "bg-warning/15 text-warning",
  leave: "bg-muted text-muted-foreground",
  holiday: "bg-muted text-muted-foreground",
};

export const label = (s: string | null | undefined) =>
  (s ?? "—").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export function StatusBadge({ status }: { status: string | null | undefined }) {
  return (
    <Badge variant="outline" className={`border-transparent ${TONE[status ?? ""] ?? "bg-muted text-muted-foreground"}`}>
      {label(status)}
    </Badge>
  );
}
