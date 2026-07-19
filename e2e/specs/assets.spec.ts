import { test, expect, type Page } from "@playwright/test";

/**
 * E2E - módulo "Activos" (/assets/**).
 *
 * Alcance real de la UI verificado leyendo el código antes de escribir estos
 * tests (apps/web/app/(central)/assets/**):
 *
 * - Los tipos "core" sin tabla de extensión (monitor, printer, phone, rack,
 *   etc.) sólo tienen alta + listado en /assets/[assetType] - NO existe
 *   página de detalle ni edición para ellos en esta versión. Por eso el
 *   flujo del activo genérico ("Monitor") termina en el listado, no entra a
 *   ningún detalle.
 * - Computer y Software sí tienen página de detalle propia
 *   (/assets/computers/[id], /assets/software/[id]), pero tampoco exponen
 *   edición de sus campos propios (nombre/serie/etc.) ni borrado - sólo
 *   alta de sub-recursos (componentes, instalaciones, versiones, licencias).
 *   `updateAssetAction`/`softDeleteAssetAction`/`restoreAssetAction`/
 *   `purgeAssetAction` existen en actions/assets.actions.ts pero no están
 *   conectados a ninguna UI (ver hallazgos reportados aparte).
 * - Sí hay borrado real en la UI para relaciones/posiciones: quitar un
 *   activo de un rack (RemoveFromRackButton) y quitar una relación de
 *   impacto (RemoveImpactRelationButton) - ambos se prueban de punta a
 *   punta, incluida la limpieza.
 * - La ruta /assets/dcim/racks/[assetId] no valida que el asset sea
 *   realmente de tipo "rack" (getAsset(assetId) genérico, ver hallazgos),
 *   así que reutilizamos los Computer creados en este archivo (que sí
 *   exponen su id vía URL de detalle) como "contenedor" y "ocupante" para
 *   ejercitar el flujo de slots sin depender de acceso directo a la base de
 *   datos ni de un tipo genérico que no tiene id visible en la UI.
 *
 * Datos de dropdowns (os, network_equipment_type, cable_type, manufacturer,
 * location) NO tienen items sembrados en un entorno fresco - sólo "status"
 * los tiene. Los tests son defensivos con esos selects: seleccionan una
 * opción real sólo si existe más allá del placeholder, pero siempre
 * verifican que el campo sea del tipo correcto (select/number/date).
 */

function uniqueName(prefix: string): string {
  return `E2E-ASSETS-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Distinct, still-greppable prefix for the self-authored test data added in this QA pass (own
 * values, not copy-pasted from the E2E-ASSETS-* fixtures above) - kept separate so either
 * generation can be identified/cleaned up independently. Same construction as uniqueName() above,
 * just a different literal prefix per this pass's task instructions.
 */
function qaUniqueName(prefix: string): string {
  return `QA-ASSETS-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Compartidas entre describes (el orden de declaración en este archivo
// determina el orden de ejecución real, ya que playwright.config.ts usa
// fullyParallel:false + workers:1): el describe de "Software" llena
// sharedSoftwareName, el de "Computer" llena las 4 de computer A/B, y los de
// "DCIM" e "Impacto" las consumen. Ver cada describe.serial más abajo.
let sharedSoftwareName: string;
let sharedComputerAId: string;
let sharedComputerAName: string;
let sharedComputerBId: string;
let sharedComputerBName: string;

function watchPageHealth(page: Page) {
  const consoleErrors: string[] = [];
  const badResponses: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(`pageerror: ${err.message}`);
  });
  page.on("response", (response) => {
    const status = response.status();
    if (status >= 400 && !response.url().includes("favicon")) {
      badResponses.push(`${status} ${response.request().method()} ${response.url()}`);
    }
  });

  return {
    assertHealthy() {
      expect(consoleErrors, `Errores de consola detectados:\n${consoleErrors.join("\n")}`).toEqual([]);
      expect(badResponses, `Respuestas HTTP >=400 detectadas:\n${badResponses.join("\n")}`).toEqual([]);
    },
  };
}

/** No hay ningún AssetFieldDefinition sembrado hoy (confirmado contra la DB),
 * pero el formulario genérico soporta campos dinámicos - esto llena
 * cualquiera que aparezca, respetando su tipo real (select/number/date/
 * texto/checkbox), para no romper si en el futuro se agregan campos. */
async function fillDynamicAssetFields(page: Page) {
  const dynamicFields = page.locator('[name^="field_"]');
  const count = await dynamicFields.count();
  for (let i = 0; i < count; i++) {
    const field = dynamicFields.nth(i);
    const tag = await field.evaluate((node) => node.tagName.toLowerCase());
    if (tag === "select") {
      const optionsCount = await field.locator("option").count();
      if (optionsCount > 1) await field.selectOption({ index: 1 });
      continue;
    }
    const type = await field.getAttribute("type");
    if (type === "checkbox") continue;
    if (type === "number") {
      await field.fill("1");
    } else if (type === "date") {
      await field.fill("2026-01-01");
    } else {
      await field.fill("Valor de campo dinámico E2E");
    }
  }
}

async function assertNoInlineFormError(page: Page) {
  await expect(page.locator("p.text-red-600")).toHaveCount(0);
}

/** Extrae el último segmento de la URL actual (el id de la ruta dinámica). */
async function idFromUrl(page: Page): Promise<string> {
  const pathname = new URL(page.url()).pathname;
  const segments = pathname.split("/").filter(Boolean);
  const last = segments.at(-1);
  if (!last) throw new Error(`No se pudo extraer un id de la URL actual: ${page.url()}`);
  return last;
}

test.describe("Activos - páginas de listado", () => {
  test("/assets (índice general) carga con buscador y tabla", async ({ page }) => {
    const health = watchPageHealth(page);
    await page.goto("/assets");

    await expect(page.getByRole("heading", { name: "Todos los activos", level: 1 })).toBeVisible();
    await expect(page.locator('input[name="q"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Buscar" })).toBeVisible();
    await expect(page.locator("table thead th")).toHaveText(["Nombre", "Tipo", "Serie", "Inventario"]);
    await expect(page.getByText("Ir a un tipo específico")).toBeVisible();

    health.assertHealthy();
  });

  test("/assets/monitor (tipo genérico) carga con lista y formulario de alta", async ({ page }) => {
    const health = watchPageHealth(page);
    await page.goto("/assets/monitor");

    await expect(page.getByRole("heading", { name: "Monitor", level: 1 })).toBeVisible();
    await expect(page.getByText("Instancias existentes")).toBeVisible();
    await expect(page.getByText("Nuevo monitor")).toBeVisible();
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="serialNumber"]')).toBeVisible();
    await expect(page.locator('input[name="inventoryNumber"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Crear" })).toBeVisible();

    health.assertHealthy();
  });

  test("/assets/computers carga con lista y formulario de alta", async ({ page }) => {
    const health = watchPageHealth(page);
    await page.goto("/assets/computers");

    await expect(page.getByRole("heading", { name: "Computadoras", level: 1 })).toBeVisible();
    await expect(page.getByText("Nueva computadora")).toBeVisible();
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('select[name="osDropdownItemId"]')).toBeVisible();
    await expect(page.locator('input[name="domain"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Crear computadora" })).toBeVisible();

    health.assertHealthy();
  });

  test("/assets/network-equipment carga con lista y formulario de alta", async ({ page }) => {
    const health = watchPageHealth(page);
    await page.goto("/assets/network-equipment");

    await expect(page.getByRole("heading", { name: "Equipos de red", level: 1 })).toBeVisible();
    await expect(page.getByText("Nuevo equipo de red")).toBeVisible();
    await expect(page.locator('select[name="deviceTypeDropdownItemId"]')).toBeVisible();
    await expect(page.locator('input[name="ipAddress"]')).toBeVisible();
    await expect(page.locator('input[name="macAddress"]')).toBeVisible();
    await expect(page.locator('input[name="portsCount"]')).toHaveAttribute("type", "number");
    await expect(page.getByRole("button", { name: "Crear equipo de red" })).toBeVisible();

    health.assertHealthy();
  });

  test("/assets/software carga con lista y formulario de alta", async ({ page }) => {
    const health = watchPageHealth(page);
    await page.goto("/assets/software");

    await expect(page.getByRole("heading", { name: "Software", level: 1 })).toBeVisible();
    await expect(page.getByText("Nuevo software")).toBeVisible();
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Crear software" })).toBeVisible();

    health.assertHealthy();
  });

  test("/assets/dcim (índice) carga", async ({ page }) => {
    const health = watchPageHealth(page);
    await page.goto("/assets/dcim");

    await expect(page.getByRole("heading", { name: "DCIM", level: 1 })).toBeVisible();
    // getByText("Racks") matches 3 elements (intro paragraph, "Racks" h2, empty-state li) - use the heading role.
    await expect(page.getByRole("heading", { name: "Racks", level: 2 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver todos los cables" })).toBeVisible();

    health.assertHealthy();
  });

  test("/assets/dcim/cables carga con lista y formulario de alta", async ({ page }) => {
    const health = watchPageHealth(page);
    await page.goto("/assets/dcim/cables");

    await expect(page.getByRole("heading", { name: "Cables", level: 1 })).toBeVisible();
    await expect(page.getByText("Nuevo cable")).toBeVisible();
    await expect(page.locator('select[name="endpointAAssetId"]')).toBeVisible();
    await expect(page.locator('select[name="endpointBAssetId"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Crear cable" })).toBeVisible();

    health.assertHealthy();
  });
});

test.describe.serial("Software - alta, versión y licencia", () => {
  const softwareName = uniqueName("SOFTWARE");
  const versionName = "1.0";
  let softwareId: string;

  test("crea software y aparece en el listado", async ({ page }) => {
    const health = watchPageHealth(page);

    await test.step("navegar y crear", async () => {
      await page.goto("/assets/software");
      await page.locator('input[name="name"]').fill(softwareName);
      await page.locator('textarea[name="comment"]').fill("Software creado por E2E de Activos");
      await page.getByRole("button", { name: "Crear software" }).click();
    });

    await test.step("verificar en el listado y entrar al detalle", async () => {
      await assertNoInlineFormError(page);
      const link = page.getByRole("link", { name: softwareName });
      await expect(link).toBeVisible();
      await link.click();
      await page.waitForURL(/\/assets\/software\/[^/]+$/);
      softwareId = await idFromUrl(page);
      await expect(page.getByRole("heading", { name: softwareName, level: 1 })).toBeVisible();
    });

    health.assertHealthy();
  });

  test("agrega una versión y persiste tras recargar", async ({ page }) => {
    const health = watchPageHealth(page);
    await page.goto(`/assets/software/${softwareId}`);

    // En esta página hay dos formularios y ambos tienen un input name="name"
    // (versión y licencia) - se distinguen porque sólo el de licencia tiene
    // el select licenseType.
    const versionForm = page.locator("form").filter({ has: page.locator('input[name="name"]') }).filter({
      hasNot: page.locator('select[name="licenseType"]'),
    });

    await versionForm.locator('input[name="name"]').fill(versionName);
    await versionForm.getByRole("button", { name: "Agregar" }).click();
    await assertNoInlineFormError(page);
    // getByText(versionName) also matches the <option> of the license form's version
    // select once it exists - scope to the versions list item specifically.
    const versionListItem = page.getByRole("listitem").filter({ hasText: versionName });
    await expect(versionListItem).toBeVisible();

    await page.reload();
    await expect(versionListItem).toBeVisible();

    health.assertHealthy();
  });

  test("agrega una licencia con tipo y versión reales, y verifica asientos", async ({ page }) => {
    const health = watchPageHealth(page);
    await page.goto(`/assets/software/${softwareId}`);

    const licenseForm = page.locator("form").filter({ has: page.locator('select[name="licenseType"]') });

    // Tipo de licencia: select con enum fijo en el código (siempre real,
    // independiente del estado de la DB).
    await expect(licenseForm.locator('select[name="licenseType"]')).toBeVisible();
    const licenseTypeOptions = await licenseForm.locator('select[name="licenseType"] option').allTextContents();
    expect(licenseTypeOptions).toEqual(["per_seat", "per_device", "volume", "subscription", "oem", "freeware"]);

    await licenseForm.locator('input[name="name"]').fill(`Licencia ${softwareName}`);
    await licenseForm.locator('select[name="licenseType"]').selectOption("per_seat");
    await licenseForm.locator('select[name="softwareVersionId"]').selectOption({ label: versionName });
    await expect(licenseForm.locator('input[name="seatsTotal"]')).toHaveAttribute("type", "number");
    await licenseForm.locator('input[name="seatsTotal"]').fill("10");
    await licenseForm.locator('input[name="serialNumber"]').fill("LIC-SN-0001");
    await licenseForm.getByRole("button", { name: "Crear licencia" }).click();

    await assertNoInlineFormError(page);
    await expect(page.getByText(`Licencia ${softwareName}`)).toBeVisible();
    await expect(page.getByText("0/10 asientos")).toBeVisible();

    await page.reload();
    await expect(page.getByText(`Licencia ${softwareName}`)).toBeVisible();
    await expect(page.getByText("0/10 asientos")).toBeVisible();

    health.assertHealthy();
  });

  test.afterAll(() => {
    sharedSoftwareName = softwareName;
  });
});

test.describe.serial("Computer - alta, componente, software instalado y activo secundario", () => {
  const computerAName = uniqueName("COMPUTER-A");
  const computerBName = uniqueName("COMPUTER-B");
  // assets.inventory_number has a real unique constraint (assets_inventory_number_unique) -
  // a literal value here would collide with a leftover row from any prior run (there's no
  // delete UI for computers, see finding below), so these must be unique per run too.
  const computerASerial = uniqueName("SN-COMPUTER-A");
  const computerAInventory = uniqueName("INV-COMPUTER-A");
  let computerAId: string;
  let computerBId: string;

  test("crea una computadora y aparece en el listado", async ({ page }) => {
    const health = watchPageHealth(page);

    await test.step("navegar y crear", async () => {
      await page.goto("/assets/computers");
      await page.locator('input[name="name"]').fill(computerAName);
      await page.locator('input[name="serialNumber"]').fill(computerASerial);
      await page.locator('input[name="inventoryNumber"]').fill(computerAInventory);

      // Select real de SO: sin items sembrados en un entorno fresco, sólo
      // validamos que sea un <select> y, si hubiera opciones reales más
      // allá del placeholder, elegimos una.
      const osSelect = page.locator('select[name="osDropdownItemId"]');
      await expect(osSelect).toBeVisible();
      const osOptionsCount = await osSelect.locator("option").count();
      if (osOptionsCount > 1) await osSelect.selectOption({ index: 1 });

      await page.locator('input[name="domain"]').fill("e2e.local");
      await page.locator('textarea[name="comment"]').fill("Computadora creada por E2E de Activos");
      await page.getByRole("button", { name: "Crear computadora" }).click();
    });

    await test.step("verificar en el listado y entrar al detalle", async () => {
      await assertNoInlineFormError(page);
      const link = page.getByRole("link", { name: computerAName });
      await expect(link).toBeVisible();
      await link.click();
      await page.waitForURL(/\/assets\/computers\/[^/]+$/);
      computerAId = await idFromUrl(page);
      await expect(page.getByRole("heading", { name: computerAName, level: 1 })).toBeVisible();
      await expect(page.getByText(computerASerial)).toBeVisible();
      await expect(page.getByText("e2e.local")).toBeVisible();
    });

    health.assertHealthy();
  });

  test("agrega un componente y persiste tras recargar", async ({ page }) => {
    const health = watchPageHealth(page);
    await page.goto(`/assets/computers/${computerAId}`);

    const componentForm = page.locator("form").filter({ has: page.locator('select[name="componentType"]') });

    const componentTypeOptions = await componentForm.locator('select[name="componentType"] option').allTextContents();
    expect(componentTypeOptions).toEqual(["cpu", "ram", "disk", "gpu", "psu", "motherboard", "nic", "other"]);

    await componentForm.locator('select[name="componentType"]').selectOption("ram");
    await componentForm.locator('input[name="name"]').fill("Kingston Fury 32GB");
    await expect(componentForm.locator('input[name="quantity"]')).toHaveAttribute("type", "number");
    await componentForm.locator('input[name="quantity"]').fill("2");
    await expect(componentForm.locator('input[name="capacityValue"]')).toHaveAttribute("type", "number");
    await componentForm.locator('input[name="capacityValue"]').fill("32");
    await componentForm.locator('input[name="capacityUnit"]').fill("GB");
    await componentForm.locator('input[name="serialNumber"]').fill("SN-RAM-0001");
    await componentForm.getByRole("button", { name: "Agregar componente" }).click();

    await assertNoInlineFormError(page);
    await expect(page.getByText("Kingston Fury 32GB (ram, 32GB x2)")).toBeVisible();

    await page.reload();
    await expect(page.getByText("Kingston Fury 32GB (ram, 32GB x2)")).toBeVisible();

    health.assertHealthy();
  });

  test("instala el software creado antes y lo ve reflejado sin recarga dura", async ({ page }) => {
    const health = watchPageHealth(page);
    await page.goto(`/assets/computers/${computerAId}`);

    const installForm = page.locator("form").filter({ has: page.locator('select[name="softwareVersionId"]') });
    await expect(installForm.getByRole("button", { name: "Instalar" })).toBeEnabled();

    // La versión de software creada en el describe "Software" de este mismo
    // archivo se busca por el texto compuesto exacto "<nombre software> 1.0"
    // que arma el propio server component (versionLabels). Se usa el nombre
    // exacto (con su timestamp único) y no un prefijo genérico, para no
    // levantar por error una versión de una corrida anterior de este mismo
    // spec que haya quedado en la DB compartida.
    const ownVersionLabel = `${sharedSoftwareName} 1.0`;
    const versionSelect = installForm.locator('select[name="softwareVersionId"]');
    await expect(versionSelect.locator("option", { hasText: ownVersionLabel })).toHaveCount(1);
    await versionSelect.selectOption({ label: ownVersionLabel });
    await installForm.getByRole("button", { name: "Instalar" }).click();

    await assertNoInlineFormError(page);
    // Sin recarga: valida que la UI refleje la instalación en la misma
    // respuesta de la Server Action (createInstallationAction ahora
    // revalida /assets/computers/[id], ver actions/software.actions.ts).
    // getByText also matches the install form's own <option> with the same label -
    // scope to the installed-software list item specifically.
    const installedListItem = page.getByRole("listitem").filter({ hasText: ownVersionLabel });
    await expect(installedListItem).toBeVisible();

    await page.reload();
    await expect(installedListItem).toBeVisible();

    health.assertHealthy();
  });

  test("crea una segunda computadora para usarla como activo relacionado en DCIM e impacto", async ({ page }) => {
    const health = watchPageHealth(page);
    await page.goto("/assets/computers");
    await page.locator('input[name="name"]').fill(computerBName);
    await page.locator('input[name="serialNumber"]').fill("SN-COMPUTER-B");
    await page.getByRole("button", { name: "Crear computadora" }).click();

    await assertNoInlineFormError(page);
    const link = page.getByRole("link", { name: computerBName });
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForURL(/\/assets\/computers\/[^/]+$/);
    computerBId = await idFromUrl(page);

    health.assertHealthy();
  });

  test.afterAll(() => {
    sharedComputerAId = computerAId;
    sharedComputerAName = computerAName;
    sharedComputerBId = computerBId;
    sharedComputerBName = computerBName;
  });
});

// Los describes de DCIM e Impacto necesitan dos ids de "assets" reales
// obtenidos 100% vía UI (los Computer de arriba son los únicos tipos, junto
// con Software, que exponen un id navegable - ver nota de alcance al inicio
// del archivo). Se comparten vía las variables declaradas al inicio del
// archivo en vez de anidar todo en un único describe.serial gigante, para
// mantener cada bloque legible y con su propio título en el reporte. El
// orden de declaración en este archivo determina el orden de ejecución real
// (fullyParallel:false + workers:1 en playwright.config.ts), así que estos
// describes deben quedar después del de "Computer" de arriba.

test.describe("DCIM - ubicar/quitar en rack y crear cable", () => {
  test("ubica un activo en un rack y luego lo quita", async ({ page }) => {
    const health = watchPageHealth(page);

    // /assets/dcim/racks/[assetId] no valida que el asset sea de tipo
    // "rack" (ver hallazgo reportado) - se usa el Computer A como
    // "contenedor" y el Computer B como "ocupante" para probar el flujo de
    // slots de punta a punta sin depender de acceso directo a la DB.
    await page.goto(`/assets/dcim/racks/${sharedComputerAId}`);
    await expect(page.getByRole("heading", { name: sharedComputerAName, level: 1 })).toBeVisible();
    await expect(page.getByText("Sin posiciones ocupadas todavía.")).toBeVisible();

    const placeForm = page.locator("form").filter({ has: page.locator('select[name="occupantAssetId"]') });
    await placeForm.locator('select[name="occupantAssetId"]').selectOption({ label: sharedComputerBName });
    await expect(placeForm.locator('input[name="positionU"]')).toHaveAttribute("type", "number");
    await placeForm.locator('input[name="positionU"]').fill("1");
    await expect(placeForm.locator('input[name="unitHeight"]')).toHaveAttribute("type", "number");
    await placeForm.locator('input[name="unitHeight"]').fill("2");

    const orientationOptions = await placeForm.locator('select[name="orientation"] option').allTextContents();
    expect(orientationOptions).toEqual(["Frontal", "Trasera"]);
    await placeForm.locator('select[name="orientation"]').selectOption("rear");

    await placeForm.getByRole("button", { name: "Ubicar en rack" }).click();
    await assertNoInlineFormError(page);

    // Se comparan celdas puntuales (no el texto completo de la fila): el
    // nombre único del activo (con su timestamp) ya contiene dígitos, así
    // que un toContainText("1")/toContainText("2") sobre toda la fila
    // pasaría "de gratis" sin validar realmente positionU/unitHeight.
    const row = page.getByRole("row", { name: new RegExp(sharedComputerBName) });
    const cells = row.locator("td");
    await expect(cells.nth(0)).toHaveText("1"); // U
    await expect(cells.nth(1)).toHaveText("2"); // Altura
    await expect(cells.nth(2)).toHaveText("rear"); // Orientación
    await expect(cells.nth(3)).toHaveText(sharedComputerBName); // Ocupante

    // Limpieza: quitar del rack (borrado real disponible en la UI).
    await row.getByRole("button", { name: "Quitar" }).click();
    await expect(page.getByText("Sin posiciones ocupadas todavía.")).toBeVisible();
    await expect(page.getByRole("row", { name: new RegExp(sharedComputerBName) })).toHaveCount(0);

    health.assertHealthy();
  });

  test("crea un cable entre dos activos reales", async ({ page }) => {
    const health = watchPageHealth(page);
    const cableName = uniqueName("CABLE");

    await page.goto("/assets/dcim/cables");
    await page.locator('input[name="name"]').fill(cableName);
    await page.locator('select[name="endpointAAssetId"]').selectOption({ label: sharedComputerAName });
    await page.locator('select[name="endpointBAssetId"]').selectOption({ label: sharedComputerBName });

    // Tipo de cable depende de dropdown items que no están sembrados en un
    // entorno fresco - el select ni siquiera se renderiza cuando no hay
    // opciones (ver cable-form.tsx), así que es condicional.
    const cableTypeSelect = page.locator('select[name="cableTypeDropdownItemId"]');
    if (await cableTypeSelect.count()) {
      const options = await cableTypeSelect.locator("option").count();
      if (options > 1) await cableTypeSelect.selectOption({ index: 1 });
    }

    await page.locator('textarea[name="comment"]').fill("Cable creado por E2E de Activos");
    await page.getByRole("button", { name: "Crear cable" }).click();

    await assertNoInlineFormError(page);
    await expect(page.getByText(cableName, { exact: false })).toBeVisible();
    await expect(page.getByText(new RegExp(`${sharedComputerAName}.*↔.*${sharedComputerBName}`))).toBeVisible();

    health.assertHealthy();
  });
});

test.describe("Análisis de impacto", () => {
  test("agrega una relación de impacto entre dos activos reales y luego la quita", async ({ page }) => {
    const health = watchPageHealth(page);

    await page.goto(`/assets/impact/${sharedComputerAId}`);
    await expect(page.getByRole("heading", { name: `Análisis de impacto: ${sharedComputerAName}`, level: 1 })).toBeVisible();
    await expect(page.getByText("Sin relaciones directas todavía.")).toBeVisible();

    const relationForm = page.locator("form").filter({ has: page.locator('select[name="relatedAssetId"]') });
    await relationForm.locator('select[name="relatedAssetId"]').selectOption({ label: sharedComputerBName });

    const directionOptions = await relationForm.locator('select[name="relationDirection"] option').allTextContents();
    expect(directionOptions).toEqual(["Este activo depende de...", "Este activo es dependencia de..."]);
    await relationForm.locator('select[name="relationDirection"]').selectOption("depende_de");
    await relationForm.locator('input[name="label"]').fill("conexión de red");

    await relationForm.getByRole("button", { name: "Agregar relación" }).click();
    await assertNoInlineFormError(page);

    await expect(page.getByText(`Depende de ${sharedComputerBName}`)).toBeVisible();
    await expect(page.getByText("conexión de red")).toBeVisible();

    // Limpieza: quitar la relación (borrado real disponible en la UI).
    await page
      .locator("li", { hasText: `Depende de ${sharedComputerBName}` })
      .getByRole("button", { name: "Quitar" })
      .click();
    await expect(page.getByText("Sin relaciones directas todavía.")).toBeVisible();

    health.assertHealthy();
  });
});

test.describe.serial("Activo genérico (Monitor) - alta y listado", () => {
  const monitorName = uniqueName("MONITOR");
  // Same unique-constraint reasoning as computerASerial/computerAInventory above -
  // assets.inventory_number is globally unique and there's no delete UI for this type.
  const monitorSerial = uniqueName("SN-MON");
  const monitorInventory = uniqueName("INV-MON");

  test("crea un monitor y aparece en su listado sin recarga dura", async ({ page }) => {
    const health = watchPageHealth(page);

    await page.goto("/assets/monitor");
    await page.locator('input[name="name"]').fill(monitorName);
    await page.locator('input[name="serialNumber"]').fill(monitorSerial);
    await page.locator('input[name="inventoryNumber"]').fill(monitorInventory);
    await fillDynamicAssetFields(page);
    await page.locator('textarea[name="comment"]').fill("Monitor creado por E2E de Activos");
    await page.getByRole("button", { name: "Crear" }).click();
    await page.waitForLoadState("networkidle");

    await assertNoInlineFormError(page);
    // Sin recarga: valida que la creación se refleje en la misma respuesta
    // (createAssetAction ahora revalida también /assets/[assetType], ver
    // actions/assets.actions.ts).
    await expect(page.getByText(monitorName)).toBeVisible();

    await page.reload();
    await expect(page.getByText(monitorName)).toBeVisible();

    health.assertHealthy();
  });

  test("aparece en el índice general de activos al buscarlo por nombre", async ({ page }) => {
    const health = watchPageHealth(page);
    await page.goto(`/assets?q=${encodeURIComponent(monitorName)}`);

    const row = page.getByRole("row", { name: new RegExp(monitorName) });
    await expect(row).toBeVisible();
    await expect(row).toContainText("Monitor");
    await expect(row).toContainText(monitorSerial);
    await expect(row).toContainText(monitorInventory);

    // No existe página de detalle para tipos genéricos en esta versión - no
    // hay ningún enlace desde este listado (hallazgo reportado aparte).
    await expect(row.getByRole("link")).toHaveCount(0);

    health.assertHealthy();
  });
});

/* ===========================================================================================
 * QA pass additions below: (1) own, self-authored realistic test data (QA-ASSETS-* prefix, NOT
 * copy-pasted from the E2E-ASSETS-* fixtures above) with create -> list persistence checks for
 * every create-form in this module, including network-equipment which previously had NO create
 * test at all (only a "page loads" check), and (2) data-type/required-field validation that
 * asserts the REAL observed browser behavior (via .validity, not guessed). Playwright's .fill()
 * throws outright for non-numeric text on input[type=number] ("Cannot type text into
 * input[type=number]") - that's not what a real user typing experiences, so those cases use
 * .pressSequentially() to simulate actual keystrokes instead, verified manually beforehand.
 * =========================================================================================== */

test.describe.serial("QA - Network equipment: datos propios y validación de portsCount", () => {
  const qaEquipmentName = qaUniqueName("NETEQ");

  test("crea un equipo de red con datos propios y aparece en el listado con su IP", async ({ page }) => {
    const health = watchPageHealth(page);
    await page.goto("/assets/network-equipment");

    await page.locator('input[name="name"]').fill(qaEquipmentName);
    await page.locator('input[name="ipAddress"]').fill("10.20.30.40");
    await page.locator('input[name="macAddress"]').fill("AA:BB:CC:DD:EE:01");
    await page.locator('input[name="firmwareVersion"]').fill("2.14.1");
    await page.locator('input[name="portsCount"]').fill("24");
    await page.locator('textarea[name="comment"]').fill("Switch de acceso creado por la pasada de QA de Activos.");
    await page.getByRole("button", { name: "Crear equipo de red" }).click();

    await assertNoInlineFormError(page);
    // network-equipment has no detail page (only alta + listado, see file header comment) - the
    // list row itself is the only place to confirm persistence, including the ipAddress value.
    const row = page.locator("li", { hasText: qaEquipmentName });
    await expect(row).toBeVisible();
    await expect(row).toContainText("10.20.30.40");

    await page.reload();
    const rowAfterReload = page.locator("li", { hasText: qaEquipmentName });
    await expect(rowAfterReload).toBeVisible();
    await expect(rowAfterReload).toContainText("10.20.30.40");

    health.assertHealthy();
  });

  test("portsCount: letras tecleadas no se registran, y un valor negativo es bloqueado por la restricción min=0 del input", async ({ page }) => {
    const health = watchPageHealth(page);
    await page.goto("/assets/network-equipment");

    const portsInput = page.locator('input[name="portsCount"]');

    // (b) wrong-type: a real user typing letters into a type=number input never gets them
    // registered - Chromium filters non-numeric keystrokes at the keyboard-event level, verified
    // manually. .pressSequentially() simulates real keystrokes (.fill() would throw outright).
    await portsInput.pressSequentially("abc");
    expect(await portsInput.inputValue()).toBe("");

    // A syntactically-numeric but out-of-range value (min=0) IS accepted into the field's value,
    // but fails constraint validation.
    await portsInput.fill("-3");
    const negativeValidity = await portsInput.evaluate((el: HTMLInputElement) => ({
      valid: el.validity.valid,
      rangeUnderflow: el.validity.rangeUnderflow,
    }));
    expect(negativeValidity).toEqual({ valid: false, rangeUnderflow: true });

    // Confirm the blocked value never reaches the server: fill the required name and submit
    // with portsCount=-3 still in place.
    const bogusName = qaUniqueName("NETEQ-SHOULD-NOT-EXIST");
    await page.locator('input[name="name"]').fill(bogusName);
    await page.getByRole("button", { name: "Crear equipo de red" }).click();

    await expect(page).toHaveURL(/\/assets\/network-equipment$/);
    await expect(page.locator("li", { hasText: bogusName })).toHaveCount(0);

    health.assertHealthy();
  });
});

test.describe.serial("QA - Computadoras: datos propios y validación de requerido", () => {
  const qaComputerName = qaUniqueName("COMPUTER");
  // Unique per run - assets.inventory_number has a real unique constraint and there's no delete UI.
  const qaComputerInventory = qaUniqueName("INV-COMPUTER-QA");

  test("crea una computadora con datos propios y aparece en el listado con detalle accesible", async ({ page }) => {
    const health = watchPageHealth(page);
    await page.goto("/assets/computers");

    await page.locator('input[name="name"]').fill(qaComputerName);
    await page.locator('input[name="serialNumber"]').fill(qaUniqueName("SN-COMPUTER-QA"));
    await page.locator('input[name="inventoryNumber"]').fill(qaComputerInventory);
    await page.locator('input[name="domain"]').fill("qa.example.local");
    await page.locator('textarea[name="comment"]').fill("Laptop de desarrollo asignada al equipo de QA.");
    await page.getByRole("button", { name: "Crear computadora" }).click();

    await assertNoInlineFormError(page);
    const link = page.getByRole("link", { name: qaComputerName });
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForURL(/\/assets\/computers\/[^/]+$/);
    await expect(page.getByRole("heading", { name: qaComputerName, level: 1 })).toBeVisible();
    await expect(page.getByText("qa.example.local")).toBeVisible();

    health.assertHealthy();
  });

  test("el campo 'name' vacío bloquea el envío nativamente y no crea la computadora", async ({ page }) => {
    const health = watchPageHealth(page);
    await page.goto("/assets/computers");

    const nameInput = page.locator('input[name="name"]');
    // name left empty on purpose - the only required field on this form.
    await page.locator('input[name="serialNumber"]').fill(qaUniqueName("SN-SHOULD-NOT-EXIST"));
    await page.getByRole("button", { name: "Crear computadora" }).click();

    const validity = await nameInput.evaluate((el: HTMLInputElement) => ({ valid: el.validity.valid, valueMissing: el.validity.valueMissing }));
    expect(validity).toEqual({ valid: false, valueMissing: true });
    await expect(page).toHaveURL(/\/assets\/computers$/);

    health.assertHealthy();
  });
});

test.describe.serial("QA - Software: datos propios y validación de seatsTotal en licencias", () => {
  const qaSoftwareName = qaUniqueName("SOFTWARE");
  let qaSoftwareId: string;

  test("crea un software con datos propios y aparece en el listado con detalle accesible", async ({ page }) => {
    const health = watchPageHealth(page);
    await page.goto("/assets/software");

    await page.locator('input[name="name"]').fill(qaSoftwareName);
    await page.locator('textarea[name="comment"]').fill("Suite ofimática evaluada por la pasada de QA de Activos.");
    await page.getByRole("button", { name: "Crear software" }).click();

    await assertNoInlineFormError(page);
    const link = page.getByRole("link", { name: qaSoftwareName });
    await expect(link).toBeVisible();
    await link.click();
    await page.waitForURL(/\/assets\/software\/[^/]+$/);
    qaSoftwareId = await idFromUrl(page);
    await expect(page.getByRole("heading", { name: qaSoftwareName, level: 1 })).toBeVisible();

    health.assertHealthy();
  });

  test("el campo 'name' vacío bloquea el envío nativamente y no crea el software", async ({ page }) => {
    const health = watchPageHealth(page);
    await page.goto("/assets/software");

    const nameInput = page.locator('input[name="name"]');
    await page.getByRole("button", { name: "Crear software" }).click();

    const validity = await nameInput.evaluate((el: HTMLInputElement) => ({ valid: el.validity.valid, valueMissing: el.validity.valueMissing }));
    expect(validity).toEqual({ valid: false, valueMissing: true });
    await expect(page).toHaveURL(/\/assets\/software$/);

    health.assertHealthy();
  });

  test("seatsTotal (licencia): letras tecleadas no se registran, y un valor negativo es bloqueado por la restricción min=0 del input", async ({ page }) => {
    test.skip(!qaSoftwareId, "El software QA no se creó en el paso anterior");

    const health = watchPageHealth(page);
    await page.goto(`/assets/software/${qaSoftwareId}`);

    const licenseForm = page.locator("form").filter({ has: page.locator('select[name="licenseType"]') });
    const seatsInput = licenseForm.locator('input[name="seatsTotal"]');

    // (b) wrong-type: verified manually - letters typed key-by-key into a type=number input
    // never register.
    await seatsInput.pressSequentially("abc");
    expect(await seatsInput.inputValue()).toBe("");

    await seatsInput.fill("-10");
    const negativeValidity = await seatsInput.evaluate((el: HTMLInputElement) => ({
      valid: el.validity.valid,
      rangeUnderflow: el.validity.rangeUnderflow,
    }));
    expect(negativeValidity).toEqual({ valid: false, rangeUnderflow: true });

    // Confirm the blocked value never reaches the server: fill the required name and submit
    // with seatsTotal=-10 still in place.
    const bogusLicenseName = `QA-ASSETS-LICENSE-SHOULD-NOT-EXIST-${Date.now()}`;
    await licenseForm.locator('input[name="name"]').fill(bogusLicenseName);
    await licenseForm.getByRole("button", { name: "Crear licencia" }).click();

    await expect(page).toHaveURL(new RegExp(`/assets/software/${qaSoftwareId}$`));
    await expect(page.getByText(bogusLicenseName)).toHaveCount(0);

    health.assertHealthy();
  });
});

test.describe("QA - Cables: datos propios y validación de endpoints requeridos", () => {
  test("crea un cable con datos propios entre dos activos reales y aparece en la lista", async ({ page }) => {
    const health = watchPageHealth(page);
    const qaCableName = qaUniqueName("CABLE");

    await page.goto("/assets/dcim/cables");
    await page.locator('input[name="name"]').fill(qaCableName);
    await page.locator('select[name="endpointAAssetId"]').selectOption({ label: sharedComputerAName });
    await page.locator('select[name="endpointBAssetId"]').selectOption({ label: sharedComputerBName });
    await page.locator('textarea[name="comment"]').fill("Patch cord de QA entre las dos computadoras compartidas de este spec.");
    await page.getByRole("button", { name: "Crear cable" }).click();

    await assertNoInlineFormError(page);
    // Scoped to this cable's own <li> row (by its unique name) rather than a page-wide text
    // match: the pre-existing "DCIM - ubicar/quitar en rack y crear cable" describe above already
    // created another A↔B cable between these same two shared computers, so an unscoped match on
    // "A ↔ B" text resolves to 2 elements (strict-mode violation).
    const row = page.locator("li", { hasText: qaCableName });
    await expect(row).toBeVisible();
    await expect(row).toContainText(new RegExp(`${sharedComputerAName}.*↔.*${sharedComputerBName}`));

    health.assertHealthy();
  });

  test("endpointAAssetId requerido vacío bloquea el envío nativamente y no crea el cable", async ({ page }) => {
    const health = watchPageHealth(page);
    const bogusName = qaUniqueName("CABLE-SHOULD-NOT-EXIST");

    await page.goto("/assets/dcim/cables");
    await page.locator('input[name="name"]').fill(bogusName);
    // Both endpoint <select required> start on a disabled, value="" placeholder option - a real
    // user who never touches them is left on an invalid selection (required + no valid value).
    const endpointA = page.locator('select[name="endpointAAssetId"]');
    const initialValidity = await endpointA.evaluate((el: HTMLSelectElement) => ({
      valid: el.validity.valid,
      valueMissing: el.validity.valueMissing,
    }));
    expect(initialValidity).toEqual({ valid: false, valueMissing: true });

    await page.getByRole("button", { name: "Crear cable" }).click();
    await expect(page).toHaveURL(/\/assets\/dcim\/cables$/);
    await expect(page.getByText(bogusName, { exact: false })).toHaveCount(0);

    health.assertHealthy();
  });
});

test.describe.serial("QA - DCIM (rack): datos propios vía el formulario genérico y validación de requerido", () => {
  const qaRackName = qaUniqueName("RACK");

  test("crea un rack con datos propios vía /assets/rack y aparece en el índice de DCIM", async ({ page }) => {
    const health = watchPageHealth(page);

    await page.goto("/assets/rack");
    await page.locator('input[name="name"]').fill(qaRackName);
    await page.locator('input[name="serialNumber"]').fill(qaUniqueName("SN-RACK-QA"));
    await page.locator('textarea[name="comment"]').fill("Rack de datacenter B creado por la pasada de QA de Activos.");
    await page.getByRole("button", { name: "Crear" }).click();

    await assertNoInlineFormError(page);
    await expect(page.getByText(qaRackName)).toBeVisible();

    // Generic asset types have no detail page (see file header comment), but the DCIM index page
    // links every "rack"-typed asset by name - confirms this create-form's output actually flows
    // into the DCIM module, not just into the generic /assets/rack listing.
    await page.goto("/assets/dcim");
    await expect(page.getByRole("link", { name: qaRackName })).toBeVisible();

    health.assertHealthy();
  });

  test("el campo 'name' vacío bloquea el envío nativamente y no crea el rack", async ({ page }) => {
    const health = watchPageHealth(page);
    await page.goto("/assets/rack");

    const nameInput = page.locator('input[name="name"]');
    await page.getByRole("button", { name: "Crear" }).click();

    const validity = await nameInput.evaluate((el: HTMLInputElement) => ({ valid: el.validity.valid, valueMissing: el.validity.valueMissing }));
    expect(validity).toEqual({ valid: false, valueMissing: true });
    await expect(page).toHaveURL(/\/assets\/rack$/);

    health.assertHealthy();
  });
});
