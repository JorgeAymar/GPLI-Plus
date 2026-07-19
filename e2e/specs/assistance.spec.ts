import { test, expect, type Page, type Locator } from "@playwright/test";

/**
 * E2E specs for the "Asistencia" ITIL module: Tickets, Problems, Changes and Recurring tickets
 * (`apps/web/app/(central)/assistance/**`).
 *
 * Auth: reuses the shared "setup" project (playwright/.auth/admin.json) - no login handled here.
 *
 * Read before writing selectors: page.tsx + <entity>-form.tsx for each of tickets/problems/
 * changes/recurring-tickets, the shared apps/web/components/itil/* satellite sections
 * (Actors/Validations/Sla/Timeline/Costs), and packages/db/src/schema/itil-shared.ts +
 * tickets.ts/problems.ts/changes.ts/recurring-tickets.ts + the zod schemas in
 * packages/core/src/validation/*.zod.ts.
 *
 * Fixes applied directly in this pass (in-zone, apps/web/app/(central)/assistance/**):
 *  - Tickets/Problems/Changes create forms had NO fields for urgency/impact/priority/category,
 *    even though itil-shared.ts columns (urgency/impact/priority/categoryDropdownItemId) and
 *    createTicketSchema/createProblemSchema/createChangeSchema (packages/core/src/validation)
 *    all accept them as optional input - every record created via the UI silently defaulted to
 *    urgency=3/impact=3/priority=3/category=null with no way to override. Added urgency/impact/
 *    priority (1-5 selects, default 3) + category (dropdown from the seeded "itil_category"
 *    dropdown category) to ticket-form.tsx, problem-form.tsx, change-form.tsx, wired the
 *    corresponding page.tsx files to fetch categoryOptions, and added a read-only
 *    "Urgencia/Impacto/Prioridad" line to the three [id]/page.tsx detail pages so the values are
 *    at least visible somewhere (previously write-only, not even readable from the UI).
 *  - recurring-ticket-form.tsx: the `intervalMinutes` input (required by
 *    createRecurringTicketTemplateSchema via z.number().int().min(1)) was missing the `required`
 *    HTML attribute, so submitting it empty produced `Number("") = 0`, silently tripping a
 *    server-side Zod error instead of failing visibly client-side like every other required
 *    field in this module. Added `required`.
 *
 * Findings NOT fixed here (out of exclusive zone, or too broad a change to make opportunistically):
 *  - No UI anywhere calls updateTicketAction/updateProblemAction/updateChangeAction
 *    (apps/web/actions/{tickets,problems,changes}.actions.ts) - title/content/urgency/impact/
 *    priority/category cannot be edited after creation from any detail page. Only `status` is
 *    editable post-creation (via StatusSelect, apps/web/components/itil/status-select.tsx -
 *    shared component, not touched here). These update actions are effectively dead code from
 *    the UI's perspective.
 *  - There is NO delete capability anywhere in the stack for tickets, problems, changes, or
 *    recurring ticket templates - not in the UI, not in apps/web/actions/*, and not even a
 *    service function in packages/core (only documents and asset field definitions have a
 *    delete service). RIGHT.DELETE (packages/core/src/auth/permissions.ts) exists as a
 *    permission bit but nothing on these four entities ever checks it. Per task instructions,
 *    this is documented rather than invented: the tests below do not attempt any cleanup/delete
 *    and instead rely on the `E2E-ASSISTANCE-*` prefix for future identification/cleanup.
 *  - apps/web/components/itil/status-select.tsx has no accessible name (no <label>, no
 *    aria-label, no name attribute on the <select>) - tests below locate it structurally
 *    (first <select> inside <main>) instead of by role/name. Shared component, not fixed here.
 *  - recurring-ticket-form.tsx never exposes `ticketType` (defaults to "request" server-side per
 *    recurring_ticket_templates.ticket_type default) - minor, has a sane default, left as-is.
 *  - `/assistance/recurring-tickets` has no `[id]` detail route at all (list items aren't even
 *    links) - matches what the task asked to cover, so treated as by-design, not a bug.
 *
 * Console/network capture: per task instructions this file treats ANY response with status >= 400
 * as a finding (portal.spec.ts in this same directory intentionally used >= 500 - diverging here
 * on purpose per explicit instructions for this pass).
 */

interface Diagnostics {
  console: string[];
  network: string[];
}

function attachDiagnostics(page: Page): Diagnostics {
  const diagnostics: Diagnostics = { console: [], network: [] };

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      diagnostics.console.push(`[console.error] ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => {
    diagnostics.console.push(`[pageerror] ${err.message}`);
  });
  page.on("requestfailed", (req) => {
    diagnostics.network.push(`[requestfailed] ${req.method()} ${req.url()} :: ${req.failure()?.errorText ?? "unknown"}`);
  });
  page.on("response", (res) => {
    if (res.status() >= 400) {
      diagnostics.network.push(`[http ${res.status()}] ${res.request().method()} ${res.url()}`);
    }
  });

  return diagnostics;
}

function expectNoCriticalErrors(diagnostics: Diagnostics) {
  expect(diagnostics.console, `Console errors found:\n${diagnostics.console.join("\n")}`).toEqual([]);
  expect(diagnostics.network, `Network failures found:\n${diagnostics.network.join("\n")}`).toEqual([]);
}

/** Unique, greppable prefix for this module's generated test data - see "no delete UI" finding above. */
function uniqueTitle(kind: string): string {
  return `E2E-ASSISTANCE-${kind}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

/**
 * Distinct, still-greppable prefix for the self-authored test data added in this QA pass
 * (own values, not copy-pasted from the E2E-ASSISTANCE-* fixtures above) - kept separate so
 * either generation can be identified/cleaned up independently. Same construction as
 * uniqueTitle() above, just a different literal prefix per this pass's task instructions.
 */
function qaUniqueTitle(kind: string): string {
  return `QA-ASSISTANCE-${kind}-${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
}

async function optionValues(select: Locator): Promise<string[]> {
  return select.locator("option").evaluateAll((opts) => opts.map((o) => (o as HTMLOptionElement).value));
}

/**
 * Shared across ticket/problem/change create forms after the fix described in the header comment:
 * urgency/impact/priority are hardcoded 1-5 selects (always real, non-empty options regardless of
 * DB state) and categoryDropdownItemId is backed by the seeded "itil_category" dropdown category
 * (may legitimately have zero items beyond the "(ninguna)" placeholder in a fresh dev DB - that's
 * a data/seeding concern for a different module, not a UI bug, so only asserted defensively).
 */
async function expectItilTriageFieldsPresent(page: Page) {
  for (const name of ["urgency", "impact", "priority"]) {
    const select = page.locator(`select[name="${name}"]`);
    await expect(select, `select[name="${name}"] should exist exactly once`).toHaveCount(1);
    expect(await optionValues(select)).toEqual(["1", "2", "3", "4", "5"]);
    await expect(select).toHaveValue("3");
    expect(await select.evaluate((el: HTMLSelectElement) => el.required)).toBe(true);
  }

  const categorySelect = page.locator('select[name="categoryDropdownItemId"]');
  await expect(categorySelect).toHaveCount(1);
  const values = await optionValues(categorySelect);
  expect(values.length).toBeGreaterThanOrEqual(1); // at least the "(ninguna)" placeholder
  for (const v of values.slice(1)) {
    expect(v, "any real category option must have a non-empty dropdown-item id").not.toBe("");
  }
}

/** Fills any admin-defined required custom fields (ticket_field_definitions) so creation isn't
 * blocked by fields seeded/added concurrently by other agents working the /setup module. */
async function fillRequiredDynamicFields(page: Page) {
  const fields = page.locator('[name^="field_"]');
  const count = await fields.count();
  for (let i = 0; i < count; i++) {
    const field = fields.nth(i);
    const tag = await field.evaluate((el) => el.tagName);
    const type = tag === "INPUT" ? await field.evaluate((el) => (el as HTMLInputElement).type) : null;
    const required = await field.evaluate((el) => (el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).required);
    if (!required) continue;

    if (tag === "SELECT") {
      const values = await optionValues(field);
      const real = values.find((v) => v !== "");
      if (real) await field.selectOption(real);
    } else if (type === "checkbox") {
      await field.check();
    } else if (type === "date") {
      await field.fill("2026-01-01");
    } else if (type === "number") {
      await field.fill("1");
    } else {
      await field.fill("Valor de prueba E2E");
    }
  }
}

/** StatusSelect (apps/web/components/itil/status-select.tsx) has no accessible name - it's
 * reliably the first <select> rendered inside <main> on every ticket/problem/change detail page
 * (before any satellite-section form's own selects). See header comment finding. */
function statusSelectOf(page: Page): Locator {
  return page.locator("main select").first();
}

test.describe.serial("Tickets (/assistance/tickets)", () => {
  test("la lista carga con heading, listado y form de creación (sin redirect a /login)", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);

    await page.goto("/assistance/tickets");

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { level: 1, name: "Tickets" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Existentes" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Nuevo ticket" })).toBeVisible();

    const emptyState = page.getByText("Sin tickets todavía.");
    const items = page.locator('a[href^="/assistance/tickets/"]');
    await expect(emptyState.or(items.first())).toBeVisible();

    await expect(page.locator('input[name="title"]')).toBeVisible();
    await expect(page.locator('textarea[name="content"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Crear ticket" })).toBeVisible();

    expectNoCriticalErrors(diagnostics);
  });

  test("el form expone tipo/categoría/urgencia/impacto/prioridad con opciones reales, y required funcional", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/assistance/tickets");

    const titleInput = page.locator('input[name="title"]');
    const contentTextarea = page.locator('textarea[name="content"]');
    const typeSelect = page.locator('select[name="ticketType"]');

    expect(await titleInput.evaluate((el: HTMLInputElement) => el.type)).toBe("text");
    expect(await titleInput.evaluate((el: HTMLInputElement) => el.required)).toBe(true);
    expect(await contentTextarea.evaluate((el: HTMLTextAreaElement) => el.required)).toBe(true);

    // "Tipo" dropdown: real, non-empty, fixed set of options.
    expect(await optionValues(typeSelect)).toEqual(["incident", "request"]);

    await expectItilTriageFieldsPresent(page);

    // Any admin-defined dynamic fields must render as a mapped input kind (defensive - fields may
    // be added concurrently by another agent testing /setup/ticket-fields against this shared DB).
    const dynamicFields = page.locator('[name^="field_"]');
    const dynamicCount = await dynamicFields.count();
    for (let i = 0; i < dynamicCount; i++) {
      const tag = await dynamicFields.nth(i).evaluate((n) => n.tagName);
      expect(["INPUT", "SELECT", "TEXTAREA"]).toContain(tag);
    }

    // Required title blocks submission client-side - no server round trip, no navigation.
    await contentTextarea.fill("Contenido de prueba sin título - no debería enviarse.");
    await page.getByRole("button", { name: "Crear ticket" }).click();
    expect(await titleInput.evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);
    await expect(page).toHaveURL(/\/assistance\/tickets$/);

    expectNoCriticalErrors(diagnostics);
  });

  const ticketTitle = uniqueTitle("TICKET");

  test("crear un ticket lo persiste, aparece en la lista y su detalle es accesible", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    const content = `Contenido generado por E2E: ${ticketTitle}`;

    await page.goto("/assistance/tickets");

    // Type defaults to "incident" - leave as-is.
    await page.locator('input[name="title"]').fill(ticketTitle);
    await page.locator('textarea[name="content"]').fill(content);
    await page.locator('select[name="categoryDropdownItemId"]').selectOption({ index: 0 });
    await page.locator('select[name="urgency"]').selectOption("4");
    await page.locator('select[name="impact"]').selectOption("2");
    await page.locator('select[name="priority"]').selectOption("5");
    await fillRequiredDynamicFields(page);

    await page.getByRole("button", { name: "Crear ticket" }).click();

    await expect(page.locator("p.text-red-600")).toHaveCount(0);
    const ticketRow = page.locator("li", { hasText: ticketTitle });
    await expect(ticketRow).toBeVisible();
    await expect(ticketRow).toContainText("Nuevo");

    await page.getByRole("link", { name: ticketTitle }).click();
    await expect(page).toHaveURL(/\/assistance\/tickets\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(ticketTitle);
    await expect(page.getByText(content)).toBeVisible();
    // Persisted triage fields set at creation time (see header-comment fix) are readable.
    await expect(page.getByText("Urgencia: 4 · Impacto: 2 · Prioridad: 5")).toBeVisible();

    // No delete UI exists anywhere for tickets (documented finding) - regression guard so a future
    // silent addition doesn't go untested, and so nobody re-invents this from the test side.
    await expect(page.getByRole("button", { name: /eliminar|borrar/i })).toHaveCount(0);

    expectNoCriticalErrors(diagnostics);
  });

  test("cambiar el estado del ticket (flujo de estado) persiste tras recargar", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/assistance/tickets");
    await page.getByRole("link", { name: ticketTitle }).click();

    const statusSelect = statusSelectOf(page);
    await expect(statusSelect).toHaveValue("new");

    await statusSelect.selectOption("assigned");
    await expect(statusSelect).toBeEnabled();
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(statusSelectOf(page)).toHaveValue("assigned");

    await statusSelectOf(page).selectOption("solved");
    await expect(statusSelectOf(page)).toBeEnabled();
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(statusSelectOf(page)).toHaveValue("solved");

    expectNoCriticalErrors(diagnostics);
  });

  test("agregar un seguimiento (timeline) al ticket persiste tras recargar", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/assistance/tickets");
    await page.getByRole("link", { name: ticketTitle }).click();
    // This detail page is reached via a client-side navigation from the list, and renders
    // several independent "use client" forms (Actors/Validations/SLA/Timeline/Costs) below the
    // fold - wait for the page to fully settle before interacting, or a click can land before
    // the form's Server Action binding is ready and silently produce no request at all.
    await page.waitForLoadState("networkidle");

    // Scoped to the form containing textarea[name="content"] - TimelineForm and CostForm both
    // render a button literally labelled "Agregar" (cost-form.tsx / timeline-form.tsx), so an
    // unscoped getByRole("button", { name: "Agregar" }) would be ambiguous (strict-mode violation).
    const followupText = `Seguimiento E2E ${Date.now()}`;
    const timelineForm = page.locator("form", { has: page.locator('textarea[name="content"]') });
    await timelineForm.locator('textarea[name="content"]').fill(followupText);
    await timelineForm.getByRole("button", { name: "Agregar" }).click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByText(followupText)).toBeVisible();
    await page.reload();
    await expect(page.getByText(followupText)).toBeVisible();

    expectNoCriticalErrors(diagnostics);
  });
});

test.describe.serial("Problems (/assistance/problems)", () => {
  test("la lista carga con heading, listado y form de creación (sin redirect a /login)", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);

    await page.goto("/assistance/problems");

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { level: 1, name: "Problemas" })).toBeVisible();

    const emptyState = page.getByText("Sin problemas todavía.");
    const items = page.locator('a[href^="/assistance/problems/"]');
    await expect(emptyState.or(items.first())).toBeVisible();

    await expect(page.locator('input[name="title"]')).toBeVisible();
    await expect(page.locator('textarea[name="content"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Crear problema" })).toBeVisible();

    expectNoCriticalErrors(diagnostics);
  });

  test("el form expone categoría/urgencia/impacto/prioridad con opciones reales, y required funcional", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/assistance/problems");

    const titleInput = page.locator('input[name="title"]');
    const contentTextarea = page.locator('textarea[name="content"]');
    expect(await titleInput.evaluate((el: HTMLInputElement) => el.required)).toBe(true);
    expect(await contentTextarea.evaluate((el: HTMLTextAreaElement) => el.required)).toBe(true);

    await expectItilTriageFieldsPresent(page);

    await contentTextarea.fill("Contenido de prueba sin título - no debería enviarse.");
    await page.getByRole("button", { name: "Crear problema" }).click();
    expect(await titleInput.evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);
    await expect(page).toHaveURL(/\/assistance\/problems$/);

    expectNoCriticalErrors(diagnostics);
  });

  const problemTitle = uniqueTitle("PROBLEM");

  test("crear un problema lo persiste, aparece en la lista y su detalle es accesible", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    const content = `Contenido generado por E2E: ${problemTitle}`;

    await page.goto("/assistance/problems");
    await page.locator('input[name="title"]').fill(problemTitle);
    await page.locator('textarea[name="content"]').fill(content);
    await page.locator('select[name="urgency"]').selectOption("5");
    await page.locator('select[name="impact"]').selectOption("5");
    await page.locator('select[name="priority"]').selectOption("1");
    await page.getByRole("button", { name: "Crear problema" }).click();

    await expect(page.locator("p.text-red-600")).toHaveCount(0);
    const row = page.locator("li", { hasText: problemTitle });
    await expect(row).toBeVisible();

    await page.getByRole("link", { name: problemTitle }).click();
    await expect(page).toHaveURL(/\/assistance\/problems\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(problemTitle);
    await expect(page.getByText(content)).toBeVisible();
    await expect(page.getByText("Urgencia: 5 · Impacto: 5 · Prioridad: 1")).toBeVisible();

    await expect(page.getByRole("button", { name: /eliminar|borrar/i })).toHaveCount(0);

    expectNoCriticalErrors(diagnostics);
  });

  test("cambiar el estado del problema (flujo de estado) persiste tras recargar", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/assistance/problems");
    await page.getByRole("link", { name: problemTitle }).click();

    const statusSelect = statusSelectOf(page);
    await expect(statusSelect).toHaveValue("new");
    await statusSelect.selectOption("planned");
    await expect(statusSelect).toBeEnabled();
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(statusSelectOf(page)).toHaveValue("planned");

    expectNoCriticalErrors(diagnostics);
  });

  test("agregar un actor al problema persiste tras recargar (edición de un campo relacionado)", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/assistance/problems");
    await page.getByRole("link", { name: problemTitle }).click();

    const actorForm = page.locator("form", { has: page.locator('select[name="userId"]') });
    await actorForm.locator('select[name="actorRole"]').selectOption("assignee");
    await actorForm.locator('select[name="userId"]').selectOption({ index: 0 });
    await actorForm.getByRole("button", { name: "Agregar actor" }).click();

    await expect(page.getByText(/assignee:/)).toBeVisible();
    await page.reload();
    await expect(page.getByText(/assignee:/)).toBeVisible();

    expectNoCriticalErrors(diagnostics);
  });
});

test.describe.serial("Changes (/assistance/changes)", () => {
  test("la lista carga con heading, listado y form de creación (sin redirect a /login)", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);

    await page.goto("/assistance/changes");

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { level: 1, name: "Cambios" })).toBeVisible();

    const emptyState = page.getByText("Sin cambios todavía.");
    const items = page.locator('a[href^="/assistance/changes/"]');
    await expect(emptyState.or(items.first())).toBeVisible();

    await expect(page.locator('input[name="title"]')).toBeVisible();
    await expect(page.locator('textarea[name="content"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Crear cambio" })).toBeVisible();

    expectNoCriticalErrors(diagnostics);
  });

  test("el form expone fechas datetime-local, categoría/urgencia/impacto/prioridad y required funcional", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/assistance/changes");

    const titleInput = page.locator('input[name="title"]');
    const contentTextarea = page.locator('textarea[name="content"]');
    const startInput = page.locator('input[name="plannedStartAt"]');
    const endInput = page.locator('input[name="plannedEndAt"]');

    expect(await titleInput.evaluate((el: HTMLInputElement) => el.required)).toBe(true);
    expect(await contentTextarea.evaluate((el: HTMLTextAreaElement) => el.required)).toBe(true);
    expect(await startInput.evaluate((el: HTMLInputElement) => el.type)).toBe("datetime-local");
    expect(await endInput.evaluate((el: HTMLInputElement) => el.type)).toBe("datetime-local");
    // Planned dates are optional per createChangeSchema (nullable().optional()) - correctly not required.
    expect(await startInput.evaluate((el: HTMLInputElement) => el.required)).toBe(false);
    expect(await endInput.evaluate((el: HTMLInputElement) => el.required)).toBe(false);

    await expectItilTriageFieldsPresent(page);

    await contentTextarea.fill("Contenido de prueba sin título - no debería enviarse.");
    await page.getByRole("button", { name: "Crear cambio" }).click();
    expect(await titleInput.evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);
    await expect(page).toHaveURL(/\/assistance\/changes$/);

    expectNoCriticalErrors(diagnostics);
  });

  const changeTitle = uniqueTitle("CHANGE");

  test("crear un cambio (con fechas planificadas) lo persiste, aparece en la lista y su detalle es accesible", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    const content = `Contenido generado por E2E: ${changeTitle}`;

    await page.goto("/assistance/changes");
    await page.locator('input[name="title"]').fill(changeTitle);
    await page.locator('textarea[name="content"]').fill(content);
    await page.locator('input[name="plannedStartAt"]').fill("2026-08-01T09:00");
    await page.locator('input[name="plannedEndAt"]').fill("2026-08-01T11:00");
    await page.locator('select[name="urgency"]').selectOption("3");
    await page.locator('select[name="impact"]').selectOption("4");
    await page.locator('select[name="priority"]').selectOption("4");
    await page.getByRole("button", { name: "Crear cambio" }).click();

    await expect(page.locator("p.text-red-600")).toHaveCount(0);
    const row = page.locator("li", { hasText: changeTitle });
    await expect(row).toBeVisible();

    await page.getByRole("link", { name: changeTitle }).click();
    await expect(page).toHaveURL(/\/assistance\/changes\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(changeTitle);
    await expect(page.getByText(content)).toBeVisible();
    await expect(page.getByText("Urgencia: 3 · Impacto: 4 · Prioridad: 4")).toBeVisible();
    await expect(page.getByText(/Planificado:/)).toBeVisible();

    await expect(page.getByRole("button", { name: /eliminar|borrar/i })).toHaveCount(0);

    expectNoCriticalErrors(diagnostics);
  });

  test("cambiar el estado del cambio (flujo de estado) persiste tras recargar", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/assistance/changes");
    await page.getByRole("link", { name: changeTitle }).click();

    const statusSelect = statusSelectOf(page);
    await expect(statusSelect).toHaveValue("new");
    await statusSelect.selectOption("assigned");
    await expect(statusSelect).toBeEnabled();
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(statusSelectOf(page)).toHaveValue("assigned");

    expectNoCriticalErrors(diagnostics);
  });

  test("solicitar y aprobar una validación del cambio (flujo de aprobación CAB) persiste", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/assistance/changes");
    await page.getByRole("link", { name: changeTitle }).click();

    await expect(page.getByText("Sin solicitudes de aprobación.")).toBeVisible();

    // Request approval from the first available user - always at least the seeded admin.
    const validationForm = page.locator("form", { has: page.locator('select[name="validatorId"]') });
    await validationForm.locator('select[name="validatorId"]').selectOption({ index: 0 });
    await validationForm.getByRole("button", { name: "Solicitar" }).click();

    const waitingRow = page.locator("li", { hasText: "waiting" });
    await expect(waitingRow).toBeVisible();
    await waitingRow.getByRole("button", { name: "Aprobar" }).click();

    const approvedRow = page.locator("li", { hasText: "approved" });
    await expect(approvedRow).toBeVisible();
    await expect(page.getByRole("button", { name: "Aprobar" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Rechazar" })).toHaveCount(0);

    await page.reload();
    await expect(page.locator("li", { hasText: "approved" })).toBeVisible();

    expectNoCriticalErrors(diagnostics);
  });
});

test.describe.serial("Recurring tickets (/assistance/recurring-tickets)", () => {
  test("la lista carga con heading, listado y form de creación (sin redirect a /login)", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);

    await page.goto("/assistance/recurring-tickets");

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { level: 1, name: "Tickets recurrentes" })).toBeVisible();

    const emptyState = page.getByText("Sin recurrencias todavía.");
    // No detail route exists for recurring templates (list items are plain text, not links) -
    // matches the task's page scope (no [id] listed for this route), treated as by-design.
    const items = page.locator("li", { hasText: "cada" });
    await expect(emptyState.or(items.first())).toBeVisible();

    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Crear recurrencia" })).toBeVisible();

    expectNoCriticalErrors(diagnostics);
  });

  test("el form valida requeridos (incluye el fix de intervalMinutes) y expone un solicitante real", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/assistance/recurring-tickets");

    const nameInput = page.locator('input[name="name"]');
    const titleTemplateInput = page.locator('input[name="titleTemplate"]');
    const contentTemplateTextarea = page.locator('textarea[name="contentTemplate"]');
    const requesterSelect = page.locator('select[name="requesterUserId"]');
    const intervalInput = page.locator('input[name="intervalMinutes"]');

    expect(await nameInput.evaluate((el: HTMLInputElement) => el.required)).toBe(true);
    expect(await titleTemplateInput.evaluate((el: HTMLInputElement) => el.required)).toBe(true);
    expect(await contentTemplateTextarea.evaluate((el: HTMLTextAreaElement) => el.required)).toBe(true);
    expect(await requesterSelect.evaluate((el: HTMLSelectElement) => el.required)).toBe(true);
    expect(await intervalInput.evaluate((el: HTMLInputElement) => el.type)).toBe("number");
    // Regression guard for the fix applied in this pass (see header comment).
    expect(await intervalInput.evaluate((el: HTMLInputElement) => el.required)).toBe(true);

    const requesterValues = await optionValues(requesterSelect);
    expect(requesterValues.length).toBeGreaterThanOrEqual(1);
    for (const v of requesterValues) {
      expect(v).not.toBe("");
    }

    // Fill everything except intervalMinutes and confirm client-side validation now blocks submit.
    await nameInput.fill("E2E validación sin completar");
    await titleTemplateInput.fill("Título de prueba");
    await contentTemplateTextarea.fill("Contenido de prueba");
    await requesterSelect.selectOption({ index: 0 });
    await page.getByRole("button", { name: "Crear recurrencia" }).click();
    expect(await intervalInput.evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);
    await expect(page).toHaveURL(/\/assistance\/recurring-tickets$/);

    expectNoCriticalErrors(diagnostics);
  });

  test("crear una recurrencia la persiste y aparece en la lista", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    const name = uniqueTitle("RECURRING");

    await page.goto("/assistance/recurring-tickets");
    await page.locator('input[name="name"]').fill(name);
    await page.locator('input[name="titleTemplate"]').fill(`Título generado - ${name}`);
    await page.locator('textarea[name="contentTemplate"]').fill(`Contenido generado por E2E: ${name}`);
    await page.locator('select[name="requesterUserId"]').selectOption({ index: 0 });
    await page.locator('input[name="intervalMinutes"]').fill("10080");
    await page.getByRole("button", { name: "Crear recurrencia" }).click();

    await expect(page.locator("p.text-red-600")).toHaveCount(0);
    const row = page.locator("li", { hasText: name });
    await expect(row).toBeVisible();
    await expect(row).toContainText("cada 10080 min");

    await page.reload();
    await expect(page.locator("li", { hasText: name })).toBeVisible();

    // No delete UI exists for recurring templates either (documented finding, same as the other
    // three entity types - see header comment).
    await expect(page.getByRole("button", { name: /eliminar|borrar/i })).toHaveCount(0);

    expectNoCriticalErrors(diagnostics);
  });
});

/* ===========================================================================================
 * QA pass additions below: (1) own, self-authored realistic test data (QA-ASSISTANCE-* prefix,
 * NOT copy-pasted from the E2E-ASSISTANCE-* fixtures above) with full create -> list -> detail
 * persistence checks, and (2) data-type/required-field validation that asserts the REAL observed
 * behavior (native HTML5 constraint validation results, via .validity - not guessed) rather than
 * just checking "no crash". Behaviors below were verified manually against the running dev server
 * before writing the assertions (e.g. Playwright's .fill() actually throws for non-numeric text
 * on input[type=number] - real users can't type letters into it either, so those cases are
 * exercised with .pressSequentially() to simulate real keystrokes instead).
 * =========================================================================================== */

test.describe.serial("QA - Tickets: datos propios y validación de tipos/requeridos", () => {
  const qaTicketTitle = qaUniqueTitle("TICKET");

  test("crear un ticket con datos propios lo persiste, aparece en la lista y su detalle es accesible", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    const content = "La impresora HP LaserJet del piso 3 no responde a trabajos de impresión desde ayer a las 14:00.";

    await page.goto("/assistance/tickets");
    await page.locator('select[name="ticketType"]').selectOption("request");
    await page.locator('input[name="title"]').fill(qaTicketTitle);
    await page.locator('textarea[name="content"]').fill(content);
    await page.locator('select[name="categoryDropdownItemId"]').selectOption({ index: 0 });
    await page.locator('select[name="urgency"]').selectOption("2");
    await page.locator('select[name="impact"]').selectOption("3");
    await page.locator('select[name="priority"]').selectOption("2");
    await fillRequiredDynamicFields(page);
    await page.getByRole("button", { name: "Crear ticket" }).click();

    await expect(page.locator("p.text-red-600")).toHaveCount(0);
    await expect(page.locator("li", { hasText: qaTicketTitle })).toBeVisible();

    await page.getByRole("link", { name: qaTicketTitle }).click();
    await expect(page).toHaveURL(/\/assistance\/tickets\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(qaTicketTitle);
    await expect(page.getByText(content)).toBeVisible();
    await expect(page.getByText("Urgencia: 2 · Impacto: 3 · Prioridad: 2")).toBeVisible();

    expectNoCriticalErrors(diagnostics);
  });

  test("'content' vacío (con título completo) bloquea el envío nativamente y no crea el ticket", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/assistance/tickets");

    // Mirror image of the pre-existing "empty title" test above - this one leaves the OTHER
    // required field (content) empty instead, so both required text fields get real coverage.
    const bogusTitle = qaUniqueTitle("TICKET-SHOULD-NOT-EXIST");
    await page.locator('input[name="title"]').fill(bogusTitle);
    await page.getByRole("button", { name: "Crear ticket" }).click();

    const contentTextarea = page.locator('textarea[name="content"]');
    const validity = await contentTextarea.evaluate((el: HTMLTextAreaElement) => ({
      valid: el.validity.valid,
      valueMissing: el.validity.valueMissing,
    }));
    expect(validity).toEqual({ valid: false, valueMissing: true });
    // Native validation blocks the submit client-side - no navigation, no server round trip.
    await expect(page).toHaveURL(/\/assistance\/tickets$/);
    await expect(page.locator("li", { hasText: bogusTitle })).toHaveCount(0);

    expectNoCriticalErrors(diagnostics);
  });
});

test.describe.serial("QA - Problems: datos propios y validación de requeridos", () => {
  const qaProblemTitle = qaUniqueTitle("PROBLEM");

  test("crear un problema con datos propios lo persiste, aparece en la lista y su detalle es accesible", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    const content = "Caída intermitente de la VPN corporativa reportada por 6 usuarios distintos en la última semana.";

    await page.goto("/assistance/problems");
    await page.locator('input[name="title"]').fill(qaProblemTitle);
    await page.locator('textarea[name="content"]').fill(content);
    await page.locator('select[name="urgency"]').selectOption("4");
    await page.locator('select[name="impact"]').selectOption("4");
    await page.locator('select[name="priority"]').selectOption("3");
    await page.getByRole("button", { name: "Crear problema" }).click();

    await expect(page.locator("p.text-red-600")).toHaveCount(0);
    await expect(page.locator("li", { hasText: qaProblemTitle })).toBeVisible();

    await page.getByRole("link", { name: qaProblemTitle }).click();
    await expect(page).toHaveURL(/\/assistance\/problems\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(qaProblemTitle);
    await expect(page.getByText(content)).toBeVisible();
    await expect(page.getByText("Urgencia: 4 · Impacto: 4 · Prioridad: 3")).toBeVisible();

    expectNoCriticalErrors(diagnostics);
  });

  test("'content' vacío (con título completo) bloquea el envío nativamente y no crea el problema", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/assistance/problems");

    const bogusTitle = qaUniqueTitle("PROBLEM-SHOULD-NOT-EXIST");
    await page.locator('input[name="title"]').fill(bogusTitle);
    await page.getByRole("button", { name: "Crear problema" }).click();

    const contentTextarea = page.locator('textarea[name="content"]');
    const validity = await contentTextarea.evaluate((el: HTMLTextAreaElement) => ({
      valid: el.validity.valid,
      valueMissing: el.validity.valueMissing,
    }));
    expect(validity).toEqual({ valid: false, valueMissing: true });
    await expect(page).toHaveURL(/\/assistance\/problems$/);
    await expect(page.locator("li", { hasText: bogusTitle })).toHaveCount(0);

    expectNoCriticalErrors(diagnostics);
  });
});

test.describe.serial("QA - Changes: datos propios y comportamiento real de las fechas planificadas", () => {
  const qaChangeTitle = qaUniqueTitle("CHANGE");

  test("crear un cambio con datos propios SIN fechas planificadas (camino nulo) lo persiste y aparece en la lista", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    const content = "Actualización de firmware en el switch core del datacenter B - ventana de mantenimiento a confirmar.";

    await page.goto("/assistance/changes");
    await page.locator('input[name="title"]').fill(qaChangeTitle);
    await page.locator('textarea[name="content"]').fill(content);
    await page.locator('select[name="urgency"]').selectOption("1");
    await page.locator('select[name="impact"]').selectOption("2");
    await page.locator('select[name="priority"]').selectOption("1");
    // plannedStartAt/plannedEndAt left empty on purpose - optional per createChangeSchema, this
    // exercises the null path (the pre-existing "crear un cambio" test above always fills both).
    await page.getByRole("button", { name: "Crear cambio" }).click();

    await expect(page.locator("p.text-red-600")).toHaveCount(0);
    await expect(page.locator("li", { hasText: qaChangeTitle })).toBeVisible();

    await page.getByRole("link", { name: qaChangeTitle }).click();
    await expect(page).toHaveURL(/\/assistance\/changes\/[0-9a-f-]+$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(qaChangeTitle);
    await expect(page.getByText(content)).toBeVisible();
    await expect(page.getByText("Urgencia: 1 · Impacto: 2 · Prioridad: 1")).toBeVisible();
    // change.tsx only renders the "Planificado:" line when either date is set - confirms the
    // null path round-trips cleanly instead of e.g. rendering "Planificado: ? → ?".
    await expect(page.getByText(/Planificado:/)).toHaveCount(0);

    expectNoCriticalErrors(diagnostics);
  });

  test("texto no-fecha tecleado en 'Inicio planificado' es descartado por el widget datetime-local (queda vacío y sigue siendo válido por ser opcional)", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/assistance/changes");

    const startInput = page.locator('input[name="plannedStartAt"]');
    // Real user keystrokes (not .fill(), which Playwright itself rejects with "Malformed value"
    // for a non-parseable datetime-local string - that guard doesn't reflect what a real user
    // typing on the keyboard experiences). Verified manually: the segmented datetime-local widget
    // has no digit keys to place from "not-a-date", so it silently discards all of it.
    await startInput.pressSequentially("not-a-date");
    expect(await startInput.inputValue()).toBe("");
    expect(await startInput.evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(true);

    // Confirm the silent discard doesn't corrupt an otherwise-valid submission alongside it.
    const title = qaUniqueTitle("CHANGE-BADDATE");
    await page.locator('input[name="title"]').fill(title);
    await page.locator('textarea[name="content"]').fill("Cambio QA para confirmar que una fecha basura descartada no bloquea ni corrompe el envío.");
    await page.getByRole("button", { name: "Crear cambio" }).click();

    await expect(page.locator("p.text-red-600")).toHaveCount(0);
    await expect(page.locator("li", { hasText: title })).toBeVisible();
    await page.getByRole("link", { name: title }).click();
    await expect(page.getByText(/Planificado:/)).toHaveCount(0);

    expectNoCriticalErrors(diagnostics);
  });
});

test.describe.serial("QA - Recurring tickets: datos propios y comportamiento real de intervalMinutes", () => {
  const qaRecurringName = qaUniqueTitle("RECURRING");

  test("crear una recurrencia con datos propios la persiste y aparece en la lista", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/assistance/recurring-tickets");
    await page.locator('input[name="name"]').fill(qaRecurringName);
    await page.locator('input[name="titleTemplate"]').fill("Verificación mensual de licencias de software");
    await page
      .locator('textarea[name="contentTemplate"]')
      .fill("Revisar asientos usados vs. contratados en el módulo de Activos > Software.");
    await page.locator('select[name="requesterUserId"]').selectOption({ index: 0 });
    await page.locator('input[name="intervalMinutes"]').fill("43200"); // ~30 días
    await page.getByRole("button", { name: "Crear recurrencia" }).click();

    await expect(page.locator("p.text-red-600")).toHaveCount(0);
    const row = page.locator("li", { hasText: qaRecurringName });
    await expect(row).toBeVisible();
    await expect(row).toContainText("cada 43200 min");

    expectNoCriticalErrors(diagnostics);
  });

  test("intervalMinutes: letras tecleadas no se registran, y 0/negativos son bloqueados por la restricción min=1 del input", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/assistance/recurring-tickets");

    const intervalInput = page.locator('input[name="intervalMinutes"]');

    // (b) wrong-type: a real user typing letters into a type=number input never gets them
    // registered - Chromium filters non-numeric keystrokes at the keyboard-event level, verified
    // manually. .pressSequentially() simulates real keystrokes (.fill() would throw outright).
    await intervalInput.pressSequentially("abc");
    expect(await intervalInput.inputValue()).toBe("");

    // A syntactically-numeric but out-of-range value (min=1) IS accepted into the field's value,
    // but fails constraint validation - the browser blocks submission via the same native
    // mechanism as an empty required field.
    await intervalInput.fill("0");
    const zeroValidity = await intervalInput.evaluate((el: HTMLInputElement) => ({
      valid: el.validity.valid,
      rangeUnderflow: el.validity.rangeUnderflow,
    }));
    expect(zeroValidity).toEqual({ valid: false, rangeUnderflow: true });

    // (a) confirm the blocked value never reaches the server: fill every other required field
    // and attempt to submit with intervalMinutes=0 left in place.
    const bogusName = qaUniqueTitle("RECURRING-SHOULD-NOT-EXIST");
    await page.locator('input[name="name"]').fill(bogusName);
    await page.locator('input[name="titleTemplate"]').fill("QA título");
    await page.locator('textarea[name="contentTemplate"]').fill("QA contenido");
    await page.locator('select[name="requesterUserId"]').selectOption({ index: 0 });
    await page.getByRole("button", { name: "Crear recurrencia" }).click();

    await expect(page).toHaveURL(/\/assistance\/recurring-tickets$/);
    await expect(page.locator("li", { hasText: bogusName })).toHaveCount(0);

    expectNoCriticalErrors(diagnostics);
  });
});
