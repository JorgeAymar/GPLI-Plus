# Fidelidad visual real al diseño de Google Stitch — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar la brecha real (verificada contra el HTML/CSS que Stitch generó, no solo screenshots) entre la app en producción y el diseño de Stitch: tipografía, sidebar, header, tabla de datos, badges de estado, y tiles del dashboard.

**Architecture:** No se reemplaza el sistema de tokens existente (`--accent`, `rounded-md`, `black/10`/`white/10`, etc.) por los nombres de variable crudos que Stitch generó (`brand-accent`, `surface-container-lowest`, `text-headline-lg`...). Se usa el HTML de Stitch como referencia de estructura/jerarquía/espaciado, traducido a las clases y componentes ya reales de la app — exactamente la filosofía que el propio `DESIGN.md` de Stitch pide ("refinar lo real, no reinventar").

**Tech Stack:** Next.js 16 (App Router), Tailwind CSS v4 (`@theme inline` tokens en `globals.css`), componentes compartidos existentes (`DataTable`, `StatusBadge`, `StatTile`, `NavSidebar`).

---

## Contexto verificado (por qué se ve distinto a Stitch)

Investigado en vivo contra el código real y el HTML descargado del proyecto Stitch "GLPI-Plus — Refinamiento de Diseño" (no contra screenshots):

1. **Bug real de tipografía**: `apps/web/app/globals.css` tiene `body { font-family: Arial, Helvetica, sans-serif; }`, que pisa la fuente Geist Sans que YA está correctamente cargada vía `next/font/google` en `layout.tsx` y expuesta como token `--font-sans`. Este solo bug explica gran parte de la sensación de "esto no es un diseño cuidado" — toda la app renderiza en Arial, no en Geist.
2. **Sidebar**: falta el lockup de marca ("GLPI-Plus" + "IT Asset Management") que Stitch pone como lo primero del sidebar. Estructuralmente el resto (grupos colapsables PRINCIPAL/SISTEMA, iconos, chip de usuario al fondo) ya está bien resuelto desde el commit `b1eb167`.
3. **Header superior**: el mockup de Stitch tiene selector de entidad estilizado como pill con ícono, buscador global, campana de notificaciones, chip de perfil con ícono, y "Salir" en rojo con ícono de logout. La app real solo tiene texto plano + un `<select>` nativo + un link "Salir" sin estilo.
4. **`DataTable` compartido** (`apps/web/components/data-table.tsx`): el encabezado no es mayúscula/tracking como pide `DESIGN.md`, y las filas no tienen hover.
5. **`StatusBadge`** (`apps/web/components/status-badge.tsx`): no tiene variante "danger" (roja), y usa `rounded` (4px) en vez de `rounded-md` (6px) como el resto de la app.
6. **`StatTile`** (dashboard): el orden label/valor está invertido respecto al mockup (Stitch pone el número grande primero, la etiqueta mayúscula chica después) y falta el hover de borde con acento.

## Decisión que necesita tu confirmación, no la asumo

El mockup de Stitch anida "Dashboard" como sub-ítem dentro del grupo "Asistencia" (con ícono más chico e indentado). Pero el Dashboard real de esta app muestra métricas cruzadas de Tickets + SLA + Activos + Contratos — no es específico de Asistencia. Copiar esa anidación literal escondería el dashboard global dentro de un submenú de un solo módulo, lo cual sería peor navegación, no solo "menos parecido a Stitch".

**Recomendación**: dejar "Dashboard" como ítem de nivel superior (como está hoy) y aplicarle solo el pulido visual (tipografía, espaciado). Si preferís seguir el mockup literal igual, es el Task 2 el que cambia.

**Fuera de alcance, y por qué**: el mockup de Stitch incluye una barra de búsqueda global y una campana de notificaciones en el header. Ninguna de las dos tiene una función real detrás hoy (no hay búsqueda global ni centro de notificaciones in-app) — agregarlas solo como decoración sería UI falsa. Se dejan fuera de este plan; si las querés, son features nuevas, no un ajuste de diseño.

---

### Task 1: Fix del bug de tipografía (Arial pisando Geist Sans)

**Files:**
- Modify: `apps/web/app/globals.css:29`

- [ ] **Step 1: Corregir la declaración de fuente**

En `apps/web/app/globals.css`, la regla `body` actual es:

```css
body {
  background: var(--background);
  color: var(--foreground);
  font-family: Arial, Helvetica, sans-serif;
}
```

Reemplazar la línea `font-family` para que use el token ya definido en `@theme inline` (`--font-sans: var(--font-geist-sans)`), en vez de pisarlo:

```css
body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans), ui-sans-serif, system-ui, sans-serif;
}
```

- [ ] **Step 2: Verificar visualmente**

Con el dev server corriendo (`pnpm --filter @itsm/web dev`), abrir cualquier página y confirmar en DevTools → Computed → `font-family` que el `<body>` resuelve a la fuente Geist (variable `--font-geist-sans`), no a Arial.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "Fix body font-family override hiding the already-loaded Geist Sans font"
```

---

### Task 2: Lockup de marca en el Sidebar

**Files:**
- Modify: `apps/web/components/layout/nav-sidebar.tsx`

- [ ] **Step 1: Agregar el header de marca**

En `nav-sidebar.tsx`, dentro del `<div className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">` (línea 271), agregar ANTES del bloque `{aiAssistantEnabled ? (...)}` (línea 272):

```tsx
<div className="px-1 pb-4">
  <h1 className="text-lg leading-tight font-semibold">GLPI-Plus</h1>
  <p className="text-xs opacity-60">IT Asset Management</p>
</div>
```

- [ ] **Step 2: (según tu decisión arriba) — si preferís seguir el mockup literal y anidar Dashboard bajo Asistencia**

Solo si confirmás que querés la anidación literal: quitar `{ href: "/dashboard", labelKey: "dashboard" }` de `TOP_LEVEL` (línea 90) y agregarlo como primer ítem dentro de `items` de la categoría `asistencia` (línea 102), con una clase reducida para diferenciarlo visualmente del resto de los ítems del grupo (ícono más chico, texto más chico), igual que hace el mockup con `scale-75` y `text-xs`. **Recomendación: no hacer este paso** salvo que lo confirmes explícitamente — ver la sección de decisión arriba.

- [ ] **Step 3: Verificar con Playwright contra producción o dev**

Tomar un screenshot del sidebar y confirmar que el lockup "GLPI-Plus / IT Asset Management" aparece arriba de todo, antes de "Asistente IA"/"Dashboard".

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/layout/nav-sidebar.tsx
git commit -m "Add GLPI-Plus brand lockup to sidebar, matching the Stitch mockup"
```

---

### Task 3: Header superior — pulido visual (sin agregar features falsas)

**Files:**
- Modify: `apps/web/app/(central)/layout.tsx`
- Modify: `apps/web/components/layout/context-switcher.tsx`

- [ ] **Step 1: Estilizar el wrapper del `ContextSwitcher` como pill**

En `context-switcher.tsx`, el `<select>` ya es funcional (nativo, accesible) — no reescribirlo como dropdown custom. Solo envolverlo para que visualmente sea un pill con ícono, igual al mockup (`corporate_fare` + texto + `expand_more`), reemplazando la clase actual del `<select>`:

```tsx
return (
  <div className="flex items-center gap-1.5 rounded-md border border-black/15 bg-black/[0.02] px-2 py-1 dark:border-white/15 dark:bg-white/[0.02]">
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4 shrink-0 opacity-60">
      <rect x="4" y="3" width="12" height="14" rx="1" />
      <path d="M7 7h2M11 7h2M7 10h2M11 10h2M7 13h2M11 13h2" />
    </svg>
    <select
      aria-label="Entidad y perfil activos"
      defaultValue={currentValue}
      disabled={isPending}
      onChange={(e) => {
        const [entityId, profileId] = e.target.value.split("::") as [string, string];
        startTransition(() => {
          switchContext({ entityId, profileId });
        });
      }}
      className="border-none bg-transparent text-sm focus:ring-0"
    >
      {assignments.map((a) => (
        <option key={`${a.entityId}::${a.profileId}`} value={`${a.entityId}::${a.profileId}`}>
          {a.entityName} · {a.profileName}
        </option>
      ))}
    </select>
  </div>
);
```

(Nota: mover el `<div>` wrapper afuera del `return` actual, dejando el resto de la lógica de `useTransition`/`currentValue` sin cambios.)

- [ ] **Step 2: Restilizar "Salir" en rojo, con ícono**

En `apps/web/app/(central)/layout.tsx`, el botón actual (línea ~38-40):

```tsx
<button type="submit" className="text-sm opacity-70 hover:opacity-100">
  Salir
</button>
```

Reemplazar por:

```tsx
<button type="submit" className="flex items-center gap-1.5 text-sm text-red-700 hover:opacity-80 dark:text-red-400">
  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
    <path d="M8 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M13 14l4-4-4-4M17 10H8" />
  </svg>
  Salir
</button>
```

- [ ] **Step 3: Verificar**

Screenshot del header en `/dashboard`: el selector de entidad ahora debe verse como un pill con ícono, y "Salir" en rojo con ícono de logout.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(central\)/layout.tsx apps/web/components/layout/context-switcher.tsx
git commit -m "Restyle top header: entity switcher as icon pill, Salir in danger red"
```

---

### Task 4: `DataTable` — encabezados y hover según DESIGN.md

**Files:**
- Modify: `apps/web/components/data-table.tsx`

- [ ] **Step 1: Encabezados mayúscula/tracking, filas con hover**

Reemplazar el `<thead>` y la fila de `<tbody>`:

```tsx
<thead>
  <tr className="text-left">
    {columns.map((col) => (
      <th key={col.key} className="pb-2 text-[11px] font-bold tracking-wider text-black/60 uppercase dark:text-white/60">
        {col.label}
      </th>
    ))}
  </tr>
</thead>
<tbody>
  {rows.map((row) => (
    <tr
      key={rowKey(row)}
      className="border-t border-black/5 hover:bg-black/[0.02] dark:border-white/5 dark:hover:bg-white/[0.03]"
    >
```

(el resto del componente queda igual)

- [ ] **Step 2: Verificar**

Este componente es compartido — abrir cualquier página que lo use (p. ej. `/tools/rss-feeds`) y confirmar que los encabezados se ven en mayúscula chica y las filas responden al hover.

- [ ] **Step 3: Correr tests**

```bash
pnpm --filter @itsm/web test -- --run
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/data-table.tsx
git commit -m "Style DataTable headers as uppercase/tracked, add row hover per DESIGN.md"
```

---

### Task 5: `StatusBadge` — variante danger + radio consistente

**Files:**
- Modify: `apps/web/components/status-badge.tsx`

- [ ] **Step 1: Agregar variante "danger" y corregir el radio**

```tsx
type StatusVariant = "neutral" | "warning" | "success" | "danger";

const VARIANT_CLASSES: Record<StatusVariant, string> = {
  neutral: "bg-black/10 text-black/70 dark:bg-white/15 dark:text-white/70",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  success: "bg-green-500/10 text-green-700 dark:text-green-400",
  danger: "bg-red-500/10 text-red-700 dark:text-red-400",
};
```

Y en `StatusBadge`, cambiar `rounded` por `rounded-md` (línea 45) para que coincida con el radio de 6px del resto de la app.

- [ ] **Step 2: Revisar si algún status debería usar "danger"**

Los únicos usos actuales de `STATUS_VARIANTS` son ITIL (`new/assigned/planned/pending/solved/closed`) — ninguno mapea naturalmente a "danger" hoy (no hay un estado tipo "cancelado"/"rechazado" en ese enum). No cambiar `STATUS_VARIANTS` en este task; la variante queda disponible para el siguiente lugar que la necesite (tokens de API revocados, etc. — ya usan su propio badge inline en `account/page.tsx`, fuera de alcance de este archivo).

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/status-badge.tsx
git commit -m "Add danger variant to StatusBadge, fix radius to match app-wide rounded-md"
```

---

### Task 6: `StatTile` del Dashboard — orden y hover del mockup

**Files:**
- Modify: `apps/web/components/stat-tile.tsx`

- [ ] **Step 1: Invertir orden label/valor y agregar hover de borde**

```tsx
export function StatTile({
  label,
  value,
  href,
  cta,
  variant = "neutral",
}: {
  label: string;
  value: ReactNode;
  href: string;
  cta: string;
  variant?: StatTileVariant;
}) {
  return (
    <div className={`group rounded-md border p-4 transition-colors hover:border-accent ${VARIANT_CLASSES[variant]}`}>
      <p className={`text-3xl leading-none font-semibold ${VALUE_CLASSES[variant]}`}>{value}</p>
      <h2 className="mt-1 text-[11px] font-bold tracking-wider opacity-60 uppercase">{label}</h2>
      <Link href={href} className="mt-3 inline-block rounded-md bg-accent px-3 py-2 text-sm text-white hover:bg-accent-hover">
        {cta}
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Verificar**

Screenshot de `/dashboard`: el número grande debe ir primero, la etiqueta en mayúscula chica debajo, y el borde de la tile debe resaltar en el color de acento al pasar el mouse.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/stat-tile.tsx
git commit -m "Reorder StatTile to lead with the number, add accent border on hover"
```

---

### Task 7: QA visual final contra los mockups reales de Stitch

**Files:**
- Create (temporal, no se commitea): script de Playwright en el scratchpad

- [ ] **Step 1: Screenshot comparativo**

Levantar el dev server, loguearse, y capturar `/dashboard` y una página que use `DataTable` (p. ej. `/tools/rss-feeds`) a 1440px de ancho. Comparar lado a lado contra los PNG ya descargados de Stitch (`stitch-dashboard.png` y el resto de los screens del proyecto `11132809398172392999`).

- [ ] **Step 2: Listar cualquier brecha restante sin arreglarla a ciegas**

Si aparece algo más (p. ej. algún color puntual, algún ícono), anotarlo como punto pendiente explícito en vez de asumir que ya quedó perfecto — no hay presupuesto en este plan para una pasada infinita de ajustes de 1px.

- [ ] **Step 3: Correr la suite completa antes de dar por cerrado**

```bash
pnpm --filter @itsm/web typecheck && pnpm --filter @itsm/web lint && pnpm --filter @itsm/web test -- --run && pnpm e2e
```

---

## Nota sobre alcance

Este plan cubre lo que pude verificar concretamente contra el HTML/CSS real de Stitch y el código real de la app: tipografía, sidebar, header, `DataTable`, `StatusBadge`, `StatTile`. El `DESIGN.md` de Stitch también pide diferenciar el peso visual entre panel de lista y panel de formulario, y una vista de detalle con secciones colapsables (actores/timeline/costos/adjuntos) — no alcancé a auditar esos dos contra el código real de las páginas de detalle (haría falta revisar cada página de detalle una por una, son ~15+ tipos de registro). Si querés, ese es un Task 8 para un plan separado, con un agente dedicado a auditar página por página en vez de asumir.
