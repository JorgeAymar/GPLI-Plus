import { requireAuthContext } from "@/lib/session";

interface Skill {
  id: string;
  prompt: string;
}

/**
 * Proxies chat requests to the IA-asistente app's own /api/chat (a separate
 * Next.js app on AI_ASSISTANT_URL, e.g. localhost:3400) so the browser only
 * ever talks to this same origin - avoids CORS entirely and lets the chat UI
 * live inside GLPI-Plus's own layout/design system instead of an iframe of a
 * differently-styled app. Also resolves the GLPI-Plus skill prompt server-side
 * (IA-asistente's own SYSTEM_PROMPT default is a generic one - the real
 * GLPI-Plus-scoped prompt only applies when `skillPrompt` is passed explicitly).
 */
export async function POST(req: Request) {
  await requireAuthContext();

  const assistantUrl = process.env.AI_ASSISTANT_URL;
  if (!assistantUrl) {
    return Response.json({ error: "AI_ASSISTANT_URL no está configurado." }, { status: 503 });
  }

  const { messages, conversationId } = await req.json();

  let skillPrompt: string | undefined;
  try {
    const skillsRes = await fetch(`${assistantUrl}/api/skills`);
    const skills: Skill[] = await skillsRes.json();
    skillPrompt = skills.find((s) => s.id === "glpi-plus")?.prompt;
  } catch {
    // Fall through without a skillPrompt - IA-asistente falls back to its own
    // generic SYSTEM_PROMPT rather than failing the request.
  }

  const upstream = await fetch(`${assistantUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, conversationId, skillPrompt }),
  });

  if (!upstream.body) {
    return Response.json({ error: "El asistente no devolvió una respuesta." }, { status: 502 });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
