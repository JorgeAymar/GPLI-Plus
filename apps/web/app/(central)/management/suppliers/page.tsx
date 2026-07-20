import { softDeleteSupplierAction } from "@/actions/suppliers.actions";
import { requireAuthContext } from "@/lib/session";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { listSuppliers } from "@itsm/core";
import Link from "next/link";
import { SupplierForm } from "./supplier-form";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Proveedores" };

export default async function SuppliersPage() {
  const context = await requireAuthContext();
  const suppliers = await listSuppliers(context.activeEntity.id, { includeSubtree: true });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Proveedores</h1>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold">Existentes</h2>
          <ul className="space-y-1">
            {suppliers.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2">
                <Link href={`/management/contacts?supplierId=${s.id}`} className="text-sm hover:underline">
                  {s.name} {s.email ? <span className="opacity-40">({s.email})</span> : null}
                </Link>
                <ConfirmDeleteButton
                  id={s.id}
                  action={softDeleteSupplierAction}
                  confirmMessage={`¿Eliminar el proveedor "${s.name}"? Esta acción no se puede deshacer.`}
                />
              </li>
            ))}
            {suppliers.length === 0 ? <li className="text-sm opacity-50">Sin proveedores todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-60">Nuevo proveedor</h2>
          <SupplierForm entityId={context.activeEntity.id} />
        </div>
      </div>
    </div>
  );
}
