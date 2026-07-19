import { requireAuthContext } from "@/lib/session";

/** Proxies to IA-asistente's own /api/conversations/[id] - same rationale as /api/assistant/chat. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAuthContext();
  const { id } = await params;

  const assistantUrl = process.env.AI_ASSISTANT_URL;
  if (!assistantUrl) return new Response("Not configured", { status: 503 });

  const upstream = await fetch(`${assistantUrl}/api/conversations/${id}`, { cache: "no-store" });
  const body = await upstream.text();
  return new Response(body, { status: upstream.status, headers: { "Content-Type": "application/json" } });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAuthContext();
  const { id } = await params;

  const assistantUrl = process.env.AI_ASSISTANT_URL;
  if (!assistantUrl) return new Response("Not configured", { status: 503 });

  const upstream = await fetch(`${assistantUrl}/api/conversations/${id}`, { method: "DELETE" });
  return new Response(null, { status: upstream.status });
}
