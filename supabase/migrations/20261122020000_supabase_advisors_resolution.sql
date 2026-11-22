-- =========================================================================
-- MIGRATION: 20261122020000_supabase_advisors_resolution.sql
-- Resolves all Supabase database advisor linter warnings & errors:
-- 1. Security Views: Set security_invoker = true and grant SELECT on base tables
-- 2. Revoke execute on sensitive SECURITY DEFINER functions from anon/public
-- 3. Resolve multiple permissive policies by separating ALL into explicit INSERT/UPDATE/DELETE
-- 4. Fix auth_rls_initplan by wrapping auth.uid() in (SELECT auth.uid())
-- 5. Add covering indexes on all 60 unindexed foreign keys
-- =========================================================================

-- 1. Views security_invoker = true & grants
ALTER VIEW IF EXISTS public.projects_view SET (security_invoker = true);
ALTER VIEW IF EXISTS public.material_requests_view SET (security_invoker = true);
ALTER VIEW IF EXISTS public.employees_view SET (security_invoker = true);
ALTER VIEW IF EXISTS public.attendance_view SET (security_invoker = true);

GRANT SELECT ON public.projects TO authenticated;
GRANT SELECT ON public.employees TO authenticated;
GRANT SELECT ON public.attendance TO authenticated;
GRANT SELECT ON public.material_requests TO authenticated;

-- 2. Revoke execute on sensitive functions from anon and public
REVOKE EXECUTE ON FUNCTION public.approve_deletion_request(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_manage_masters() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_manage_projects() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.can_manage_roles() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.create_group_payment(text, uuid, date, numeric, text, text, text, text, jsonb, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.generate_receipt_number() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_account_balances() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_md_dashboard_financials() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_row_markers(text, uuid[]) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_attendance_wage_calc() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_finance_user() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_md() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_operations_user() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.record_audit_log(text, uuid, text, text, text, text, text, text, text, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.reject_deletion_request(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.restore_record(text, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.save_material_request_with_items(uuid, jsonb, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.save_purchase_order_with_items(uuid, jsonb, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.soft_delete_record(text, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.soft_delete_record(text, uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.soft_delete_records(text, uuid[], text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.trg_audit_money_entry() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.trg_track_row_edits() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.unvoid_record(text, uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.void_group_payment(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.void_record(text, uuid, text) FROM anon, public;

-- 3. Resolve redundant & duplicate policies on base tables

-- clients
DROP POLICY IF EXISTS "read all" ON public.clients;
DROP POLICY IF EXISTS "clients select policy" ON public.clients;
CREATE POLICY "clients_select_policy" ON public.clients FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

-- projects
DROP POLICY IF EXISTS "read all" ON public.projects;
DROP POLICY IF EXISTS "projects select policy" ON public.projects;
CREATE POLICY "projects_select_policy" ON public.projects FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

-- material_requests
DROP POLICY IF EXISTS "read all" ON public.material_requests;
DROP POLICY IF EXISTS "material_requests select policy" ON public.material_requests;
CREATE POLICY "material_requests_select_policy" ON public.material_requests FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.is_operations_user());

-- material_receipts
DROP POLICY IF EXISTS "read all" ON public.material_receipts;
DROP POLICY IF EXISTS "material_receipts select policy" ON public.material_receipts;
CREATE POLICY "material_receipts_select_policy" ON public.material_receipts FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.is_operations_user());

-- material_receipt_items
DROP POLICY IF EXISTS "read all" ON public.material_receipt_items;
DROP POLICY IF EXISTS "material_receipt_items select policy" ON public.material_receipt_items;
CREATE POLICY "material_receipt_items_select_policy" ON public.material_receipt_items FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.is_operations_user());

-- material_request_items
DROP POLICY IF EXISTS "read all" ON public.material_request_items;
DROP POLICY IF EXISTS "items select" ON public.material_request_items;
DROP POLICY IF EXISTS "items insert" ON public.material_request_items;
DROP POLICY IF EXISTS "items update" ON public.material_request_items;
DROP POLICY IF EXISTS "items delete" ON public.material_request_items;
DROP POLICY IF EXISTS "material_request_items select policy" ON public.material_request_items;
CREATE POLICY "material_request_items_select_policy" ON public.material_request_items FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.is_operations_user());

-- account_transfers
DROP POLICY IF EXISTS "transfers select" ON public.account_transfers;
DROP POLICY IF EXISTS "transfers insert" ON public.account_transfers;
DROP POLICY IF EXISTS "transfers update" ON public.account_transfers;
DROP POLICY IF EXISTS "transfers delete" ON public.account_transfers;
DROP POLICY IF EXISTS "account_transfers select policy" ON public.account_transfers;
DROP POLICY IF EXISTS "account_transfers insert policy" ON public.account_transfers;
DROP POLICY IF EXISTS "account_transfers update policy" ON public.account_transfers;

CREATE POLICY "account_transfers_select_policy" ON public.account_transfers FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts')));
CREATE POLICY "account_transfers_insert_policy" ON public.account_transfers FOR INSERT TO authenticated
  WITH CHECK (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'));
CREATE POLICY "account_transfers_update_policy" ON public.account_transfers FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts')))
  WITH CHECK (deleted_at IS NULL AND (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts')));
CREATE POLICY "account_transfers_delete_policy" ON public.account_transfers FOR DELETE TO authenticated
  USING (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'));

-- subcontractor_payments
DROP POLICY IF EXISTS "Finance users can manage subcontractor payments" ON public.subcontractor_payments;

-- supplier_payments
DROP POLICY IF EXISTS "supplier_payments finance write" ON public.supplier_payments;
DROP POLICY IF EXISTS "supplier_payments read all" ON public.supplier_payments;

-- work_orders
DROP POLICY IF EXISTS "read all" ON public.work_orders;
DROP POLICY IF EXISTS "finance write" ON public.work_orders;
CREATE POLICY "work_orders_select_policy" ON public.work_orders FOR SELECT TO authenticated
  USING (deleted_at IS NULL);
CREATE POLICY "work_orders_insert_policy" ON public.work_orders FOR INSERT TO authenticated
  WITH CHECK (public.can_write_finance());
CREATE POLICY "work_orders_update_policy" ON public.work_orders FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND public.can_write_finance())
  WITH CHECK (deleted_at IS NULL AND public.can_write_finance());
CREATE POLICY "work_orders_delete_policy" ON public.work_orders FOR DELETE TO authenticated
  USING (public.can_write_finance());

-- machine_movements
DROP POLICY IF EXISTS "read all" ON public.machine_movements;
DROP POLICY IF EXISTS "site write" ON public.machine_movements;
CREATE POLICY "machine_movements_select_policy" ON public.machine_movements FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "machine_movements_insert_policy" ON public.machine_movements FOR INSERT TO authenticated
  WITH CHECK (public.can_write_site());
CREATE POLICY "machine_movements_update_policy" ON public.machine_movements FOR UPDATE TO authenticated
  USING (public.can_write_site())
  WITH CHECK (public.can_write_site());
CREATE POLICY "machine_movements_delete_policy" ON public.machine_movements FOR DELETE TO authenticated
  USING (public.can_write_site());

-- measurement_books
DROP POLICY IF EXISTS "read all" ON public.measurement_books;
DROP POLICY IF EXISTS "site write" ON public.measurement_books;
CREATE POLICY "measurement_books_select_policy" ON public.measurement_books FOR SELECT TO authenticated
  USING (deleted_at IS NULL);
CREATE POLICY "measurement_books_insert_policy" ON public.measurement_books FOR INSERT TO authenticated
  WITH CHECK (public.can_write_site());
CREATE POLICY "measurement_books_update_policy" ON public.measurement_books FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND public.can_write_site())
  WITH CHECK (deleted_at IS NULL AND public.can_write_site());
CREATE POLICY "measurement_books_delete_policy" ON public.measurement_books FOR DELETE TO authenticated
  USING (public.can_write_site());

-- measurement_items
DROP POLICY IF EXISTS "read all" ON public.measurement_items;
DROP POLICY IF EXISTS "site write" ON public.measurement_items;
CREATE POLICY "measurement_items_select_policy" ON public.measurement_items FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "measurement_items_insert_policy" ON public.measurement_items FOR INSERT TO authenticated
  WITH CHECK (public.can_write_site());
CREATE POLICY "measurement_items_update_policy" ON public.measurement_items FOR UPDATE TO authenticated
  USING (public.can_write_site())
  WITH CHECK (public.can_write_site());
CREATE POLICY "measurement_items_delete_policy" ON public.measurement_items FOR DELETE TO authenticated
  USING (public.can_write_site());

-- project_documents
DROP POLICY IF EXISTS "read all" ON public.project_documents;
DROP POLICY IF EXISTS "site write" ON public.project_documents;
CREATE POLICY "project_documents_select_policy" ON public.project_documents FOR SELECT TO authenticated
  USING (true);
CREATE POLICY "project_documents_insert_policy" ON public.project_documents FOR INSERT TO authenticated
  WITH CHECK (public.can_write_site());
CREATE POLICY "project_documents_update_policy" ON public.project_documents FOR UPDATE TO authenticated
  USING (public.can_write_site())
  WITH CHECK (public.can_write_site());
CREATE POLICY "project_documents_delete_policy" ON public.project_documents FOR DELETE TO authenticated
  USING (public.can_write_site());

-- payroll
DROP POLICY IF EXISTS "finance write" ON public.payroll;
CREATE POLICY "payroll_insert_policy" ON public.payroll FOR INSERT TO authenticated
  WITH CHECK (public.can_write_finance());
CREATE POLICY "payroll_update_policy" ON public.payroll FOR UPDATE TO authenticated
  USING (public.can_write_finance())
  WITH CHECK (public.can_write_finance());
CREATE POLICY "payroll_delete_policy" ON public.payroll FOR DELETE TO authenticated
  USING (public.can_write_finance());

-- payroll_items
DROP POLICY IF EXISTS "finance write" ON public.payroll_items;
CREATE POLICY "payroll_items_insert_policy" ON public.payroll_items FOR INSERT TO authenticated
  WITH CHECK (public.can_write_finance());
CREATE POLICY "payroll_items_update_policy" ON public.payroll_items FOR UPDATE TO authenticated
  USING (public.can_write_finance())
  WITH CHECK (public.can_write_finance());
CREATE POLICY "payroll_items_delete_policy" ON public.payroll_items FOR DELETE TO authenticated
  USING (public.can_write_finance());

-- project_quotations
DROP POLICY IF EXISTS "project_quotations write policy" ON public.project_quotations;
CREATE POLICY "project_quotations_insert_policy" ON public.project_quotations FOR INSERT TO authenticated
  WITH CHECK (public.is_finance_user());
CREATE POLICY "project_quotations_update_policy" ON public.project_quotations FOR UPDATE TO authenticated
  USING (public.is_finance_user())
  WITH CHECK (public.is_finance_user());
CREATE POLICY "project_quotations_delete_policy" ON public.project_quotations FOR DELETE TO authenticated
  USING (public.is_finance_user());

-- sites
DROP POLICY IF EXISTS "sites write policy" ON public.sites;
CREATE POLICY "sites_insert_policy" ON public.sites FOR INSERT TO authenticated
  WITH CHECK (public.is_operations_user());
CREATE POLICY "sites_update_policy" ON public.sites FOR UPDATE TO authenticated
  USING (public.is_operations_user())
  WITH CHECK (public.is_operations_user());
CREATE POLICY "sites_delete_policy" ON public.sites FOR DELETE TO authenticated
  USING (public.is_operations_user());

-- teams
DROP POLICY IF EXISTS "teams write policy" ON public.teams;
CREATE POLICY "teams_insert_policy" ON public.teams FOR INSERT TO authenticated
  WITH CHECK (public.is_operations_user());
CREATE POLICY "teams_update_policy" ON public.teams FOR UPDATE TO authenticated
  USING (public.is_operations_user())
  WITH CHECK (public.is_operations_user());
CREATE POLICY "teams_delete_policy" ON public.teams FOR DELETE TO authenticated
  USING (public.is_operations_user());

-- team_members
DROP POLICY IF EXISTS "team_members_write_policy" ON public.team_members;
CREATE POLICY "team_members_insert_policy" ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'));
CREATE POLICY "team_members_update_policy" ON public.team_members FOR UPDATE TO authenticated
  USING (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'))
  WITH CHECK (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'));
CREATE POLICY "team_members_delete_policy" ON public.team_members FOR DELETE TO authenticated
  USING (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'));

-- account_opening_balances
DROP POLICY IF EXISTS "aob_write" ON public.account_opening_balances;
CREATE POLICY "aob_insert_policy" ON public.account_opening_balances FOR INSERT TO authenticated
  WITH CHECK (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'));
CREATE POLICY "aob_update_policy" ON public.account_opening_balances FOR UPDATE TO authenticated
  USING (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'))
  WITH CHECK (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'));
CREATE POLICY "aob_delete_policy" ON public.account_opening_balances FOR DELETE TO authenticated
  USING (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'));

-- app_settings
DROP POLICY IF EXISTS "settings_write_policy" ON public.app_settings;
CREATE POLICY "settings_insert_policy" ON public.app_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'));
CREATE POLICY "settings_update_policy" ON public.app_settings FOR UPDATE TO authenticated
  USING (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'))
  WITH CHECK (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'));
CREATE POLICY "settings_delete_policy" ON public.app_settings FOR DELETE TO authenticated
  USING (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'));

-- group_payments
DROP POLICY IF EXISTS "group_payments_write_policy" ON public.group_payments;
CREATE POLICY "group_payments_insert_policy" ON public.group_payments FOR INSERT TO authenticated
  WITH CHECK (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'));
CREATE POLICY "group_payments_update_policy" ON public.group_payments FOR UPDATE TO authenticated
  USING (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'))
  WITH CHECK (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'));
CREATE POLICY "group_payments_delete_policy" ON public.group_payments FOR DELETE TO authenticated
  USING (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'));

-- group_payment_allocations
DROP POLICY IF EXISTS "group_alloc_write_policy" ON public.group_payment_allocations;
CREATE POLICY "group_alloc_insert_policy" ON public.group_payment_allocations FOR INSERT TO authenticated
  WITH CHECK (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'));
CREATE POLICY "group_alloc_update_policy" ON public.group_payment_allocations FOR UPDATE TO authenticated
  USING (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'))
  WITH CHECK (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'));
CREATE POLICY "group_alloc_delete_policy" ON public.group_payment_allocations FOR DELETE TO authenticated
  USING (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'));

-- job_types
DROP POLICY IF EXISTS "job_types_write_policy" ON public.job_types;
CREATE POLICY "job_types_insert_policy" ON public.job_types FOR INSERT TO authenticated
  WITH CHECK (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'));
CREATE POLICY "job_types_update_policy" ON public.job_types FOR UPDATE TO authenticated
  USING (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'))
  WITH CHECK (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'));
CREATE POLICY "job_types_delete_policy" ON public.job_types FOR DELETE TO authenticated
  USING (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'));

-- labour_wage_payments
DROP POLICY IF EXISTS "lwp_write_policy" ON public.labour_wage_payments;
CREATE POLICY "lwp_insert_policy" ON public.labour_wage_payments FOR INSERT TO authenticated
  WITH CHECK (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'));
CREATE POLICY "lwp_update_policy" ON public.labour_wage_payments FOR UPDATE TO authenticated
  USING (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'))
  WITH CHECK (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'));
CREATE POLICY "lwp_delete_policy" ON public.labour_wage_payments FOR DELETE TO authenticated
  USING (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'));

-- md_investments
DROP POLICY IF EXISTS "mdi_write" ON public.md_investments;
CREATE POLICY "mdi_insert_policy" ON public.md_investments FOR INSERT TO authenticated
  WITH CHECK (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'));
CREATE POLICY "mdi_update_policy" ON public.md_investments FOR UPDATE TO authenticated
  USING (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'))
  WITH CHECK (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'));
CREATE POLICY "mdi_delete_policy" ON public.md_investments FOR DELETE TO authenticated
  USING (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'));

-- user_roles
DROP POLICY IF EXISTS "user_roles_write_policy" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles read policy" ON public.user_roles;
CREATE POLICY "user_roles_select_policy" ON public.user_roles FOR SELECT TO authenticated
  USING (public.can_manage_roles() OR user_id = (SELECT auth.uid()));
CREATE POLICY "user_roles_insert_policy" ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.is_md() OR (public.has_role((SELECT auth.uid()), 'accounts') AND role <> 'md'::app_role));
CREATE POLICY "user_roles_update_policy" ON public.user_roles FOR UPDATE TO authenticated
  USING (public.is_md() OR (public.has_role((SELECT auth.uid()), 'accounts') AND role <> 'md'::app_role))
  WITH CHECK (public.is_md() OR (public.has_role((SELECT auth.uid()), 'accounts') AND role <> 'md'::app_role));
CREATE POLICY "user_roles_delete_policy" ON public.user_roles FOR DELETE TO authenticated
  USING (public.is_md() OR (public.has_role((SELECT auth.uid()), 'accounts') AND role <> 'md'::app_role));

-- profiles (InitPlan optimization)
DROP POLICY IF EXISTS "own profile write" ON public.profiles;
DROP POLICY IF EXISTS "own profile insert" ON public.profiles;
CREATE POLICY "profiles_insert_policy" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = (SELECT auth.uid()));
CREATE POLICY "profiles_update_policy" ON public.profiles FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- cash_closing (InitPlan optimization)
DROP POLICY IF EXISTS "cash_closing select policy" ON public.cash_closing;
DROP POLICY IF EXISTS "cash_closing insert policy" ON public.cash_closing;
DROP POLICY IF EXISTS "cash_closing update policy" ON public.cash_closing;
CREATE POLICY "cash_closing_select_policy" ON public.cash_closing FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts')));
CREATE POLICY "cash_closing_insert_policy" ON public.cash_closing FOR INSERT TO authenticated
  WITH CHECK (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'));
CREATE POLICY "cash_closing_update_policy" ON public.cash_closing FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts')))
  WITH CHECK (deleted_at IS NULL AND (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts')));

-- expenses (InitPlan optimization)
DROP POLICY IF EXISTS "expenses select policy" ON public.expenses;
DROP POLICY IF EXISTS "expenses insert policy" ON public.expenses;
DROP POLICY IF EXISTS "expenses update policy" ON public.expenses;
CREATE POLICY "expenses_select_policy" ON public.expenses FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts') OR (public.has_role((SELECT auth.uid()), 'supervisor') AND project_id IS NOT NULL)));
CREATE POLICY "expenses_insert_policy" ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts') OR public.has_role((SELECT auth.uid()), 'supervisor') OR (SELECT auth.uid()) IS NOT NULL);
CREATE POLICY "expenses_update_policy" ON public.expenses FOR UPDATE TO authenticated
  USING (deleted_at IS NULL AND (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts') OR (public.has_role((SELECT auth.uid()), 'supervisor') AND project_id IS NOT NULL)))
  WITH CHECK (deleted_at IS NULL AND (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts') OR (public.has_role((SELECT auth.uid()), 'supervisor') AND project_id IS NOT NULL)));

-- deletion_requests (InitPlan optimization)
DROP POLICY IF EXISTS "deletion_requests insert" ON public.deletion_requests;
DROP POLICY IF EXISTS "deletion_requests select" ON public.deletion_requests;
CREATE POLICY "deletion_requests_insert_policy" ON public.deletion_requests FOR INSERT TO authenticated
  WITH CHECK (requested_by = (SELECT auth.uid()));
CREATE POLICY "deletion_requests_select_policy" ON public.deletion_requests FOR SELECT TO authenticated
  USING (public.is_md() OR requested_by = (SELECT auth.uid()));

-- notification_reads (InitPlan optimization)
DROP POLICY IF EXISTS "notification_reads select own" ON public.notification_reads;
DROP POLICY IF EXISTS "notification_reads insert own" ON public.notification_reads;
DROP POLICY IF EXISTS "notification_reads update own" ON public.notification_reads;
CREATE POLICY "notification_reads_select_policy" ON public.notification_reads FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
CREATE POLICY "notification_reads_insert_policy" ON public.notification_reads FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "notification_reads_update_policy" ON public.notification_reads FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- audit_logs (InitPlan optimization)
DROP POLICY IF EXISTS "audit insert" ON public.audit_logs;
DROP POLICY IF EXISTS "audit read" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_policy" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (performed_by = (SELECT auth.uid()) OR (SELECT auth.uid()) IS NULL);
CREATE POLICY "audit_logs_select_policy" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_md() OR public.has_role((SELECT auth.uid()), 'accounts'));

-- 4. Foreign Key Covering Indexes
CREATE INDEX IF NOT EXISTS idx_account_opening_balances_updated_by ON public.account_opening_balances(updated_by);
CREATE INDEX IF NOT EXISTS idx_account_transfers_created_by ON public.account_transfers(created_by);
CREATE INDEX IF NOT EXISTS idx_account_transfers_project_id ON public.account_transfers(project_id);
CREATE INDEX IF NOT EXISTS idx_account_transfers_voided_by ON public.account_transfers(voided_by);
CREATE INDEX IF NOT EXISTS idx_attendance_site_id ON public.attendance(site_id);
CREATE INDEX IF NOT EXISTS idx_cash_closing_project_id ON public.cash_closing(project_id);
CREATE INDEX IF NOT EXISTS idx_cash_closing_voided_by ON public.cash_closing(voided_by);
CREATE INDEX IF NOT EXISTS idx_client_payments_client_id ON public.client_payments(client_id);
CREATE INDEX IF NOT EXISTS idx_client_payments_voided_by ON public.client_payments(voided_by);
CREATE INDEX IF NOT EXISTS idx_contractor_bills_contractor_id ON public.contractor_bills(contractor_id);
CREATE INDEX IF NOT EXISTS idx_contractor_bills_project_id ON public.contractor_bills(project_id);
CREATE INDEX IF NOT EXISTS idx_contractor_bills_voided_by ON public.contractor_bills(voided_by);
CREATE INDEX IF NOT EXISTS idx_contractor_bills_work_order_id ON public.contractor_bills(work_order_id);
CREATE INDEX IF NOT EXISTS idx_contractor_payments_bill_id ON public.contractor_payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_contractor_payments_contractor_id ON public.contractor_payments(contractor_id);
CREATE INDEX IF NOT EXISTS idx_contractor_payments_project_id ON public.contractor_payments(project_id);
CREATE INDEX IF NOT EXISTS idx_contractor_payments_voided_by ON public.contractor_payments(voided_by);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_requested_by ON public.deletion_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_reviewed_by ON public.deletion_requests(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_employees_team_id ON public.employees(team_id);
CREATE INDEX IF NOT EXISTS idx_expenses_voided_by ON public.expenses(voided_by);
CREATE INDEX IF NOT EXISTS idx_group_payment_allocations_contractor_bill_id ON public.group_payment_allocations(contractor_bill_id);
CREATE INDEX IF NOT EXISTS idx_group_payments_created_by ON public.group_payments(created_by);
CREATE INDEX IF NOT EXISTS idx_group_payments_voided_by ON public.group_payments(voided_by);
CREATE INDEX IF NOT EXISTS idx_job_types_created_by ON public.job_types(created_by);
CREATE INDEX IF NOT EXISTS idx_labour_wage_payments_created_by ON public.labour_wage_payments(created_by);
CREATE INDEX IF NOT EXISTS idx_labour_wage_payments_voided_by ON public.labour_wage_payments(voided_by);
CREATE INDEX IF NOT EXISTS idx_machine_movements_machine_id ON public.machine_movements(machine_id);
CREATE INDEX IF NOT EXISTS idx_machine_movements_project_id ON public.machine_movements(project_id);
CREATE INDEX IF NOT EXISTS idx_material_receipt_items_po_item_id ON public.material_receipt_items(po_item_id);
CREATE INDEX IF NOT EXISTS idx_material_receipt_items_receipt_id ON public.material_receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_material_receipts_po_id ON public.material_receipts(po_id);
CREATE INDEX IF NOT EXISTS idx_material_receipts_project_id ON public.material_receipts(project_id);
CREATE INDEX IF NOT EXISTS idx_material_receipts_supplier_id ON public.material_receipts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_material_request_items_request_id ON public.material_request_items(request_id);
CREATE INDEX IF NOT EXISTS idx_material_requests_project_id ON public.material_requests(project_id);
CREATE INDEX IF NOT EXISTS idx_material_requests_voided_by ON public.material_requests(voided_by);
CREATE INDEX IF NOT EXISTS idx_md_investments_created_by ON public.md_investments(created_by);
CREATE INDEX IF NOT EXISTS idx_md_investments_voided_by ON public.md_investments(voided_by);
CREATE INDEX IF NOT EXISTS idx_measurement_books_contractor_id ON public.measurement_books(contractor_id);
CREATE INDEX IF NOT EXISTS idx_measurement_books_project_id ON public.measurement_books(project_id);
CREATE INDEX IF NOT EXISTS idx_measurement_books_work_order_id ON public.measurement_books(work_order_id);
CREATE INDEX IF NOT EXISTS idx_measurement_items_mb_id ON public.measurement_items(mb_id);
CREATE INDEX IF NOT EXISTS idx_notification_reads_user_id ON public.notification_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_by ON public.notifications(created_by);
CREATE INDEX IF NOT EXISTS idx_notifications_target_user_id ON public.notifications(target_user_id);
CREATE INDEX IF NOT EXISTS idx_payroll_project_id ON public.payroll(project_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_employee_id ON public.payroll_items(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_payroll_id ON public.payroll_items(payroll_id);
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON public.projects(client_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po_id ON public.purchase_order_items(po_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_project_id ON public.purchase_orders(project_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_request_id ON public.purchase_orders(request_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_supplier_id ON public.purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_voided_by ON public.purchase_orders(voided_by);
CREATE INDEX IF NOT EXISTS idx_subcontractor_payments_voided_by ON public.subcontractor_payments(voided_by);
CREATE INDEX IF NOT EXISTS idx_supplier_payments_voided_by ON public.supplier_payments(voided_by);
CREATE INDEX IF NOT EXISTS idx_team_members_created_by ON public.team_members(created_by);
CREATE INDEX IF NOT EXISTS idx_work_orders_contractor_id ON public.work_orders(contractor_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_project_id ON public.work_orders(project_id);
