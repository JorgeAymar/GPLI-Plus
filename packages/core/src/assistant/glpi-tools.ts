import type { AuthContext } from "../auth/get-auth-context";
import { RIGHT, requireRight } from "../auth/permissions";
import { ITEMTYPE_REGISTRY } from "../api-clients/itemtype-registry";
import type { OllamaToolDef } from "./ollama-client";

/**
 * In-process equivalent of the standalone IA-asistente app's lib/glpi-mcp.ts.
 * That version talked to /api/mcp over HTTP with a single static personal
 * access token, so every chat user shared that one token's permissions
 * regardless of who was actually logged in. Now that the assistant lives
 * inside the same app, tools run straight against ITEMTYPE_REGISTRY (the
 * same registry /api/mcp/route.ts uses) with the real caller's AuthContext -
 * each user only ever sees what they're actually allowed to see.
 */

export function getGlpiToolsForOllama(): OllamaToolDef[] {
  const defs: OllamaToolDef[] = [];
  for (const key of Object.keys(ITEMTYPE_REGISTRY)) {
    defs.push({
      type: "function",
      function: {
        name: `list_${key}`,
        description: `Lista los "${key}" de tu entidad activa (incluye subárbol).`,
        parameters: { type: "object", properties: {} },
      },
    });
    if (ITEMTYPE_REGISTRY[key]?.get) {
      defs.push({
        type: "function",
        function: {
          name: `get_${key}`,
          description: `Obtiene un "${key.replace(/s$/, "")}" por id. ADVERTENCIA: no verifica que el registro pertenezca a tu entidad activa.`,
          parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
        },
      });
    }
  }
  return defs;
}

/**
 * Runs a tool call by name against ITEMTYPE_REGISTRY, scoped to `context`'s
 * real active entity and rights. Mirrors /api/mcp/route.ts's per-call
 * behavior (fresh permission check every call, human-readable text on
 * denial/not-found rather than throwing) so both entry points behave
 * identically.
 */
export async function callGlpiTool(context: AuthContext, name: string, args: Record<string, unknown>): Promise<string> {
  const match = name.match(/^(list|get)_(.+)$/);
  if (!match) return `Herramienta desconocida: "${name}".`;
  const [, action, key] = match;
  const entry = ITEMTYPE_REGISTRY[key as string];
  if (!entry) return `Herramienta desconocida: "${name}".`;

  try {
    await requireRight(context, entry.moduleKey, RIGHT.READ);
  } catch (err) {
    return err instanceof Error ? err.message : "Sin permiso";
  }

  if (action === "list") {
    const items = await entry.list(context.activeEntity.id);
    return JSON.stringify(items);
  }

  if (!entry.get) return `"${key}" no soporta búsqueda por id.`;
  const id = typeof args.id === "string" ? args.id : undefined;
  if (!id) return "Falta el parámetro id.";
  const item = await entry.get(id);
  if (!item) return `No se encontró "${key}" con id ${id}.`;
  return JSON.stringify(item);
}
