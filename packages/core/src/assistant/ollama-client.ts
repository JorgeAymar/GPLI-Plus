function requireAiUrl(): string {
  const url = process.env.AI_URL;
  if (!url) throw new Error("AI_URL no está configurado.");
  return url;
}

export interface OllamaToolCall {
  id?: string;
  function: {
    index?: number;
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface OllamaMessage {
  role: string;
  content: string;
  tool_calls?: OllamaToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface OllamaToolDef {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
  };
}

function ollamaHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const apiKey = process.env.AI_API_KEY;
  if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;
  return headers;
}

/** Reads an Ollama `stream: true` /api/chat response and yields text deltas. */
async function* readOllamaStream(res: Response): AsyncGenerator<string> {
  if (!res.body) throw new Error("Ollama no devolvió cuerpo de respuesta");

  const reader = res.body.getReader();
  const dec = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    for (const line of dec.decode(value, { stream: true }).split("\n")) {
      if (!line.trim()) continue;
      try {
        const chunk = JSON.parse(line);
        const text: string = chunk.message?.content ?? "";
        if (text) yield text;
      } catch {
        /* partial line */
      }
    }
  }
}

export async function* streamOllama(model: string, messages: OllamaMessage[], system?: string): AsyncGenerator<string> {
  const url = requireAiUrl();
  const ollamaMessages: OllamaMessage[] = [];
  if (system) ollamaMessages.push({ role: "system", content: system });
  ollamaMessages.push(...messages);

  const res = await fetch(`${url}/api/chat`, {
    method: "POST",
    headers: ollamaHeaders(),
    body: JSON.stringify({ model, messages: ollamaMessages, stream: true }),
  });

  if (!res.ok || !res.body) {
    throw new Error(`Ollama responded with ${res.status}`);
  }

  yield* readOllamaStream(res);
}

/**
 * Full tool-calling round trip against Ollama's /api/chat.
 *
 * - `tools` follows the OpenAI function-calling shape
 *   (`{type:"function", function:{name, description, parameters}}`).
 * - Tool-calling decisions only show up reliably in `message.tool_calls`
 *   when the request is sent with `stream: false` — the first turn below
 *   is non-streaming for that reason.
 * - Ollama accepts tool results back as plain `{role: "tool", content}`
 *   messages appended after the assistant's tool_calls message.
 * - If no tool call is made, the first (non-streaming) call already has
 *   the complete answer — so it's emitted as a single chunk instead of
 *   firing a second, redundant request to Ollama just to re-stream text
 *   that's already in hand.
 */
export async function* streamOllamaWithTools(
  model: string,
  messages: OllamaMessage[],
  system: string | undefined,
  tools: OllamaToolDef[],
  callTool: (name: string, args: Record<string, unknown>) => Promise<string>,
): AsyncGenerator<string> {
  const url = requireAiUrl();
  const base: OllamaMessage[] = [];
  if (system) base.push({ role: "system", content: system });
  base.push(...messages);

  const decisionRes = await fetch(`${url}/api/chat`, {
    method: "POST",
    headers: ollamaHeaders(),
    body: JSON.stringify({ model, messages: base, tools, stream: false }),
  });
  if (!decisionRes.ok) {
    throw new Error(`Ollama responded with ${decisionRes.status}`);
  }
  const decision = (await decisionRes.json()) as { message?: OllamaMessage };
  const assistantMessage: OllamaMessage = decision.message ?? { role: "assistant", content: "" };
  const toolCalls = assistantMessage.tool_calls ?? [];

  if (toolCalls.length === 0) {
    if (assistantMessage.content) yield assistantMessage.content;
    return;
  }

  const toolResultMessages: OllamaMessage[] = [];
  for (const call of toolCalls) {
    const name = call.function?.name;
    const args = call.function?.arguments ?? {};
    let resultText: string;
    try {
      resultText = name ? await callTool(name, args) : "El modelo solicitó una herramienta sin nombre; no se puede ejecutar.";
    } catch (err) {
      resultText = `Error ejecutando la herramienta "${name}": ${err instanceof Error ? err.message : String(err)}`;
    }
    toolResultMessages.push({
      role: "tool",
      content: resultText,
      tool_call_id: call.id,
      name,
    });
  }

  const followUpMessages: OllamaMessage[] = [
    ...base,
    { role: "assistant", content: assistantMessage.content ?? "", tool_calls: toolCalls },
    ...toolResultMessages,
  ];

  const finalRes = await fetch(`${url}/api/chat`, {
    method: "POST",
    headers: ollamaHeaders(),
    body: JSON.stringify({ model, messages: followUpMessages, stream: true }),
  });
  if (!finalRes.ok || !finalRes.body) {
    throw new Error(`Ollama responded with ${finalRes.status}`);
  }

  yield* readOllamaStream(finalRes);
}
