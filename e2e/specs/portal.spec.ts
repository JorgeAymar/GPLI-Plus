import { test, expect, type Page } from "@playwright/test";

/**
 * E2E specs for the simplified self-service Portal (`apps/web/app/(simplified)/portal`).
 *
 * Auth: reuses the shared "setup" project (playwright/.auth/admin.json). Confirmed by reading
 * lib/session.ts + app/page.tsx + app/(simplified)/portal/layout.tsx that /portal has NO
 * role/interface gate of its own: `requireAuthContext()` only requires an active session, and
 * `createTicketAction()` only requires MODULE.ASSISTANCE_TICKET / RIGHT.CREATE, which the admin
 * seed user holds. Admin's own default redirect (app/page.tsx, based on
 * `activeProfile.interface`) happens to be `/dashboard`, but that's just the *default landing
 * page* - nothing stops an authenticated admin from navigating to `/portal` directly, so the
 * shared admin storageState works fine for this spec.
 *
 * Scope: `apps/web/app/(simplified)/portal/**` only. Does not touch shared ticket logic
 * (`apps/web/actions/tickets.actions.ts`, `packages/core`) - see inline notes below for findings
 * reported but intentionally not fixed there.
 */

interface Diagnostics {
  console: string[];
  network: string[];
}

/** Attaches console/network listeners for the duration of a test and returns the collected buckets. */
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
    // Only 5xx count as hard failures here - 4xx can legitimately happen (e.g. static asset
    // probes) and would make this check too brittle for a black-box E2E spec.
    if (res.status() >= 500) {
      diagnostics.network.push(`[http ${res.status()}] ${res.request().method()} ${res.url()}`);
    }
  });

  return diagnostics;
}

function expectNoCriticalErrors(diagnostics: Diagnostics) {
  expect(diagnostics.console, `Console errors found:\n${diagnostics.console.join("\n")}`).toEqual([]);
  expect(diagnostics.network, `Network failures found:\n${diagnostics.network.join("\n")}`).toEqual([]);
}

test.describe.serial("Portal de autoservicio (/portal)", () => {
  test("carga la página con Catálogo de servicios, form de creación y Mis solicitudes", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);

    await page.goto("/portal");

    await expect(page.getByRole("heading", { level: 1, name: "¿En qué te podemos ayudar?" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Catálogo de servicios" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Mis solicitudes" })).toBeVisible();

    // Catalog section: either the empty state or a list of catalog item links is valid, depending
    // on whether service_catalog_items has active rows for the admin's active entity (currently
    // empty in this dev DB, but other parallel agents/seeds could change that).
    const emptyState = page.getByText("Sin tipos de solicitud predefinidos todavía.");
    const catalogLinks = page.locator('a[href^="/portal?serviceCatalogItemId="]');
    await expect(emptyState.or(catalogLinks.first())).toBeVisible();

    // The ticket-creation form must always be present regardless of catalog state.
    await expect(page.locator('input[name="title"]')).toBeVisible();
    await expect(page.locator('textarea[name="content"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar solicitud" })).toBeVisible();

    expectNoCriticalErrors(diagnostics);
  });

  test("el form expone título y descripción con el tipo y el required correctos", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    await page.goto("/portal");

    const titleInput = page.locator('input[name="title"]');
    const contentTextarea = page.locator('textarea[name="content"]');

    // Now that labels carry htmlFor/id (fixed in portal-ticket-form-client.tsx), getByLabel works.
    await expect(page.getByLabel("¿Qué necesitas?")).toHaveCount(1);
    await expect(page.getByLabel("Cuéntanos más")).toHaveCount(1);

    await expect(titleInput).toHaveAttribute("placeholder", "Ej: No puedo entrar a mi correo");
    expect(await titleInput.evaluate((el: HTMLInputElement) => el.tagName)).toBe("INPUT");
    expect(await titleInput.evaluate((el: HTMLInputElement) => el.type)).toBe("text");
    expect(await contentTextarea.evaluate((el: HTMLTextAreaElement) => el.tagName)).toBe("TEXTAREA");

    // Required checks - functional (native HTML5 constraint validation), not just declarative.
    expect(await titleInput.evaluate((el: HTMLInputElement) => el.required)).toBe(true);
    expect(await contentTextarea.evaluate((el: HTMLTextAreaElement) => el.required)).toBe(true);

    // Any admin-defined dynamic fields (ticket_field_definitions for ticketType "incident" or
    // null - none seeded in this dev DB right now) must render as one of the mapped input kinds.
    const dynamicFields = page.locator('[name^="field_"]');
    const dynamicCount = await dynamicFields.count();
    for (let i = 0; i < dynamicCount; i++) {
      const tag = await dynamicFields.nth(i).evaluate((n) => n.tagName);
      expect(["INPUT", "SELECT", "TEXTAREA"]).toContain(tag);
    }

    // Submitting with an empty required title must be blocked client-side - no server round trip.
    await contentTextarea.fill("Contenido de prueba sin título - no debería enviarse.");
    await page.getByRole("button", { name: "Enviar solicitud" }).click();
    expect(await titleInput.evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);
    await expect(page).toHaveURL(/\/portal$/);

    expectNoCriticalErrors(diagnostics);
  });

  test("crear un ticket desde el portal lo agrega a Mis solicitudes", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    const ticketTitle = `E2E-PORTAL-${Date.now()}`;
    const ticketContent = `Contenido generado por E2E: ${ticketTitle}`;

    await page.goto("/portal");

    await page.locator('input[name="title"]').fill(ticketTitle);
    await page.locator('textarea[name="content"]').fill(ticketContent);
    await page.getByRole("button", { name: "Enviar solicitud" }).click();

    // No error surfaced by the server action (createTicketAction throwing would render this).
    await expect(page.locator("p.text-red-600")).toHaveCount(0);

    // The ticket must show up in "Mis solicitudes" WITHOUT a manual reload. createTicketAction
    // (apps/web/actions/tickets.actions.ts, shared with Asistencia central - not modified here)
    // calls revalidatePath("/assistance/tickets"), not "/portal". Per the vendored Next.js docs
    // (node_modules/next/dist/docs/01-app/02-guides/server-actions.md: "it runs the action, then
    // re-renders the current route server-side" and 04-functions/revalidatePath.md: "Updates the
    // UI immediately if viewing the affected path") any revalidatePath call from a Server Action
    // re-renders the *current* route (/portal, where the form lives), regardless of the literal
    // path string passed in. This assertion is the regression guard for that behavior.
    const ticketRow = page.locator("li", { hasText: ticketTitle });
    await expect(ticketRow).toBeVisible();
    await expect(ticketRow).toContainText("Nuevo");

    // Confirm it's durably persisted (not just a client-side artifact) via a hard reload.
    await page.reload();
    await expect(page.locator("li", { hasText: ticketTitle })).toBeVisible();

    expectNoCriticalErrors(diagnostics);
  });

  test("?serviceCatalogItemId= no rompe la página (integración documentada como no leída aún)", async ({ page }) => {
    const diagnostics = attachDiagnostics(page);
    const fakeId = "00000000-0000-0000-0000-000000000000";

    await page.goto(`/portal?serviceCatalogItemId=${fakeId}`);

    await expect(page.getByRole("heading", { level: 1, name: "¿En qué te podemos ayudar?" })).toBeVisible();

    // Documented in portal-ticket-form.tsx: serviceCatalogItemId is reserved for a future
    // enhancement and is NOT read by PortalTicketForm yet, so it must not prefill/alter the form.
    await expect(page.locator('input[name="title"]')).toHaveValue("");
    await expect(page.locator('textarea[name="content"]')).toHaveValue("");

    expectNoCriticalErrors(diagnostics);
  });
});
