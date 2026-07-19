import { requireAuthContext } from "@/lib/session";
import { listSoftware } from "@itsm/core";
import Link from "next/link";
import { SoftwareForm } from "./software-form";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Software" };

export default async function SoftwarePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const context = await requireAuthContext();
  const allSoftware = await listSoftware(context.activeEntity.id, { includeSubtree: true });
  const softwareList = q ? allSoftware.filter((s) => s.name.toLowerCase().includes(q.toLowerCase())) : allSoftware;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Software</h1>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nombre..."
          className="w-full max-w-md rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
        <button type="submit" className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15">
          Buscar
        </button>
      </form>

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
