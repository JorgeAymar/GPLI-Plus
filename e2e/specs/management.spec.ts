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
 * entities have an "editar" (update) UI. Consumable *units* are the only sub-resource
 * with real state transitions (new -> in_use -> used), which is why the "editar"
 * requirement is exercised there instead of via a generic edit form.
 *
 * Soft-delete for suppliers/contacts IS wired to a button (ConfirmDeleteButton, native
 * confirm() dialog) on their listing/detail page - see the "hallazgo" tests below, which
 * used to document the opposite (no delete UI) and now verify the real delete flow.
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

/**
 * Distinct, still-greppable prefix for the self-authored test data added in this QA pass (own
 * values, not copy-pasted from the E2E-MANAGEMENT-* fixtures above) - kept separate so either
 * generation can be identified/cleaned up independently. Same construction as tag()/emailFor()
 * above, just a different literal prefix per this pass's task instructions.
 */
const qaTag = (label: string) => `QA-MANAGEMENT-${label}-${RUN_ID}`;
const qaEmailFor = (label: string) => `qa-management-${label.toLowerCase()}-${RUN_ID}@example.com`;

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

  test("hallazgo: sigue sin haber edición disponible para proveedores en la UI", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto("/management/suppliers");

    const row = page.locator("li").filter({ hasText: supplierName });
    await expect(row).toBeVisible();
    await expect(row.getByRole("button", { name: /editar/i })).toHaveCount(0);
    await expect(row.getByRole("link", { name: /editar/i })).toHaveCount(0);

    assertClean(diag);
  });

  test("elimina el proveedor tras confirmar el diálogo y desaparece del listado", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto("/management/suppliers");

    const row = page.locator("li").filter({ hasText: supplierName });
    await expect(row).toBeVisible();

    page.once("dialog", (dialog) => dialog.accept());
    await row.getByRole("button", { name: "Eliminar" }).click();

    await expect(page.locator("li").filter({ hasText: supplierName })).toHaveCount(0);

    // Persiste tras recargar (soft-delete real, no solo optimismo de UI).
    await page.reload();
    await expect(page.locator("li").filter({ hasText: supplierName })).toHaveCount(0);

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
    // Scoped to this item's own <li> row (there is no delete UI for consumable items - see file
    // header comment - so a leftover zero-stock item from an earlier run/session can coexist with
    // this one; an unscoped page-wide getByText("(0 disponibles)") would then match more than one
    // element and fail with a strict-mode violation instead of testing what this test means to test).
    const row = page.locator("li").filter({ has: link });
    await expect(row).toContainText("(0 disponibles)");

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

/* =========================================================================
 * QA pass additions below: (1) own, self-authored realistic test data
 * (QA-MANAGEMENT-* prefix, NOT copy-pasted from the E2E-MANAGEMENT-* fixtures above) with
 * create -> list persistence checks for every create-form in this module, including contacts,
 * budgets and certificates which previously had NO create test at all (only a "page loads /
 * attribute types are correct" check), and (2) data-type/required-field validation that asserts
 * the REAL observed browser behavior (via .validity, not guessed). Playwright's .fill() throws
 * outright for non-numeric text on input[type=number] ("Cannot type text into
 * input[type=number]") - that's not what a real user typing experiences, so those cases use
 * .pressSequentially() to simulate actual keystrokes instead, verified manually beforehand.
 * ========================================================================= */

test.describe.serial("QA - Proveedores: datos propios y validación de email", () => {
  const qaSupplierName = qaTag("SUP");

  test("crea un proveedor con datos propios y aparece en el listado", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto("/management/suppliers");

    await page.getByLabel("Nombre").fill(qaSupplierName);
    await page.getByLabel("Teléfono").fill("+52 55 1234-5678");
    await page.getByLabel("Email").fill(qaEmailFor("sup"));
    await page.getByLabel("Sitio web").fill("https://proveedor-qa.example.com");
    await page.getByRole("button", { name: "Crear proveedor" }).click();

    await expect(page.getByRole("link", { name: new RegExp(qaSupplierName) })).toBeVisible();

    assertClean(diag);
  });

  test("un email con formato inválido bloquea el envío nativamente y no crea el proveedor", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto("/management/suppliers");

    const bogusName = qaTag("SUP-SHOULD-NOT-EXIST");
    const emailInput = page.getByLabel("Email");
    await page.getByLabel("Nombre").fill(bogusName);
    await emailInput.fill("not-an-email");

    await page.getByRole("button", { name: "Crear proveedor" }).click();

    // Real observed behavior: type="email" native validation flags a value without an "@"/domain
    // as a typeMismatch, which blocks submission just like an empty required field would.
    const validity = await emailInput.evaluate((el: HTMLInputElement) => ({ valid: el.validity.valid, typeMismatch: el.validity.typeMismatch }));
    expect(validity).toEqual({ valid: false, typeMismatch: true });
    await expect(page.getByRole("link", { name: new RegExp(bogusName) })).toHaveCount(0);

    assertClean(diag);
  });
});

test.describe.serial("QA - Contactos: datos propios y validación de requeridos/email", () => {
  const qaContactFullName = qaTag("CONTACT");

  test("crea un contacto con datos propios y aparece en el listado", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto("/management/contacts");

    await page.getByLabel("Nombre").fill("QA");
    await page.getByLabel("Apellido").fill(qaContactFullName);
    await page.getByLabel("Email").fill(qaEmailFor("contact"));
    await page.getByLabel("Teléfono").fill("+52 55 8765-4321");
    await page.getByRole("button", { name: "Crear contacto" }).click();

    // Unlike suppliers/contracts/computers/software, contacts have NO detail page and the list
    // row is plain text, not a link (confirmed by reading contacts/page.tsx - no <Link> wrapper) -
    // so persistence can only be confirmed via the <li> row text itself.
    await expect(page.locator("li", { hasText: qaContactFullName })).toBeVisible();

    assertClean(diag);
  });

  test("'Apellido' vacío (con nombre completo) bloquea el envío nativamente y no crea el contacto", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto("/management/contacts");

    await page.getByLabel("Nombre").fill("QA sin apellido");
    // Apellido left empty on purpose - the other required field alongside "Nombre".
    await page.getByRole("button", { name: "Crear contacto" }).click();

    const lastNameInput = page.getByLabel("Apellido");
    const validity = await lastNameInput.evaluate((el: HTMLInputElement) => ({ valid: el.validity.valid, valueMissing: el.validity.valueMissing }));
    expect(validity).toEqual({ valid: false, valueMissing: true });
    await expect(page.locator("li", { hasText: "QA sin apellido" })).toHaveCount(0);

    assertClean(diag);
  });

  test("un email con formato inválido bloquea el envío nativamente y no crea el contacto", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto("/management/contacts");

    const bogusLastName = qaTag("CONTACT-SHOULD-NOT-EXIST");
    const emailInput = page.getByLabel("Email");
    await page.getByLabel("Nombre").fill("QA");
    await page.getByLabel("Apellido").fill(bogusLastName);
    await emailInput.fill("not-an-email");
    await page.getByRole("button", { name: "Crear contacto" }).click();

    const validity = await emailInput.evaluate((el: HTMLInputElement) => ({ valid: el.validity.valid, typeMismatch: el.validity.typeMismatch }));
    expect(validity).toEqual({ valid: false, typeMismatch: true });
    await expect(page.locator("li", { hasText: bogusLastName })).toHaveCount(0);

    assertClean(diag);
  });
});

test.describe.serial("QA - Contratos: datos propios y validación de campos numéricos/fecha", () => {
  const qaContractName = qaTag("CONTRACT");

  test("crea un contrato con datos propios (tipo/facturación distintos a la fixture E2E-) y aparece en el listado", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto("/management/contracts");

    await page.getByLabel("Nombre").fill(qaContractName);
    await page.getByLabel("Tipo").selectOption("support");
    await page.getByLabel("Facturación").selectOption("annual");
    await page.getByLabel("Inicio").fill("2026-02-01");
    await page.getByLabel("Fin").fill("2027-01-31");
    await page.getByLabel("Costo").fill("4999.5");
    await page.getByRole("button", { name: "Crear contrato" }).click();

    const link = page.getByRole("link", { name: new RegExp(qaContractName) });
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForURL(/\/management\/contracts\/[0-9a-f-]{36}$/i);

    await expect(page.getByRole("heading", { level: 1, name: qaContractName })).toBeVisible();
    await expect(page.getByText("support")).toBeVisible();
    await expect(page.getByText("annual")).toBeVisible();
    await expect(page.getByText("$4999.50")).toBeVisible();

    assertClean(diag);
  });

  test("Costo: letras tecleadas no se registran, y un valor negativo es bloqueado por la restricción min=0 del input", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto("/management/contracts");

    const costInput = page.getByLabel("Costo");

    // (b) wrong-type: a real user typing letters into a type=number input never gets them
    // registered - Chromium filters non-numeric keystrokes at the keyboard-event level, verified
    // manually. .pressSequentially() simulates real keystrokes (.fill() would throw outright).
    await costInput.pressSequentially("abc");
    expect(await costInput.inputValue()).toBe("");

    await costInput.fill("-50");
    const negativeValidity = await costInput.evaluate((el: HTMLInputElement) => ({ valid: el.validity.valid, rangeUnderflow: el.validity.rangeUnderflow }));
    expect(negativeValidity).toEqual({ valid: false, rangeUnderflow: true });

    const bogusName = qaTag("CONTRACT-SHOULD-NOT-EXIST");
    await page.getByLabel("Nombre").fill(bogusName);
    await page.getByRole("button", { name: "Crear contrato" }).click();

    await expect(page).toHaveURL(/\/management\/contracts$/);
    await expect(page.getByRole("link", { name: new RegExp(bogusName) })).toHaveCount(0);

    assertClean(diag);
  });

  test("texto no-fecha tecleado en 'Inicio' es descartado por el input date (queda vacío, sigue siendo válido por ser opcional)", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto("/management/contracts");

    const startDateInput = page.getByLabel("Inicio");
    // Real user keystrokes (not .fill(), which Playwright itself rejects with "Malformed value"
    // for a non-parseable date string). Verified manually: the segmented date widget has no digit
    // keys to place from "not-a-date", so it silently discards all of it.
    await startDateInput.pressSequentially("not-a-date");
    expect(await startDateInput.inputValue()).toBe("");
    expect(await startDateInput.evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(true);

    assertClean(diag);
  });
});

test.describe.serial("QA - Presupuestos: datos propios y validación de 'Monto' requerido", () => {
  const qaBudgetName = qaTag("BUDGET");

  test("crea un presupuesto con datos propios y aparece en el listado con el monto correcto", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto("/management/budgets");

    await page.getByLabel("Nombre").fill(qaBudgetName);
    await page.getByLabel("Monto").fill("12500.75");
    await page.getByRole("button", { name: "Crear presupuesto" }).click();

    const row = page.locator("li").filter({ hasText: qaBudgetName });
    await expect(row).toBeVisible();
    await expect(row).toContainText("$12500.75");

    assertClean(diag);
  });

  test("'Monto' vacío bloquea el envío nativamente (required), y letras tecleadas nunca llegan a registrarse", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto("/management/budgets");

    const amountInput = page.getByLabel("Monto");
    const bogusName = qaTag("BUDGET-SHOULD-NOT-EXIST");
    await page.getByLabel("Nombre").fill(bogusName);
    // Monto left empty on purpose.
    await page.getByRole("button", { name: "Crear presupuesto" }).click();

    const emptyValidity = await amountInput.evaluate((el: HTMLInputElement) => ({ valid: el.validity.valid, valueMissing: el.validity.valueMissing }));
    expect(emptyValidity).toEqual({ valid: false, valueMissing: true });
    await expect(page.locator("li").filter({ hasText: bogusName })).toHaveCount(0);

    // (b) wrong-type: letters typed key-by-key into this type=number input never register either -
    // it collapses to the exact same valueMissing failure as leaving it empty outright.
    await amountInput.pressSequentially("abc");
    expect(await amountInput.inputValue()).toBe("");

    // A negative monto is syntactically numeric but blocked by the min="0" constraint.
    await amountInput.fill("-100");
    const negativeValidity = await amountInput.evaluate((el: HTMLInputElement) => ({ valid: el.validity.valid, rangeUnderflow: el.validity.rangeUnderflow }));
    expect(negativeValidity).toEqual({ valid: false, rangeUnderflow: true });

    assertClean(diag);
  });
});

test.describe.serial("QA - Certificados: datos propios y validación de fechas", () => {
  const qaCertificateName = qaTag("CERT");

  test("crea un certificado con datos propios (tipo 'Firma de código' y fechas reales) y aparece en el listado", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto("/management/certificates");

    await page.getByLabel("Nombre").fill(qaCertificateName);
    await page.getByLabel("Tipo").selectOption("code_signing");
    await page.getByLabel("Emisor").fill("QA Certificate Authority");
    await page.getByLabel("Número de serie").fill(qaTag("CERT-SN"));
    await page.getByLabel("Válido desde").fill("2026-01-01");
    await page.getByLabel("Válido hasta").fill("2027-01-01");
    await page.getByRole("button", { name: "Crear certificado" }).click();

    const row = page.locator("li").filter({ hasText: qaCertificateName });
    await expect(row).toBeVisible();
    await expect(row).toContainText("Firma de código");
    await expect(row).toContainText("vence");

    assertClean(diag);
  });

  test("texto no-fecha tecleado en 'Válido desde' es descartado por el input date (queda vacío, sigue siendo válido por ser opcional)", async ({ page }) => {
    const diag = attachDiagnostics(page);
    await page.goto("/management/certificates");

    const validFromInput = page.getByLabel("Válido desde");
    await validFromInput.pressSequentially("not-a-date");
    expect(await validFromInput.inputValue()).toBe("");
    expect(await validFromInput.evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(true);

    // Confirm the silent discard doesn't corrupt an otherwise-valid submission alongside it - the
    // certificate is still created successfully, just without a "Válido desde" date.
    const name = qaTag("CERT-BADDATE");
    await page.getByLabel("Nombre").fill(name);
    await page.getByRole("button", { name: "Crear certificado" }).click();
    await expect(page.locator("li").filter({ hasText: name })).toBeVisible();

    assertClean(diag);
  });
});

test.describe.serial("QA - Consumibles: datos propios (con proveedor) y validación real de 'Cantidad'", () => {
  const qaSupplierForConsumable = qaTag("SUP-FOR-CONS");
  const qaItemName = qaTag("CONS");
  let qaItemId = "";

  test("crea un proveedor y un item de consumible con datos propios vinculado a él", async ({ page }) => {
    const diag = attachDiagnostics(page);

    await page.goto("/management/suppliers");
    await page.getByLabel("Nombre").fill(qaSupplierForConsumable);
    await page.getByRole("button", { name: "Crear proveedor" }).click();
    await expect(page.getByRole("link", { name: new RegExp(qaSupplierForConsumable) })).toBeVisible();

    await page.goto("/management/consumables");
    await page.getByLabel("Nombre").fill(qaItemName);
    await page.getByLabel("Proveedor").selectOption({ label: qaSupplierForConsumable });
    await page.getByLabel("Umbral de alerta (stock bajo)").fill("5");
    await page.getByLabel("Comentario").fill("Tóner creado por la pasada de QA de Gestión.");
    await page.getByRole("button", { name: "Crear consumible" }).click();

    const link = page.getByRole("link", { name: qaItemName });
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForURL(/\/management\/consumables\/[0-9a-f-]{36}$/i);
    qaItemId = extractIdFromUrl(page.url());

    await expect(page.getByRole("heading", { level: 1, name: qaItemName })).toBeVisible();
    await expect(page.getByText("Umbral de alerta")).toBeVisible();

    assertClean(diag);
  });

  test("Cantidad: letras tecleadas no se registran, y 0/1001 son bloqueados por las restricciones min=1/max=1000 del input", async ({ page }) => {
    test.skip(!qaItemId, "El item de consumible QA no se creó en el paso anterior");

    const diag = attachDiagnostics(page);
    await page.goto(`/management/consumables/${qaItemId}`);

    const quantity = page.getByLabel("Cantidad");

    // (b) wrong-type: verified manually - letters typed key-by-key into a type=number input never
    // register (.fill() itself throws for this, so real keystrokes are simulated instead). This
    // field defaults to "1" (unlike intervalMinutes/portsCount which default to empty), so the
    // real observed behavior is that the pre-filled "1" is left untouched, not cleared to "".
    await expect(quantity).toHaveValue("1");
    await quantity.pressSequentially("abc");
    expect(await quantity.inputValue()).toBe("1");

    await quantity.fill("0");
    const belowMin = await quantity.evaluate((el: HTMLInputElement) => ({ valid: el.validity.valid, rangeUnderflow: el.validity.rangeUnderflow }));
    expect(belowMin).toEqual({ valid: false, rangeUnderflow: true });

    await quantity.fill("1001");
    const aboveMax = await quantity.evaluate((el: HTMLInputElement) => ({ valid: el.validity.valid, rangeOverflow: el.validity.rangeOverflow }));
    expect(aboveMax).toEqual({ valid: false, rangeOverflow: true });

    // (a) confirm neither out-of-range value ever reached the server: no extra units were added.
    await page.getByRole("button", { name: "Agregar unidades" }).click();
    await expect(page).toHaveURL(new RegExp(`/management/consumables/${qaItemId}$`));
    await expect(page.locator("li").filter({ hasText: "Nuevo" })).toHaveCount(0);

    // Confirm a real, in-range value right after the blocked attempts still submits correctly -
    // the native validation above doesn't leave the input or the form in a broken state. This also
    // avoids leaving this QA item stuck at 0 units forever (there is no delete UI for consumable
    // items - see file header comment - so a permanently-zero-stock item would otherwise pollute
    // any future test that asserts on "(0 disponibles)" against the whole page).
    await quantity.fill("2");
    await page.getByRole("button", { name: "Agregar unidades" }).click();
    await expect(page.locator("li").filter({ hasText: "Nuevo" })).toHaveCount(2);

    assertClean(diag);
  });
});
