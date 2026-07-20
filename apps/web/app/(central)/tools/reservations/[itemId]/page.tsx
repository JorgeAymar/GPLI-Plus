import { requireAuthContext } from "@/lib/session";
import { getReservationItem, listReservationsForItem } from "@itsm/core";
import { notFound } from "next/navigation";
import { CancelReservationButton } from "./cancel-reservation-button";
import { ReservationForm } from "./reservation-form";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reservas del activo" };

export default async function ReservationItemDetailPage({ params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  await requireAuthContext();

  const item = await getReservationItem(itemId);
  if (!item) notFound();

  const reservationList = await listReservationsForItem(itemId);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reservas del activo</h1>
      {item.comment ? <p className="text-sm opacity-60">{item.comment}</p> : null}

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Reservas existentes</h2>
          <ul className="space-y-2">
            {reservationList.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {new Date(r.beginAt).toLocaleString()} → {new Date(r.endAt).toLocaleString()}
                  {r.comment ? <span className="opacity-40"> · {r.comment}</span> : null}
                </span>
                <CancelReservationButton reservationId={r.id} reservationItemId={itemId} />
              </li>
            ))}
            {reservationList.length === 0 ? <li className="text-sm opacity-50">Sin reservas todavía.</li> : null}
          </ul>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Nueva reserva</h2>
          <ReservationForm reservationItemId={itemId} />
        </div>
      </div>
    </div>
  );
}
