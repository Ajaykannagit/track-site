-- =========================================================================
-- 20261017160000_client_payments_and_receivables.sql
-- Feature Enhancement: Project Receivables, Client Payments, Advance & Milestones
-- =========================================================================

-- 1. Client Receipts / Payments Table
CREATE TABLE IF NOT EXISTS public.client_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number text NOT NULL UNIQUE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text NOT NULL DEFAULT 'bank', -- 'cash', 'bank', 'upi', 'cheque', 'other'
  reference_number text,                        -- UTR, Cheque #, transaction ref
  payment_category text NOT NULL DEFAULT 'progress', -- 'advance', 'progress', 'final', 'reversal', 'other'
  invoice_reference text,                      -- Running bill ref or invoice number
  notes text,
  status text NOT NULL DEFAULT 'received',      -- 'received', 'pending', 'cancelled', 'failed', 'refunded'
  account_type text NOT NULL DEFAULT 'bank',   -- 'bank', 'petty_cash', 'office'
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_payments_project_id ON public.client_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_client_payments_date ON public.client_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_client_payments_status ON public.client_payments(status);

-- 2. Project Payment Milestones Table
CREATE TABLE IF NOT EXISTS public.payment_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  expected_amount numeric(14,2) NOT NULL CHECK (expected_amount >= 0),
  due_date date NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'paid', 'partially_paid', 'cancelled'
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_milestones_project_id ON public.payment_milestones(project_id);
CREATE INDEX IF NOT EXISTS idx_payment_milestones_due_date ON public.payment_milestones(due_date);

-- 3. Grants & Row Level Security
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_payments TO authenticated;
GRANT ALL ON public.client_payments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_milestones TO authenticated;
GRANT ALL ON public.payment_milestones TO service_role;

ALTER TABLE public.client_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_milestones ENABLE ROW LEVEL SECURITY;

-- Read policy: Finance users (MD & Accounts) can view client receipts
CREATE POLICY "client_payments read policy" ON public.client_payments
  FOR SELECT TO authenticated
  USING (public.is_finance_user());

-- Write policy: MD and Accounts can record and adjust receipts
CREATE POLICY "client_payments write policy" ON public.client_payments
  FOR ALL TO authenticated
  USING (public.is_finance_user())
  WITH CHECK (public.is_finance_user());

-- Milestones read: Finance users can view
CREATE POLICY "payment_milestones read policy" ON public.payment_milestones
  FOR SELECT TO authenticated
  USING (public.is_finance_user());

-- Milestones write: Finance users can create/update
CREATE POLICY "payment_milestones write policy" ON public.payment_milestones
  FOR ALL TO authenticated
  USING (public.is_finance_user())
  WITH CHECK (public.is_finance_user());
