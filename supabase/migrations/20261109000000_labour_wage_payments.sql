-- =========================================================================
-- MIGRATION: 20261109000000_labour_wage_payments.sql
-- PURPOSE:
--   Track partial / instalment payments made against each worker's weekly
--   earned wage (separate from weekly_wage_adjustments advance column which
--   is a pre-pay advance).  Supports cumulative unpaid balance carry-over.
-- =========================================================================

-- -------------------------------------------------------------------------
-- TABLE: labour_wage_payments
-- Records one or more cash/account payments made against a worker's wage
-- for a given week.  Many payments per (employee, week) are allowed.
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.labour_wage_payments (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       uuid        NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  week_start_date   date        NOT NULL,
  payment_date      date        NOT NULL DEFAULT CURRENT_DATE,
  amount_paid       numeric(14,2) NOT NULL CHECK (amount_paid > 0),
  payment_method    text        NOT NULL DEFAULT 'cash'
                                CHECK (payment_method IN ('cash','upi','bank','cheque','other')),
  reference_number  text,
  remarks           text,
  is_void           boolean     NOT NULL DEFAULT false,
  voided_at         timestamptz,
  voided_by         uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.labour_wage_payments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'labour_wage_payments' AND policyname = 'lwp_select_policy'
  ) THEN
    CREATE POLICY "lwp_select_policy" ON public.labour_wage_payments
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'labour_wage_payments' AND policyname = 'lwp_write_policy'
  ) THEN
    CREATE POLICY "lwp_write_policy" ON public.labour_wage_payments
      FOR ALL TO authenticated
      USING  (public.is_md() OR public.has_role(auth.uid(), 'accounts'))
      WITH CHECK (public.is_md() OR public.has_role(auth.uid(), 'accounts'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_lwp_employee    ON public.labour_wage_payments(employee_id);
CREATE INDEX IF NOT EXISTS idx_lwp_week        ON public.labour_wage_payments(week_start_date);
CREATE INDEX IF NOT EXISTS idx_lwp_emp_week    ON public.labour_wage_payments(employee_id, week_start_date);
CREATE INDEX IF NOT EXISTS idx_lwp_void        ON public.labour_wage_payments(is_void);

GRANT SELECT, INSERT, UPDATE ON public.labour_wage_payments TO authenticated;
