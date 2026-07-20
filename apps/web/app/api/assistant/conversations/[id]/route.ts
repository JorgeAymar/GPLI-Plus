import { requireAuthContext } from "@/lib/session";
import { deleteConversation, getConversationWithMessages } from "@itsm/core";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await requireAuthContext();
  const { id } = await params;

  const conversation = await getConversationWithMessages(id, context.user.id);
  if (!conversation) return new Response("Not found", { status: 404 });

  return Response.json(conversation);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await requireAuthContext();
  const { id } = await params;

  await deleteConversation(id, context.user.id);
  return new Response(null, { status: 204 });
}
