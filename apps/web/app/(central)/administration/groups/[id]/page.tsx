import { getGroup, listGroupMembers, listUsers } from "@itsm/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AddMemberForm } from "./add-member-form";
import { RemoveMemberButton } from "./remove-member-button";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const group = await getGroup(id);
  return { title: group?.name ?? "Grupo" };
}

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const group = await getGroup(id);
  if (!group) notFound();

  const [members, users] = await Promise.all([listGroupMembers(id), listUsers()]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{group.name}</h1>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
          <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-semibold dark:border-white/10">Miembros</h2>
          <ul className="space-y-1">
            {members.map((m) => (
              <li key={m.userId} className="flex items-center gap-2 text-sm">
                {m.displayName}
                {m.isManager ? <span className="text-xs opacity-40">(responsable)</span> : null}
                <RemoveMemberButton userId={m.userId} groupId={id} />
              </li>
            ))}
            {members.length === 0 ? <li className="text-sm opacity-50">Sin miembros todavía.</li> : null}
          </ul>
        </div>
        <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
          <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-semibold dark:border-white/10">Agregar miembro</h2>
          <AddMemberForm groupId={id} users={users} />
        </div>
      </div>
    </div>
  );
}
