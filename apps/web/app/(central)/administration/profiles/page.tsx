import { listAllEntities, listProfiles, listUsers } from "@itsm/core";
import Link from "next/link";
import { AssignForm } from "./assign-form";
import { ProfileForm } from "./profile-form";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Perfiles" };

export default async function ProfilesPage() {
  const [profiles, users, entities] = await Promise.all([listProfiles(), listUsers(), listAllEntities()]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Perfiles</h1>
      <div className="grid grid-cols-2 gap-8">
        <div className="min-w-0">
          <h2 className="mb-2 text-sm font-medium opacity-70">Perfiles existentes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left opacity-60">
                  <th className="pb-2">Nombre</th>
                  <th className="pb-2">Interfaz</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id} className="border-t border-black/5 dark:border-white/5">
                    <td className="py-2">{p.name}</td>
                    <td className="py-2 opacity-70">{p.interface}</td>
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
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Nuevo perfil</h2>
          <ProfileForm />
        </div>
      </div>
      <div>
        <h2 className="mb-2 text-sm font-medium opacity-70">Asignar perfil a usuario</h2>
        <AssignForm users={users} profiles={profiles} entities={entities} />
      </div>
    </div>
  );
}
