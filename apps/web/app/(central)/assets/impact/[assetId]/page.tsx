import { requireAuthContext } from "@/lib/session";
import { buildImpactGraph, getAsset, listAssets, listDirectRelations, type ImpactGraphNode } from "@itsm/core";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ImpactRelationForm } from "./impact-relation-form";
import { RemoveImpactRelationButton } from "./remove-impact-relation-button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ assetId: string }>;
}): Promise<Metadata> {
  const { assetId } = await params;
  const asset = await getAsset(assetId);
  return { title: asset ? `Análisis de impacto: ${asset.name}` : "Análisis de impacto" };
}

/**
 * Flat <ul> per direction, indented via padding-left proportional to depth -
 * a "nested list" without building an actual recursive tree of <ul><li><ul>
 * or pulling in a graph-drawing library (out of scope for v1, see
 * impact-service.ts). depth 0 (the root asset itself) is filtered out by the
 * caller since it's already shown as the page title.
 */
function ImpactList({ title, nodes, emptyLabel }: { title: string; nodes: ImpactGraphNode[]; emptyLabel: string }) {
  const sorted = [...nodes].sort((a, b) => a.depth - b.depth || a.name.localeCompare(b.name));

  return (
    <div>
      <h2 className="mb-2 text-sm font-medium opacity-70">{title}</h2>
      <ul className="space-y-1">
        {sorted.map((node) => (
          <li key={node.assetId} className="text-sm" style={{ paddingLeft: `${node.depth * 16}px` }}>
            {node.name} <span className="opacity-40">(nivel {node.depth})</span>
          </li>
        ))}
        {sorted.length === 0 ? <li className="text-sm opacity-50">{emptyLabel}</li> : null}
      </ul>
    </div>
  );
}

export default async function ImpactPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const context = await requireAuthContext();

  const asset = await getAsset(assetId);
  if (!asset) notFound();

  const [dependsOnGraph, impactsGraph, directBackward, directForward, assets] = await Promise.all([
    buildImpactGraph(assetId, { direction: "backward" }),
    buildImpactGraph(assetId, { direction: "forward" }),
    listDirectRelations(assetId, "backward"),
    listDirectRelations(assetId, "forward"),
    listAssets(context.activeEntity.id, { includeSubtree: true }),
  ]);

  // depth 0 in each graph is the root asset (assetId) itself.
  const dependsOnNodes = dependsOnGraph.nodes.filter((n) => n.depth > 0);
  const impactsNodes = impactsGraph.nodes.filter((n) => n.depth > 0);

  const assetNameById = new Map(assets.map((a) => [a.id, a.name]));
  const relatedAssetOptions = assets.filter((a) => a.id !== asset.id).map((a) => ({ id: a.id, name: a.name }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Análisis de impacto: {asset.name}</h1>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <ImpactList title="De qué depende este activo" nodes={dependsOnNodes} emptyLabel="Sin dependencias registradas todavía." />
        <ImpactList title="Qué depende de este activo" nodes={impactsNodes} emptyLabel="Nada depende de este activo todavía." />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium opacity-70">Relaciones directas</h2>
        <ul className="space-y-1">
          {directBackward.map((relation) => (
            <li key={relation.id} className="text-sm">
              Depende de {assetNameById.get(relation.sourceAssetId) ?? relation.sourceAssetId}
              {relation.label ? <span className="opacity-40"> ({relation.label})</span> : null}{" "}
              <RemoveImpactRelationButton id={relation.id} viewAssetId={asset.id} />
            </li>
          ))}
          {directForward.map((relation) => (
            <li key={relation.id} className="text-sm">
              Impacta a {assetNameById.get(relation.impactedAssetId) ?? relation.impactedAssetId}
              {relation.label ? <span className="opacity-40"> ({relation.label})</span> : null}{" "}
              <RemoveImpactRelationButton id={relation.id} viewAssetId={asset.id} />
            </li>
          ))}
          {directBackward.length === 0 && directForward.length === 0 ? (
            <li className="text-sm opacity-50">Sin relaciones directas todavía.</li>
          ) : null}
        </ul>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium opacity-70">Nueva relación de impacto</h2>
        <ImpactRelationForm assetId={asset.id} assets={relatedAssetOptions} />
      </div>
    </div>
  );
}
