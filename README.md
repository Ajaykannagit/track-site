# Brickweld

Civil - Interior - Fabrication — Project Control Web Application.

A comprehensive construction and site management application providing centralized control over projects, site attendance, payroll, expenses, petty cash, materials procurement, contractor billing, and real-time project profitability (P&L).

---

## 1. Project Overview

Brickweld is a modern web application designed for construction, interior fit-out, and fabrication enterprises to track site operations and financials in real time. It unifies operations across the site, the back office, and accounting.

---

## 2. Main Features

- **Dashboard**: High-level KPIs, active projects list with live spend vs contract value comparison, monthly expense trends, and pending approvals.
- **Projects & Sites**: Manage active, completed, and upcoming construction sites. View detailed project-level budget allotments, live cost composition, category breakdown charts, and profit margins.
- **Attendance & Labour**: Record daily workforce counts and wages for labour, office staff, and contractors with overtime calculation and CSV export.
- **Payroll**: Run, review, and approve monthly wage sheets across projects and departments.
- **Accounts & Petty Cash**: Record daily site vouchers, expense categories, and end-of-day cash closings.
- **Materials Procurement**: Complete workflow from site indents to purchase orders (PO) and goods receipt notes (GRN).
- **Contractor Billing**: Issue work orders (WO), log measurement books (MB), verify contractor bills, track deductions/retentions, and record payments.
- **Reports & P&L**: Live project-by-project profit and loss calculation with date range filtering and contractor bill status filtering (Draft, Submitted, Verified, Approved, Paid, Rejected).
- **Settings**: Role-based access control (md, supervisor, ccounts, iewer), application business rules configuration, and company information.

---

## 3. Technology Stack

- **Frontend**: React 19, TypeScript, Vite
- **Routing & State**: TanStack Router (file-based routing), TanStack Query
- **Styling & UI**: Tailwind CSS 4, shadcn/ui, Lucide React, Recharts
- **Backend & Database**: Hosted Supabase (PostgreSQL with Row-Level Security, Supabase Auth)

---

## 4. Project Structure

`	ext
track-site-main/
├── public/                 # Static assets (favicon, robots.txt)
├── src/
│   ├── components/         # Reusable UI components, layout shell, data tables, dialogs
│   │   └── ui/             # shadcn/ui primitives (Button, Card, Dialog, Select, Tabs, etc.)
│   ├── integrations/       # Supabase client initialization and generated database types
│   ├── lib/                # Database queries/mutations, auth provider, formatting helpers
│   ├── routes/             # TanStack Router file-based route tree
│   │   ├── _authenticated/ # Authenticated layout & protected pages
│   │   ├── auth.tsx        # Authentication page (Sign in / Sign up)
│   │   └── __root.tsx      # Root application shell & metadata
│   └── styles.css          # Tailwind CSS 4 tokens and global theme definitions
├── supabase/
│   └── migrations/         # PostgreSQL schema migrations and RLS policies
├── .env.example            # Template for environment variables
└── package.json            # Project dependencies and npm scripts
`

---

## 5. Prerequisites

- **Node.js**: Version 20+ or 22+ recommended (or modern Bun)
- **Package Manager**: 
pm (included with Node.js)
- **Supabase Account**: A live or local Supabase project with database migrations applied

---

## 6. Installation Steps

1. Clone or download the repository:
   `sh
   git clone <repository-url>
   cd track-site-main
   `

2. Install dependencies:
   `sh
   npm install
   `

---

## 7. Environment Variables Required

Copy .env.example to .env:

`sh
cp .env.example .env
`

Configure your Supabase credentials in .env:

`env
VITE_SUPABASE_URL=" https://<your-project-id>.supabase.co\
VITE_SUPABASE_PUBLISHABLE_KEY=\<your-publishable-key>\
VITE_SUPABASE_PROJECT_ID=\<your-project-id>\

# Optional backend / SSR variables
SUPABASE_URL=\https://<your-project-id>.supabase.co\
SUPABASE_PUBLISHABLE_KEY=\<your-publishable-key>\
SUPABASE_PROJECT_ID=\<your-project-id>\
`

*(Note: Never commit your .env file to version control. It is ignored by .gitignore.)*

---

## 8. How to Run Frontend

Start the Vite development server:

`sh
npm run dev
`

The application will start on http://localhost:8080.

---

## 9. How to Run Backend & Database

The application connects directly to Supabase via @supabase/supabase-js with Row-Level Security (RLS) enforced at the database level.

- To apply database migrations to a new Supabase project:
 Run the SQL migration scripts located in supabase/migrations/ sequentially using the Supabase Dashboard SQL Editor or Supabase CLI (supabase db push).

---

## 10. How to Build the Project

Run typecheck and the production build:

`sh
# Typecheck TypeScript files
npx tsc --noEmit

# Production build
npm run build
`

The output will be bundled in .output/. You can preview the production build locally using:

`sh
npm run preview
`

---

## 11. Demo Instructions

1. Start the dev server (
pm run dev) or preview server (
pm run preview).
2. Navigate to http://localhost:8080/auth.
3. Sign in with an authorized user (or sign up a new account). The initial user can be assigned the md role in Supabase user_roles table for full administrative access.
4. **Dashboard**: Inspect the KPI cards, monthly expense trend chart, and the **Active projects** section showing live Cost So Far alongside Contract Value.
5. **Projects**: Navigate to /projects to see the **All / Active / Completed** status filter tabs. Click into a project to explore the **Cost composition** stat cards and the interactive category donut chart.
6. **Reports & P&L**: Navigate to /reports to view project profitability. Test filtering by **Date range** or **Contractor bill status** (Approved, Submitted, Paid, Rejected, etc.) to observe real-time recalculation of contractor costs, totals, and profit margins.
7. **Settings**: Navigate to /settings to see **Users & roles**, **App settings**, and the new **Company info** card with official contact details.

---

## 12. Important Notes for Future Development

- **Small, surgical changes**: Follow the repository guidelines in AGENTS.md. Do not invent financial rules; keep calculations aligned with src/lib/db.ts and eports.tsx.
- **Database mutations**: Always use useSaveRow and useDeleteRow helpers in src/lib/db.ts to ensure RLS policies and authentication context are respected.
- **Logo replacement**: The company logo asset can be updated directly in src/components/AppShell.tsx and public/favicon.ico when new branding graphics are supplied.
