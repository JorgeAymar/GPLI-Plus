import { requireAuthContext } from "@/lib/session";
import { getRssFeed, listCachedItems } from "@itsm/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const feed = await getRssFeed(id);
  return { title: feed?.name ?? "Feed RSS" };
}

/**
 * Cached item descriptions are already sanitized server-side (sanitize-html,
 * see rss-feed-service.ts refreshRssFeed()), but this page still renders them
 * as plain text rather than markup - defense in depth, and simpler/safer than
 * re-parsing HTML on the client for v1.
 */
export default async function RssFeedDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAuthContext();

  const feed = await getRssFeed(id);
  if (!feed) notFound();

  const items = await listCachedItems(id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{feed.name}</h1>
        <p className="mt-1 text-xs opacity-50">
          {feed.url} · cada {feed.refreshRateMinutes} min · máx. {feed.maxItems} items
          {feed.haveError ? <span className="text-red-600"> · último intento falló</span> : null}
        </p>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium opacity-70">Items en caché</h2>
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-md border border-black/10 p-3 text-sm dark:border-white/10">
              <a href={item.link} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                {item.title}
              </a>
              <div className="mt-0.5 text-xs opacity-50">
                {item.publishedAt ? new Date(item.publishedAt).toLocaleString() : "sin fecha"}
              </div>
              {item.description ? <p className="mt-1 whitespace-pre-wrap opacity-80">{item.description}</p> : null}
            </li>
          ))}
          {items.length === 0 ? <li className="text-sm opacity-50">Sin items en caché todavía.</li> : null}
        </ul>
      </div>
    </div>
  );
}
