"use client";

import { createLdapAuthSourceAction } from "@/actions/ldap.actions";
import { useActionState } from "react";

interface FormState {
  error?: string;
}

async function action(_prev: FormState | undefined, formData: FormData): Promise<FormState> {
  try {
    await createLdapAuthSourceAction({
      name: formData.get("name") as string,
      host: formData.get("host") as string,
      port: Number(formData.get("port") || 389),
      baseDn: formData.get("baseDn") as string,
      bindDn: formData.get("bindDn") as string,
      bindPasswordEncrypted: formData.get("bindPasswordEncrypted") as string,
      loginField: (formData.get("loginField") as string) || "uid",
      syncField: formData.get("syncField") as string,
      groupField: (formData.get("groupField") as string) || null,
      useTls: formData.get("useTls") === "on",
      isActive: formData.get("isActive") === "on",
    });
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Error desconocido" };
  }
}

export function LdapSourceForm() {
  const [state, formAction, isPending] = useActionState(action, undefined);
  const inputClass = "mt-1 w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15";

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="ldap-name" className="text-sm font-medium">Nombre</label>
        <input id="ldap-name" name="name" required placeholder="LDAP corporativo" className={inputClass} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label htmlFor="ldap-host" className="text-sm font-medium">Host</label>
          <input id="ldap-host" name="host" required placeholder="ldap.empresa.com" className={inputClass} />
        </div>
        <div>
          <label htmlFor="ldap-port" className="text-sm font-medium">Puerto</label>
          <input id="ldap-port" name="port" type="number" defaultValue={389} className={inputClass} />
        </div>
      </div>
      <div>
        <label htmlFor="ldap-base-dn" className="text-sm font-medium">Base DN</label>
        <input id="ldap-base-dn" name="baseDn" required placeholder="dc=empresa,dc=com" className={inputClass} />
      </div>
      <div>
        <label htmlFor="ldap-bind-dn" className="text-sm font-medium">Bind DN (cuenta de servicio)</label>
        <input id="ldap-bind-dn" name="bindDn" required placeholder="cn=admin,dc=empresa,dc=com" className={inputClass} />
      </div>
      <div>
        <label htmlFor="ldap-bind-password" className="text-sm font-medium">Contraseña del bind</label>
        <input id="ldap-bind-password" name="bindPasswordEncrypted" type="password" required className={inputClass} />
        <p className="mt-1 text-xs opacity-50">
          Se guarda en texto plano en esta versión (v1) - ver nota de seguridad en la sección de arriba.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="ldap-login-field" className="text-sm font-medium">Campo de login</label>
          <input id="ldap-login-field" name="loginField" defaultValue="uid" className={inputClass} />
        </div>
        <div>
          <label htmlFor="ldap-sync-field" className="text-sm font-medium">Campo de sincronización</label>
          <input id="ldap-sync-field" name="syncField" required placeholder="mail" className={inputClass} />
        </div>
      </div>
      <div>
        <label htmlFor="ldap-group-field" className="text-sm font-medium">Campo de grupo (opcional)</label>
        <input id="ldap-group-field" name="groupField" placeholder="memberOf" className={inputClass} />
      </div>
      <div className="flex gap-6">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input name="useTls" type="checkbox" />
          Usar TLS (ldaps://)
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input name="isActive" type="checkbox" defaultChecked />
          Activa
        </label>
      </div>
      {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {isPending ? "Creando..." : "Crear fuente LDAP"}
      </button>
    </form>
  );
}
