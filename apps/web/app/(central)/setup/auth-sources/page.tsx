import { listLdapAuthSources } from "@itsm/core";
import { LdapSourceForm } from "./ldap-source-form";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Fuentes de autenticación" };

export default async function AuthSourcesPage() {
  const sources = await listLdapAuthSources();

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Fuentes de autenticación</h1>
        <p className="mt-1 text-sm opacity-60">
          Autenticación empresarial (SSO): servidores LDAP y proveedor OIDC genérico. SAML aún no está soportado.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">LDAP</h2>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div>
            <h3 className="mb-2 text-sm font-medium opacity-70">Servidores configurados</h3>
            <ul className="space-y-2">
              {sources.map((s) => (
                <li key={s.id} className="rounded-md border border-black/10 p-3 text-sm dark:border-white/10">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{s.name}</span>
                    <span className={`text-xs ${s.isActive ? "text-green-600" : "opacity-40"}`}>
                      {s.isActive ? "activa" : "inactiva"}
                    </span>
                  </div>
                  <div className="mt-1 text-xs opacity-60">
                    {s.useTls ? "ldaps" : "ldap"}://{s.host}:{s.port} - base: {s.baseDn}
                  </div>
                  <div className="mt-1 text-xs opacity-60">
                    login: {s.loginField} - sync: {s.syncField}
                    {s.groupField ? ` - grupo: ${s.groupField}` : ""}
                  </div>
                </li>
              ))}
              {sources.length === 0 ? <li className="text-sm opacity-50">Sin fuentes LDAP todavía.</li> : null}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-medium opacity-70">Nueva fuente LDAP</h3>
            <p className="mb-3 text-xs opacity-50">
              La contraseña del bind se guarda en texto plano en esta versión (v1) - el cifrado en reposo es una
              mejora de infraestructura pendiente, fuera del alcance de este módulo.
            </p>
            <LdapSourceForm />
          </div>
        </div>
      </section>

      <section className="space-y-2 rounded-md border border-black/10 p-4 text-sm dark:border-white/10">
        <h2 className="text-lg font-medium">OIDC (OpenID Connect)</h2>
        <p className="opacity-70">
          El login por OIDC (Google Workspace, Azure AD / Entra ID, Okta, Auth0, cualquier proveedor OIDC-compliant)
          se configura por variables de entorno, no desde esta pantalla:
        </p>
        <ul className="list-inside list-disc space-y-1 opacity-70">
          <li>
            <code>OIDC_ISSUER</code> - URL del emisor (issuer) del proveedor OIDC.
          </li>
          <li>
            <code>OIDC_CLIENT_ID</code> - client ID de la aplicación registrada en el proveedor.
          </li>
          <li>
            <code>OIDC_CLIENT_SECRET</code> - client secret de esa misma aplicación.
          </li>
        </ul>
        <p className="opacity-70">
          Si las 3 variables están presentes, el botón de inicio de sesión SSO aparece automáticamente en{" "}
          <code>/login</code>. Si falta cualquiera, el proveedor OIDC simplemente no se agrega y el login sigue
          funcionando solo con email/contraseña.
        </p>
      </section>

      <section className="space-y-1 rounded-md border border-black/10 p-4 text-sm opacity-70 dark:border-white/10">
        <h2 className="text-lg font-medium opacity-100">SAML</h2>
        <p>SAML está diferido - no está soportado todavía en esta versión. Usá OIDC o LDAP mientras tanto.</p>
      </section>
    </div>
  );
}
