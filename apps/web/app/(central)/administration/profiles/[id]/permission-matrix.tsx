"use client";

import { setModuleRightAction } from "@/actions/profiles.actions";
import { useMemo, useState } from "react";

const RIGHT_LABELS: Record<string, string> = {
  READ: "Leer",
  CREATE: "Crear",
  UPDATE: "Actualizar",
  DELETE: "Borrar",
  PURGE: "Purgar",
  APPROVE: "Aprobar",
  ASSIGN: "Asignar",
};

interface Props {
  profileId: string;
  moduleKeys: string[];
  rightBits: Record<string, number>;
  initialRights: Record<string, number>;
}

export function PermissionMatrix({ profileId, moduleKeys, rightBits, initialRights }: Props) {
  const [rights, setRights] = useState<Record<string, number>>(initialRights);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(() => {
    const byPrefix = new Map<string, string[]>();
    for (const key of moduleKeys) {
      const prefix = key.split(".")[0] ?? key;
      const list = byPrefix.get(prefix) ?? [];
      list.push(key);
      byPrefix.set(prefix, list);
    }
    return [...byPrefix.entries()];
  }, [moduleKeys]);

  const rightEntries = Object.entries(rightBits);

  async function toggle(moduleKey: string, bit: number) {
    const current = rights[moduleKey] ?? 0;
    const next = (current & bit) === bit ? current & ~bit : current | bit;
    setRights((prev) => ({ ...prev, [moduleKey]: next }));
    setPendingKey(`${moduleKey}:${bit}`);
    setError(null);
    try {
      await setModuleRightAction(profileId, moduleKey, next);
    } catch (err) {
      setRights((prev) => ({ ...prev, [moduleKey]: current }));
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <div className="space-y-6">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {groups.map(([prefix, keys]) => (
        <div key={prefix}>
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide opacity-50">{prefix}</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left opacity-60">
                <th className="pb-2 pr-4">Módulo</th>
                {rightEntries.map(([name]) => (
                  <th key={name} className="pb-2 text-center">
                    {RIGHT_LABELS[name] ?? name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {keys.map((moduleKey) => (
                <tr key={moduleKey} className="border-t border-black/5 dark:border-white/5">
                  <td className="py-1.5 pr-4 font-mono text-xs opacity-80">{moduleKey}</td>
                  {rightEntries.map(([name, bit]) => {
                    const checked = ((rights[moduleKey] ?? 0) & bit) === bit;
                    const isPending = pendingKey === `${moduleKey}:${bit}`;
                    return (
                      <td key={name} className="py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isPending}
                          onChange={() => toggle(moduleKey, bit)}
                          className="h-4 w-4 disabled:opacity-50"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
