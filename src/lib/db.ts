import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase as typedSupabase } from "@/integrations/supabase/client";

// Generic helpers operate on arbitrary tables, so use an untyped view of the client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = typedSupabase as any;

type FilterOp = "eq" | "gte" | "lte" | "in";
type Filter = { col: string; op: FilterOp; value: unknown };

export type ListOptions = {
  select?: string;
  filters?: Filter[];
  order?: { col: string; asc?: boolean };
  limit?: number;
  enabled?: boolean;
};

const PAGE_SIZE = 1000;
const MAX_ROWS = 20_000;

/** Generic list query against any table via the Data API (RLS applies).
 *  Automatically pages through all rows (up to MAX_ROWS) unless `limit` is set. */
export function useRows<T = Record<string, unknown>>(table: string, opts: ListOptions = {}) {
  const { select = "*", filters = [], order, limit, enabled = true } = opts;
  return useQuery({
    queryKey: [table, select, filters, order, limit],
    enabled,
    queryFn: async () => {
      // If a hard limit is requested, do a single fetch with that limit
      if (limit) {
        let q = supabase.from(table).select(select);
        for (const f of filters) {
          if (f.value === undefined || f.value === null || f.value === "") continue;
          q = q[f.op](f.col, f.value);
        }
        if (order) q = q.order(order.col, { ascending: order.asc ?? false });
        q = q.limit(limit);
        const { data, error } = await q;
        if (error) throw error;
        return (data ?? []) as T[];
      }

      // Otherwise page through all rows
      const allRows: T[] = [];
      let offset = 0;
      while (true) {
        let q = supabase.from(table).select(select);
        for (const f of filters) {
          if (f.value === undefined || f.value === null || f.value === "") continue;
          q = q[f.op](f.col, f.value);
        }
        if (order) q = q.order(order.col, { ascending: order.asc ?? false });
        q = q.range(offset, offset + PAGE_SIZE - 1);
        const { data, error } = await q;
        if (error) throw error;
        const page = (data ?? []) as T[];
        allRows.push(...page);
        if (page.length < PAGE_SIZE) break; // last page
        offset += PAGE_SIZE;
        if (allRows.length >= MAX_ROWS) {
          console.warn(
            `[useRows] Table "${table}" has ≥${MAX_ROWS} rows. Stopped paging. Some rows may be missing.`,
          );
          break;
        }
      }
      return allRows;
    },
  });
}

export function formatDbError(e: unknown, defaultAction = "modify"): string {
  const err = e as { message?: string; code?: string };
  const msg = err?.message || String(e || "");
  const code = err?.code;
  if (
    code === "23503" ||
    msg.includes("violates foreign key constraint") ||
    msg.includes("foreign key")
  ) {
    return "Unable to delete this record because it is referenced by other records (e.g. attendance, expenses, or bills). Please remove or reassign dependent records first.";
  }
  if (
    code === "23505" ||
    msg.includes("violates unique constraint") ||
    msg.includes("already exists")
  ) {
    return "A record with this code or identifier already exists.";
  }
  return msg || `Failed to ${defaultAction} record.`;
}

/**
 * Map of base table names → view names that should also be invalidated after a save/delete.
 * Fixes the bug where list queries read from *_view but mutation invalidates only the base table key.
 */
const VIEW_ALIASES: Record<string, string[]> = {
  attendance: ["attendance_view"],
  material_requests: ["material_requests_view"],
  material_receipts: ["material_receipts_view"],
  employees: ["employees_view"],
  projects: ["projects_view"],
};

export function useSaveRow(table: string, label = "Record") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id?: string | undefined;
      values: Record<string, unknown>;
    }) => {
      if (id) {
        const { error } = await supabase.from(table).update(values).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase.from(table).insert(values).select("id").single();
      if (error) throw error;
      return (data as { id: string }).id;
    },
    onSuccess: () => {
      // Invalidate the base table query key
      qc.invalidateQueries({ queryKey: [table] });
      // Invalidate the _view variant (legacy pattern used in some places)
      qc.invalidateQueries({ queryKey: [`${table}_view`] });
      // Invalidate any view aliases that are used in list queries
      for (const alias of VIEW_ALIASES[table] ?? []) {
        qc.invalidateQueries({ queryKey: [alias] });
      }
      toast.success(`${label} saved`);
    },
    onError: (e: Error) => toast.error(formatDbError(e, "save")),
  });
}

export function useDeleteRow(table: string, label = "Record") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("soft_delete_record", {
        p_table_name: table,
        p_record_id: id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      qc.invalidateQueries({ queryKey: [`${table}_view`] });
      for (const alias of VIEW_ALIASES[table] ?? []) {
        qc.invalidateQueries({ queryKey: [alias] });
      }
      toast.success(`${label} deleted successfully`);
    },
    onError: (e: Error) => toast.error(formatDbError(e, "delete")),
  });
}

export function useRestoreRow(table: string, label = "Record") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.rpc("restore_record", {
        p_table_name: table,
        p_record_id: id,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      qc.invalidateQueries({ queryKey: [`${table}_view`] });
      for (const alias of VIEW_ALIASES[table] ?? []) {
        qc.invalidateQueries({ queryKey: [alias] });
      }
      toast.success(`${label} restored successfully`);
    },
    onError: (e: Error) => toast.error(formatDbError(e, "restore")),
  });
}

export const sum = <T>(rows: T[], pick: (r: T) => number | null | undefined) =>
  rows.reduce((a, r) => a + Number(pick(r) ?? 0), 0);

export function useVoidRow(table: string, label = "Record") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await supabase.rpc("void_record", {
        p_table_name: table,
        p_record_id: id,
        p_reason: reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      qc.invalidateQueries({ queryKey: [`${table}_view`] });
      for (const alias of VIEW_ALIASES[table] ?? []) {
        qc.invalidateQueries({ queryKey: [alias] });
      }
      toast.success(`${label} marked as Void.`);
    },
    onError: (e: Error) => toast.error(formatDbError(e, "void")),
  });
}

export function useUnvoidRow(table: string, label = "Record") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await supabase.rpc("unvoid_record", {
        p_table_name: table,
        p_record_id: id,
        p_reason: reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      qc.invalidateQueries({ queryKey: [`${table}_view`] });
      for (const alias of VIEW_ALIASES[table] ?? []) {
        qc.invalidateQueries({ queryKey: [alias] });
      }
      toast.success(`${label} unvoided successfully.`);
    },
    onError: (e: Error) => toast.error(formatDbError(e, "unvoid")),
  });
}
