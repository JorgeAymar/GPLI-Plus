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
  depth,
}: {
  entity: Entity;
  byParent: Map<string | null, Entity[]>;
  depth: number;
}) {
  const children = byParent.get(entity.id) ?? [];
  return (
    <div>
      <div
        style={{ paddingLeft: `${depth * 1.25}rem` }}
        className="rounded px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/5"
      >
        {entity.name} <span className="opacity-40">({entity.path})</span>
      </div>
      {children.map((c) => (
        <EntityNode key={c.id} entity={c} byParent={byParent} depth={depth + 1} />
      ))}
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
        <EntityNode key={r.id} entity={r} byParent={byParent} depth={0} />
      ))}
    </div>
  );
}
