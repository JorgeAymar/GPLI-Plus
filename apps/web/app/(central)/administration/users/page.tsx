import { listAllEntities, listUsers } from "@itsm/core";
import { UserForm } from "./user-form";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Usuarios" };

export default async function UsersPage() {
  const [users, entities] = await Promise.all([listUsers(), listAllEntities()]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Usuarios</h1>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="min-w-0 rounded-md border border-black/10 p-6 lg:col-span-8 dark:border-white/10">
          <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-semibold dark:border-white/10">Usuarios existentes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="pb-2 text-[11px] font-bold tracking-wider text-black/60 uppercase dark:text-white/60">Nombre</th>
                  <th className="pb-2 text-[11px] font-bold tracking-wider text-black/60 uppercase dark:text-white/60">Email</th>
                  <th className="pb-2 text-[11px] font-bold tracking-wider text-black/60 uppercase dark:text-white/60">Usuario</th>
                  <th className="pb-2 text-[11px] font-bold tracking-wider text-black/60 uppercase dark:text-white/60">Último acceso</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-black/5 dark:border-white/5">
                    <td className="py-2">{u.displayName}</td>
                    <td className="py-2 opacity-70">{u.email}</td>
                    <td className="py-2 opacity-70">{u.username}</td>
                    <td className="py-2 whitespace-nowrap opacity-70">{u.lastLoginAt ? u.lastLoginAt.toLocaleString() : "Nunca"}</td>
                  </tr>
                ))}
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-2 opacity-50">
                      Sin usuarios todavía.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
        <div className="rounded-md border border-black/10 p-6 lg:col-span-4 dark:border-white/10">
          <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-medium opacity-60 dark:border-white/10">Nuevo usuario</h2>
          <UserForm entities={entities} />
        </div>
      </div>
    </div>
  );
}
