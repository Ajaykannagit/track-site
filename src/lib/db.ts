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
    msg.includes("payment_source") &&
    (msg.includes("violates not-null constraint") || msg.includes("null value in column") || msg.includes("violates check constraint"))
  ) {
    return "Please select a payment source (Bank Account or Petty Cash) before saving.";
  }
  if (code === "23502" || msg.includes("violates not-null constraint") || msg.includes("null value in column")) {
    return "A required field is missing. Please check all mandatory fields and try again.";
  }
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
  if (code === "23514" || msg.includes("violates check constraint")) {
    return "The entry entered violates validation rules. Please check values and try again.";
  }
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
    return "Network error. Please check your internet connection.";
  }
  return msg.startsWith("PostgresError:") || msg.includes("violates") || msg.includes("syntax error")
    ? `Failed to ${defaultAction} record. Please verify entries.`
    : (msg || `Failed to ${defaultAction} record.`);
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
    mutationFn: async (arg: string | { id: string; reason?: string }) => {
      const id = typeof arg === "string" ? arg : arg.id;
      const reason = typeof arg === "object" ? arg.reason : undefined;
      const { data, error } = await supabase.rpc("soft_delete_record", {
        p_table_name: table,
        p_record_id: id,
        p_reason: reason || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [table] });
      qc.invalidateQueries({ queryKey: [`${table}_view`] });
      qc.invalidateQueries({ queryKey: ["account_balances"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
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


export type GroupPaymentPayload = {
  payment_type: "contractor" | "supplier";
  party_id: string;
  payment_date: string;
  total_amount: number;
  payment_mode: string;
  payment_source?: "bank" | "petty_cash";
  reference_number?: string | null;
  bank_account_id?: string | null;
  remarks?: string | null;
  allocations: Array<{
    project_id: string;
    work_order_id?: string | null;
    contractor_bill_id?: string | null;
    po_id?: string | null;
    allocated_amount: number;
    remarks?: string | null;
  }>;
};

export function useCreateGroupPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: GroupPaymentPayload) => {
      const { data, error } = await supabase.rpc("create_group_payment", {
        p_payment_type: payload.payment_type,
        p_party_id: payload.party_id,
        p_payment_date: payload.payment_date,
        p_total_amount: payload.total_amount,
        p_payment_mode: payload.payment_mode,
        p_reference_number: payload.reference_number || null,
        p_bank_account_id: payload.bank_account_id || null,
        p_remarks: payload.remarks || null,
        p_allocations: payload.allocations,
        p_payment_source: payload.payment_source || (payload.payment_mode?.toLowerCase() === "cash" ? "petty_cash" : "bank"),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["group_payments"] });
      qc.invalidateQueries({ queryKey: ["group_payment_allocations"] });
      qc.invalidateQueries({ queryKey: ["contractor_payments"] });
      qc.invalidateQueries({ queryKey: ["supplier_payments"] });
      qc.invalidateQueries({ queryKey: ["work_orders"] });
      qc.invalidateQueries({ queryKey: ["contractor_bills"] });
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["cash_closing"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success(
        variables.payment_type === "contractor"
          ? "Contractor group payment recorded successfully."
          : "Supplier group payment recorded successfully."
      );
    },
    onError: (e: Error) => toast.error(formatDbError(e, "create group payment")),
  });
}

export function useVoidGroupPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { data, error } = await supabase.rpc("void_group_payment", {
        p_group_id: id,
        p_reason: reason,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["group_payments"] });
      qc.invalidateQueries({ queryKey: ["group_payment_allocations"] });
      qc.invalidateQueries({ queryKey: ["contractor_payments"] });
      qc.invalidateQueries({ queryKey: ["supplier_payments"] });
      qc.invalidateQueries({ queryKey: ["work_orders"] });
      qc.invalidateQueries({ queryKey: ["contractor_bills"] });
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["cash_closing"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Group payment marked as Void.");
    },
    onError: (e: Error) => toast.error(formatDbError(e, "void group payment")),
  });
}


export type AccountBalances = {
  bank: { opening: number; inflows: number; outflows: number; balance: number };
  petty_cash: { opening: number; inflows: number; outflows: number; balance: number };
  combined: { opening: number; inflows: number; outflows: number; balance: number };
};

export function useAccountBalances() {
  return useQuery({
    queryKey: ['account_balances'],
    queryFn: async (): Promise<AccountBalances> => {
      const { data, error } = await supabase.rpc('get_account_balances');
      if (error) {
        console.error('Failed to fetch account balances:', error);
        return {
          bank: { opening: 0, inflows: 0, outflows: 0, balance: 0 },
          petty_cash: { opening: 0, inflows: 0, outflows: 0, balance: 0 },
          combined: { opening: 0, inflows: 0, outflows: 0, balance: 0 },
        };
      }
      const rows = (data || []) as Array<{
        account_type: string;
        opening_balance: number;
        total_inflows: number;
        total_outflows: number;
        current_balance: number;
      }>;
      const bankRow = rows.find((r) => r.account_type === 'bank') || {
        opening_balance: 0,
        total_inflows: 0,
        total_outflows: 0,
        current_balance: 0,
      };
      const pettyRow = rows.find((r) => r.account_type === 'petty_cash') || {
        opening_balance: 0,
        total_inflows: 0,
        total_outflows: 0,
        current_balance: 0,
      };

      const bank = {
        opening: Number(bankRow.opening_balance || 0),
        inflows: Number(bankRow.total_inflows || 0),
        outflows: Number(bankRow.total_outflows || 0),
        balance: Number(bankRow.current_balance || 0),
      };
      const petty_cash = {
        opening: Number(pettyRow.opening_balance || 0),
        inflows: Number(pettyRow.total_inflows || 0),
        outflows: Number(pettyRow.total_outflows || 0),
        balance: Number(pettyRow.current_balance || 0),
      };

      return {
        bank,
        petty_cash,
        combined: {
          opening: bank.opening + petty_cash.opening,
          inflows: bank.inflows + petty_cash.inflows,
          outflows: bank.outflows + petty_cash.outflows,
          balance: bank.balance + petty_cash.balance,
        },
      };
    },
    staleTime: 1000 * 15,
  });
}
