import { getRule, listRuleActions, listRuleCriteria } from "@itsm/core";
import { notFound } from "next/navigation";
import { ActionForm } from "./action-form";
import { CriteriaForm } from "./criteria-form";

const OPERATOR_LABEL: Record<string, string> = {
  is: "es igual a",
  contains: "contiene",
  regex_match: "coincide con regex",
  less_than: "menor que",
  greater_than: "mayor que",
  date_before: "fecha antes de",
  date_after: "fecha después de",
};

const ACTION_LABEL: Record<string, string> = {
  assign: "Asignar",
  append: "Agregar al final",
  regex_result: "Resultado de regex",
  stop_processing: "Detener procesamiento",
};

export default async function RuleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const rule = await getRule(id);
  if (!rule) notFound();

  const [criteria, actions] = await Promise.all([listRuleCriteria(id), listRuleActions(id)]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{rule.name}</h1>
        <p className="text-sm opacity-60">
          {rule.ruleType} · ranking {rule.ranking} · {rule.matchType === "all" ? "todas (AND)" : "cualquiera (OR)"}
          {rule.isActive ? "" : " · inactiva"}
          {rule.stopOnMatch ? " · detiene evaluación si matchea" : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Criterios</h2>
          <ul className="mb-4 space-y-1">
            {criteria.map((c) => (
              <li key={c.id} className="text-sm">
                {c.field} {OPERATOR_LABEL[c.operator] ?? c.operator} <span className="opacity-70">&quot;{c.value}&quot;</span>
              </li>
            ))}
            {criteria.length === 0 ? <li className="text-sm opacity-50">Sin criterios todavía.</li> : null}
          </ul>
          <CriteriaForm ruleId={id} />
        </div>
        <div>
          <h2 className="mb-2 text-sm font-medium opacity-70">Acciones</h2>
          <ul className="mb-4 space-y-1">
            {actions.map((a) => (
              <li key={a.id} className="text-sm">
                {ACTION_LABEL[a.actionType] ?? a.actionType} {a.field} <span className="opacity-70">&quot;{a.value}&quot;</span>
              </li>
            ))}
            {actions.length === 0 ? <li className="text-sm opacity-50">Sin acciones todavía.</li> : null}
          </ul>
          <ActionForm ruleId={id} />
        </div>
      </div>
    </div>
  );
}
