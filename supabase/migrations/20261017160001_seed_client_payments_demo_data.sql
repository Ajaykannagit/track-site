-- =========================================================================
-- 20261017160001_seed_client_payments_demo_data.sql
-- Demo Dataset for Client Payments & Receivables
-- Exactly matches requirements:
-- Project A (DEMO-PRJ-A): CV ₹20,00,000, Adv agreed ₹4,00,000; Adv received ₹3,00,000; Progress received ₹2,00,000 -> Total ₹5,00,000; Pending ₹15,00,000.
-- Project B (DEMO-PRJ-B): CV ₹15,00,000, Progress received ₹2,00,000, ₹3,00,000, ₹1,50,000 -> Total ₹6,50,000; Pending ₹8,50,000.
-- Project C (DEMO-PRJ-C): CV ₹8,00,000, Adv received ₹2,00,000, Progress ₹4,00,000, Final ₹2,00,000 -> Total ₹8,00,000; Pending ₹0 (Fully Paid).
-- Project D (DEMO-PRJ-D): CV ₹12,00,000, No payments received -> Total ₹0; Pending ₹12,00,000.
-- =========================================================================

DO $$
DECLARE
  v_cli_a uuid := '11111111-cccc-cccc-cccc-111111111101';
  v_cli_b uuid := '11111111-cccc-cccc-cccc-111111111102';
  v_cli_c uuid := '11111111-cccc-cccc-cccc-111111111103';
  v_cli_d uuid := '11111111-cccc-cccc-cccc-111111111104';

  v_prj_a uuid := '22222222-cccc-cccc-cccc-222222222201';
  v_prj_b uuid := '22222222-cccc-cccc-cccc-222222222202';
  v_prj_c uuid := '22222222-cccc-cccc-cccc-222222222203';
  v_prj_d uuid := '22222222-cccc-cccc-cccc-222222222204';
BEGIN

  -- 1. Clients
  INSERT INTO public.clients (id, name, address, contact_person, phone, email, is_demo) VALUES
    (v_cli_a, 'Apex Infra & Properties (DEMO)', 'Block 4, OMR IT Corridor, Chennai', 'Karthik Raja', '+91 98401 22334', 'karthik@apexinfra.demo', true),
    (v_cli_b, 'Blue Horizon Estates (DEMO)',   '72 Race Course Road, Coimbatore',    'Meenakshi Sundaram', '+91 94432 55667', 'meenakshi@bluehorizon.demo', true),
    (v_cli_c, 'Crestline Retail Solutions (DEMO)', '15 MG Road, Bangalore',          'Vikram Seth', '+91 98860 77889', 'vikram@crestline.demo', true),
    (v_cli_d, 'Dynasty Hospitality (DEMO)',    '88 Beach Road, Pondicherry',         'Ananya Deshmukh', '+91 99403 99001', 'ananya@dynasty.demo', true)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    is_demo = true;

  -- 2. Projects
  INSERT INTO public.projects (id, project_code, name, client_id, quotation_amount, agreement_details, status, is_demo, start_date, expected_completion_date) VALUES
    (v_prj_a, 'DEMO-PRJ-A', 'Apex Commercial Tower (DEMO)',  v_cli_a, 2000000, 'Agreed advance ₹4,00,000 (20%). Milestone billing on slab completion.', 'active', true, '2026-08-01', '2027-04-30'),
    (v_prj_b, 'DEMO-PRJ-B', 'Blue Horizon Residency (DEMO)', v_cli_b, 1500000, 'Running account billing on monthly RA bills.', 'active', true, '2026-07-15', '2027-02-28'),
    (v_prj_c, 'DEMO-PRJ-C', 'Crestline Showroom (DEMO)',    v_cli_c,  800000, 'Turnkey interior fitout. Complete payment upon handover.', 'completed', true, '2026-05-01', '2026-09-30'),
    (v_prj_d, 'DEMO-PRJ-D', 'Dynasty Heritage Resort (DEMO)', v_cli_d, 1200000, 'Initial phase civil & landscaping works.', 'planning', true, '2026-10-01', '2027-06-30')
  ON CONFLICT (id) DO UPDATE SET
    project_code = EXCLUDED.project_code,
    name = EXCLUDED.name,
    quotation_amount = EXCLUDED.quotation_amount,
    agreement_details = EXCLUDED.agreement_details,
    is_demo = true;

  -- 3. Milestones (including upcoming & overdue milestones)
  DELETE FROM public.payment_milestones WHERE project_id IN (v_prj_a, v_prj_b, v_prj_c, v_prj_d);

  -- Project A Milestones
  INSERT INTO public.payment_milestones (project_id, title, description, expected_amount, due_date, order_index, status, is_demo) VALUES
    (v_prj_a, 'Contract Advance (20%)', 'Mobilization advance agreed upon signing', 400000, '2026-08-10', 1, 'partially_paid', true),
    (v_prj_a, 'Foundation & Plinth Completion', 'Substructure casting & plinth beam sign-off', 500000, '2026-09-15', 2, 'partially_paid', true),
    (v_prj_a, 'Superstructure Slab 1', 'First floor slab casting milestone (Overdue)', 500000, '2026-10-05', 3, 'pending', true),
    (v_prj_a, 'Finishing & Handover', 'Final handover milestone (Upcoming)', 600000, '2026-12-15', 4, 'pending', true);

  -- Project B Milestones
  INSERT INTO public.payment_milestones (project_id, title, description, expected_amount, due_date, order_index, status, is_demo) VALUES
    (v_prj_b, 'RA Bill 1 - Structural framing', 'First running bill certified by PMC', 200000, '2026-08-05', 1, 'paid', true),
    (v_prj_b, 'RA Bill 2 - Masonry & Plastering', 'Second running progress bill', 300000, '2026-08-25', 2, 'paid', true),
    (v_prj_b, 'RA Bill 3 - Flooring & Plumbing', 'Third running bill certified', 150000, '2026-09-20', 3, 'paid', true),
    (v_prj_b, 'RA Bill 4 - Electrical & Painting (Upcoming)', 'Upcoming progress milestone', 450000, '2026-11-15', 4, 'pending', true),
    (v_prj_b, 'Final Retention Release (Upcoming)', 'Release of 5% retention after snag list', 400000, '2027-01-31', 5, 'pending', true);

  -- Project C Milestones (Fully settled)
  INSERT INTO public.payment_milestones (project_id, title, description, expected_amount, due_date, order_index, status, is_demo) VALUES
    (v_prj_c, 'Advance Mobilization', 'Signing advance', 200000, '2026-05-10', 1, 'paid', true),
    (v_prj_c, 'Mid-Stage Fitout Progress', 'False ceiling and joinery execution', 400000, '2026-07-20', 2, 'paid', true),
    (v_prj_c, 'Final Settlement on Handover', 'Complete handover and snag completion', 200000, '2026-09-28', 3, 'paid', true);

  -- Project D Milestones (No payments yet, upcoming milestone)
  INSERT INTO public.payment_milestones (project_id, title, description, expected_amount, due_date, order_index, status, is_demo) VALUES
    (v_prj_d, 'Mobilization Advance (Overdue)', 'Initial mobilization advance due before site prep', 300000, '2026-10-10', 1, 'pending', true),
    (v_prj_d, 'Site Clearance & Excavation', 'Excavation & boundary marking', 400000, '2026-11-20', 2, 'pending', true),
    (v_prj_d, 'Foundation Concrete Milestone', 'PCC and RCC foundations', 500000, '2027-01-15', 3, 'pending', true);

  -- 4. Client Receipts / Payments
  DELETE FROM public.client_payments WHERE project_id IN (v_prj_a, v_prj_b, v_prj_c, v_prj_d);

  -- Project A Receipts: ₹3,00,000 (Advance) + ₹2,00,000 (Progress) = ₹5,00,000 Total
  INSERT INTO public.client_payments (
    receipt_number, project_id, client_id, amount, payment_date,
    payment_method, reference_number, payment_category, invoice_reference,
    notes, status, account_type, is_demo
  ) VALUES
    ('DEMO-RCP-A01', v_prj_a, v_cli_a, 300000, '2026-08-12', 'bank', 'HDFC-NEFT-884102', 'advance', 'AGR/2026/A-ADV', 'Part advance received against agreed ₹4,00,000 (DEMO)', 'received', 'bank', true),
    ('DEMO-RCP-A02', v_prj_a, v_cli_a, 200000, '2026-09-18', 'bank', 'HDFC-RTGS-993214', 'progress', 'RA-BILL-01', 'Progress payment against substructure milestone (DEMO)', 'received', 'bank', true);

  -- Project B Receipts: ₹2,00,000 + ₹3,00,000 + ₹1,50,000 = ₹6,50,000 Total
  INSERT INTO public.client_payments (
    receipt_number, project_id, client_id, amount, payment_date,
    payment_method, reference_number, payment_category, invoice_reference,
    notes, status, account_type, is_demo
  ) VALUES
    ('DEMO-RCP-B01', v_prj_b, v_cli_b, 200000, '2026-08-08', 'bank', 'ICICI-IMPS-119284', 'progress', 'RA-BILL-01', 'Progress receipt for structural framing (DEMO)', 'received', 'bank', true),
    ('DEMO-RCP-B02', v_prj_b, v_cli_b, 300000, '2026-08-28', 'bank', 'ICICI-NEFT-550192', 'progress', 'RA-BILL-02', 'Progress receipt for masonry work (DEMO)', 'received', 'bank', true),
    ('DEMO-RCP-B03', v_prj_b, v_cli_b, 150000, '2026-09-22', 'upi',  'UPI-SBI-77281923',  'progress', 'RA-BILL-03', 'Progress receipt for plumbing & flooring (DEMO)', 'received', 'bank', true);

  -- Project C Receipts: ₹2,00,000 + ₹4,00,000 + ₹2,00,000 = ₹8,00,000 Total (Fully Paid)
  INSERT INTO public.client_payments (
    receipt_number, project_id, client_id, amount, payment_date,
    payment_method, reference_number, payment_category, invoice_reference,
    notes, status, account_type, is_demo
  ) VALUES
    ('DEMO-RCP-C01', v_prj_c, v_cli_c, 200000, '2026-05-15', 'bank', 'AXIS-NEFT-332918', 'advance', 'AGR/2026/C-ADV', 'Initial advance mobilization payment (DEMO)', 'received', 'bank', true),
    ('DEMO-RCP-C02', v_prj_c, v_cli_c, 400000, '2026-07-25', 'bank', 'AXIS-RTGS-774012', 'progress', 'INV-SHOWROOM-01', 'Mid-term interior fitout settlement (DEMO)', 'received', 'bank', true),
    ('DEMO-RCP-C03', v_prj_c, v_cli_c, 200000, '2026-09-29', 'cheque', 'CHQ-882019-AXIS', 'final', 'FINAL-SETTLEMENT', 'Final handover settlement (DEMO)', 'received', 'bank', true);

  -- Project D: No receipts recorded (Total received ₹0, pending ₹12,00,000)

END $$;
