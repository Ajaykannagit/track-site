# Site & Steel — agent notes

Construction project-control web app. Prefer small, surgical changes. Do not invent financial rules; mark unclear calculations as configurable.

## Stack

- React 19 + TypeScript
- TanStack Router / Start (file-based routes in `src/routes`)
- TanStack Query for data fetching
- Supabase (`@supabase/supabase-js`) with RLS; client in `src/integrations/supabase`
- Vite, Tailwind CSS 4, shadcn/ui

## Routing

Authenticated pages live under `src/routes/_authenticated/`. The gate is `src/routes/_authenticated/route.tsx` (redirects to `/auth` when there is no session). Keep `<Outlet />` in `__root.tsx` and the authenticated layout.

## Data

Use `src/lib/db.ts` helpers (`useRows`, mutations) so RLS still applies. Schema types are generated in `src/integrations/supabase/types.ts`. SQL migrations are in `supabase/migrations/`.

## Roles

`md`, `supervisor`, `accounts`, `viewer` — assigned via `user_roles` and Settings.

## Origin

Originally generated with Lovable; continued in this repo. Backend is a hosted Supabase project (`VITE_SUPABASE_URL` in `.env`).

## Protected Pre-Zoho Stable Backup (DO NOT DELETE OR OVERWRITE)

- **Backup Branch:** `backup/pre-zoho-v1-stable-DO-NOT-DELETE`
- **Immutable Release Tag:** `v1.0-pre-zoho-stable-DO-NOT-DELETE`
- **Purpose:** This branch and tag preserve the verified, QA-passed v1.0 application state BEFORE the Zoho-style complex payment architecture changes.
- **CRITICAL RULE FOR ALL FUTURE AI AGENTS:**
  1. **NEVER delete, force-push, overwrite, or merge into** `backup/pre-zoho-v1-stable-DO-NOT-DELETE` or the tag `v1.0-pre-zoho-stable-DO-NOT-DELETE`.
  2. Even if the user asks to "clean up branches", "merge all branches", or "delete old branches" months later, **STOP and explicitly warn the user** that `backup/pre-zoho-v1-stable-DO-NOT-DELETE` and `v1.0-pre-zoho-stable-DO-NOT-DELETE` are the permanent pre-Zoho recovery point, and deleting them would destroy the ability to roll back to the pre-Zoho version.
  3. Only restore from this branch/tag if the user explicitly asks to revert/roll back to the pre-Zoho v1 version.
