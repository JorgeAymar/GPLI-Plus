import type { ItilType, ItilValidation, User } from "@itsm/db";
import { RespondValidationButtons } from "./respond-validation-buttons";
import { ValidationForm } from "./validation-form";

export function ValidationsSection({
  itilType,
  itilId,
  validations,
  users,
}: {
  itilType: ItilType;
  itilId: string;
  validations: ItilValidation[];
  users: User[];
}) {
  const userById = new Map(users.map((u) => [u.id, u]));

  return (
    <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
      <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-semibold dark:border-white/10">Aprobaciones</h2>
      <ul className="mb-3 space-y-1">
        {validations.map((v) => (
          <li key={v.id} className="text-sm">
            {userById.get(v.validatorId)?.displayName ?? v.validatorId} — <span className="opacity-60">{v.status}</span>
            {v.status === "waiting" ? <RespondValidationButtons id={v.id} itilType={itilType} itilId={itilId} /> : null}
          </li>
        ))}
        {validations.length === 0 ? <li className="text-sm opacity-50">Sin solicitudes de aprobación.</li> : null}
      </ul>
      <ValidationForm itilType={itilType} itilId={itilId} users={users} />
    </div>
  );
}
