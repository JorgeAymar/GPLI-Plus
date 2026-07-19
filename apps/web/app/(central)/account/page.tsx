import { requireAuthContext } from "@/lib/session";
import { listMyApiClients, SUPPORTED_LANGUAGES } from "@itsm/core";
import { LanguageForm } from "./language-form";
import { RevokeTokenButton } from "./revoke-token-button";
import { TokenForm } from "./token-form";

export default async function AccountPage() {
  const context = await requireAuthContext();
  const tokens = await listMyApiClients(context.user.id);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Mi cuenta</h1>

      <section className="space-y-2">
        <h2 className="text-sm font-medium opacity-70">Datos</h2>
        <dl className="grid max-w-md grid-cols-2 gap-y-1 text-sm">
          <dt className="opacity-60">Nombre</dt>
          <dd>{context.user.displayName}</dd>
          <dt className="opacity-60">Email</dt>
          <dd>{context.user.email}</dd>
          <dt className="opacity-60">Entidad activa</dt>
          <dd>{context.activeEntity.name}</dd>
          <dt className="opacity-60">Perfil activo</dt>
          <dd>{context.activeProfile.name}</dd>
        </dl>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium opacity-70">Idioma</h2>
        <LanguageForm currentLanguage={context.user.language} options={SUPPORTED_LANGUAGES} />
        <p className="max-w-md text-xs opacity-50">
          Esto solo guarda tu preferencia. Todavía no cambia el idioma de la interfaz.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium opacity-70">Tokens MCP</h2>
        <p className="max-w-2xl text-sm opacity-70">
          Tokens personales para conectar clientes MCP (Claude Desktop, Claude Code, etc.) contra{" "}
          <code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">/api/mcp</code>. Actúan con tus mismos permisos —
          solo lectura por ahora.
        </p>

        <div className="grid grid-cols-2 gap-8">
          <div className="min-w-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left opacity-60">
                    <th className="pb-2">Nombre</th>
                    <th className="pb-2">Prefijo</th>
                    <th className="pb-2">Estado</th>
                    <th className="pb-2">Último uso</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((t) => (
                    <tr key={t.id} className="border-t border-black/5 dark:border-white/5">
                      <td className="py-2">{t.name}</td>
                      <td className="py-2 font-mono opacity-70">{t.apiKeyPrefix}…</td>
                      <td className="py-2">
                        {t.isActive ? (
                          <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-xs text-green-700 dark:text-green-400">
                            Activo
                          </span>
                        ) : (
                          <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-xs text-red-700 dark:text-red-400">
                            Revocado
                          </span>
                        )}
                      </td>
                      <td className="py-2 whitespace-nowrap opacity-70">{t.lastUsedAt ? t.lastUsedAt.toLocaleString() : "Nunca"}</td>
                      <td className="py-2">{t.isActive ? <RevokeTokenButton id={t.id} /> : null}</td>
                    </tr>
                  ))}
                  {tokens.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-2 opacity-50">
                        Sin tokens todavía.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <TokenForm />
          </div>
        </div>
      </section>
    </div>
  );
}
