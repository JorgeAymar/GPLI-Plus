import type { Entity } from "@itsm/db";

function buildChildIndex(entities: Entity[]): Map<string | null, Entity[]> {
  const byParent = new Map<string | null, Entity[]>();
  for (const e of entities) {
    const key = e.parentId ?? null;
    const bucket = byParent.get(key) ?? [];
    bucket.push(e);
    byParent.set(key, bucket);
  }
  return byParent;
}

function EntityNode({
  entity,
  byParent,
}: {
  entity: Entity;
  byParent: Map<string | null, Entity[]>;
}) {
  const children = byParent.get(entity.id) ?? [];
  return (
    <div>
      <div className="rounded px-2 py-1.5 hover:bg-black/5 dark:hover:bg-white/5">
        <div className="text-sm font-medium">{entity.name}</div>
        <div className="font-mono text-xs opacity-40">{entity.path}</div>
      </div>
      {children.length > 0 ? (
        <div className="ml-3 border-l border-black/10 pl-3 dark:border-white/10">
          {children.map((c) => (
            <EntityNode key={c.id} entity={c} byParent={byParent} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function EntityTree({ entities }: { entities: Entity[] }) {
  const byParent = buildChildIndex(entities);
  const roots = byParent.get(null) ?? [];

  if (roots.length === 0) {
    return <p className="text-sm opacity-50">Sin entidades todavía.</p>;
  }

  return (
    <div>
      {roots.map((r) => (
        <EntityNode key={r.id} entity={r} byParent={byParent} />
      ))}
    </div>
  );
}
