import { requireAuthContext } from "@/lib/session";
import { listRssFeeds } from "@itsm/core";
import Link from "next/link";
import { RssFeedForm } from "./rss-feed-form";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Feeds RSS" };

export default async function RssFeedsPage() {
  const context = await requireAuthContext();
  const feeds = await listRssFeeds(context);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Feeds RSS</h1>
      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Feeds</h2>
          <ul className="space-y-1">
            {feeds.map((f) => (
              <li key={f.id} className="text-sm">
                <Link href={`/tools/rss-feeds/${f.id}`} className="hover:underline">
                  {f.name}
                </Link>
                {f.haveError ? <span className="ml-2 text-xs text-red-600">error</span> : null}
                {f.isActive ? null : <span className="ml-2 text-xs opacity-40">(inactivo)</span>}
              </li>
            ))}
            {feeds.length === 0 ? <li className="text-sm opacity-50">Sin feeds todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Nuevo feed</h2>
          <RssFeedForm ownerUserId={context.user.id} />
        </div>
      </div>
    </div>
  );
}
