-- ============================================================
-- Update 6: Subcontractor Payments
-- Ad-hoc payments to painters, electricians, site vendors, etc.
-- These appear in the weekly attendance sheet "Other Payments" table.
-- ============================================================

CREATE TABLE IF NOT EXISTS subcontractor_payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,                      -- e.g. "Painter Sirenjeev", "Tamil Electrician"
  work_description text,                              -- e.g. "Painting work - Site 637"
  amount          numeric(12,2) NOT NULL DEFAULT 0,
  payment_date    date NOT NULL,
  week_start_date date NOT NULL,                      -- Monday of the week this belongs to
  project_id      uuid REFERENCES projects(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'job_done')),
  remarks         text,
  is_demo         boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Index for weekly attendance lookups
CREATE INDEX IF NOT EXISTS subcontractor_payments_week_idx
  ON subcontractor_payments (week_start_date);

CREATE INDEX IF NOT EXISTS subcontractor_payments_project_idx
  ON subcontractor_payments (project_id);

-- RLS
ALTER TABLE subcontractor_payments ENABLE ROW LEVEL SECURITY;

-- Only finance users (MD + Accounts) can read/write subcontractor payments
-- Supervisors cannot see financial amounts per the role matrix
CREATE POLICY "Finance users can manage subcontractor payments"
  ON subcontractor_payments
  FOR ALL
  TO authenticated
  USING (is_finance_user())
  WITH CHECK (is_finance_user());
