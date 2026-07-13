import { requireAuthContext } from "@/lib/session";
import { listSoftware } from "@itsm/core";
import Link from "next/link";
import { SoftwareForm } from "./software-form";

export default async function SoftwarePage() {
  const context = await requireAuthContext();
  const softwareList = await listSoftware(context.activeEntity.id, { includeSubtree: true });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Software</h1>
      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Existente</h2>
          <ul className="space-y-1">
            {softwareList.map((s) => (
              <li key={s.id}>
                <Link href={`/assets/software/${s.id}`} className="text-sm hover:underline">
                  {s.name}
                </Link>
              </li>
            ))}
            {softwareList.length === 0 ? <li className="text-sm opacity-50">Sin software todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Nuevo software</h2>
          <SoftwareForm entityId={context.activeEntity.id} />
        </div>
      </div>
    </div>
  );
}
