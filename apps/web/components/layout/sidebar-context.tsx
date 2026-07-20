"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface SidebarContextValue {
  /** Whether the off-canvas sidebar is visible below the `md` breakpoint. Irrelevant at `md` and up, where the sidebar is always shown. */
  open: boolean;
  toggle: () => void;
  close: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

/**
 * Shares the mobile sidebar's open/closed state between the toggle button
 * (rendered in the header, `(central)/layout.tsx`) and `<NavSidebar>` itself -
 * they're siblings, not parent/child, so plain prop-drilling can't connect
 * them. Mirrors the existing `ToastProvider` context pattern in this app.
 */
export function SidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <SidebarContext.Provider value={{ open, toggle: () => setOpen((o) => !o), close: () => setOpen(false) }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarContextValue {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within a SidebarProvider");
  return ctx;
}
