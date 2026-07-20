import { requireAuthContext } from "@/lib/session";
import { listRulesByEntity } from "@itsm/core";
import Link from "next/link";
import { RuleForm } from "./rule-form";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reglas" };

export default async function RulesPage() {
  const context = await requireAuthContext();
  const rules = await listRulesByEntity(context.activeEntity.id);

  const byType = new Map<string, typeof rules>();
  for (const rule of rules) {
    const list = byType.get(rule.ruleType) ?? [];
    list.push(rule);
    byType.set(rule.ruleType, list);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reglas</h1>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="space-y-4">
          {[...byType.entries()].map(([ruleType, list]) => (
            <div key={ruleType}>
              <h2 className="mb-2 text-sm font-semibold">{ruleType}</h2>
              <ul className="space-y-1">
                {list.map((r) => (
                  <li key={r.id} className="text-sm">
                    <Link href={`/setup/rules/${r.id}`} className="hover:underline">
                      {r.name}
                    </Link>
                    <span className="ml-2 text-xs opacity-40">
                      (ranking {r.ranking}, {r.matchType === "all" ? "AND" : "OR"}
                      {r.isActive ? "" : ", inactiva"})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {rules.length === 0 ? <p className="text-sm opacity-50">Sin reglas todavía.</p> : null}
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-60">Nueva regla</h2>
          <RuleForm entityId={context.activeEntity.id} />
        </div>
      </div>
    </div>
  );
}
