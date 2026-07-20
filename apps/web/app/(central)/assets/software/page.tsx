import { requireAuthContext } from "@/lib/session";
import { DataTable } from "@/components/data-table";
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

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="min-w-0">
          <h2 className="mb-2 text-sm font-medium opacity-70">Existente</h2>
          <DataTable
            columns={[
              {
                key: "name",
                label: "Nombre",
                render: (s) => (
                  <Link href={`/assets/software/${s.id}`} className="hover:underline">
                    {s.name}
                  </Link>
                ),
              },
            ]}
            rows={softwareList}
            rowKey={(s) => s.id}
            emptyMessage="Sin software todavía."
          />
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Nuevo software</h2>
          <SoftwareForm entityId={context.activeEntity.id} />
        </div>
      </div>
    </div>
  );
}
