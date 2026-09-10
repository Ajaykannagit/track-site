import { useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  CalendarCheck,
  Wallet,
  Receipt,
  Package,
  HardHat,
  Users,
  BarChart3,
  Settings,
  Menu,
  LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, ROLE_LABEL } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: Building2 },
  { to: "/attendance", label: "Attendance", icon: CalendarCheck },
  { to: "/payroll", label: "Payroll", icon: Wallet },
  { to: "/accounts", label: "Accounts & Cash", icon: Receipt },
  { to: "/materials", label: "Materials", icon: Package },
  { to: "/contractors", label: "Contractors", icon: HardHat },
  { to: "/masters", label: "Masters", icon: Users },
  { to: "/reports", label: "Reports & P&L", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              active && "bg-sidebar-accent text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2 border-b border-sidebar-border px-4 py-4">
      <img src="/logo.png" className="size-9 rounded-md object-contain" alt="Brickweld" />
      <div className="leading-tight">
        <p className="font-display text-base font-semibold text-sidebar-foreground">Brickweld</p>
        <p className="text-[11px] uppercase tracking-wide text-sidebar-foreground/60">Civil - Interior - Fabrication</p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, roles } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="no-print hidden w-64 shrink-0 flex-col bg-sidebar lg:flex">
        <Brand />
        <NavList />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-20 flex items-center gap-3 border-b bg-card/95 px-4 py-3 backdrop-blur">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 bg-sidebar p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <Brand />
              <NavList onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.email}</p>
            <p className="truncate text-xs text-muted-foreground">
              {roles.length ? roles.map((r) => ROLE_LABEL[r]).join(", ") : "No role assigned"}
            </p>
          </div>

          <Button variant="outline" size="sm" onClick={() => supabase.auth.signOut()}>
            <LogOut className="mr-2 size-4" /> Sign out
          </Button>
        </header>

        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="no-print flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
