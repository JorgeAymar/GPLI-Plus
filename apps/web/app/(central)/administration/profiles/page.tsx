import { listAllEntities, listProfiles, listUsers } from "@itsm/core";
import Link from "next/link";
import { AssignForm } from "./assign-form";
import { ProfileForm } from "./profile-form";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Perfiles" };

/** Color-codes the `interface` column (central/simplified) like the other status badges in the app - purely visual, keeps the same text. */
function interfaceBadgeClass(iface: string): string {
  const variant =
    iface === "central"
      ? "bg-black/10 text-black/70 dark:bg-white/15 dark:text-white/70"
      : "bg-amber-500/10 text-amber-700 dark:text-amber-400";
  return `rounded-md px-1.5 py-0.5 text-xs whitespace-nowrap ${variant}`;
}

export default async function ProfilesPage() {
  const [profiles, users, entities] = await Promise.all([listProfiles(), listUsers(), listAllEntities()]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Perfiles</h1>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="min-w-0 rounded-md border border-black/10 p-6 dark:border-white/10">
          <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-semibold dark:border-white/10">Perfiles existentes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="pb-2 text-[11px] font-bold tracking-wider text-black/60 uppercase dark:text-white/60">Nombre</th>
                  <th className="pb-2 text-[11px] font-bold tracking-wider text-black/60 uppercase dark:text-white/60">Interfaz</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id} className="border-t border-black/5 dark:border-white/5">
                    <td className="py-2">{p.name}</td>
                    <td className="py-2">
                      <span className={interfaceBadgeClass(p.interface)}>{p.interface}</span>
                    </td>
                    <td className="py-2">
                      <Link href={`/administration/profiles/${p.id}`} className="text-xs hover:underline">
                        Permisos →
                      </Link>
                    </td>
                  </tr>
                ))}
                {profiles.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-2 opacity-50">
                      Sin perfiles todavía.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
        <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
          <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-medium opacity-60 dark:border-white/10">Nuevo perfil</h2>
          <ProfileForm />
        </div>
      </div>
      <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
        <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-medium opacity-60 dark:border-white/10">Asignar perfil a usuario</h2>
        <AssignForm users={users} profiles={profiles} entities={entities} />
      </div>
    </div>
  );
}
