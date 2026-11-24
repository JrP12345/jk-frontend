"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export interface WorkspacePages {
  items: Array<{ id: string; label: string }>;
  active: string;
  select: (id: string) => void;
}
const Context = createContext<{ pages: WorkspacePages | null; publish: (pages: WorkspacePages | null) => void } | null>(null);

export function WorkspacePageNavigationProvider({ children }: { children: ReactNode }) {
  const [pages, publish] = useState<WorkspacePages | null>(null);
  const value = useMemo(() => ({ pages, publish }), [pages]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useWorkspacePageNavigation() { return useContext(Context); }
