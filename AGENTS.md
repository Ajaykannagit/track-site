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
