-- =============================================================================
-- MIGRATION: 20261120000001_batch2_accountant_rights_safeguards.sql
-- =============================================================================
-- Requirements:
-- A1: Accountant manages the system, including assigning roles to other users.
-- Safeguard: Strictly block non-MD users (including Accountant) from:
--   1. Assigning the 'md' role to anyone.
--   2. Modifying or deleting any existing 'md' role assignment.
-- =============================================================================

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 1. Helper function: check if authenticated user can manage roles
CREATE OR REPLACE FUNCTION public.can_manage_roles() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_md() OR public.has_role(auth.uid(), 'accounts');
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_roles() TO authenticated;

-- 2. Read Policy: MD and Accountant can see all assigned roles; users see their own
DROP POLICY IF EXISTS "user_roles read policy" ON public.user_roles;
CREATE POLICY "user_roles read policy" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.can_manage_roles() OR user_id = auth.uid());

-- 3. Write Policy (INSERT / UPDATE / DELETE):
-- - MD can manage any role (full admin).
-- - Accountant can insert/update/delete non-MD roles only.
DROP POLICY IF EXISTS "user_roles admin write" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_write_policy" ON public.user_roles;

CREATE POLICY "user_roles_write_policy" ON public.user_roles
  FOR ALL TO authenticated
  USING (
    public.is_md() OR (
      public.has_role(auth.uid(), 'accounts') AND role != 'md'
    )
  )
  WITH CHECK (
    public.is_md() OR (
      public.has_role(auth.uid(), 'accounts') AND role != 'md'
    )
  );

-- 4. App Settings: Allow MD and Accountant to update settings
DROP POLICY IF EXISTS "settings write" ON public.app_settings;
DROP POLICY IF EXISTS "settings_write_policy" ON public.app_settings;

CREATE POLICY "settings_write_policy" ON public.app_settings
  FOR ALL TO authenticated
  USING (public.is_md() OR public.has_role(auth.uid(), 'accounts'))
  WITH CHECK (public.is_md() OR public.has_role(auth.uid(), 'accounts'));
