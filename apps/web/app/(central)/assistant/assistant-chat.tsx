"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

/** Three staggered pulsing dots, shown in the assistant's bubble while the first token hasn't arrived yet. */
function TypingIndicator() {
  return (
    <span className="flex items-center gap-1 py-1">
      {[0, 150, 300].map((delayMs) => (
        <span
          key={delayMs}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-60"
          style={{ animationDelay: `${delayMs}ms` }}
        />
      ))}
    </span>
  );
}

const STORAGE_KEY = "glpi-plus:assistant-chat";

interface StoredChat {
  conversationId: string | null;
  messages: ChatMessage[];
}

function loadStoredChat(): StoredChat {
  if (typeof window === "undefined") return { conversationId: null, messages: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { conversationId: null, messages: [] };
    const parsed = JSON.parse(raw) as StoredChat;
    return { conversationId: parsed.conversationId ?? null, messages: parsed.messages ?? [] };
  } catch {
    return { conversationId: null, messages: [] };
  }
}

export function AssistantChat() {
  const t = useTranslations("assistant");
  const suggestions = t.raw("suggestions") as string[];
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const hydratedRef = useRef(false);

  async function refreshConversations() {
    try {
      const res = await fetch("/api/assistant/conversations");
      if (res.ok) setConversations(await res.json());
    } catch {
      // Sidebar list is a convenience, not required for the chat itself to work.
    }
  }

  // Loaded on mount (not during SSR, where localStorage doesn't exist) so a page
  // refresh resumes the same conversation instead of starting over - per explicit
  // instruction, the user's assistant configuration/history stays in the browser.
  // A lazy useState(loadStoredChat) initializer would run during SSR's render
  // pass too (returning the empty default there) but then ALSO run again on the
  // client's very first hydration pass with a real window - producing a
  // hydration mismatch (server: empty, client: populated) instead of the clean
  // "render empty, then swap in the real data" this effect deliberately does.
  useEffect(() => {
    const stored = loadStoredChat();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional post-hydration sync from localStorage, not derived render state; see comment above.
    setMessages(stored.messages);
    setConversationId(stored.conversationId);
    hydratedRef.current = true;
    refreshConversations();
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ conversationId, messages }));
  }, [conversationId, messages]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function sendText(text: string) {
    if (!text.trim() || isSending) return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setIsSending(true);
    setError(null);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages, conversationId }),
      });
      if (!res.body) throw new Error("No response body");

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const payload = line.replace(/^data: /, "").trim();
          if (!payload || payload === "[DONE]") continue;
          const event = JSON.parse(payload) as
            | { type: "conversation_id"; id: string }
            | { type: "text"; text: string }
            | { type: "done" }
            | { type: "error"; message: string };

          if (event.type === "conversation_id") {
            setConversationId(event.id);
          } else if (event.type === "text") {
            setMessages((prev) => {
              const updated = [...prev];
              const last = updated[updated.length - 1];
              if (last?.role === "assistant") updated[updated.length - 1] = { ...last, content: last.content + event.text };
              return updated;
            });
          } else if (event.type === "error") {
            setError(event.message);
          }
        }
      }

      // A brand new conversation gets its auto-generated title only after the
      // first exchange completes server-side - refresh so it shows up (and so
      // an existing one moves to the top by updatedAt).
      refreshConversations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setIsSending(false);
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    await sendText(input);
  }

  function startNewConversation() {
    setMessages([]);
    setConversationId(null);
    setError(null);
    window.localStorage.removeItem(STORAGE_KEY);
  }

  async function loadConversation(id: string) {
    if (id === conversationId) return;
    setError(null);
    try {
      const res = await fetch(`/api/assistant/conversations/${id}`);
      if (!res.ok) throw new Error("No se pudo cargar la conversación.");
      const data = await res.json();
      setConversationId(data.id);
      setMessages(data.messages.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    }
  }

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`/api/assistant/conversations/${id}`, { method: "DELETE" });
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (id === conversationId) startNewConversation();
  }

  return (
    <div className="flex flex-1 gap-4 overflow-hidden">
      <aside className="flex w-56 shrink-0 flex-col overflow-hidden rounded-md border border-black/10 dark:border-white/10">
        <div className="flex items-center justify-between border-b border-black/10 px-3 py-2 dark:border-white/10">
          <span className="text-xs font-medium uppercase tracking-wide opacity-60">{t("history")}</span>
          <button type="button" onClick={startNewConversation} className="text-sm opacity-70 hover:opacity-100">
            {t("newConversation")}
          </button>
        </div>
        <ul className="flex-1 space-y-1 overflow-y-auto p-2">
          {conversations.length === 0 ? (
            <li className="px-1 py-2 text-sm opacity-50">{t("noConversations")}</li>
          ) : (
            conversations.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => loadConversation(c.id)}
                  className={
                    c.id === conversationId
                      ? "flex w-full items-center justify-between rounded-md bg-black/5 px-2 py-2 text-left text-sm dark:bg-white/10"
                      : "flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/5"
                  }
                >
                  <span className="truncate">{c.title}</span>
                  <span
                    role="button"
                    aria-label={t("deleteConversation")}
                    onClick={(e) => deleteConversation(c.id, e)}
                    className="ml-2 shrink-0 opacity-40 hover:opacity-100"
                  >
                    ×
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden rounded-md border border-black/10 dark:border-white/10">
        <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm opacity-50">{t("emptyState")}</p>
              <p className="text-xs font-medium uppercase tracking-wide opacity-60">{t("suggestionsHeading")}</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => sendText(s)}
                    className="rounded-md border border-black/15 px-3 py-2 text-left text-sm hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    m.role === "user"
                      ? "max-w-[75%] rounded-md bg-black/5 px-3 py-2 text-sm dark:bg-white/10"
                      : "max-w-[75%] whitespace-pre-wrap rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10"
                  }
                >
                  {m.content ? m.content : isSending && i === messages.length - 1 ? <TypingIndicator /> : ""}
                </div>
              </div>
            ))
          )}
          {error ? (
            <p className="text-sm text-red-600">
              {t("errorPrefix")} {error}
            </p>
          ) : null}
        </div>

        <form onSubmit={sendMessage} className="flex gap-2 border-t border-black/10 p-3 dark:border-white/10">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("placeholder")}
            disabled={isSending}
            className="flex-1 rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
          />
          <button
            type="submit"
            disabled={isSending || !input.trim()}
            className="rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {isSending ? t("sending") : t("send")}
          </button>
        </form>
      </div>
    </div>
  );
}
