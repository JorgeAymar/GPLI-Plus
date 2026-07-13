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
    <div>
      <h2 className="mb-2 text-sm font-medium opacity-70">Actores</h2>
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
