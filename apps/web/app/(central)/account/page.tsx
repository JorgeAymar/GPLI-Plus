import { requireAuthContext } from "@/lib/session";
import { listMyApiClients, SUPPORTED_LANGUAGES } from "@itsm/core";
import { getTranslations } from "next-intl/server";
import { LanguageForm } from "./language-form";
import { RevokeTokenButton } from "./revoke-token-button";
import { TokenForm } from "./token-form";

export default async function AccountPage() {
  const context = await requireAuthContext();
  const tokens = await listMyApiClients(context.user.id);
  const t = await getTranslations("account");

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      <section className="space-y-2">
        <h2 className="text-sm font-medium opacity-70">{t("dataHeading")}</h2>
        <dl className="grid max-w-md grid-cols-2 gap-y-1 text-sm">
          <dt className="opacity-60">{t("name")}</dt>
          <dd>{context.user.displayName}</dd>
          <dt className="opacity-60">{t("email")}</dt>
          <dd>{context.user.email}</dd>
          <dt className="opacity-60">{t("activeEntity")}</dt>
          <dd>{context.activeEntity.name}</dd>
          <dt className="opacity-60">{t("activeProfile")}</dt>
          <dd>{context.activeProfile.name}</dd>
        </dl>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium opacity-70">{t("languageHeading")}</h2>
        <LanguageForm currentLanguage={context.user.language} options={SUPPORTED_LANGUAGES} />
        <p className="max-w-md text-xs opacity-50">{t("languageDisclaimer")}</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-medium opacity-70">{t("tokensHeading")}</h2>
        <p className="max-w-2xl text-sm opacity-70">
          {t.rich("tokensDescription", {
            endpoint: () => <code className="rounded bg-black/5 px-1 py-0.5 dark:bg-white/10">/api/mcp</code>,
          })}
        </p>

        <div className="grid grid-cols-2 gap-8">
          <div className="min-w-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left opacity-60">
                    <th className="pb-2">{t("tokenColName")}</th>
                    <th className="pb-2">{t("tokenColPrefix")}</th>
                    <th className="pb-2">{t("tokenColStatus")}</th>
                    <th className="pb-2">{t("tokenColLastUsed")}</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((tk) => (
                    <tr key={tk.id} className="border-t border-black/5 dark:border-white/5">
                      <td className="py-2">{tk.name}</td>
                      <td className="py-2 font-mono opacity-70">{tk.apiKeyPrefix}…</td>
                      <td className="py-2">
                        {tk.isActive ? (
                          <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-xs text-green-700 dark:text-green-400">
                            {t("tokenStatusActive")}
                          </span>
                        ) : (
                          <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-xs text-red-700 dark:text-red-400">
                            {t("tokenStatusRevoked")}
                          </span>
                        )}
                      </td>
                      <td className="py-2 whitespace-nowrap opacity-70">
                        {tk.lastUsedAt ? tk.lastUsedAt.toLocaleString() : t("tokenLastUsedNever")}
                      </td>
                      <td className="py-2">{tk.isActive ? <RevokeTokenButton id={tk.id} /> : null}</td>
                    </tr>
                  ))}
                  {tokens.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-2 opacity-50">
                        {t("tokenEmpty")}
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
