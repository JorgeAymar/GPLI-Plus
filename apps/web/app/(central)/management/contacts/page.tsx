import { softDeleteContactAction } from "@/actions/contacts.actions";
import { requireAuthContext } from "@/lib/session";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { listContacts, listSuppliers } from "@itsm/core";
import { ContactForm } from "./contact-form";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Contactos" };

export default async function ContactsPage({ searchParams }: { searchParams: Promise<{ supplierId?: string }> }) {
  const { supplierId } = await searchParams;
  const context = await requireAuthContext();
  const [contacts, suppliers] = await Promise.all([
    listContacts(context.activeEntity.id, { includeSubtree: true }),
    listSuppliers(context.activeEntity.id, { includeSubtree: true }),
  ]);

  const supplierById = new Map(suppliers.map((s) => [s.id, s]));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Contactos</h1>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold">Existentes</h2>
          <ul className="space-y-1">
            {contacts.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {c.firstName} {c.lastName}{" "}
                  <span className="opacity-40">{c.supplierId ? `(${supplierById.get(c.supplierId)?.name ?? "?"})` : ""}</span>
                </span>
                <ConfirmDeleteButton
                  id={c.id}
                  action={softDeleteContactAction}
                  confirmMessage={`¿Eliminar el contacto "${c.firstName} ${c.lastName}"? Esta acción no se puede deshacer.`}
                />
              </li>
            ))}
            {contacts.length === 0 ? <li className="text-sm opacity-50">Sin contactos todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-60">Nuevo contacto</h2>
          <ContactForm entityId={context.activeEntity.id} suppliers={suppliers} defaultSupplierId={supplierId} />
        </div>
      </div>
    </div>
  );
}
