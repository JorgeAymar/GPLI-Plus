"use client";

import { useSidebar } from "./sidebar-context";

/**
 * Hamburger button that shows/hides the off-canvas sidebar below `md`
 * (768px). Hidden at `md` and up, where the sidebar is always visible and a
 * toggle would be pointless. Renders in the header (`(central)/layout.tsx`)
 * since the sidebar itself is often off-screen there.
 */
export function SidebarToggleButton() {
  const { open, toggle } = useSidebar();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={open}
      aria-label={open ? "Cerrar menú" : "Abrir menú"}
      className="-ml-1 rounded-md p-2 hover:bg-black/5 md:hidden dark:hover:bg-white/5"
    >
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="h-5 w-5">
        {open ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
      </svg>
    </button>
  );
}
