import { getAuthContext } from "@/lib/session";
import { readDocumentContent } from "@itsm/core";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getAuthContext();
  if (!context) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const content = await readDocumentContent(id);
  if (!content) return new Response("Not found", { status: 404 });

  return new Response(new Uint8Array(content.buffer), {
    headers: {
      "Content-Type": content.mimeType,
      "Content-Disposition": `attachment; filename="${content.filename}"`,
      "Content-Length": String(content.buffer.length),
    },
  });
}
