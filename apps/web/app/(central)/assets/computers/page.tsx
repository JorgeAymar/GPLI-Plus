import { requireAuthContext } from "@/lib/session";
import { getDropdownCategoryByKey, listComputers, listDropdownItems } from "@itsm/core";
import Link from "next/link";
import { ComputerForm } from "./computer-form";

export default async function ComputersPage() {
  const context = await requireAuthContext();

  const computers = await listComputers(context.activeEntity.id, { includeSubtree: true });

  const osCategory = await getDropdownCategoryByKey("os");
  const osOptions = osCategory ? await listDropdownItems(osCategory.id, context.activeEntity.id) : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Computadoras</h1>
      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Existentes</h2>
          <ul className="space-y-1">
            {computers.map((c) => (
              <li key={c.id}>
                <Link href={`/assets/computers/${c.id}`} className="text-sm hover:underline">
                  {c.name} {c.serialNumber ? <span className="opacity-40">({c.serialNumber})</span> : null}
                </Link>
              </li>
            ))}
            {computers.length === 0 ? <li className="text-sm opacity-50">Sin computadoras todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Nueva computadora</h2>
          <ComputerForm entityId={context.activeEntity.id} osOptions={osOptions} />
        </div>
      </div>
    </div>
  );
}
