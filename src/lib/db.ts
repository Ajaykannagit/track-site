import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase as typedSupabase } from "@/integrations/supabase/client";

// Generic helpers operate on arbitrary tables, so use an untyped view of the client.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = typedSupabase as any;

type Filter = { col: string; op: "eq" | "gte" | "lte" | "in"; value: unknown };

export type ListOptions = {
  select?: string;
  filters?: Filter[];
  order?: { col: string; asc?: boolean };
  limit?: number;
  enabled?: boolean;
};

/** Generic list query against any table via the Data API (RLS applies). */
export function useRows<T = Record<string, unknown>>(table: string, opts: ListOptions = {}) {
  const { select = "*", filters = [], order, limit, enabled = true } = opts;
  return useQuery({
    queryKey: [table, select, filters, order, limit],
    enabled,
    queryFn: async () => {
      let q = supabase.from(table).select(select);
      for (const f of filters) {
        if (f.value === undefined || f.value === null || f.value === "") continue;
        q = q[f.op](f.col, f.value);
      }
      if (order) q = q.order(order.col, { ascending: order.asc ?? false });
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}

export function useSaveRow(table: string, label = "Record") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id?: string; values: Record<string, unknown> }) => {
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
      qc.invalidateQueries({ queryKey: [table] });
      toast.success(`${label} saved`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteRow(table: string, label = "Record") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      toast.success(`${label} deleted`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export const sum = <T,>(rows: T[], pick: (r: T) => number | null | undefined) =>
  rows.reduce((a, r) => a + Number(pick(r) ?? 0), 0);
