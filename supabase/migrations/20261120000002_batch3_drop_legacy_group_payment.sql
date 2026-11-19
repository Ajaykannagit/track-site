-- =============================================================================
-- MIGRATION: 20261120000002_batch3_drop_legacy_group_payment.sql
-- =============================================================================
-- Drops the obsolete legacy 9-argument overload of create_group_payment.
-- Only the 10-argument version with mandatory p_payment_source is retained.
-- =============================================================================

DROP FUNCTION IF EXISTS public.create_group_payment(
  text,
  uuid,
  date,
  numeric,
  text,
  text,
  text,
  text,
  jsonb
);
