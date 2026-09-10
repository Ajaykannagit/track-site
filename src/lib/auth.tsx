import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "md" | "supervisor" | "accounts" | "viewer";

export const ROLE_LABEL: Record<AppRole, string> = {
  md: "MD / Administrator",
  supervisor: "Site Supervisor",
  accounts: "Accounts / Back Office",
  viewer: "Viewer",
};

type AuthState = {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  isMD: boolean;
  canWriteFinance: boolean;
  canWriteSite: boolean;
  refreshRoles: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRoles = async (userId: string | undefined) => {
    if (!userId) {
      setRoles([]);
      return;
    }
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    setRoles((data ?? []).map((r) => r.role as AppRole));
  };

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      loadRoles(data.session?.user.id).finally(() => setLoading(false));
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      void loadRoles(next?.user.id);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const isMD = roles.includes("md");
  const value: AuthState = {
    user: session?.user ?? null,
    session,
    roles,
    loading,
    isMD,
    canWriteFinance: isMD || roles.includes("accounts"),
    canWriteSite: isMD || roles.includes("accounts") || roles.includes("supervisor"),
    refreshRoles: () => loadRoles(session?.user.id),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
