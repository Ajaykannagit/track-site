-- =============================================================================
-- Migration: 20261124000000_zoho_books_50_upgrades.sql
-- Purpose: Additive, non-breaking schema extensions for the 50 Zoho Books
--          upgrades (Buyer & Vendor 360° Workspace, Advances & Unused Credits,
--          PO Billed Status, Multi-Wallet Passbook, and Zoho Chart of Accounts).
-- =============================================================================

-- 1. Clients (Buyers): optional GSTIN, place of supply, opening balance
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS gst_number text,
  ADD COLUMN IF NOT EXISTS place_of_supply text DEFAULT 'Tamil Nadu',
  ADD COLUMN IF NOT EXISTS opening_balance numeric(14,2) DEFAULT 0;

-- 2. Suppliers (Material Vendors): optional bank details, place of supply, opening balance
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS bank_details text,
  ADD COLUMN IF NOT EXISTS place_of_supply text DEFAULT 'Tamil Nadu',
  ADD COLUMN IF NOT EXISTS opening_balance numeric(14,2) DEFAULT 0;

-- 3. Contractors (Work Vendors): optional GSTIN, place of supply, opening balance
ALTER TABLE public.contractors
  ADD COLUMN IF NOT EXISTS gst_number text,
  ADD COLUMN IF NOT EXISTS place_of_supply text DEFAULT 'Tamil Nadu',
  ADD COLUMN IF NOT EXISTS opening_balance numeric(14,2) DEFAULT 0;

-- 4. Client Payments: optional TDS withheld amount, wallet_name, applied_milestone_id
ALTER TABLE public.client_payments
  ADD COLUMN IF NOT EXISTS tds_amount numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wallet_name text,
  ADD COLUMN IF NOT EXISTS applied_milestone_id uuid;

-- 5. Supplier Payments: optional advance tracking, unused credit amount, wallet_name
ALTER TABLE public.supplier_payments
  ADD COLUMN IF NOT EXISTS is_advance boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS unused_amount numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wallet_name text;

-- 6. Contractor Payments: optional advance tracking, unused credit amount, wallet_name
ALTER TABLE public.contractor_payments
  ADD COLUMN IF NOT EXISTS is_advance boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS unused_amount numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wallet_name text;

-- 7. Purchase Orders: dual status (Order Status + Billed Status) & supplier bill reference
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS billed_status text DEFAULT 'yet_to_be_billed',
  ADD COLUMN IF NOT EXISTS supplier_bill_number text,
  ADD COLUMN IF NOT EXISTS supplier_bill_date date;

-- 8. Expenses: optional party tags (Supplier, Contractor, Employee, Client) & wallet_name
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS supplier_id uuid,
  ADD COLUMN IF NOT EXISTS contractor_id uuid,
  ADD COLUMN IF NOT EXISTS employee_id uuid,
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS wallet_name text;

-- 9. Account Transfers & MD Investments: optional named wallet tracking
ALTER TABLE public.account_transfers
  ADD COLUMN IF NOT EXISTS from_wallet text,
  ADD COLUMN IF NOT EXISTS to_wallet text;

ALTER TABLE public.md_investments
  ADD COLUMN IF NOT EXISTS wallet_name text;

-- 10. Financial Wallets Table (Multi-Wallet Zoho Banking & Petty Cash architecture)
CREATE TABLE IF NOT EXISTS public.financial_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  account_code text,
  account_type text NOT NULL DEFAULT 'bank', -- 'bank' | 'petty_cash' | 'clearing'
  bank_account_number text,
  opening_balance numeric(14,2) NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.financial_wallets ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'financial_wallets' AND policyname = 'financial_wallets_select_authenticated'
  ) THEN
    CREATE POLICY financial_wallets_select_authenticated
      ON public.financial_wallets
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'financial_wallets' AND policyname = 'financial_wallets_write_finance'
  ) THEN
    CREATE POLICY financial_wallets_write_finance
      ON public.financial_wallets
      FOR ALL
      TO authenticated
      USING (public.is_finance_user() OR public.is_md())
      WITH CHECK (public.is_finance_user() OR public.is_md());
  END IF;
END $$;

INSERT INTO public.financial_wallets (name, account_code, account_type, bank_account_number, is_default, description)
VALUES
  ('Brickweld Private Limited (xxxx5909)', '1001', 'bank', 'xxxx5909', true, 'Primary corporate bank account in Zoho Books'),
  ('Kodak- Petty Cash', '7865', 'petty_cash', NULL, true, 'Primary site & office petty cash wallet'),
  ('General Petty Cash', '1002', 'petty_cash', NULL, false, 'Secondary petty cash box'),
  ('Suspense Account', '9999', 'clearing', NULL, false, 'Clearing & unallocated suspense ledger')
ON CONFLICT (name) DO NOTHING;

-- 11. Pre-seed Zoho Books Chart of Accounts expense categories into expense_categories
INSERT INTO public.expense_categories (name, active)
VALUES
  ('Raw Materials And Consumables', true),
  ('Salaries and Employee Wages', true),
  ('Subcontractor', true),
  ('Transportation Expense', true),
  ('Fuel/Mileage Expenses', true),
  ('Employee Advance', true),
  ('Employee Reimbursements', true),
  ('Meals and Entertainment', true),
  ('Commission', true),
  ('Rent Expense', true),
  ('Repairs and Maintenance', true),
  ('Bank Fees and Charges', true)
ON CONFLICT (name) DO NOTHING;
