import { requireAuthContext } from "@/lib/session";
import { listConversations } from "@itsm/core";

export async function GET() {
  const context = await requireAuthContext();
  const conversations = await listConversations(context.user.id);
  return Response.json(conversations);
}
