-- ============================================================
-- BRICKWELD PRIVATE LIMITED — Phase 1: Audit Trail Migration
-- ============================================================

-- 1. Extend audit_logs table with first-class audit fields
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS module text,
  ADD COLUMN IF NOT EXISTS field_name text,
  ADD COLUMN IF NOT EXISTS old_value text,
  ADD COLUMN IF NOT EXISTS new_value text,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS user_role text,
  ADD COLUMN IF NOT EXISTS verification_status text;

-- 2. Performance indexes for audit lookups & reports
CREATE INDEX IF NOT EXISTS idx_audit_logs_record ON public.audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON public.audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_date   ON public.audit_logs(performed_at DESC);

-- 3. Security & Immutability: STRICT RLS
-- Audit logs must NEVER be updated or deleted by any user or role.
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Revoke update and delete completely for authenticated users
REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated;

-- Allow MD and Accounts to read audit logs
DROP POLICY IF EXISTS "audit read" ON public.audit_logs;
CREATE POLICY "audit read" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'md') OR public.has_role(auth.uid(), 'accounts'));

-- Allow inserting audit records
DROP POLICY IF EXISTS "audit insert" ON public.audit_logs;
CREATE POLICY "audit insert" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- 4. Server-side log helper function to guarantee server-side timestamps & auth ID
CREATE OR REPLACE FUNCTION public.record_audit_log(
  p_table_name text,
  p_record_id uuid,
  p_action text,
  p_module text,
  p_field_name text,
  p_old_value text,
  p_new_value text,
  p_reason text DEFAULT NULL,
  p_verification_status text DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_id uuid;
BEGIN
  -- Determine primary role of actor
  SELECT role::text INTO v_role
  FROM public.user_roles
  WHERE user_id = auth.uid()
  ORDER BY CASE role WHEN 'md' THEN 1 WHEN 'accounts' THEN 2 WHEN 'supervisor' THEN 3 ELSE 4 END
  LIMIT 1;

  INSERT INTO public.audit_logs (
    table_name,
    record_id,
    action,
    module,
    field_name,
    old_value,
    new_value,
    reason,
    user_role,
    verification_status,
    details,
    performed_by,
    performed_at
  ) VALUES (
    p_table_name,
    p_record_id,
    p_action,
    p_module,
    p_field_name,
    p_old_value,
    p_new_value,
    p_reason,
    COALESCE(v_role, 'unknown'),
    p_verification_status,
    p_details,
    auth.uid(),
    now()
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_audit_log TO authenticated;
