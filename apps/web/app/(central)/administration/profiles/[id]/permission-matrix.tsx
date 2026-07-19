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

/** Readable label for each dotted module-key prefix (the group a module belongs to). */
const GROUP_LABELS: Record<string, string> = {
  administration: "Administración",
  setup: "Configuración",
  assets: "Activos",
  assistance: "Asistencia",
  management: "Gestión",
  tools: "Herramientas",
  advanced: "Avanzado",
};

/** Readable label for each dotted MODULE key from @itsm/core - keep in sync with packages/core/src/auth/modules.ts. */
const MODULE_LABELS: Record<string, string> = {
  "administration.entity": "Entidades",
  "administration.user": "Usuarios",
  "administration.profile": "Perfiles",
  "administration.auth_source": "Fuentes de autenticación (LDAP/OIDC)",
  "administration.group": "Grupos",
  "administration.audit_log": "Registro de auditoría",

  "setup.asset_definition": "Tipos de activo",
  "setup.dropdown": "Listas desplegables",
  "setup.sla_policy": "Políticas SLA",
  "setup.notification_template": "Plantillas de notificación",
  "setup.rule": "Reglas",
  "setup.ticket_field": "Campos de ticket",
  "setup.cron": "Trabajos programados",

  "assets.computer": "Computadoras",
  "assets.network_equipment": "Equipos de red",
  "assets.monitor": "Monitores",
  "assets.printer": "Impresoras",
  "assets.phone": "Teléfonos",
  "assets.peripheral": "Periféricos",
  "assets.generic": "Activos genéricos (personalizados)",
  "assets.software": "Software",
  "assets.software_license": "Licencias de software",
  "assets.unmanaged": "Dispositivos no gestionados",

  "assistance.ticket": "Tickets",
  "assistance.problem": "Problemas",
  "assistance.change": "Cambios",
  "assistance.service_catalog": "Catálogo de servicios",

  "management.supplier": "Proveedores",
  "management.contact": "Contactos",
  "management.contract": "Contratos",
  "management.budget": "Presupuestos",
  "management.certificate": "Certificados",
  "management.datacenter": "Centros de datos",
  "management.domain": "Dominios",
  "management.line": "Líneas telefónicas",
  "management.database": "Bases de datos",
  "management.consumable": "Consumibles",

  "tools.knowledge_base": "Base de conocimiento",
  "tools.reservation": "Reservas",
  "tools.project": "Proyectos",
  "tools.report": "Reportes",
  "tools.saved_search": "Búsquedas guardadas",
  "tools.rss_feed": "Feeds RSS",
  "tools.dashboard": "Dashboards",
  "tools.reminder": "Recordatorios",
  "tools.planning": "Planificación",

  "advanced.inventory": "Inventario (agentes)",
  "advanced.dcim": "DCIM",
  "advanced.impact": "Análisis de impacto",
  "advanced.api": "Clientes API",
  "advanced.webhook": "Webhooks",
};

/** Human-readable label for a module key - falls back to the raw dotted key for any module not yet mapped above. */
function moduleLabel(moduleKey: string): string {
  const prefix = moduleKey.split(".")[0] ?? moduleKey;
  const group = GROUP_LABELS[prefix];
  const item = MODULE_LABELS[moduleKey];
  if (group && item) return `${group} - ${item}`;
  return moduleKey;
}

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
                    const rightLabel = RIGHT_LABELS[name] ?? name;
                    return (
                      <td key={name} className="py-1.5 text-center">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isPending}
                          onChange={() => toggle(moduleKey, bit)}
                          aria-label={`${moduleLabel(moduleKey)}: permiso ${rightLabel}`}
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
