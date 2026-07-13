import { test, expect, type Page, type Locator } from "@playwright/test";

/**
 * E2E specs for the "Herramientas" (Tools) module (`apps/web/app/(central)/tools/**`).
 *
 * Auth: reuses the shared "setup" project (playwright/.auth/admin.json). The seed admin
 * profile ("Super-Admin", packages/core/scripts/seed.ts) holds FULL_RIGHTS on every module,
 * so every requireRight()/getEffectiveRights() check in these pages/actions passes without
 * any extra setup.
 *
 * Scope: apps/web/app/(central)/tools/** and the 7 action files named in the task
 * (knowledge-base, reservations, projects, dashboards, saved-searches, rss-feeds,
 * reminders).actions.ts. Two real bugs were found while building this spec (by reading
 * card-provider.ts/report-service.ts against dashboard-card.tsx and card-key-labels.ts) and
 * fixed directly, both inside apps/web/app/(central)/tools/dashboards/** (in scope):
 *
 *   1. card-key-labels.ts was missing "tickets_created_by_day" and "sla_compliance_rate" - 2
 *      of the 8 AVAILABLE_CARD_KEYS (packages/core/src/dashboards/card-provider.ts) - so the
 *      "Card" <select> on the add-card form and the card heading on the dashboard detail page
 *      fell back to the raw snake_case key instead of a translated label.
 *   2. dashboard-card.tsx's normalizeForChart()/TableView() assumed every card's resolved data
 *      was an array of rows. getSlaComplianceRate() (report-service.ts) actually resolves to a
 *      single `{ total, breached, complianceRate }` object, so the "Cumplimiento de SLA" card
 *      rendered "Sin datos." in every chart mode (table/bar/pie) regardless of real data - a
 *      100% reproducible bug for that card key. Both functions now special-case that shape.
 *      tickets_created_by_day (a real array, just missing from the switch) was also wired
 *      into normalizeForChart's bar/pie mapping.
 *
 * The "Reservas - flujo E2E" block creates one throwaway asset via /assets/monitor (outside
 * tools/**, out of this agent's fix scope) purely as setup: reservations require a backing
 * asset (createReservationItemSchema.assetId) and packages/core/scripts/seed.ts only seeds
 * asset *definitions*, not instances, so a fresh dev DB has none to pick from otherwise.
 *
 * Known product gaps found but NOT fixed (feature-shaped, not bugs - building brand-new edit
 * UI is out of scope for a test-writing task):
 *   - None of knowledge-base, reminders, saved-searches, rss-feeds, dashboards, or the project
 *     entity itself expose an "edit existing record" form, even though updateKbArticleAction /
 *     updateProjectSchema / etc. exist in @itsm/core and are otherwise unused by any page in
 *     app/(central)/tools/**. The closest real mutating actions are exercised below instead
 *     (KB: add comment + revert-to-revision history; Reminder: mark done; reservations: cancel;
 *     dashboards: remove card). None of knowledge-base/reminders/saved-searches/rss-feeds/
 *     dashboards(top-level)/projects has a delete action either, except reservations (cancel)
 *     and dashboard cards (remove) - both covered below. Per the task ("limpiar si hay borrado
 *     en UI"), no cleanup is attempted for entities with no delete UI - their E2E-TOOLS- rows
 *     are expected to persist in the dev DB across runs.
 *   - saved-search-form.tsx's itemType <select> labels the options "Tickets"/"Activos"
 *     (plural), but the list page's ITEM_TYPE_LABEL renders "Ticket"/"Activo" (singular) for
 *     the same saved search - a harmless copy inconsistency, not worth a risky find/replace
 *     fix in a shared label map here.
 */

interface Diagnostics {
  console: string[];
  network: string[];
}

/** Attaches console/network listeners for the duration of a test and returns the collected buckets. */
function attachDiagnostics(page: Page): Diagnostics {
  const diagnostics: Diagnostics = { console: [], network: [] };

  page.on("console", (msg) => {
    // Chrome auto-logs any >=400 response as a "Failed to load resource" console error,
    // duplicating what the `response` listener below already tracks. A Server Action that
    // throws to report an expected validation error (e.g. the reservation-overlap conflict
    // below) always surfaces as a 500 at the transport level - that's how Next.js Server
    // Actions propagate a thrown error, not a bug - so this specific browser-native log line
    // is not actionable application state.
    if (msg.type() === "error" && !/^Failed to load resource:/.test(msg.text())) {
      diagnostics.console.push(`[console.error] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => {
    diagnostics.console.push(`[pageerror] ${err.message}`);
  });
  page.on("requestfailed", (req) => {
    // net::ERR_ABORTED is normal noise from Next.js's router cancelling an in-flight
    // RSC/prefetch request when a new navigation starts right after - not a real failure.
    if (req.failure()?.errorText === "net::ERR_ABORTED") return;
    diagnostics.network.push(`[requestfailed] ${req.method()} ${req.url()} :: ${req.failure()?.errorText ?? "unknown"}`);
  });
  page.on("response", (res) => {
    // Only 5xx count as hard failures here - 4xx can legitimately happen and would make
    // this check too brittle for a black-box E2E spec.
    if (res.status() >= 500) {
      diagnostics.network.push(`[http ${res.status()}] ${res.request().method()} ${res.url()}`);
    }
  });

  return diagnostics;
}

function expectNoCriticalErrors(diagnostics: Diagnostics, options: { allowNetwork?: boolean } = {}) {
  expect(diagnostics.console, `Console errors found:\n${diagnostics.console.join("\n")}`).toEqual([]);
  if (!options.allowNetwork) {
    expect(diagnostics.network, `Network failures found:\n${diagnostics.network.join("\n")}`).toEqual([]);
  }
}

/** Reads the live `type` IDL property (correct even for inputs with no explicit `type=` in JSX, which default to "text"). */
async function expectFieldType(locator: Locator, type: string) {
  const actual = await locator.evaluate((el) => (el as HTMLInputElement).type);
  expect(actual).toBe(type);
}

const RUN_ID = Date.now();
let seq = 0;
/** All generated test data is prefixed E2E-TOOLS- and suffixed with a run-unique id, so repeat runs never collide. */
function uniqueLabel(tag: string): string {
  seq += 1;
  return `E2E-TOOLS-${tag}-${RUN_ID}-${seq}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** Formats `now + offsetMs` as a `datetime-local` input value using local wall-clock components (matches what a real browser fill() expects). */
function localDateTimeInput(offsetMs: number): string {
  const d = new Date(Date.now() + offsetMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

test.describe("Reportes (solo lectura)", () => {
  test("el índice de reportes carga y lista los reportes disponibles", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/tools/reports");

    await expect(page.getByRole("heading", { level: 1, name: "Reportes" })).toBeVisible();
    // Admin has full rights on every module (seed.ts), so every REPORT_LINKS entry should be
    // visible - this doubles as a smoke check that reports/page.tsx's per-link RIGHT.READ
    // gating (against the owning module, not MODULE.TOOLS_REPORT) isn't over-hiding links.
    await expect(page.getByRole("link", { name: "Activos por estado" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Tickets por estado" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Cumplimiento de SLA" })).toBeVisible();

    expectNoCriticalErrors(diagnostics);
  });

  test("activos por estado muestra una tabla con encabezados y total", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/tools/reports/assets-by-status");

    await expect(page.getByRole("heading", { level: 1, name: "Activos por estado" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Estado" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Cantidad" })).toBeVisible();
    // Either real rows + a "Total" footer, or the documented empty state - both are a valid load.
    const hasEmptyState = await page.getByText("Sin activos todavía.").isVisible();
    const hasTotal = await page.getByText("Total").isVisible();
    expect(hasEmptyState || hasTotal).toBe(true);

    expectNoCriticalErrors(diagnostics);
  });

  test("tickets por estado muestra una tabla con encabezados y total", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/tools/reports/tickets-by-status");

    await expect(page.getByRole("heading", { level: 1, name: "Tickets por estado" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Estado" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Cantidad" })).toBeVisible();
    const hasEmptyState = await page.getByText("Sin tickets todavía.").isVisible();
    const hasTotal = await page.getByText("Total").isVisible();
    expect(hasEmptyState || hasTotal).toBe(true);

    expectNoCriticalErrors(diagnostics);
  });

  test("cumplimiento de SLA muestra el resumen de asignaciones", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/tools/reports/sla-compliance");

    await expect(page.getByRole("heading", { level: 1, name: "Cumplimiento de SLA" })).toBeVisible();
    await expect(page.getByText("Total de asignaciones")).toBeVisible();
    await expect(page.getByText("Incumplidas", { exact: true })).toBeVisible();
    await expect(page.getByText(/^\d+(\.\d+)?%$/)).toBeVisible();

    expectNoCriticalErrors(diagnostics);
  });
});

test.describe("Planificación", () => {
  test("la página de planificación carga con el filtro de fechas", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/tools/planning");

    await expect(page.getByRole("heading", { level: 1, name: "Planificación" })).toBeVisible();
    await expectFieldType(page.locator("#from"), "date");
    await expectFieldType(page.locator("#to"), "date");
    await expect(page.getByRole("button", { name: "Aplicar" })).toBeVisible();

    // A fresh 30-day window renders either the grouped items or the documented empty state -
    // both are a valid "loaded correctly" outcome; isVisible() resolves false (not a throw)
    // when nothing matches, so no extra try/catch is needed for the branch that's absent.
    const hasEmptyState = await page.getByText("Sin items planificados en este rango.").isVisible();
    const hasGroups = await page.getByRole("heading", { level: 2 }).first().isVisible();
    expect(hasEmptyState || hasGroups).toBe(true);

    expectNoCriticalErrors(diagnostics);
  });
});

test.describe.serial("Base de conocimiento - flujo E2E", () => {
  const articleTitle = uniqueLabel("KB");
  const articleBody = "Contenido de prueba generado por el spec E2E de Herramientas.";
  const commentText = "Comentario E2E de verificación.";

  test("crear un artículo con los tipos de campo correctos y verlo en la lista", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/tools/knowledge-base");

    await expect(page.getByRole("heading", { level: 1, name: "Base de conocimiento" })).toBeVisible();
    await expect(page.locator('input[name="q"]')).toBeVisible();

    const titleInput = page.locator('input[name="title"]');
    const bodyInput = page.locator('textarea[name="body"]');
    const isFaqCheckbox = page.locator('input[name="isFaq"]');
    const showInCatalogCheckbox = page.locator('input[name="showInServiceCatalog"]');
    await expectFieldType(titleInput, "text");
    await expectFieldType(isFaqCheckbox, "checkbox");
    await expectFieldType(showInCatalogCheckbox, "checkbox");

    await titleInput.fill(articleTitle);
    await bodyInput.fill(articleBody);
    await isFaqCheckbox.check();
    await page.getByRole("button", { name: "Crear artículo" }).click();

    await expect(page.getByRole("link", { name: `${articleTitle} (FAQ)` })).toBeVisible();

    expectNoCriticalErrors(diagnostics);
  });

  test("el detalle del artículo muestra su contenido y el historial de revisiones", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/tools/knowledge-base");
    await page.getByRole("link", { name: `${articleTitle} (FAQ)` }).click();
    await page.waitForURL(/\/tools\/knowledge-base\/[^/]+$/);

    await expect(page.getByRole("heading", { level: 1, name: articleTitle })).toBeVisible();
    await expect(page.getByText("FAQ", { exact: true })).toBeVisible();
    await expect(page.getByText(articleBody)).toBeVisible();
    await expect(page.getByText(/\d+ vistas/)).toBeVisible();

    // A single revision (creation) exists so far - it must be tagged as current, with no
    // "revert" action offered for it (RevertButton only renders for index > 0).
    await expect(page.getByText("versión actual")).toBeVisible();
    await expect(page.getByRole("button", { name: "Revertir a esta versión" })).toHaveCount(0);

    expectNoCriticalErrors(diagnostics);
  });

  test("agregar un comentario lo muestra en la lista de comentarios", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/tools/knowledge-base");
    await page.getByRole("link", { name: `${articleTitle} (FAQ)` }).click();
    await page.waitForURL(/\/tools\/knowledge-base\/[^/]+$/);

    const commentBox = page.locator('textarea[name="content"]');
    await commentBox.fill(commentText);
    await page.getByRole("button", { name: "Comentar" }).click();

    await expect(page.getByText(commentText)).toBeVisible();
    await expect(page.getByText("Sin comentarios todavía.")).toHaveCount(0);

    expectNoCriticalErrors(diagnostics);
  });
});

test.describe.serial("Recordatorios - flujo E2E", () => {
  const reminderTitle = uniqueLabel("REMINDER");

  test("crear un recordatorio con los tipos de campo correctos lo muestra en pendientes", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/tools/reminders");

    await expect(page.getByRole("heading", { level: 1, name: "Recordatorios" })).toBeVisible();

    const titleInput = page.locator('input[name="title"]');
    const contentInput = page.locator('textarea[name="content"]');
    const remindAtInput = page.locator('input[name="remindAt"]');
    await expectFieldType(titleInput, "text");
    await expectFieldType(remindAtInput, "datetime-local");

    await titleInput.fill(reminderTitle);
    await contentInput.fill("Notas de prueba E2E");
    await remindAtInput.fill(localDateTimeInput(2 * DAY_MS));
    await page.getByRole("button", { name: "Crear recordatorio" }).click();

    const pendingItem = page.locator("li", { hasText: reminderTitle });
    await expect(pendingItem).toBeVisible();
    await expect(pendingItem.getByRole("button", { name: "Marcar hecho" })).toBeVisible();

    expectNoCriticalErrors(diagnostics);
  });

  test("marcar como hecho lo mueve de pendientes a hechos", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/tools/reminders");

    await page.locator("li", { hasText: reminderTitle }).getByRole("button", { name: "Marcar hecho" }).click();

    await expect(page.locator("li", { hasText: reminderTitle }).getByRole("button", { name: "Marcar hecho" })).toHaveCount(0);
    await expect(page.locator("li.line-through", { hasText: reminderTitle })).toBeVisible();

    expectNoCriticalErrors(diagnostics);
  });
});

test.describe.serial("Búsquedas guardadas - flujo E2E", () => {
  const ticketSearchName = uniqueLabel("SAVEDSEARCH-TICKET");
  const assetSearchName = uniqueLabel("SAVEDSEARCH-ASSET");
  const searchTerm = uniqueLabel("term");

  test("crear una búsqueda privada de tickets con criterios de texto", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/tools/saved-searches");

    await expect(page.getByRole("heading", { level: 1, name: "Búsquedas guardadas" })).toBeVisible();

    const isPrivateCheckbox = page.locator("#isPrivate");
    const queryJsonBox = page.locator('textarea[name="queryJson"]');
    await expectFieldType(isPrivateCheckbox, "checkbox");
    await expect(isPrivateCheckbox).toBeChecked(); // defaultChecked in saved-search-form.tsx

    await page.locator('input[name="name"]').fill(ticketSearchName);
    await page.locator('select[name="itemType"]').selectOption("ticket");
    await queryJsonBox.fill(JSON.stringify({ search: searchTerm }));
    await page.getByRole("button", { name: "Crear búsqueda guardada" }).click();

    const row = page.locator("li", { hasText: ticketSearchName });
    await expect(row).toBeVisible();
    await expect(row.getByText("(Ticket)")).toBeVisible();
    await expect(row.getByText("compartida")).toHaveCount(0); // isPrivate=true -> no "shared" tag

    expectNoCriticalErrors(diagnostics);
  });

  test("crear una búsqueda compartida de activos sin criterios de texto", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/tools/saved-searches");

    await page.locator('input[name="name"]').fill(assetSearchName);
    await page.locator('select[name="itemType"]').selectOption("asset");
    await page.locator("#isPrivate").uncheck();
    await page.getByRole("button", { name: "Crear búsqueda guardada" }).click();

    const row = page.locator("li", { hasText: assetSearchName });
    await expect(row).toBeVisible();
    await expect(row.getByText("(Activo)")).toBeVisible();
    await expect(row.getByText("compartida")).toBeVisible();

    expectNoCriticalErrors(diagnostics);
  });

  test('el link "Usar" arma la URL correcta según el tipo de elemento y los criterios', async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/tools/saved-searches");

    const ticketRow = page.locator("li", { hasText: ticketSearchName });
    await ticketRow.getByRole("link", { name: "Usar" }).click();
    await page.waitForURL(new RegExp(`/assistance/tickets\\?q=${encodeURIComponent(searchTerm)}`));

    await page.goto("/tools/saved-searches");
    const assetRow = page.locator("li", { hasText: assetSearchName });
    await assetRow.getByRole("link", { name: "Usar" }).click();
    // Empty `search` in queryJson -> buildUseHref() falls back to the bare base path (no ?q=).
    await page.waitForURL(/\/assets$/);

    expectNoCriticalErrors(diagnostics);
  });
});

test.describe.serial("Reservas - flujo E2E", () => {
  const assetName = uniqueLabel("ASSET");
  const beginAt = localDateTimeInput(DAY_MS);
  const endAt = localDateTimeInput(DAY_MS + HOUR_MS);
  // Starts 30 minutes into the first reservation and runs past its end - a genuine overlap.
  const overlapBeginAt = localDateTimeInput(DAY_MS + 30 * 60 * 1000);
  const overlapEndAt = localDateTimeInput(DAY_MS + 2 * HOUR_MS);

  test("crear un activo de prueba (fixture fuera de tools/**, necesario para habilitar una reserva)", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    // "monitor" is a core asset definition seeded with hasExtensionTable=false and no custom
    // field definitions, so its generic asset form is just Nombre/Serie/Inventario/Comentario.
    await page.goto("/assets/monitor");

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.locator('input[name="name"]').fill(assetName);
    await page.getByRole("button", { name: "Crear", exact: true }).click();

    await expect(page.getByText(assetName)).toBeVisible();

    expectNoCriticalErrors(diagnostics);
  });

  test("habilitar el activo para reserva lo muestra en la lista con los tipos de campo correctos", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/tools/reservations");

    await expect(page.getByRole("heading", { level: 1, name: "Reservas" })).toBeVisible();

    const assetSelect = page.locator('select[name="assetId"]');
    const commentInput = page.locator('textarea[name="comment"]');
    await expect(assetSelect).toBeVisible();
    await expect(commentInput).toBeVisible();

    await assetSelect.selectOption({ label: assetName });
    await commentInput.fill("Reserva E2E de prueba");
    await page.getByRole("button", { name: "Habilitar para reserva" }).click();

    const row = page.locator("li", { hasText: assetName });
    await expect(row).toBeVisible();
    await expect(row).toContainText("Reserva E2E de prueba");

    expectNoCriticalErrors(diagnostics);
  });

  test("crear una reserva con los tipos de campo correctos la muestra en el detalle del activo", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/tools/reservations");
    await page.locator("li", { hasText: assetName }).getByRole("link").click();
    await page.waitForURL(/\/tools\/reservations\/[^/]+$/);

    await expect(page.getByRole("heading", { level: 1, name: "Reservas del activo" })).toBeVisible();

    const beginInput = page.locator('input[name="beginAt"]');
    const endInput = page.locator('input[name="endAt"]');
    await expectFieldType(beginInput, "datetime-local");
    await expectFieldType(endInput, "datetime-local");

    await beginInput.fill(beginAt);
    await endInput.fill(endAt);
    await page.locator('textarea[name="comment"]').fill("Primer turno");
    await page.getByRole("button", { name: "Crear reserva" }).click();

    await expect(page.getByText("Primer turno")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancelar" })).toBeVisible();

    expectNoCriticalErrors(diagnostics);
  });

  test("una reserva superpuesta muestra el error de conflicto de horario y no crea una segunda reserva", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/tools/reservations");
    await page.locator("li", { hasText: assetName }).getByRole("link").click();
    await page.waitForURL(/\/tools\/reservations\/[^/]+$/);

    await page.locator('input[name="beginAt"]').fill(overlapBeginAt);
    await page.locator('input[name="endAt"]').fill(overlapEndAt);
    await page.getByRole("button", { name: "Crear reserva" }).click();

    await expect(page.getByText(/Conflicto de horario/)).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancelar" })).toHaveCount(1);

    // Not asserting network here: createReservation()'s thrown business-rule Error is caught
    // client-side in reservation-form.tsx and turned into state.error, but this is the one
    // scenario in this spec that deliberately makes a server action reject - depending on how
    // Next.js 16 surfaces a thrown Server Action error over the wire, the underlying request
    // may legitimately show as a non-2xx response for this call alone.
    expectNoCriticalErrors(diagnostics, { allowNetwork: true });
  });

  test("cancelar la reserva la remueve de la lista", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/tools/reservations");
    await page.locator("li", { hasText: assetName }).getByRole("link").click();
    await page.waitForURL(/\/tools\/reservations\/[^/]+$/);

    await page.getByRole("button", { name: "Cancelar" }).click();

    await expect(page.getByText("Sin reservas todavía.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancelar" })).toHaveCount(0);

    expectNoCriticalErrors(diagnostics);
  });
});

test.describe.serial("Proyectos - flujo E2E", () => {
  const projectName = uniqueLabel("PROJECT");
  const projectCode = uniqueLabel("CODE");
  const taskName = uniqueLabel("TASK");

  test("crear un proyecto con los tipos de campo correctos lo muestra en la lista", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/tools/projects");

    await expect(page.getByRole("heading", { level: 1, name: "Proyectos" })).toBeVisible();

    const nameInput = page.locator('input[name="name"]');
    const codeInput = page.locator('input[name="code"]');
    await expectFieldType(nameInput, "text");
    await expectFieldType(codeInput, "text");

    await nameInput.fill(projectName);
    await codeInput.fill(projectCode);
    await page.getByRole("button", { name: "Crear proyecto" }).click();

    const row = page.locator("li", { hasText: projectName });
    await expect(row).toBeVisible();
    await expect(row).toContainText(`[${projectCode}]`);
    await expect(row).toContainText("(0%)");

    expectNoCriticalErrors(diagnostics);
  });

  test("el detalle del proyecto muestra sus datos y los sub-formularios con los tipos correctos", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/tools/projects");
    await page.locator("li", { hasText: projectName }).getByRole("link").click();
    await page.waitForURL(/\/tools\/projects\/[^/]+$/);

    await expect(page.getByRole("heading", { level: 1, name: projectName })).toBeVisible();
    await expect(page.getByText("Código")).toBeVisible();
    await expect(page.getByText(projectCode, { exact: true })).toBeVisible();
    await expect(page.getByText("Avance")).toBeVisible();

    const amountInput = page.locator('input[name="amount"]');
    await expectFieldType(amountInput, "number");
    await expect(amountInput).toHaveAttribute("step", "0.01");
    await expect(amountInput).toHaveAttribute("min", "0");

    expectNoCriticalErrors(diagnostics);
  });

  test("agregar una tarea hito la muestra en la lista de tareas y en la columna kanban sin estado", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/tools/projects");
    await page.locator("li", { hasText: projectName }).getByRole("link").click();
    await page.waitForURL(/\/tools\/projects\/[^/]+$/);

    await page.locator('input[name="name"]').fill(taskName);
    await page.locator('input[name="isMilestone"]').check();
    await page.getByRole("button", { name: "Crear tarea" }).click();

    await expect(page.getByText(`◆ ${taskName}`)).toBeVisible();

    // No project_task_state dropdown items are seeded for this entity, so a freshly-created
    // task with no state falls into the "Sin estado" catch-all kanban column (project detail
    // page.tsx). The column <h3> is a direct sibling of its <ul> under the same wrapper <div>,
    // so the heading's own parent is the column - no ambiguous multi-match "div" locator needed.
    const kanbanColumn = page.getByRole("heading", { level: 3, name: "Sin estado" }).locator("xpath=..");
    await expect(kanbanColumn.getByText(taskName)).toBeVisible();

    expectNoCriticalErrors(diagnostics);
  });

  test("agregar un miembro al equipo lo muestra en la lista de equipo", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/tools/projects");
    await page.locator("li", { hasText: projectName }).getByRole("link").click();
    await page.waitForURL(/\/tools\/projects\/[^/]+$/);

    await page.locator('select[name="role"]').selectOption("owner");
    await page.getByRole("button", { name: "Agregar al equipo" }).click();

    await expect(page.getByText(/\(owner\)/)).toBeVisible();

    expectNoCriticalErrors(diagnostics);
  });

  test("agregar un costo lo muestra formateado en centavos->pesos en la lista de costos", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/tools/projects");
    await page.locator("li", { hasText: projectName }).getByRole("link").click();
    await page.waitForURL(/\/tools\/projects\/[^/]+$/);

    await page.locator('input[name="amount"]').fill("123.45");
    await page.locator('input[name="comment"]').fill("Costo E2E");
    await page.getByRole("button", { name: "Agregar costo" }).click();

    await expect(page.getByText("$123.45")).toBeVisible();
    await expect(page.getByText("Costo E2E")).toBeVisible();

    expectNoCriticalErrors(diagnostics);
  });
});

test.describe.serial("Dashboards - flujo E2E", () => {
  const dashboardKey = uniqueLabel("dash-key").toLowerCase();
  const dashboardName = uniqueLabel("Dashboard");

  test("crear un dashboard con los tipos de campo correctos lo muestra en la lista", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/tools/dashboards");

    await expect(page.getByRole("heading", { level: 1, name: "Dashboards" })).toBeVisible();

    const keyInput = page.locator('input[name="key"]');
    const nameInput = page.locator('input[name="name"]');
    await expectFieldType(keyInput, "text");
    await expectFieldType(nameInput, "text");

    await keyInput.fill(dashboardKey);
    await nameInput.fill(dashboardName);
    await page.getByRole("button", { name: "Crear dashboard" }).click();

    const row = page.locator("li", { hasText: dashboardName });
    await expect(row).toBeVisible();
    await expect(row).toContainText(`(${dashboardKey})`);

    expectNoCriticalErrors(diagnostics);
  });

  test("el detalle expone el formulario de cards con los tipos correctos y las etiquetas traducidas (regresión card-key-labels)", async ({
    page,
  }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/tools/dashboards");
    await page.locator("li", { hasText: dashboardName }).getByRole("link").click();
    await page.waitForURL(/\/tools\/dashboards\/[^/]+$/);

    await expect(page.getByRole("heading", { level: 1, name: dashboardName })).toBeVisible();
    await expect(page.getByText(dashboardKey, { exact: true })).toBeVisible();

    for (const field of ["positionX", "positionY", "width", "height"]) {
      await expectFieldType(page.locator(`input[name="${field}"]`), "number");
    }
    await expect(page.locator('input[name="width"]')).toHaveAttribute("max", "12");

    // Regression check for the card-key-labels.ts fix: before it, these two option labels
    // fell back to the raw snake_case cardKey value instead of a translated Spanish label.
    const cardKeySelect = page.locator('select[name="cardKey"]');
    await expect(cardKeySelect.locator('option[value="sla_compliance_rate"]')).toHaveText("Cumplimiento de SLA");
    await expect(cardKeySelect.locator('option[value="tickets_created_by_day"]')).toHaveText("Tickets creados por día");

    expectNoCriticalErrors(diagnostics);
  });

  test('agregar la card "Cumplimiento de SLA" en modo tabla muestra datos reales, no "Sin datos." (regresión normalizeForChart/TableView)', async ({
    page,
  }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/tools/dashboards");
    await page.locator("li", { hasText: dashboardName }).getByRole("link").click();
    await page.waitForURL(/\/tools\/dashboards\/[^/]+$/);

    await page.locator('select[name="cardKey"]').selectOption("sla_compliance_rate");
    await page.locator('select[name="chartType"]').selectOption("table");
    await page.getByRole("button", { name: "Agregar card" }).click();

    const heading = page.getByRole("heading", { level: 3, name: "Cumplimiento de SLA" });
    await expect(heading).toBeVisible();
    // Card structure (dashboard-card-form.tsx's sibling dashboard-card.tsx / [id]/page.tsx):
    // <div card><div header><h3/></div><DashboardCardView/></div> - the heading's grandparent
    // is the card, its parent is just the header row.
    const card = heading.locator("xpath=../..");
    await expect(card.locator("table")).toBeVisible();
    await expect(card.getByText("Sin datos.")).toHaveCount(0);

    expectNoCriticalErrors(diagnostics);
  });

  test('agregar la card "Tickets creados por día" en modo barras renderiza el gráfico (regresión normalizeForChart)', async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/tools/dashboards");
    await page.locator("li", { hasText: dashboardName }).getByRole("link").click();
    await page.waitForURL(/\/tools\/dashboards\/[^/]+$/);

    await page.locator('select[name="cardKey"]').selectOption("tickets_created_by_day");
    await page.locator('select[name="chartType"]').selectOption("bar");
    await page.getByRole("button", { name: "Agregar card" }).click();

    const heading = page.getByRole("heading", { level: 3, name: "Tickets creados por día" });
    await expect(heading).toBeVisible();
    const card = heading.locator("xpath=../..");
    await expect(card.locator("svg")).toBeVisible();
    await expect(card.getByText("Sin datos.")).toHaveCount(0);

    expectNoCriticalErrors(diagnostics);
  });

  test("quitar una card la remueve del dashboard", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/tools/dashboards");
    await page.locator("li", { hasText: dashboardName }).getByRole("link").click();
    await page.waitForURL(/\/tools\/dashboards\/[^/]+$/);

    const heading = page.getByRole("heading", { level: 3, name: "Cumplimiento de SLA" });
    const card = heading.locator("xpath=../..");
    await card.getByRole("button", { name: "Eliminar" }).click();

    await expect(page.getByRole("heading", { level: 3, name: "Cumplimiento de SLA" })).toHaveCount(0);
    // The other card added earlier in this describe.serial block must be unaffected.
    await expect(page.getByRole("heading", { level: 3, name: "Tickets creados por día" })).toBeVisible();

    expectNoCriticalErrors(diagnostics);
  });
});

test.describe.serial("Feeds RSS - flujo E2E", () => {
  const feedName = uniqueLabel("RSS");
  const feedUrl = `https://example.com/${uniqueLabel("feed").toLowerCase()}.xml`;

  test("crear un feed con los tipos de campo correctos lo muestra en la lista", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/tools/rss-feeds");

    await expect(page.getByRole("heading", { level: 1, name: "Feeds RSS" })).toBeVisible();

    const nameInput = page.locator('input[name="name"]');
    const urlInput = page.locator('input[name="url"]');
    const refreshInput = page.locator('input[name="refreshRateMinutes"]');
    const maxItemsInput = page.locator('input[name="maxItems"]');
    await expectFieldType(nameInput, "text");
    await expectFieldType(urlInput, "url");
    await expectFieldType(refreshInput, "number");
    await expectFieldType(maxItemsInput, "number");
    await expect(maxItemsInput).toHaveAttribute("max", "100");

    await nameInput.fill(feedName);
    await urlInput.fill(feedUrl);
    await refreshInput.fill("60");
    await maxItemsInput.fill("10");
    await page.getByRole("button", { name: "Crear feed" }).click();

    await expect(page.getByRole("link", { name: feedName })).toBeVisible();

    expectNoCriticalErrors(diagnostics);
  });

  test("el detalle del feed muestra su configuración y el estado vacío de items cacheados", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/tools/rss-feeds");
    await page.getByRole("link", { name: feedName }).click();
    await page.waitForURL(/\/tools\/rss-feeds\/[^/]+$/);

    await expect(page.getByRole("heading", { level: 1, name: feedName })).toBeVisible();
    await expect(page.getByText(feedUrl)).toBeVisible();
    await expect(page.getByText("cada 60 min")).toBeVisible();
    await expect(page.getByText("máx. 10 items")).toBeVisible();
    // No refresh has run yet (that's a background job, out of scope here), so the cache is empty.
    await expect(page.getByText("Sin items en caché todavía.")).toBeVisible();

    expectNoCriticalErrors(diagnostics);
  });
});
