import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { AssistantChat } from "./assistant-chat";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("assistant");
  return { title: t("title") };
}

export default async function AssistantPage() {
  const t = await getTranslations("assistant");
  const configured = Boolean(process.env.AI_ASSISTANT_URL);

  return (
    <div className="flex h-[calc(100vh-6.5rem)] flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="mt-1 text-sm opacity-60">{t("subtitle")}</p>
      </div>

      {configured ? (
        <AssistantChat />
      ) : (
        <p className="text-sm opacity-60">{t("notConfigured")}</p>
      )}
    </div>
  );
}
