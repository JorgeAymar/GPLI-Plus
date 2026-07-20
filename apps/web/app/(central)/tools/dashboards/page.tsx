import { requireAuthContext } from "@/lib/session";
import { listDashboardsVisibleTo } from "@itsm/core";
import Link from "next/link";
import { DashboardForm } from "./dashboard-form";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboards" };

export default async function DashboardsPage() {
  const context = await requireAuthContext();
  const dashboards = await listDashboardsVisibleTo(context);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboards</h1>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Existentes</h2>
          <ul className="space-y-1">
            {dashboards.map((d) => (
              <li key={d.id} className="text-sm">
                <Link href={`/tools/dashboards/${d.id}`} className="hover:underline">
                  {d.name}
                </Link>
                <span className="ml-2 text-xs opacity-40">({d.key})</span>
              </li>
            ))}
            {dashboards.length === 0 ? <li className="text-sm opacity-50">Sin dashboards todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Nuevo dashboard</h2>
          <DashboardForm />
        </div>
      </div>
    </div>
  );
}
