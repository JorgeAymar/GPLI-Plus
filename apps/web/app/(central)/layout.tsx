import { signOutAction } from "@/actions/auth.actions";
import { ContextSwitcher } from "@/components/layout/context-switcher";
import { NavSidebar } from "@/components/layout/nav-sidebar";
import { requireAuthContext } from "@/lib/session";
import { listUserProfileAssignments } from "@itsm/core";

export default async function CentralLayout({ children }: { children: React.ReactNode }) {
  const context = await requireAuthContext();
  const assignments = await listUserProfileAssignments(context.user.id);

  return (
    <div className="flex min-h-screen flex-1">
      <NavSidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-black/10 px-6 py-3 dark:border-white/10">
          <span className="text-sm font-medium">{context.user.displayName}</span>
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
  );
}
