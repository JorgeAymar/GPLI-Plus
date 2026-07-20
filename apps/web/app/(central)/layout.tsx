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
                  <button type="submit" className="text-sm opacity-70 hover:opacity-100">
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
