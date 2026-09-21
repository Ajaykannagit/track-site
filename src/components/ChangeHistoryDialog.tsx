import { useState } from "react";
import { History, Download, FileSpreadsheet } from "lucide-react";
import { useRows } from "@/lib/db";
import { dateFmt } from "@/lib/format";
import { exportToExcel } from "@/lib/excel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export type ChangeHistoryProps = {
  tableName: string;
  recordId: string;
  title?: string;
  trigger?: React.ReactNode;
};

export function ChangeHistoryDialog({
  tableName,
  recordId,
  title = "Change History & Audit Trail",
  trigger,
}: ChangeHistoryProps) {
  const [open, setOpen] = useState(false);

  const logs = useRows<any>("audit_logs", {
    filters: [
      { col: "table_name", op: "eq", value: tableName },
      { col: "record_id", op: "eq", value: recordId },
    ],
    order: { col: "performed_at", asc: false },
    limit: 100,
  });

  const hasModifications = (logs.data ?? []).some((l: any) => l.action === "update" || l.old_value !== null);

  const exportAudit = async (type: "excel" | "csv") => {
    const list = logs.data ?? [];
    if (list.length === 0) return;

    await exportToExcel({
      filename: `audit-history-${tableName}-${recordId.slice(0, 8)}.${type === "csv" ? "csv" : "xlsx"}`,
      title: `Audit History: ${tableName}`,
      description: `Historical field-level modifications for record ${recordId}`,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rows: list as any[],
      columns: [
        { header: "Timestamp", value: (l: any) => dateFmt(l.performed_at) },
        { header: "Action", value: (l: any) => l.action?.toUpperCase() ?? "" },
        { header: "Field", value: (l: any) => l.field_name || "—" },
        { header: "Old Value", value: (l: any) => l.old_value ?? "—" },
        { header: "New Value", value: (l: any) => l.new_value ?? "—" },
        { header: "Reason", value: (l: any) => l.reason || "—" },
        { header: "Role", value: (l: any) => l.user_role?.toUpperCase() || "—" },
        { header: "Status", value: (l: any) => l.verification_status || "—" },
      ],
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            variant={hasModifications ? "destructive" : "ghost"}
            size="icon"
            className={`size-7 ${hasModifications ? "bg-red-500/15 text-red-600 hover:bg-red-500/25 hover:text-red-700 dark:bg-red-950/50 dark:text-red-400" : ""}`}
            title={hasModifications ? "Modified record — view change history" : "View change history"}
          >
            <History className={`size-3.5 ${hasModifications ? "text-red-600 dark:text-red-400" : ""}`} />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex flex-row items-center justify-between pr-6">
          <div>
            <DialogTitle className="flex items-center gap-2">
              <History className="size-4" />
              {title}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Chronological immutable log of every modification made to this record.
            </DialogDescription>
          </div>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => exportAudit("excel")}
              disabled={!logs.data?.length}
            >
              <FileSpreadsheet className="mr-1 size-3.5 text-emerald-600" /> Export Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => exportAudit("csv")}
              disabled={!logs.data?.length}
            >
              <Download className="mr-1 size-3.5" /> CSV
            </Button>
          </div>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 border rounded-md mt-3">
          {logs.isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading audit log...</div>
          ) : !logs.data?.length ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No previous changes recorded for this item.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead className="bg-muted/60 sticky top-0 border-b">
                <tr>
                  <th className="p-2.5 text-left font-medium">Timestamp</th>
                  <th className="p-2.5 text-left font-medium">Field</th>
                  <th className="p-2.5 text-left font-medium">Previous</th>
                  <th className="p-2.5 text-left font-medium">New Value</th>
                  <th className="p-2.5 text-left font-medium">Role</th>
                  <th className="p-2.5 text-left font-medium">Reason</th>
                  <th className="p-2.5 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {logs.data.map((log: any) => (
                  <tr key={log.id} className="hover:bg-muted/20">
                    <td className="p-2.5 font-mono whitespace-nowrap text-muted-foreground">
                      {dateFmt(log.performed_at)}
                    </td>
                    <td className="p-2.5 font-semibold text-foreground">
                      {log.field_name ? (
                        <span className="capitalize">{log.field_name.replace(/_/g, " ")}</span>
                      ) : (
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {log.action}
                        </Badge>
                      )}
                    </td>
                    <td className="p-2.5 line-through text-destructive font-mono">
                      {log.old_value ?? "—"}
                    </td>
                    <td className="p-2.5 font-bold text-emerald-600 font-mono">
                      {log.new_value ?? "—"}
                    </td>
                    <td className="p-2.5">
                      <Badge variant="secondary" className="text-[10px] uppercase">
                        {log.user_role || "User"}
                      </Badge>
                    </td>
                    <td className="p-2.5 italic text-muted-foreground max-w-xs truncate" title={log.reason}>
                      {log.reason || "—"}
                    </td>
                    <td className="p-2.5">
                      {log.verification_status ? (
                        <Badge variant="outline" className="text-[10px]">
                          {log.verification_status}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Visual badge indicating a modified field or record
 */
export function ModifiedBadge({ hasChanges = false }: { hasChanges?: boolean }) {
  if (!hasChanges) return null;
  return (
    <Badge
      variant="destructive"
      className="text-[10px] px-1 py-0 h-4 uppercase tracking-wider font-semibold ml-1.5"
    >
      Modified
    </Badge>
  );
}
