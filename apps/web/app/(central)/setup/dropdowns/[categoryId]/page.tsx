import { requireAuthContext } from "@/lib/session";
import { getDropdownCategory, listDropdownItems } from "@itsm/core";
import { notFound } from "next/navigation";
import { DropdownItemForm } from "./dropdown-item-form";

export default async function DropdownCategoryPage({ params }: { params: Promise<{ categoryId: string }> }) {
  const { categoryId } = await params;
  const context = await requireAuthContext();

  const category = await getDropdownCategory(categoryId);
  if (!category) notFound();

  const items = await listDropdownItems(categoryId, context.activeEntity.id);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">{category.name}</h1>
      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Items existentes</h2>
          <ul className="space-y-1">
            {items.map((i) => (
              <li key={i.id} className="text-sm">
                {i.name}
              </li>
            ))}
            {items.length === 0 ? <li className="text-sm opacity-50">Sin items todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Nuevo item</h2>
          <DropdownItemForm categoryId={categoryId} entityId={context.activeEntity.id} />
        </div>
      </div>
    </div>
  );
}
