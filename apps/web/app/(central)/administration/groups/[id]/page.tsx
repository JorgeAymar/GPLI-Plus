import { getGroup, listGroupMembers, listUsers } from "@itsm/core";
import { notFound } from "next/navigation";
import { AddMemberForm } from "./add-member-form";
import { RemoveMemberButton } from "./remove-member-button";

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const group = await getGroup(id);
  if (!group) notFound();

  const [members, users] = await Promise.all([listGroupMembers(id), listUsers()]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{group.name}</h1>
      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Miembros</h2>
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
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Agregar miembro</h2>
          <AddMemberForm groupId={id} users={users} />
        </div>
      </div>
    </div>
  );
}
