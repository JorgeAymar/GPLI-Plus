import { requireAuthContext } from "@/lib/session";

/** Proxies to IA-asistente's own /api/conversations - same rationale as /api/assistant/chat. */
export async function GET() {
  await requireAuthContext();

  const assistantUrl = process.env.AI_ASSISTANT_URL;
  if (!assistantUrl) return Response.json([]);

  const upstream = await fetch(`${assistantUrl}/api/conversations`, { cache: "no-store" });
  const data = await upstream.json();
  return Response.json(data, { status: upstream.status });
}
