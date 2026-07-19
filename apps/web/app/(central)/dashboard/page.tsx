import { requireAuthContext } from "@/lib/session";
import { getTranslations } from "next-intl/server";

export default async function DashboardPage() {
  const context = await requireAuthContext();
  const t = await getTranslations("dashboard");

  return (
    <div>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="mt-2 text-sm opacity-70">
        {t("activeEntity")}: <strong>{context.activeEntity.name}</strong> · {t("activeProfile")}:{" "}
        <strong>{context.activeProfile.name}</strong> ({context.activeProfile.interface})
      </p>
    </div>
  );
}
