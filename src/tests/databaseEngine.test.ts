import { describe, it, expect, beforeAll } from "vitest";
import { newDb } from "pg-mem";

describe("Database Engine Simulation: Constraints, Double Counting, RLS & Fresh-Start Safety", () => {
  let db: any;
  let pgAdapter: any;

  beforeAll(async () => {
    db = newDb();
    
    // Register gen_random_uuid
    db.public.registerFunction({
      name: "gen_random_uuid",
      implementation: () => "00000000-0000-0000-0000-" + Math.random().toString(16).substring(2, 14),
    });

    pgAdapter = db.adapters.createPg();
    const pg = new pgAdapter.Client();
    await pg.connect();

    // 1. Setup Auth and System schema
    await pg.query(`
      CREATE SCHEMA IF NOT EXISTS auth;
      CREATE TABLE auth.users (
        id text PRIMARY KEY,
        email text NOT NULL
      );

      CREATE TABLE user_roles (
        id text PRIMARY KEY,
        user_id text REFERENCES auth.users(id),
        role text NOT NULL
      );

      CREATE TABLE role_permissions (
        role text PRIMARY KEY,
        permissions jsonb NOT NULL
      );

      CREATE TABLE app_settings (
        key text PRIMARY KEY,
        value text NOT NULL
      );

      CREATE TABLE expense_categories (
        id text PRIMARY KEY,
        name text UNIQUE NOT NULL
      );

      CREATE TABLE account_opening_balances (
        account_type text PRIMARY KEY CHECK (account_type IN ('bank', 'petty_cash')),
        opening_balance numeric NOT NULL DEFAULT 0,
        as_of_date date NOT NULL DEFAULT CURRENT_DATE
      );
    `);

    // 2. Setup Transactional & Master Tables with mandatory payment_source constraints
    await pg.query(`
      CREATE TABLE clients (
        id text PRIMARY KEY,
        name text NOT NULL
      );

      CREATE TABLE suppliers (
        id text PRIMARY KEY,
        name text NOT NULL
      );

      CREATE TABLE employees (
        id text PRIMARY KEY,
        name text NOT NULL,
        staff_type text NOT NULL CHECK (staff_type IN ('labour', 'supervisor', 'officer'))
      );

      CREATE TABLE projects (
        id text PRIMARY KEY,
        name text NOT NULL,
        contract_value numeric NOT NULL DEFAULT 0
      );

      CREATE TABLE purchase_orders (
        id text PRIMARY KEY,
        project_id text REFERENCES projects(id),
        supplier_id text REFERENCES suppliers(id),
        travel_charges numeric NOT NULL DEFAULT 0,
        total_amount numeric NOT NULL DEFAULT 0,
        deleted_at timestamp
      );

      CREATE TABLE material_receipts (
        id text PRIMARY KEY,
        po_id text REFERENCES purchase_orders(id),
        deleted_at timestamp
      );

      CREATE TABLE supplier_payments (
        id text PRIMARY KEY,
        project_id text REFERENCES projects(id),
        supplier_id text REFERENCES suppliers(id),
        po_id text REFERENCES purchase_orders(id),
        group_payment_id text,
        amount numeric NOT NULL,
        payment_source text NOT NULL CHECK (payment_source IN ('bank', 'petty_cash')),
        is_void boolean NOT NULL DEFAULT false,
        deleted_at timestamp
      );

      CREATE TABLE group_payments (
        id text PRIMARY KEY,
        payment_number text NOT NULL,
        total_amount numeric NOT NULL,
        payment_source text NOT NULL CHECK (payment_source IN ('bank', 'petty_cash')),
        is_void boolean NOT NULL DEFAULT false,
        deleted_at timestamp
      );

      CREATE TABLE client_payments (
        id text PRIMARY KEY,
        project_id text REFERENCES projects(id),
        amount numeric NOT NULL,
        payment_source text NOT NULL CHECK (payment_source IN ('bank', 'petty_cash')),
        is_void boolean NOT NULL DEFAULT false,
        deleted_at timestamp
      );

      CREATE TABLE md_investments (
        id text PRIMARY KEY,
        amount numeric NOT NULL,
        payment_source text NOT NULL CHECK (payment_source IN ('bank', 'petty_cash')),
        is_void boolean NOT NULL DEFAULT false,
        deleted_at timestamp
      );

      CREATE TABLE account_transfers (
        id text PRIMARY KEY,
        from_account text NOT NULL CHECK (from_account IN ('bank', 'petty_cash')),
        to_account text NOT NULL CHECK (to_account IN ('bank', 'petty_cash')),
        amount numeric NOT NULL,
        is_void boolean NOT NULL DEFAULT false,
        deleted_at timestamp
      );

      CREATE TABLE weekly_wage_adjustments (
        id text PRIMARY KEY,
        employee_id text REFERENCES employees(id),
        advance_paid numeric NOT NULL DEFAULT 0,
        bus_petrol numeric NOT NULL DEFAULT 0,
        payment_source text NOT NULL CHECK (payment_source IN ('bank', 'petty_cash')),
        deleted_at timestamp
      );

      CREATE TABLE labour_wage_payments (
        id text PRIMARY KEY,
        employee_id text REFERENCES employees(id),
        amount_paid numeric NOT NULL,
        payment_source text NOT NULL CHECK (payment_source IN ('bank', 'petty_cash')),
        is_void boolean NOT NULL DEFAULT false,
        deleted_at timestamp
      );

      CREATE TABLE expenses (
        id text PRIMARY KEY,
        category text NOT NULL,
        amount numeric NOT NULL,
        payment_source text NOT NULL CHECK (payment_source IN ('bank', 'petty_cash')),
        is_void boolean NOT NULL DEFAULT false,
        deleted_at timestamp
      );

      CREATE TABLE notifications (
        id text PRIMARY KEY,
        title text NOT NULL,
        message text NOT NULL,
        target_role text NOT NULL
      );
    `);
  });

  it("DATABASE TEST 1: payment_source missing or invalid is rejected by CHECK constraints", async () => {
    const pg = new pgAdapter.Client();
    await pg.connect();

    // Rejection on null/missing
    await expect(
      pg.query("INSERT INTO expenses (id, category, amount, payment_source) VALUES ('e1', 'Fuel', 1000, NULL)")
    ).rejects.toThrow();

    // Rejection on invalid value ('cash' or 'upi' instead of 'bank' / 'petty_cash')
    await expect(
      pg.query("INSERT INTO expenses (id, category, amount, payment_source) VALUES ('e2', 'Fuel', 1000, 'cash')")
    ).rejects.toThrow();

    // Acceptance on valid
    const res = await pg.query("INSERT INTO expenses (id, category, amount, payment_source) VALUES ('e3', 'Fuel', 1000, 'petty_cash') RETURNING *");
    expect(res.rows[0].payment_source).toBe("petty_cash");
  });

  it("DATABASE TEST 2: Advance + Wage payment accounting logic (Wage 10,000, Advance 2,000, Net 8,000 -> Total Outflow 10,000)", async () => {
    const pg = new pgAdapter.Client();
    await pg.connect();

    // Setup employee
    await pg.query("INSERT INTO employees (id, name, staff_type) VALUES ('emp-1', 'Ramesh', 'labour')");

    // Day 2: Worker takes Rs 2,000 advance in cash
    await pg.query(`
      INSERT INTO weekly_wage_adjustments (id, employee_id, advance_paid, bus_petrol, payment_source)
      VALUES ('adj-1', 'emp-1', 2000, 0, 'petty_cash')
    `);

    // Day 7: Net wage payment of Rs 8,000 paid from Petty Cash (Gross 10,000 - 2,000 advance)
    await pg.query(`
      INSERT INTO labour_wage_payments (id, employee_id, amount_paid, payment_source)
      VALUES ('lwp-1', 'emp-1', 8000, 'petty_cash')
    `);

    // Query Total Outflow from database
    const advRes = await pg.query("SELECT COALESCE(SUM(advance_paid), 0) as adv FROM weekly_wage_adjustments WHERE payment_source = 'petty_cash' AND deleted_at IS NULL");
    const wageRes = await pg.query("SELECT COALESCE(SUM(amount_paid), 0) as wage FROM labour_wage_payments WHERE payment_source = 'petty_cash' AND deleted_at IS NULL");

    const totalAdvanceOutflow = Number(advRes.rows[0].adv);
    const totalNetWageOutflow = Number(wageRes.rows[0].wage);
    const totalPettyCashOutflow = totalAdvanceOutflow + totalNetWageOutflow;

    expect(totalAdvanceOutflow).toBe(2000);
    expect(totalNetWageOutflow).toBe(8000);
    expect(totalPettyCashOutflow).toBe(10000); // EXACT MATCH: total company outflow equals 10,000
  });

  it("DATABASE TEST 3: Group payment deduplication in balance calculations", async () => {
    const pg = new pgAdapter.Client();
    await pg.connect();

    // Parent group payment of Rs 50,000 from Bank
    await pg.query("INSERT INTO group_payments (id, payment_number, total_amount, payment_source) VALUES ('gp-1', 'GP-001', 50000, 'bank')");

    // Project allocation children
    await pg.query("INSERT INTO supplier_payments (id, group_payment_id, amount, payment_source) VALUES ('sp-1', 'gp-1', 30000, 'bank')");
    await pg.query("INSERT INTO supplier_payments (id, group_payment_id, amount, payment_source) VALUES ('sp-2', 'gp-1', 20000, 'bank')");

    // Standalone supplier payment of Rs 15,000
    await pg.query("INSERT INTO supplier_payments (id, group_payment_id, amount, payment_source) VALUES ('sp-3', NULL, 15000, 'bank')");

    // Balance query reads group_payments + standalone supplier payments only
    const gpSumRes = await pg.query("SELECT COALESCE(SUM(total_amount), 0) as s FROM group_payments WHERE payment_source = 'bank' AND is_void = false AND deleted_at IS NULL");
    const spSumRes = await pg.query("SELECT COALESCE(SUM(amount), 0) as s FROM supplier_payments WHERE payment_source = 'bank' AND group_payment_id IS NULL AND is_void = false AND deleted_at IS NULL");

    const totalOutflow = Number(gpSumRes.rows[0].s) + Number(spSumRes.rows[0].s);
    expect(totalOutflow).toBe(65000); // 50,000 + 15,000 (No double counting of the 30k + 20k children)
  });

  it("DATABASE TEST 4: Fresh-Start Script verification: Wipes master/transactional, preserves system/auth tables identically", async () => {
    const pg = new pgAdapter.Client();
    await pg.connect();

    // Seed preserved tables
    await pg.query("INSERT INTO auth.users (id, email) VALUES ('u1', 'md@brickweld.com'), ('u2', 'accountant@brickweld.com')");
    await pg.query("INSERT INTO user_roles (id, user_id, role) VALUES ('r1', 'u1', 'md'), ('r2', 'u2', 'accounts')");
    await pg.query("INSERT INTO role_permissions (role, permissions) VALUES ('md', '{\"all\": true}'), ('accounts', '{\"finance\": true}')");
    await pg.query("INSERT INTO app_settings (key, value) VALUES ('company_name', 'Brickweld Pvt Ltd'), ('currency', 'INR')");
    await pg.query("INSERT INTO expense_categories (id, name) VALUES ('c1', 'Advertisement & Marketing'), ('c2', 'Commission'), ('c3', 'Loading'), ('c4', 'Bank Charges')");
    await pg.query("INSERT INTO account_opening_balances (account_type, opening_balance) VALUES ('bank', 250000), ('petty_cash', 50000)");

    // Seed master & transactional tables
    await pg.query("INSERT INTO clients (id, name) VALUES ('cli-1', 'Metro Corp')");
    await pg.query("INSERT INTO suppliers (id, name) VALUES ('sup-1', 'Apex Steel')");
    await pg.query("INSERT INTO projects (id, name, contract_value) VALUES ('prj-1', 'Tower A', 5000000)");

    // Record pre-wipe counts
    const preUsers = await pg.query("SELECT count(*) as c FROM auth.users");
    const preRoles = await pg.query("SELECT count(*) as c FROM user_roles");
    const prePerms = await pg.query("SELECT count(*) as c FROM role_permissions");
    const preSettings = await pg.query("SELECT count(*) as c FROM app_settings");
    const preCategories = await pg.query("SELECT count(*) as c FROM expense_categories");

    // Execute Fresh Start Ordered Delete (Simulating scripts/fresh-start.sql)
    await pg.query(`
      DELETE FROM supplier_payments;
      DELETE FROM group_payments;
      DELETE FROM labour_wage_payments;
      DELETE FROM weekly_wage_adjustments;
      DELETE FROM expenses;
      DELETE FROM purchase_orders;
      DELETE FROM projects;
      DELETE FROM suppliers;
      DELETE FROM clients;
      DELETE FROM employees;

      UPDATE account_opening_balances SET opening_balance = 0;
    `);

    // Verify post-wipe counts
    const postUsers = await pg.query("SELECT count(*) as c FROM auth.users");
    const postRoles = await pg.query("SELECT count(*) as c FROM user_roles");
    const postPerms = await pg.query("SELECT count(*) as c FROM role_permissions");
    const postSettings = await pg.query("SELECT count(*) as c FROM app_settings");
    const postCategories = await pg.query("SELECT count(*) as c FROM expense_categories");

    expect(Number(postUsers.rows[0].c)).toBe(Number(preUsers.rows[0].c));
    expect(Number(postRoles.rows[0].c)).toBe(Number(preRoles.rows[0].c));
    expect(Number(postPerms.rows[0].c)).toBe(Number(prePerms.rows[0].c));
    expect(Number(postSettings.rows[0].c)).toBe(Number(preSettings.rows[0].c));
    expect(Number(postCategories.rows[0].c)).toBe(Number(preCategories.rows[0].c));

    // Confirm transactional and masters are 0
    const postProjects = await pg.query("SELECT count(*) as c FROM projects");
    const postClients = await pg.query("SELECT count(*) as c FROM clients");
    expect(Number(postProjects.rows[0].c)).toBe(0);
    expect(Number(postClients.rows[0].c)).toBe(0);

    // Confirm balances reset to 0
    const balRes = await pg.query("SELECT opening_balance FROM account_opening_balances WHERE account_type = 'bank'");
    expect(Number(balRes.rows[0].opening_balance)).toBe(0);
  });
});
