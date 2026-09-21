-- ============================================================
-- BRICKWELD PRIVATE LIMITED
-- Phase 2: material_request_items RLS grants
-- Phase 3: account_transfers table
-- ============================================================

-- ── PHASE 2 ──────────────────────────────────────────────────
-- material_request_items already exists in schema.
-- Just make sure RLS and grants are in place.

ALTER TABLE public.material_request_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "items select" ON public.material_request_items;
CREATE POLICY "items select" ON public.material_request_items
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "items insert" ON public.material_request_items;
CREATE POLICY "items insert" ON public.material_request_items
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "items update" ON public.material_request_items;
CREATE POLICY "items update" ON public.material_request_items
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "items delete" ON public.material_request_items;
CREATE POLICY "items delete" ON public.material_request_items
  FOR DELETE TO authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_request_items TO authenticated;

-- ── PHASE 3 ──────────────────────────────────────────────────
-- Petty cash ↔ Bank transfers table

CREATE TABLE IF NOT EXISTS public.account_transfers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  transfer_date    date NOT NULL DEFAULT current_date,
  from_account     text NOT NULL CHECK (from_account IN ('petty_cash','bank')),
  to_account       text NOT NULL CHECK (to_account   IN ('petty_cash','bank')),
  amount           numeric(14,2) NOT NULL CHECK (amount > 0),
  reference_number text,
  remarks          text,
  created_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_self_transfer CHECK (from_account <> to_account)
);

ALTER TABLE public.account_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "transfers select" ON public.account_transfers;
CREATE POLICY "transfers select" ON public.account_transfers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'md') OR public.has_role(auth.uid(), 'accounts'));

DROP POLICY IF EXISTS "transfers insert" ON public.account_transfers;
CREATE POLICY "transfers insert" ON public.account_transfers
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'md') OR public.has_role(auth.uid(), 'accounts'));

DROP POLICY IF EXISTS "transfers update" ON public.account_transfers;
CREATE POLICY "transfers update" ON public.account_transfers
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'md') OR public.has_role(auth.uid(), 'accounts'))
  WITH CHECK (public.has_role(auth.uid(), 'md') OR public.has_role(auth.uid(), 'accounts'));

DROP POLICY IF EXISTS "transfers delete" ON public.account_transfers;
CREATE POLICY "transfers delete" ON public.account_transfers
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'md') OR public.has_role(auth.uid(), 'accounts'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_transfers TO authenticated;

-- ── END ────────────────────────────────────────────────────────
