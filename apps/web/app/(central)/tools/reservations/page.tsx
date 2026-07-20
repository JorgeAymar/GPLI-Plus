import { requireAuthContext } from "@/lib/session";
import { listAssets, listReservationItems } from "@itsm/core";
import Link from "next/link";
import { ReservationItemForm } from "./reservation-item-form";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reservas" };

export default async function ReservationsPage() {
  const context = await requireAuthContext();
  const [items, assets] = await Promise.all([
    listReservationItems(context.activeEntity.id, { includeSubtree: true }),
    listAssets(context.activeEntity.id, { includeSubtree: true }),
  ]);

  // An asset can only back one reservation item (assetId is unique), so drop
  // already-enabled assets from the "enable for reservation" picker.
  const reservedAssetIds = new Set(items.map(({ asset }) => asset.id));
  const availableAssets = assets.filter((a) => !reservedAssetIds.has(a.id));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reservas</h1>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Activos habilitados para reserva</h2>
          <ul className="space-y-1">
            {items.map(({ item, asset }) => (
              <li key={item.id} className="text-sm">
                <Link href={`/tools/reservations/${item.id}`} className="hover:underline">
                  {asset.name}
                </Link>
                {item.comment ? <span className="opacity-40"> · {item.comment}</span> : null}
              </li>
            ))}
            {items.length === 0 ? <li className="text-sm opacity-50">Sin activos habilitados para reserva todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Habilitar activo para reserva</h2>
          <ReservationItemForm assets={availableAssets.map((a) => ({ id: a.id, name: a.name }))} />
        </div>
      </div>
    </div>
  );
}
