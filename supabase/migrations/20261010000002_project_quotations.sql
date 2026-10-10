-- MIGRATION: Mid-Project Quotations / Variations (Update 4)

CREATE TABLE IF NOT EXISTS public.project_quotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  quotation_number text,
  title text NOT NULL,
  description text,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  quotation_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'approved',
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_quotations_project_id ON public.project_quotations(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_quotations TO authenticated;
GRANT ALL ON public.project_quotations TO service_role;

ALTER TABLE public.project_quotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "project_quotations read policy" ON public.project_quotations FOR SELECT TO authenticated
  USING (public.is_finance_user());

CREATE POLICY "project_quotations write policy" ON public.project_quotations FOR ALL TO authenticated
  USING (public.is_finance_user())
  WITH CHECK (public.is_finance_user());
