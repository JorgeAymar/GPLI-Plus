import { test, expect, type Page } from "@playwright/test";

/**
 * E2E coverage for the "Gestión" (Management) module:
 *   /management/suppliers
 *   /management/contacts
 *   /management/contracts (+ /management/contracts/[id])
 *   /management/budgets
 *   /management/certificates
 *   /management/consumables (+ /management/consumables/[id], units lifecycle)
 *
 * Known product limitation (documented, not a bug we can fix here): none of these
 * entities have an "editar" (update) UI. Only soft-delete server actions exist for
 * suppliers/contacts, and neither is wired to a button. Consumable *units* are the
 * only sub-resource with real state transitions (new -> in_use -> used), which is
 * why the "editar" requirement is exercised there instead of via a generic edit form.
 */

/* ------------------------------------------------------------------------- */
/* Diagnostics: capture console errors / page errors / failed network calls  */
/* ------------------------------------------------------------------------- */

interface Diagnostics {
  consoleErrors: string[];
  pageErrors: string[];
  failedResponses: string[];
}

function attachDiagnostics(page: Page): Diagnostics {
  const diag: Diagnostics = { consoleErrors: [], pageErrors: [], failedResponses: [] };

  page.on("console", (msg) => {
    if (msg.type() === "error") diag.consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    diag.pageErrors.push(err.message);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !response.url().includes("/favicon")) {
      diag.failedResponses.push(`${response.status()} ${response.request().method()} ${response.url()}`);
    }
  });

  return diag;
}

function assertClean(diag: Diagnostics) {
  expect(diag.consoleErrors, `Errores de consola inesperados:\n${diag.consoleErrors.join("\n")}`).toEqual([]);
  expect(diag.pageErrors, `Errores de página (uncaught) inesperados:\n${diag.pageErrors.join("\n")}`).toEqual([]);
  expect(diag.failedResponses, `Respuestas de red fallidas:\n${diag.failedResponses.join("\n")}`).toEqual([]);
}

/* ------------------------------------------------------------------------- */
/* Test data helpers                                                        */
/* ------------------------------------------------------------------------- */

const RUN_ID = Date.now().toString(36);
const tag = (label: string) => `E2E-MANAGEMENT-${label}-${RUN_ID}`;
const emailFor = (label: string) => `e2e-management-${label.toLowerCase()}-${RUN_ID}@example.com`;

function extractIdFromUrl(url: string): string {
  const match = url.match(/([0-9a-f-]{36})\/?$/i);
  if (!match) throw new Error(`No se pudo extraer un UUID de la URL: ${url}`);
  return match[1];
}

/* =========================================================================
 * 1. Páginas de listado: carga, estructura (lista + formulario) y tipos
 * ========================================================================= */

test.describe("Gestión - páginas de listado", () => {
  test("Proveedores: carga, lista y formulario", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto("/management/suppliers");

    await expect(page.getByRole("heading", { level: 1, name: "Proveedores" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Existentes" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Nuevo proveedor" })).toBeVisible();

    await expect(page.getByLabel("Nombre")).toHaveJSProperty("required", true);
    await expect(page.getByLabel("Email")).toHaveAttribute("type", "email");
    await expect(page.getByRole("button", { name: "Crear proveedor" })).toBeVisible();

    assertClean(diag);
  });

  test("Contactos: carga, lista y formulario", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto("/management/contacts");

    await expect(page.getByRole("heading", { level: 1, name: "Contactos" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Existentes" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Nuevo contacto" })).toBeVisible();

    await expect(page.getByLabel("Nombre")).toHaveJSProperty("required", true);
    await expect(page.getByLabel("Apellido")).toHaveJSProperty("required", true);
    await expect(page.getByLabel("Email")).toHaveAttribute("type", "email");
    await expect(page.getByLabel("Proveedor")).toBeVisible();
    await expect(page.getByRole("button", { name: "Crear contacto" })).toBeVisible();

    assertClean(diag);
  });

  test("Contratos: carga, lista y formulario", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto("/management/contracts");

    await expect(page.getByRole("heading", { level: 1, name: "Contratos" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Existentes" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Nuevo contrato" })).toBeVisible();

    await expect(page.getByLabel("Nombre")).toHaveJSProperty("required", true);
    await expect(page.getByLabel("Inicio")).toHaveAttribute("type", "date");
    await expect(page.getByLabel("Fin")).toHaveAttribute("type", "date");
    const cost = page.getByLabel("Costo");
    await expect(cost).toHaveAttribute("type", "number");
    await expect(cost).toHaveAttribute("step", "0.01");
    await expect(cost).toHaveAttribute("min", "0");

    const typeOptions = await page.getByLabel("Tipo").locator("option").allTextContents();
    expect(typeOptions).toEqual(["maintenance", "lease", "license", "support", "other"]);
    const billingOptions = await page.getByLabel("Facturación").locator("option").allTextContents();
    expect(billingOptions).toEqual(["monthly", "quarterly", "annual", "one_time"]);

    await expect(page.getByRole("button", { name: "Crear contrato" })).toBeVisible();

    assertClean(diag);
  });

  test("Presupuestos: carga, lista y formulario", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto("/management/budgets");

    await expect(page.getByRole("heading", { level: 1, name: "Presupuestos" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Existentes" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Nuevo presupuesto" })).toBeVisible();

    await expect(page.getByLabel("Nombre")).toHaveJSProperty("required", true);
    const amount = page.getByLabel("Monto");
    await expect(amount).toHaveJSProperty("required", true);
    await expect(amount).toHaveAttribute("type", "number");
    await expect(amount).toHaveAttribute("step", "0.01");
    await expect(amount).toHaveAttribute("min", "0");

    await expect(page.getByRole("button", { name: "Crear presupuesto" })).toBeVisible();

    assertClean(diag);
  });

  test("Certificados: carga, lista y formulario", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto("/management/certificates");

    await expect(page.getByRole("heading", { level: 1, name: "Certificados" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Existentes" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Nuevo certificado" })).toBeVisible();

    await expect(page.getByLabel("Nombre")).toHaveJSProperty("required", true);
    await expect(page.getByLabel("Válido desde")).toHaveAttribute("type", "date");
    await expect(page.getByLabel("Válido hasta")).toHaveAttribute("type", "date");

    const typeOptions = await page.getByLabel("Tipo").locator("option").allTextContents();
    expect(typeOptions).toEqual(["SSL", "Firma de código", "Otro"]);
    await expect(page.getByLabel("Tipo")).toHaveValue("ssl");

    await expect(page.getByRole("button", { name: "Crear certificado" })).toBeVisible();

    assertClean(diag);
  });

  test("Consumibles: carga, lista y formulario", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto("/management/consumables");

    await expect(page.getByRole("heading", { level: 1, name: "Consumibles" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Existentes" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Nuevo consumible" })).toBeVisible();

    await expect(page.getByLabel("Nombre")).toHaveJSProperty("required", true);
    const threshold = page.getByLabel("Umbral de alerta (stock bajo)");
    await expect(threshold).toHaveAttribute("type", "number");
    await expect(threshold).toHaveAttribute("min", "0");

    await expect(page.getByRole("button", { name: "Crear consumible" })).toBeVisible();

    assertClean(diag);
  });
});

/* =========================================================================
 * 2. Flujo E2E: Proveedor (crear -> verificar listado -> persistencia)
 * ========================================================================= */

test.describe.serial("Gestión - flujo E2E: Proveedor", () => {
  const supplierName = tag("SUP");

  test("crea un proveedor nuevo y aparece en el listado", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto("/management/suppliers");

    await page.getByLabel("Nombre").fill(supplierName);
    await page.getByLabel("Teléfono").fill("+54 11 5555-0100");
    await page.getByLabel("Email").fill(emailFor("sup"));
    await page.getByLabel("Sitio web").fill("https://example.com/" + supplierName);
    await page.getByRole("button", { name: "Crear proveedor" }).click();

    await expect(page.getByRole("link", { name: new RegExp(supplierName) })).toBeVisible();

    assertClean(diag);
  });

  test("el proveedor persiste tras recargar la página", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto("/management/suppliers");

    await expect(page.getByRole("link", { name: new RegExp(supplierName) })).toBeVisible();

    assertClean(diag);
  });

  test("hallazgo: no hay edición ni borrado disponibles para proveedores en la UI", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto("/management/suppliers");

    const row = page.locator("li").filter({ hasText: supplierName });
    await expect(row).toBeVisible();
    await expect(row.getByRole("button", { name: /editar|eliminar|borrar/i })).toHaveCount(0);
    await expect(row.getByRole("link", { name: /editar|eliminar|borrar/i })).toHaveCount(0);

    assertClean(diag);
  });
});

/* =========================================================================
 * 3. Flujo E2E: Contrato (crear -> detalle -> vincular activo -> persistencia)
 * ========================================================================= */

test.describe.serial("Gestión - flujo E2E: Contrato", () => {
  const contractName = tag("CONTRACT");
  let contractId = "";

  test("crea un contrato nuevo y aparece en el listado", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto("/management/contracts");

    await page.getByLabel("Nombre").fill(contractName);
    await page.getByLabel("Tipo").selectOption("license");
    await page.getByLabel("Facturación").selectOption("monthly");
    await page.getByLabel("Inicio").fill("2026-01-01");
    await page.getByLabel("Fin").fill("2026-12-31");
    await page.getByLabel("Costo").fill("199.99");
    await page.getByRole("button", { name: "Crear contrato" }).click();

    const link = page.getByRole("link", { name: new RegExp(contractName) });
    await expect(link).toBeVisible();

    await link.click();
    await page.waitForURL(/\/management\/contracts\/[0-9a-f-]{36}$/i);
    contractId = extractIdFromUrl(page.url());

    await expect(page.getByRole("heading", { level: 1, name: contractName })).toBeVisible();
    await expect(page.getByText("license")).toBeVisible();
    await expect(page.getByText("monthly")).toBeVisible();
    await expect(page.getByText("$199.99")).toBeVisible();

    assertClean(diag);
  });

  test("vincula un activo existente y persiste tras recargar", async ({ page }) => {
    test.skip(!contractId, "El contrato no se creó en el paso anterior");

    const diag = attachDiagnostics(page);
    await page.goto(`/management/contracts/${contractId}`);

    const assetSelect = page.getByLabel("Activo");
    const optionCount = await assetSelect.locator("option").count();
    test.skip(optionCount === 0, "No hay activos disponibles en el entorno para vincular al contrato");

    const assetName = (await assetSelect.locator("option").first().textContent())?.trim() ?? "";
    await assetSelect.selectOption({ index: 0 });
    await page.getByRole("button", { name: "Vincular" }).click();

    const coveredList = page.getByRole("heading", { name: "Activos cubiertos" }).locator("xpath=following-sibling::ul[1]");
    await expect(coveredList.getByText(assetName)).toBeVisible();

    await page.reload();
    await expect(coveredList.getByText(assetName)).toBeVisible();

    assertClean(diag);
  });
});

/* =========================================================================
 * 4. Flujo E2E: Consumible (crear item -> agregar unidades -> usar -> retirar)
 * ========================================================================= */

test.describe.serial("Gestión - flujo E2E: Consumible (unidades)", () => {
  const itemName = tag("CONS");
  let itemId = "";

  test("crea un item de consumible", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto("/management/consumables");

    await page.getByLabel("Nombre").fill(itemName);
    await page.getByLabel("Umbral de alerta (stock bajo)").fill("2");
    await page.getByLabel("Comentario").fill("Creado por spec E2E de management");
    await page.getByRole("button", { name: "Crear consumible" }).click();

    const link = page.getByRole("link", { name: itemName });
    await expect(link).toBeVisible();
    await expect(page.getByText("(0 disponibles)")).toBeVisible();

    await link.click();
    await page.waitForURL(/\/management\/consumables\/[0-9a-f-]{36}$/i);
    itemId = extractIdFromUrl(page.url());

    await expect(page.getByRole("heading", { level: 1, name: itemName })).toBeVisible();
    await expect(page.getByText("Umbral de alerta")).toBeVisible();
    await expect(page.getByText("2", { exact: true })).toBeVisible();

    assertClean(diag);
  });

  test("agrega 3 unidades nuevas y valida tipos del campo cantidad", async ({ page }) => {
    test.skip(!itemId, "El item de consumible no se creó en el paso anterior");

    const diag = attachDiagnostics(page);
    await page.goto(`/management/consumables/${itemId}`);

    const quantity = page.getByLabel("Cantidad");
    await expect(quantity).toHaveAttribute("type", "number");
    await expect(quantity).toHaveAttribute("min", "1");
    await expect(quantity).toHaveAttribute("max", "1000");
    await expect(quantity).toHaveJSProperty("required", true);
    await expect(quantity).toHaveValue("1");

    await quantity.fill("3");
    await page.getByRole("button", { name: "Agregar unidades" }).click();

    await expect(page.locator("li").filter({ hasText: "Nuevo" })).toHaveCount(3);

    assertClean(diag);
  });

  test("marca una unidad como usada, asignada a un activo existente", async ({ page }) => {
    test.skip(!itemId, "El item de consumible no se creó en el paso anterior");

    const diag = attachDiagnostics(page);
    await page.goto(`/management/consumables/${itemId}`);

    const row = page.locator("li").filter({ hasText: "Nuevo" }).first();
    const assetSelect = row.getByLabel("Activo a asignar");
    const optionCount = await assetSelect.locator("option").count(); // includes placeholder
    test.skip(optionCount <= 1, "No hay activos disponibles en el entorno para asignar al consumible");

    await assetSelect.selectOption({ index: 1 });
    await row.getByRole("button", { name: "Usar" }).click();

    await expect(page.locator("li").filter({ hasText: "En uso" })).toHaveCount(1);
    await expect(page.locator("li").filter({ hasText: "Nuevo" })).toHaveCount(2);

    assertClean(diag);
  });

  test("retira la unidad en uso", async ({ page }) => {
    test.skip(!itemId, "El item de consumible no se creó en el paso anterior");

    const diag = attachDiagnostics(page);
    await page.goto(`/management/consumables/${itemId}`);

    const inUseRow = page.locator("li").filter({ hasText: "En uso" });
    const inUseCount = await inUseRow.count();
    test.skip(inUseCount === 0, "No hay una unidad en uso (paso previo fue omitido)");

    await inUseRow.first().getByRole("button", { name: "Retirar" }).click();

    await expect(page.locator("li").filter({ hasText: "Usado" })).toHaveCount(1);
    await expect(page.locator("li").filter({ hasText: "En uso" })).toHaveCount(0);

    assertClean(diag);
  });

  test("el estado final de las unidades persiste tras recargar", async ({ page }) => {
    test.skip(!itemId, "El item de consumible no se creó en el paso anterior");

    const diag = attachDiagnostics(page);
    await page.goto(`/management/consumables/${itemId}`);
    await page.reload();

    await expect(page.locator("li").filter({ hasText: "Usado" })).toHaveCount(1);
    await expect(page.locator("li").filter({ hasText: "Nuevo" })).toHaveCount(2);
    await expect(page.locator("li").filter({ hasText: "En uso" })).toHaveCount(0);

    assertClean(diag);
  });
});
