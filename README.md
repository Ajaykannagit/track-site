# Brickweld Track-Site Management Application

Construction site and office project control system built with React 19, TypeScript, TanStack Router/Start, and Supabase.

## Roles & Access Control

The app implements strict role-based access control with four roles:

1. **Managing Director (`md`):** System owner.
   - Has exclusive access to **Profit, Loss, Margins**, high-level company financials, cash-on-hand, audit logs, and settings.
   - Sole authority to approve or reject deletion requests.
   - Assigns user roles in Settings.

2. **Accounts (`accounts`):** Back-office and accounts team.
   - Can add and edit attendance, enter office expenses, and record client/supplier/contractor payments and bills.
   - **Strictly restricted** from viewing Profit & Loss reports, project margin percentages, or the P&L page.

3. **Supervisor (`supervisor`):** On-site supervisor.
   - Can enter/edit daily and weekly worker attendance and mark sites.
   - Operational site data access only (no wage amounts, payment rates, or company finances).

4. **Viewer (`viewer`):** Default role assigned to any new signup.
   - Read-only access to projects list. Cannot enter attendance or view financials.

### Creating the First Managing Director (MD)

To prevent privilege escalation, the database trigger `handle_new_user()` always assigns the `viewer` role to all signups, strictly ignoring any client-provided metadata.

To create the initial Managing Director account:
1. Sign up normally via the app UI or Supabase Auth.
2. In the Supabase Dashboard SQL Editor, run:
   ```sql
   INSERT INTO public.user_roles (user_id, role)
   VALUES ('<USER_UUID_FROM_AUTH_USERS>', 'md')
   ON CONFLICT (user_id, role) DO NOTHING;
   ```
3. Once granted, the MD can log in and manage all other user roles directly in the **Settings** menu.

## Environment Variables

Copy `.env.example` to `.env` and fill in the values:
```bash
cp .env.example .env
```

Variables required:
- `VITE_SUPABASE_URL`: Your hosted Supabase project URL (`https://<project-ref>.supabase.co`).
- `VITE_SUPABASE_ANON_KEY`: Supabase anon public API key.

*Note: Never commit secrets, passwords, or the service role key to git.*

## Applying Database Migrations

All security enhancements, role hardening, and approval functions are consolidated in:
`supabase/migrations/20261026000000_security_and_approval_fixes.sql`

To apply:
1. Open the Supabase project dashboard -> SQL Editor.
2. Paste the contents of `supabase/migrations/20261026000000_security_and_approval_fixes.sql` and run.
3. Open `supabase/checks/verify_20261026.sql` and execute the queries to verify all policies, privileges, and triggers.

## Scripts & Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run type check (must pass with 0 errors)
npm run typecheck

# Run automated unit test suite (Vitest)
npm test

# Production build
npm run build
```
