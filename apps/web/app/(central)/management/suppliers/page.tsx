import { requireAuthContext } from "@/lib/session";
import { listSuppliers } from "@itsm/core";
import Link from "next/link";
import { SupplierForm } from "./supplier-form";

export default async function SuppliersPage() {
  const context = await requireAuthContext();
  const suppliers = await listSuppliers(context.activeEntity.id, { includeSubtree: true });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Proveedores</h1>
      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Existentes</h2>
          <ul className="space-y-1">
            {suppliers.map((s) => (
              <li key={s.id}>
                <Link href={`/management/contacts?supplierId=${s.id}`} className="text-sm hover:underline">
                  {s.name} {s.email ? <span className="opacity-40">({s.email})</span> : null}
                </Link>
              </li>
            ))}
            {suppliers.length === 0 ? <li className="text-sm opacity-50">Sin proveedores todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Nuevo proveedor</h2>
          <SupplierForm entityId={context.activeEntity.id} />
        </div>
      </div>
    </div>
  );
}
