import { requireAuthContext } from "@/lib/session";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return { title: t("title") };
}

export default async function DashboardPage() {
  const context = await requireAuthContext();
  const t = await getTranslations("dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-2 text-sm opacity-70">
          {t("activeEntity")}: <strong>{context.activeEntity.name}</strong> · {t("activeProfile")}:{" "}
          <strong>{context.activeProfile.name}</strong> ({context.activeProfile.interface})
        </p>
      </div>

      <div className="rounded-md border border-black/10 p-4 dark:border-white/10">
        <h2 className="text-sm font-medium opacity-70">{t("assistantHeading")}</h2>
        <p className="mt-1 text-sm opacity-70">{t("assistantDescription")}</p>
        <a
          href="http://localhost:3400"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block rounded-md border border-black/15 px-3 py-2 text-sm hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
        >
          {t("assistantCta")}
        </a>
      </div>
    </div>
  );
}
