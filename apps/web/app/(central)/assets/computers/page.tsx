import { requireAuthContext } from "@/lib/session";
import { DataTable } from "@/components/data-table";
import { DROPDOWN_CATEGORY, getDropdownCategoryByKey, listComputers, listDropdownItems } from "@itsm/core";
import Link from "next/link";
import { ComputerForm } from "./computer-form";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Computadoras" };

export default async function ComputersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const context = await requireAuthContext();

  const allComputers = await listComputers(context.activeEntity.id, { includeSubtree: true });
  const computers = q
    ? allComputers.filter((c) => {
        const needle = q.toLowerCase();
        return (
          c.name.toLowerCase().includes(needle) ||
          (c.serialNumber ?? "").toLowerCase().includes(needle) ||
          (c.inventoryNumber ?? "").toLowerCase().includes(needle)
        );
      })
    : allComputers;

  const osCategory = await getDropdownCategoryByKey(DROPDOWN_CATEGORY.OS);
  const osOptions = osCategory ? await listDropdownItems(osCategory.id, context.activeEntity.id) : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Computadoras</h1>

      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Buscar por nombre, serie o inventario..."
          className="w-full max-w-md rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
        />
        <button type="submit" className="rounded-md border border-black/15 px-3 py-2 text-sm dark:border-white/15">
          Buscar
        </button>
      </form>

      <div className="grid grid-cols-2 gap-8">
        <div className="min-w-0">
          <h2 className="mb-2 text-sm font-medium opacity-70">Existentes</h2>
          <DataTable
            columns={[
              {
                key: "name",
                label: "Nombre",
                render: (c) => (
                  <Link href={`/assets/computers/${c.id}`} className="hover:underline">
                    {c.name}
                  </Link>
                ),
              },
              { key: "serialNumber", label: "Serie", render: (c) => c.serialNumber ?? "-", className: "opacity-70" },
            ]}
            rows={computers}
            rowKey={(c) => c.id}
            emptyMessage="Sin computadoras todavía."
          />
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Nueva computadora</h2>
          <ComputerForm entityId={context.activeEntity.id} osOptions={osOptions} />
        </div>
      </div>
    </div>
  );
}
