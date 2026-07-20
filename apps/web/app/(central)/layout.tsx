import { signOutAction } from "@/actions/auth.actions";
import { ContextSwitcher } from "@/components/layout/context-switcher";
import { NavSidebar } from "@/components/layout/nav-sidebar";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { SidebarToggleButton } from "@/components/layout/sidebar-toggle-button";
import { ToastProvider } from "@/components/toast";
import { requireAuthContext } from "@/lib/session";
import { listUserProfileAssignments } from "@itsm/core";

export default async function CentralLayout({ children }: { children: React.ReactNode }) {
  const context = await requireAuthContext();
  const assignments = await listUserProfileAssignments(context.user.id);

  return (
    <ToastProvider>
      <SidebarProvider>
        <div className="flex min-h-screen flex-1">
          <NavSidebar
            aiAssistantEnabled={Boolean(process.env.AI_URL)}
            userDisplayName={context.user.displayName}
            profileLabel={`${context.activeProfile.name} · ${context.activeEntity.name}`}
          />
          <div className="flex flex-1 flex-col">
            {/* z-40, above the mobile drawer's z-30 (see nav-sidebar.tsx) so
                the toggle button here stays clickable/visible with the drawer open. */}
            <header className="sticky top-0 z-40 flex items-center justify-between border-b border-black/10 bg-background px-6 py-3 dark:border-white/10">
              <div className="flex items-center gap-1">
                <SidebarToggleButton />
                <span className="text-sm font-medium">{context.user.displayName}</span>
              </div>
              <div className="flex items-center gap-3">
                <ContextSwitcher
                  assignments={assignments}
                  activeEntityId={context.activeEntity.id}
                  activeProfileId={context.activeProfile.id}
                />
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 text-sm text-red-700 hover:opacity-80 dark:text-red-400"
                  >
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
                      <path d="M8 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M13 14l4-4-4-4M17 10H8" />
                    </svg>
                    Salir
                  </button>
                </form>
              </div>
            </header>
            <main className="flex-1 p-6">{children}</main>
          </div>
        </div>
      </SidebarProvider>
    </ToastProvider>
  );
}
