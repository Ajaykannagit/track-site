import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "brickweld_selected_project_id";

/**
 * Hook to share and persist the selected project filter across Materials and Accounts tabs/screens.
 * Falls back to "all" if the stored ID is missing or invalid.
 */
export function useSharedProjectFilter(availableProjectIds?: string[]) {
  const [projectId, setProjectIdState] = useState<string>(() => {
    if (typeof window === "undefined") return "all";
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored && stored.trim() ? stored : "all";
    } catch {
      return "all";
    }
  });

  // Verify against available project IDs if provided
  useEffect(() => {
    if (availableProjectIds && availableProjectIds.length > 0 && projectId !== "all") {
      if (!availableProjectIds.includes(projectId)) {
        setProjectIdState("all");
        try {
          localStorage.setItem(STORAGE_KEY, "all");
        } catch {
          // ignore storage error
        }
      }
    }
  }, [availableProjectIds, projectId]);

  const setProjectId = useCallback((id: string) => {
    const next = id || "all";
    setProjectIdState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
      // Dispatch storage event so other tabs/components in same window react if needed
      window.dispatchEvent(new CustomEvent("brickweld:project-filter-change", { detail: next }));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const handleCustom = (e: Event) => {
      const ce = e as CustomEvent<string>;
      if (ce.detail !== undefined) {
        setProjectIdState(ce.detail);
      }
    };
    window.addEventListener("brickweld:project-filter-change", handleCustom);
    return () => window.removeEventListener("brickweld:project-filter-change", handleCustom);
  }, []);

  return [projectId, setProjectId] as const;
}
