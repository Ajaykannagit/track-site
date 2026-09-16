-- ATTENDANCE PERMISSIONS RESTRICTION
-- MD / Administrator has full access; Site Supervisor has operational access.
-- Accounts / Back Office and Viewer are strictly read-only for attendance.

CREATE OR REPLACE FUNCTION public.can_write_attendance() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'md') OR public.has_role(auth.uid(), 'supervisor');
$$;

REVOKE ALL ON FUNCTION public.can_write_attendance() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_write_attendance() TO authenticated;

-- Replace generic site write policy on public.attendance with attendance-specific write policy
DROP POLICY IF EXISTS "site write" ON public.attendance;
DROP POLICY IF EXISTS "attendance write" ON public.attendance;

CREATE POLICY "attendance write" ON public.attendance FOR ALL TO authenticated
  USING (public.can_write_attendance())
  WITH CHECK (public.can_write_attendance());
