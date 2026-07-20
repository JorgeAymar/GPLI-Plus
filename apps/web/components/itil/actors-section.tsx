import type { ItilActor, ItilType, User } from "@itsm/db";
import { ActorForm } from "./actor-form";

export function ActorsSection({
  itilType,
  itilId,
  actors,
  users,
}: {
  itilType: ItilType;
  itilId: string;
  actors: ItilActor[];
  users: User[];
}) {
  const userById = new Map(users.map((u) => [u.id, u]));

  return (
    <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
      <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-semibold dark:border-white/10">Actores</h2>
      <ul className="mb-3 space-y-1">
        {actors.map((a) => (
          <li key={a.id} className="text-sm">
            <span className="opacity-60">{a.actorRole}:</span>{" "}
            {a.actorKind === "user" ? (userById.get(a.actorId)?.displayName ?? a.actorId) : `${a.actorKind}:${a.actorId}`}
          </li>
        ))}
        {actors.length === 0 ? <li className="text-sm opacity-50">Sin actores todavía.</li> : null}
      </ul>
      <ActorForm itilType={itilType} itilId={itilId} users={users} />
    </div>
  );
}
