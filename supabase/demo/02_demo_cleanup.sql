-- ============================================================
-- 02_demo_cleanup.sql
-- Removes ONLY rows where is_demo = true, in correct FK order.
-- NEVER deletes real data.
-- Target: https://bcfirpcfowqaueqayksz.supabase.co
-- ============================================================

-- Leaf tables first (no other table FK-depends on them)
DELETE FROM public.machine_movements         WHERE is_demo = true;
DELETE FROM public.measurement_items         WHERE mb_id IN (SELECT id FROM public.measurement_books WHERE is_demo = true);
DELETE FROM public.material_receipt_items    WHERE receipt_id IN (SELECT id FROM public.material_receipts WHERE is_demo = true);
DELETE FROM public.purchase_order_items      WHERE po_id IN (SELECT id FROM public.purchase_orders WHERE is_demo = true);
DELETE FROM public.material_request_items    WHERE request_id IN (SELECT id FROM public.material_requests WHERE is_demo = true);

-- Child tables (reference parent tables below)
DELETE FROM public.contractor_payments       WHERE is_demo = true;
DELETE FROM public.contractor_bills          WHERE is_demo = true;
DELETE FROM public.client_payments           WHERE is_demo = true;
DELETE FROM public.payment_milestones        WHERE is_demo = true;
DELETE FROM public.measurement_books         WHERE is_demo = true;
DELETE FROM public.work_orders               WHERE is_demo = true;
DELETE FROM public.subcontractor_payments    WHERE is_demo = true;
DELETE FROM public.supplier_payments         WHERE is_demo = true;
DELETE FROM public.material_receipts         WHERE is_demo = true;
DELETE FROM public.purchase_orders           WHERE is_demo = true;
DELETE FROM public.material_requests         WHERE is_demo = true;
DELETE FROM public.weekly_wage_adjustments   WHERE is_demo = true;
DELETE FROM public.cash_closing              WHERE is_demo = true;
DELETE FROM public.expenses                  WHERE is_demo = true;

-- Attendance (only demo rows; leave real rows intact)
DELETE FROM public.attendance                WHERE is_demo = true;

-- project_quotations before projects
DELETE FROM public.project_quotations        WHERE is_demo = true;
DELETE FROM public.project_budgets
  WHERE project_id IN (SELECT id FROM public.projects WHERE is_demo = true);

DELETE FROM public.machines                  WHERE is_demo = true;

-- projects before clients
DELETE FROM public.projects                  WHERE is_demo = true;
DELETE FROM public.clients                   WHERE is_demo = true;

-- Suppliers & contractors
DELETE FROM public.supplier_payments         WHERE is_demo = true; -- already done above, safe to re-run
DELETE FROM public.suppliers                 WHERE is_demo = true;
DELETE FROM public.contractors               WHERE is_demo = true;

-- Employees before teams (team_id FK set to NULL on delete, but we still clear in order)
UPDATE public.employees SET team_id = NULL   WHERE is_demo = true;
DELETE FROM public.employees                 WHERE is_demo = true;
DELETE FROM public.teams                     WHERE is_demo = true;
DELETE FROM public.sites                     WHERE is_demo = true;
