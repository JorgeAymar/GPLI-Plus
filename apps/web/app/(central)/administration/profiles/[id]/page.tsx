import { getProfile, listModuleRightsForProfile, MODULE, RIGHT } from "@itsm/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PermissionMatrix } from "./permission-matrix";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const profile = await getProfile(id);
  return { title: profile?.name ?? "Perfil" };
}

export default async function ProfileDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const profile = await getProfile(id);
  if (!profile) notFound();

  const rights = await listModuleRightsForProfile(id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{profile.name}</h1>
        <p className="text-sm opacity-60">Interfaz: {profile.interface}</p>
      </div>
      <div className="rounded-md border border-black/10 p-6 dark:border-white/10">
        <h2 className="mb-4 border-b border-black/10 pb-3 text-sm font-semibold dark:border-white/10">Permisos</h2>
        <PermissionMatrix profileId={id} moduleKeys={Object.values(MODULE)} rightBits={RIGHT} initialRights={rights} />
      </div>
    </div>
  );
}
