"use client";

import { createContactAction } from "@/actions/contacts.actions";
import { useFormSuccessToast } from "@/components/toast";
import type { Supplier } from "@itsm/db";
import { useActionState, useRef } from "react";

interface FormState {
  error?: string;
}

function makeAction(entityId: string) {
  return async (_prev: FormState | undefined, formData: FormData): Promise<FormState> => {
    try {
      await createContactAction({
        entityId,
        supplierId: (formData.get("supplierId") as string) || null,
        firstName: formData.get("firstName") as string,
        lastName: formData.get("lastName") as string,
        email: (formData.get("email") as string) || null,
        phone: (formData.get("phone") as string) || null,
      });
      return {};
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Error desconocido" };
    }
  };
}

export function ContactForm({
  entityId,
  suppliers,
  defaultSupplierId,
}: {
  entityId: string;
  suppliers: Supplier[];
  defaultSupplierId?: string;
}) {
  const [state, formAction, isPending] = useActionState(makeAction(entityId), undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useFormSuccessToast(state, formRef, "Contacto creado.");
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="contact-first-name" className="text-sm font-medium">Nombre</label>
          <input id="contact-first-name" name="firstName" required className={inputClass} />
        </div>
        <div>
          <label htmlFor="contact-last-name" className="text-sm font-medium">Apellido</label>
          <input id="contact-last-name" name="lastName" required className={inputClass} />
        </div>
      </div>
      <div>
        <label htmlFor="contact-supplier" className="text-sm font-medium">Proveedor</label>
        <select id="contact-supplier" name="supplierId" defaultValue={defaultSupplierId ?? ""} className={inputClass}>
          <option value="">(ninguno)</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="contact-email" className="text-sm font-medium">Email</label>
          <input id="contact-email" name="email" type="email" className={inputClass} />
        </div>
        <div>
          <label htmlFor="contact-phone" className="text-sm font-medium">Teléfono</label>
          <input id="contact-phone" name="phone" className={inputClass} />
        </div>
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear contacto"}
      </button>
    </form>
  );
}
