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
      <PermissionMatrix profileId={id} moduleKeys={Object.values(MODULE)} rightBits={RIGHT} initialRights={rights} />
    </div>
  );
}
