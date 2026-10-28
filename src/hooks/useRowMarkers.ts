import { useQuery } from "@tanstack/react-query";
import { supabase as typedSupabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = typedSupabase as any;

export type RowMarker = {
  id: string;
  edited: boolean;
  pending_delete: boolean;
};

/**
 * Fetch edit and pending_delete markers for a set of row IDs in a given table.
 * Calls the database RPC `get_row_markers`.
 *
 * - `edited`: last_edited_at is set and after creation.
 * - `pending_delete`: a pending deletion_requests row exists for this table & id.
 */
export function useRowMarkers(table: string, ids: (string | undefined | null)[]) {
  const cleanIds = Array.from(new Set(ids.filter((id): id is string => Boolean(id))));

  return useQuery({
    queryKey: ["row_markers", table, cleanIds.sort().join(",")],
    enabled: cleanIds.length > 0,
    staleTime: 10_000,
    queryFn: async (): Promise<Record<string, { edited: boolean; pending_delete: boolean }>> => {
      if (!cleanIds.length) return {};
      const { data, error } = await supabase.rpc("get_row_markers", {
        p_table: table,
        p_ids: cleanIds,
      });

      if (error) {
        // Markers are an enhancement; degrade gracefully if function is not yet present
        console.warn(`useRowMarkers(${table}) error:`, error.message);
        return {};
      }

      const map: Record<string, { edited: boolean; pending_delete: boolean }> = {};
      for (const row of (data ?? []) as RowMarker[]) {
        map[row.id] = {
          edited: Boolean(row.edited),
          pending_delete: Boolean(row.pending_delete),
        };
      }
      return map;
    },
  });
}

/**
 * Returns Tailwind class names based on row marker state.
 * Red (pending delete) wins over Orange (edited).
 */
export function getRowMarkerClass(marker?: { edited: boolean; pending_delete: boolean }): string {
  if (!marker) return "";
  if (marker.pending_delete) {
    return "bg-red-500/10 border-l-4 border-red-500";
  }
  if (marker.edited) {
    return "bg-orange-500/10 border-l-4 border-orange-500";
  }
  return "";
}
