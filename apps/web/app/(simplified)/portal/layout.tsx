import { signOutAction } from "@/actions/auth.actions";
import { requireAuthContext } from "@/lib/session";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const context = await requireAuthContext();

  return (
    <div className="mx-auto max-w-3xl flex-1 p-6">
      <header className="mb-6 flex items-center justify-between">
        <span className="text-sm font-medium">{context.user.displayName} · Portal de autoservicio</span>
        <form action={signOutAction}>
          <button type="submit" className="text-sm opacity-70 hover:opacity-100">
            Salir
          </button>
        </form>
      </header>
      {children}
    </div>
  );
}
