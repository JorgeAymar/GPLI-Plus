import { requireAuthContext } from "@/lib/session";

export default async function DashboardPage() {
  const context = await requireAuthContext();

  return (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-2 text-sm opacity-70">
        Entidad activa: <strong>{context.activeEntity.name}</strong> · Perfil activo:{" "}
        <strong>{context.activeProfile.name}</strong> ({context.activeProfile.interface})
      </p>
    </div>
  );
}
