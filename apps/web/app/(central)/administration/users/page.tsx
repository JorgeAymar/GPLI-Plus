import { listAllEntities, listUsers } from "@itsm/core";
import { UserForm } from "./user-form";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Usuarios" };

export default async function UsersPage() {
  const [users, entities] = await Promise.all([listUsers(), listAllEntities()]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Usuarios</h1>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="min-w-0">
          <h2 className="mb-2 text-sm font-medium opacity-70">Usuarios existentes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left opacity-60">
                  <th className="pb-2">Nombre</th>
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Usuario</th>
                  <th className="pb-2">Último acceso</th>
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
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Nuevo usuario</h2>
          <UserForm entities={entities} />
        </div>
      </div>
    </div>
  );
}
