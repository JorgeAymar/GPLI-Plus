import Link from "next/link";
import { listDropdownCategories } from "@itsm/core";
import { DropdownCategoryForm } from "./dropdown-category-form";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Listas desplegables" };

export default async function DropdownsPage() {
  const categories = await listDropdownCategories();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Listas desplegables</h1>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
          <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-semibold dark:border-white/10">Categorías existentes</h2>
          <ul className="space-y-1">
            {categories.map((c) => (
              <li key={c.id}>
                <Link href={`/setup/dropdowns/${c.id}`} className="text-sm hover:underline">
                  {c.name} <span className="opacity-40">({c.key})</span>
                </Link>
              </li>
            ))}
            {categories.length === 0 ? <li className="text-sm opacity-50">Sin categorías todavía.</li> : null}
          </ul>
        </div>
        <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
          <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-medium opacity-60 dark:border-white/10">Nueva categoría</h2>
          <DropdownCategoryForm />
        </div>
      </div>
    </div>
  );
}
