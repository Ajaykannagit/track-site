-- ============================================================
-- BRICKWELD PRIVATE LIMITED
-- Migration: Notifications & Deletion Approvals System
-- ============================================================

-- 1. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.notifications (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type              text NOT NULL DEFAULT 'edit', -- 'edit' | 'delete_request' | 'delete_approved' | 'delete_rejected'
  title             text NOT NULL,
  message           text,
  table_name        text,
  record_id         text,
  field_name        text,
  old_value         text,
  new_value         text,
  reason            text,
  target_role       text DEFAULT 'md',
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_email  text,
  is_read           boolean NOT NULL DEFAULT false,
  details           jsonb DEFAULT '{}'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_target_role ON public.notifications(target_role);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read     ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at  ON public.notifications(created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications select" ON public.notifications;
CREATE POLICY "notifications select" ON public.notifications
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "notifications insert" ON public.notifications;
CREATE POLICY "notifications insert" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "notifications update" ON public.notifications;
CREATE POLICY "notifications update" ON public.notifications
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "notifications delete" ON public.notifications;
CREATE POLICY "notifications delete" ON public.notifications
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'md'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;


-- 2. DELETION REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.deletion_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name        text NOT NULL,
  record_id         text NOT NULL,
  record_title      text NOT NULL,
  record_summary    text,
  record_data       jsonb DEFAULT '{}'::jsonb,
  reason            text NOT NULL,
  status            text NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  requested_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_by_email text,
  requested_at      timestamptz NOT NULL DEFAULT now(),
  reviewed_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_by_email text,
  reviewed_at       timestamptz,
  review_notes      text
);

CREATE INDEX IF NOT EXISTS idx_deletion_requests_status     ON public.deletion_requests(status);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_table_rec  ON public.deletion_requests(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_requested  ON public.deletion_requests(requested_at DESC);

ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deletion_requests select" ON public.deletion_requests;
CREATE POLICY "deletion_requests select" ON public.deletion_requests
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "deletion_requests insert" ON public.deletion_requests;
CREATE POLICY "deletion_requests insert" ON public.deletion_requests
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "deletion_requests update" ON public.deletion_requests;
CREATE POLICY "deletion_requests update" ON public.deletion_requests
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'md'))
  WITH CHECK (public.has_role(auth.uid(), 'md'));

DROP POLICY IF EXISTS "deletion_requests delete" ON public.deletion_requests;
CREATE POLICY "deletion_requests delete" ON public.deletion_requests
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'md'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deletion_requests TO authenticated;
GRANT ALL ON public.deletion_requests TO service_role;
