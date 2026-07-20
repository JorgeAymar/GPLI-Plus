import { requireAuthContext } from "@/lib/session";
import {
  GLPI_PLUS_SYSTEM_PROMPT,
  addMessage,
  callGlpiTool,
  createConversation,
  getGlpiToolsForOllama,
  maybeSetInitialTitle,
  streamOllama,
  streamOllamaWithTools,
} from "@itsm/core";

/**
 * Runs entirely in-process now (previously proxied to a standalone sibling
 * app over HTTP) - streams from Ollama and, when tools are called, resolves
 * them straight against ITEMTYPE_REGISTRY scoped to the real logged-in
 * user's AuthContext (see @itsm/core's assistant/glpi-tools.ts).
 */
export async function POST(req: Request) {
  const context = await requireAuthContext();

  const { messages, conversationId } = await req.json();
  const model = process.env.AI_MODEL ?? "";

  let convId: string = conversationId ?? "";
  const userMessage: { role: string; content: string } = messages[messages.length - 1];

  if (!convId) {
    convId = await createConversation(context.user.id);
  }

  await addMessage(convId, "user", userMessage.content, null);

  const encoder = new TextEncoder();
  let fullResponse = "";

  const readable = new ReadableStream({
    async start(controller) {
      const send = (data: object) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

      try {
        send({ type: "conversation_id", id: convId });

        const ollamaMessages = messages.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content }));
        const tools = getGlpiToolsForOllama();
        const textStream =
          tools.length > 0
            ? streamOllamaWithTools(model, ollamaMessages, GLPI_PLUS_SYSTEM_PROMPT, tools, (name, args) => callGlpiTool(context, name, args))
            : streamOllama(model, ollamaMessages, GLPI_PLUS_SYSTEM_PROMPT);

        for await (const text of textStream) {
          fullResponse += text;
          send({ type: "text", text });
        }

        await addMessage(convId, "assistant", fullResponse, model);
        await maybeSetInitialTitle(convId, userMessage.content);

        send({ type: "done" });
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error desconocido";
        send({ type: "error", message });
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
