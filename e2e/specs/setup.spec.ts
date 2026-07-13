import { test, expect, type Page } from "@playwright/test";

/**
 * E2E coverage for the "Configuración" (setup) module:
 *   /setup/asset-definitions(/[id])
 *   /setup/dropdowns(/[categoryId])
 *   /setup/sla-policies
 *   /setup/notification-templates
 *   /setup/rules(/[id])
 *   /setup/inventory-agents
 *   /setup/api-clients
 *   /setup/webhooks(/[id])
 *   /setup/auth-sources
 *   /setup/service-catalog
 *   /setup/ticket-fields
 *   /setup/cron-jobs
 *
 * All specs run authenticated as admin (see e2e/auth.setup.ts + playwright.config.ts).
 *
 * Known module-wide constraint (verified by reading every action under
 * apps/web/actions/{asset-definitions,dropdowns,sla-policies,notification-templates,
 * rules,inventory,api-clients,webhooks,ldap,service-catalog,ticket-fields}.actions.ts):
 * this module is CREATE-ONLY. There is no update/delete action for dropdown
 * categories/items, asset definitions/fields, SLA policies, notification templates,
 * rules/criteria/actions, webhooks, LDAP sources, service catalog items, or ticket
 * fields. The only state-changing action beyond create is `revokeApiClientAction`
 * (soft-delete an API client) and the inventory `lockInventoryFieldAction` /
 * `acceptUnmanagedAction`. So "editar" below means the closest real analogue:
 * appending a sub-resource (rule criteria/actions) or revoking (API clients).
 * This is asserted explicitly in a couple of tests below instead of silently
 * assumed, so a regression that finally adds real edit/delete UI will surface
 * as a (welcome) test failure to update, not a silent gap.
 */

function randomSlug(): string {
  // lowercase alnum only - safe for the `/^[a-z0-9_]+$/` key regexes (dropdown
  // category key, asset-definition key, notification-template key).
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

interface Diagnostics {
  consoleErrors: string[];
  requestErrors: string[];
  assertNoConsoleErrors(): void;
  assertClean(): void;
}

/**
 * Attaches console/network listeners for the lifetime of `page` (a fresh page
 * per test, so this must be called at the top of every test that wants
 * coverage). `assertClean()` should be called once at the end of a happy-path
 * test; `assertNoConsoleErrors()` is used in the intentional-validation-error
 * tests, where a non-2xx response from the server action itself is expected
 * and not a bug.
 */
function diagnostics(page: Page): Diagnostics {
  const consoleErrors: string[] = [];
  const requestErrors: string[] = [];

  page.on("console", (msg) => {
    // Chrome auto-logs any >=400 response as a "Failed to load resource" console
    // error, duplicating what `requestErrors` (the `response` listener below)
    // already tracks from the network layer. A Server Action that throws to
    // report a validation error (see parseInput() in the actions files) always
    // surfaces as a 500 at the transport level - that's how Next.js Server
    // Actions propagate a thrown error, not a bug - so this specific browser-
    // native log line is not actionable application state and would otherwise
    // false-fail every intentional-validation-error test.
    if (msg.type() === "error" && !/^Failed to load resource:/.test(msg.text())) consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(`pageerror: ${err.message}`);
  });
  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("/_next/") || url.endsWith("/favicon.ico")) return;
    if (response.status() >= 400) {
      requestErrors.push(`${response.status()} ${url}`);
    }
  });

  return {
    consoleErrors,
    requestErrors,
    assertNoConsoleErrors() {
      expect(consoleErrors, `console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
    },
    assertClean() {
      expect(consoleErrors, `console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
      expect(requestErrors, `network errors:\n${requestErrors.join("\n")}`).toEqual([]);
    },
  };
}

// ---------------------------------------------------------------------------
// 1. Smoke: every top-level setup list page loads, shows its heading, and
//    produces no console/network errors just from navigating to it.
// ---------------------------------------------------------------------------

const SMOKE_PAGES: { path: string; heading: string }[] = [
  { path: "/setup/asset-definitions", heading: "Tipos de activo" },
  { path: "/setup/dropdowns", heading: "Listas desplegables" },
  { path: "/setup/sla-policies", heading: "Políticas SLA" },
  { path: "/setup/notification-templates", heading: "Plantillas de notificación" },
  { path: "/setup/rules", heading: "Reglas" },
  { path: "/setup/inventory-agents", heading: "Agentes de inventario" },
  { path: "/setup/api-clients", heading: "Clientes API" },
  { path: "/setup/webhooks", heading: "Webhooks" },
  { path: "/setup/auth-sources", heading: "Fuentes de autenticación" },
  { path: "/setup/service-catalog", heading: "Catálogo de servicios" },
  { path: "/setup/ticket-fields", heading: "Campos de ticket" },
  { path: "/setup/cron-jobs", heading: "Trabajos programados" },
];

test.describe("Configuración - smoke de las 12 páginas de listado", () => {
  for (const { path, heading } of SMOKE_PAGES) {
    test(`${path} carga, muestra su encabezado y no genera errores`, async ({ page }) => {
      const diag = diagnostics(page);
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      diag.assertClean();
    });
  }
});

// ---------------------------------------------------------------------------
// 2. Field-type / attribute checks and read-only guarantees.
// ---------------------------------------------------------------------------

test.describe("Configuración - tipos de campo y páginas de solo lectura", () => {
  test("api-clients: tabla de clientes existentes + form de creación presentes", async ({ page }) => {
    const diag = diagnostics(page);
    await page.goto("/setup/api-clients");
    await expect(page.locator("table")).toBeVisible();
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="scopes"]').first()).toBeVisible();
    diag.assertClean();
  });

  test("webhooks: URL es input type=url y secreto exige mínimo 8 caracteres", async ({ page }) => {
    const diag = diagnostics(page);
    await page.goto("/setup/webhooks");
    await expect(page.locator('input[name="url"]')).toHaveAttribute("type", "url");
    await expect(page.locator('input[name="secret"]')).toHaveAttribute("minlength", "8");
    await expect(page.locator('input[name="maxRetries"]')).toHaveAttribute("type", "number");
    await expect(page.locator('select[name="event"] option')).toHaveCount(3);
    diag.assertClean();
  });

  test("sla-policies: umbrales de tiempo son inputs numéricos con min=1", async ({ page }) => {
    const diag = diagnostics(page);
    await page.goto("/setup/sla-policies");
    for (const name of ["ttoMinutes", "ttrMinutes"]) {
      const input = page.locator(`input[name="${name}"]`);
      await expect(input).toHaveAttribute("type", "number");
      await expect(input).toHaveAttribute("min", "1");
    }
    diag.assertClean();
  });

  test("auth-sources: puerto LDAP es numérico (default 389) y contraseña es password", async ({ page }) => {
    const diag = diagnostics(page);
    await page.goto("/setup/auth-sources");
    await expect(page.locator('input[name="port"]')).toHaveAttribute("type", "number");
    await expect(page.locator('input[name="port"]')).toHaveValue("389");
    await expect(page.locator('input[name="bindPasswordEncrypted"]')).toHaveAttribute("type", "password");
    diag.assertClean();
  });

  test("ticket-fields: selector de tipo de dato ofrece los 6 tipos soportados", async ({ page }) => {
    const diag = diagnostics(page);
    await page.goto("/setup/ticket-fields");
    const options = await page.locator('select[name="fieldType"] option').allTextContents();
    expect(options).toEqual(["text", "textarea", "number", "boolean", "date", "dropdown"]);
    diag.assertClean();
  });

  test("cron-jobs: es una vista de solo lectura (sin forms, dos tablas)", async ({ page }) => {
    const diag = diagnostics(page);
    await page.goto("/setup/cron-jobs");
    // Scope to <main> - the shared (central) layout always renders its own sign-out
    // <form> in the header on every page, unrelated to this page's own content.
    await expect(page.locator("main form")).toHaveCount(0);
    await expect(page.locator("main table")).toHaveCount(2);
    await expect(page.getByText(/No es posible ejecutar un job manualmente/)).toBeVisible();
    diag.assertClean();
  });

  test("cron-jobs: si el worker corrió, expone los 6 jobs con expresión cron válida", async ({ page }) => {
    const diag = diagnostics(page);
    await page.goto("/setup/cron-jobs");

    const emptyState = page.getByText("Sin horarios programados todavía.");
    if (await emptyState.isVisible().catch(() => false)) {
      // pg-boss persists schedules in pgboss.schedule at worker startup; if
      // apps/worker never ran against this database the table is empty and
      // there is nothing to assert against - skip instead of failing on an
      // environment precondition outside this module's control.
      test.skip(true, "pgboss.schedule está vacío: apps/worker nunca corrió contra esta base de datos.");
    }

    const EXPECTED_QUEUES = [
      "sla-escalation-sweep",
      "notification-dispatch",
      "recurring-tickets-sweep",
      "saved-search-alerts-sweep",
      "rss-feed-refresh-sweep",
      "webhook-dispatch",
    ];
    const scheduleTable = page.locator("table").first();
    const names = await scheduleTable.locator("tbody tr td:first-child").allTextContents();
    for (const expected of EXPECTED_QUEUES) {
      expect(names, `cola esperada "${expected}" no encontrada en pgboss.schedule`).toContain(expected);
    }
    const crons = await scheduleTable.locator("tbody tr td:nth-child(2)").allTextContents();
    for (const cron of crons) {
      expect(cron, `expresión cron con formato inesperado: "${cron}"`).toMatch(/^(\S+\s+){4}\S+$/);
    }
    diag.assertClean();
  });
});

// ---------------------------------------------------------------------------
// 3. Validation errors must render a readable message, not a raw Zod JSON
//    dump. Regression guard for the ZodError#message bug fixed in
//    apps/web/actions/{dropdowns,api-clients}.actions.ts (see parseInput()).
// ---------------------------------------------------------------------------

test.describe("Configuración - errores de validación son legibles (no JSON crudo)", () => {
  test("dropdowns: key con formato inválido muestra el mensaje del regex, no un blob JSON", async ({ page }) => {
    const diag = diagnostics(page);
    await page.goto("/setup/dropdowns");
    await page.locator('input[name="key"]').fill("Invalid Key!");
    await page.locator('input[name="name"]').fill(`E2E-SETUP-baddropdownkey-${randomSlug()}`);
    await page.getByRole("button", { name: "Crear categoría" }).click();

    const error = page.locator("form p.text-red-600").first();
    await expect(error).toBeVisible();
    const text = (await error.textContent())?.trim() ?? "";
    expect(text.startsWith("[") || text.startsWith("{"), `error no debería ser JSON crudo: ${text}`).toBe(false);
    expect(text).toContain("Solo minúsculas, dígitos y guión bajo");
    diag.assertNoConsoleErrors();
  });

  test("api-clients: crear sin seleccionar ningún scope muestra el mensaje de Zod, no un blob JSON", async ({ page }) => {
    const diag = diagnostics(page);
    await page.goto("/setup/api-clients");
    await page.locator('input[name="name"]').fill(`E2E-SETUP-noscopes-${randomSlug()}`);
    await page.getByRole("button", { name: "Crear cliente API" }).click();

    const error = page.locator("form p.text-red-600").first();
    await expect(error).toBeVisible();
    const text = (await error.textContent())?.trim() ?? "";
    expect(text.startsWith("[") || text.startsWith("{"), `error no debería ser JSON crudo: ${text}`).toBe(false);
    expect(text).toBe("Array must contain at least 1 element(s)");
    diag.assertNoConsoleErrors();
  });
});

// ---------------------------------------------------------------------------
// 4. Representative full E2E flows (create -> verify in list -> the closest
//    thing this module has to "editar" -> clean up where UI allows it).
// ---------------------------------------------------------------------------

test.describe.serial("E2E: Dropdown category + item", () => {
  const id = randomSlug();
  const categoryKey = `e2e_setup_${id}`; // regex-constrained: /^[a-z0-9_]+$/
  const categoryName = `E2E-SETUP-Category-${id}`;
  const itemName = `E2E-SETUP-Item-${id}`;
  let categoryId: string | undefined;

  test("crear categoría de dropdown", async ({ page }) => {
    const diag = diagnostics(page);
    await page.goto("/setup/dropdowns");
    await page.locator('input[name="key"]').fill(categoryKey);
    await page.locator('input[name="name"]').fill(categoryName);
    await page.getByRole("button", { name: "Crear categoría" }).click();
    await expect(page.getByText(categoryName)).toBeVisible();
    diag.assertClean();
  });

  test("la categoría aparece en la lista y su detalle abre correctamente", async ({ page }) => {
    const diag = diagnostics(page);
    await page.goto("/setup/dropdowns");
    const link = page.getByRole("link", { name: new RegExp(categoryName) });
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^\/setup\/dropdowns\/.+/);
    categoryId = href?.split("/").pop();

    await link.click();
    await expect(page.getByRole("heading", { level: 1, name: categoryName })).toBeVisible();
    diag.assertClean();
  });

  test("crear item dentro de la categoría y verificarlo en la lista", async ({ page }) => {
    test.skip(!categoryId, "no se pudo resolver el id de la categoría en el paso anterior");
    const diag = diagnostics(page);
    await page.goto(`/setup/dropdowns/${categoryId}`);
    await page.locator('input[name="name"]').fill(itemName);
    await page.getByRole("button", { name: "Crear item" }).click();
    await expect(page.getByText(itemName)).toBeVisible();
    diag.assertClean();
  });

  test("no existe UI de edición ni borrado para categorías/items de dropdown (gap conocido)", async ({ page }) => {
    test.skip(!categoryId, "no se pudo resolver el id de la categoría");
    await page.goto(`/setup/dropdowns/${categoryId}`);
    await expect(page.getByRole("button", { name: /editar|eliminar|borrar/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /editar/i })).toHaveCount(0);
  });
});

test.describe.serial("E2E: SLA Policy", () => {
  const id = randomSlug();
  const name = `E2E-SETUP-SLA-${id}`;

  test("crear política SLA con tiempo de respuesta y de resolución", async ({ page }) => {
    const diag = diagnostics(page);
    await page.goto("/setup/sla-policies");
    await page.locator('input[name="name"]').fill(name);
    await page.locator('input[name="ttoMinutes"]').fill("60");
    await page.locator('input[name="ttrMinutes"]').fill("1440");
    await page.getByRole("button", { name: "Crear política SLA" }).click();
    await expect(page.getByText(name)).toBeVisible();
    diag.assertClean();
  });

  test("la política muestra los minutos correctos en la lista", async ({ page }) => {
    const diag = diagnostics(page);
    await page.goto("/setup/sla-policies");
    const row = page.locator("li", { hasText: name });
    await expect(row).toContainText("60min");
    await expect(row).toContainText("1440min");
    diag.assertClean();
  });
});

test.describe.serial("E2E: API Client - crear y revocar (el único borrado real del módulo)", () => {
  const id = randomSlug();
  const name = `E2E-SETUP-ApiClient-${id}`;

  test("crear cliente API con al menos un scope revela la key una sola vez", async ({ page }) => {
    const diag = diagnostics(page);
    await page.goto("/setup/api-clients");
    await page.locator('input[name="name"]').fill(name);
    await page.locator('input[name="scopes"]').first().check();
    await page.getByRole("button", { name: "Crear cliente API" }).click();

    const keyBlock = page.locator("pre");
    await expect(keyBlock).toBeVisible();
    const rawKey = (await keyBlock.textContent())?.trim() ?? "";
    expect(rawKey).toMatch(/^sk_[0-9a-f]{48}$/);

    const row = page.locator("tbody tr", { hasText: name });
    await expect(row).toContainText("Activo");
    await expect(row.getByRole("button", { name: "Revocar" })).toBeVisible();
    diag.assertClean();
  });

  test("revocar marca el cliente como Revocado y oculta el botón de revocar", async ({ page }) => {
    const diag = diagnostics(page);
    await page.goto("/setup/api-clients");
    const row = page.locator("tbody tr", { hasText: name });
    await row.getByRole("button", { name: "Revocar" }).click();
    await page.waitForLoadState("networkidle");
    await expect(row).toContainText("Revocado", { timeout: 10_000 });
    await expect(row.getByRole("button", { name: "Revocar" })).toHaveCount(0);
    diag.assertClean();
  });
});

// ---------------------------------------------------------------------------
// 5. Remaining detail-page ([id]) coverage + create flows for the pages that
//    do not need a full serial "representative" flow above.
// ---------------------------------------------------------------------------

test.describe.serial("Cobertura: Asset Definition + campo personalizado ([id])", () => {
  const id = randomSlug();
  const key = `e2e_setup_${id}`;
  const name = `E2E-SETUP-AssetDef-${id}`;
  const fieldKey = `e2e_setup_field_${id}`;
  const fieldLabel = `E2E-SETUP-Field-${id}`;
  let definitionId: string | undefined;

  test("crear tipo de activo y abrir su detalle", async ({ page }) => {
    const diag = diagnostics(page);
    await page.goto("/setup/asset-definitions");
    await page.locator('input[name="key"]').fill(key);
    await page.locator('input[name="name"]').fill(name);
    await page.getByRole("button", { name: "Crear tipo de activo" }).click();

    const link = page.getByRole("link", { name: new RegExp(name) });
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");
    definitionId = href?.split("/").pop();

    await link.click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    diag.assertClean();
  });

  test("el selector de tipo de dato ofrece los 6 tipos y crear un campo personalizado funciona", async ({ page }) => {
    test.skip(!definitionId, "no se pudo resolver el id del tipo de activo");
    const diag = diagnostics(page);
    await page.goto(`/setup/asset-definitions/${definitionId}`);

    const options = await page.locator('select[name="fieldType"] option').allTextContents();
    expect(options).toEqual(["text", "textarea", "number", "boolean", "date", "dropdown"]);

    await page.locator('input[name="key"]').fill(fieldKey);
    await page.locator('input[name="label"]').fill(fieldLabel);
    await page.getByRole("button", { name: "Crear campo" }).click();
    await expect(page.getByText(fieldLabel)).toBeVisible();
    diag.assertClean();
  });
});

test.describe.serial("Cobertura: Webhook + envíos en cola ([id])", () => {
  const id = randomSlug();
  const name = `E2E-SETUP-Webhook-${id}`;
  let webhookId: string | undefined;

  test("crear webhook y abrir su detalle", async ({ page }) => {
    const diag = diagnostics(page);
    await page.goto("/setup/webhooks");
    await page.locator('input[name="name"]').fill(name);
    await page.locator('input[name="itemType"]').fill("ticket");
    await page.locator('select[name="event"]').selectOption("create");
    await page.locator('input[name="url"]').fill("https://example.com/e2e-setup-webhook");
    await page.locator('input[name="secret"]').fill(`e2eSetupSecret-${id}`);
    await page.getByRole("button", { name: "Crear webhook" }).click();

    const link = page.getByRole("link", { name: new RegExp(name) });
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");
    webhookId = href?.split("/").pop();

    await link.click();
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    diag.assertClean();
  });

  test("el detalle muestra tipo de item, evento, URL y la sección de envíos", async ({ page }) => {
    test.skip(!webhookId, "no se pudo resolver el id del webhook");
    const diag = diagnostics(page);
    await page.goto(`/setup/webhooks/${webhookId}`);
    await expect(page.getByText(/ticket · create · https:\/\/example\.com\/e2e-setup-webhook/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Últimos envíos" })).toBeVisible();
    diag.assertClean();
  });
});

test.describe.serial("Cobertura: Rule + criterio + acción ([id])", () => {
  const id = randomSlug();
  const ruleType = `e2e_setup_ruletype_${id}`;
  const ruleName = `E2E-SETUP-Rule-${id}`;
  const criteriaValue = `E2E-SETUP-critvalue-${id}`;
  const actionValue = `E2E-SETUP-actionvalue-${id}`;
  let ruleId: string | undefined;

  test("crear regla y abrir su detalle", async ({ page }) => {
    const diag = diagnostics(page);
    await page.goto("/setup/rules");
    await page.locator('input[name="ruleType"]').fill(ruleType);
    await page.locator('input[name="name"]').fill(ruleName);
    await page.getByRole("button", { name: "Crear regla" }).click();

    const link = page.getByRole("link", { name: ruleName });
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");
    ruleId = href?.split("/").pop();

    await link.click();
    await expect(page.getByRole("heading", { level: 1, name: ruleName })).toBeVisible();
    diag.assertClean();
  });

  test("agregar un criterio y una acción - la más cercana a 'editar' una regla existente", async ({ page }) => {
    test.skip(!ruleId, "no se pudo resolver el id de la regla");
    const diag = diagnostics(page);
    await page.goto(`/setup/rules/${ruleId}`);

    // Left column: criteria form. Right column: action form. Both forms have
    // an input[name="field"] and input[name="value"] - disambiguate by DOM order.
    await page.locator('input[name="field"]').first().fill("category");
    await page.locator('input[name="value"]').first().fill(criteriaValue);
    await page.getByRole("button", { name: "Agregar criterio" }).click();
    await expect(page.getByText(criteriaValue)).toBeVisible();

    await page.locator('input[name="field"]').last().fill("assignee");
    await page.locator('input[name="value"]').last().fill(actionValue);
    await page.getByRole("button", { name: "Agregar acción" }).click();
    await expect(page.getByText(actionValue)).toBeVisible();

    diag.assertClean();
  });
});

test.describe("Cobertura: create-only rápido para páginas restantes", () => {
  test("auth-sources: crear fuente LDAP y verla en la lista de servidores configurados", async ({ page }) => {
    const id = randomSlug();
    const name = `E2E-SETUP-LDAP-${id}`;
    const diag = diagnostics(page);
    await page.goto("/setup/auth-sources");
    await page.locator('input[name="name"]').fill(name);
    await page.locator('input[name="host"]').fill(`ldap-${id}.example.com`);
    await page.locator('input[name="baseDn"]').fill(`dc=e2e-setup-${id},dc=com`);
    await page.locator('input[name="bindDn"]').fill(`cn=admin,dc=e2e-setup-${id},dc=com`);
    await page.locator('input[name="bindPasswordEncrypted"]').fill(`E2ESetupBindPwd-${id}`);
    await page.locator('input[name="syncField"]').fill("mail");
    await page.getByRole("button", { name: "Crear fuente LDAP" }).click();
    await expect(page.getByText(name)).toBeVisible();
    diag.assertClean();
  });

  test("notification-templates: crear plantilla y verla en la lista", async ({ page }) => {
    const id = randomSlug();
    const key = `e2e_setup_${id}`;
    const name = `E2E-SETUP-Template-${id}`;
    const diag = diagnostics(page);
    await page.goto("/setup/notification-templates");
    await page.locator('input[name="key"]').fill(key);
    await page.locator('input[name="name"]').fill(name);
    await page.locator('input[name="subjectTemplate"]').fill(`Asunto E2E-SETUP {{ticketTitle}}`);
    await page.locator('textarea[name="bodyTemplate"]').fill("Cuerpo de prueba E2E-SETUP.");
    await page.getByRole("button", { name: "Crear plantilla" }).click();
    await expect(page.getByText(name)).toBeVisible();
    diag.assertClean();
  });

  test("service-catalog: crear tipo de solicitud y verlo en la lista", async ({ page }) => {
    const id = randomSlug();
    const name = `E2E-SETUP-Catalog-${id}`;
    const diag = diagnostics(page);
    await page.goto("/setup/service-catalog");
    await page.locator('input[name="name"]').fill(name);
    await page.locator('select[name="ticketType"]').selectOption("request");
    await page.getByRole("button", { name: "Crear tipo de solicitud" }).click();
    await expect(page.getByText(name)).toBeVisible();
    diag.assertClean();
  });

  test("ticket-fields: crear campo de ticket y verlo en la lista", async ({ page }) => {
    const id = randomSlug();
    const key = `e2e_setup_field_${id}`;
    const label = `E2E-SETUP-TicketField-${id}`;
    const diag = diagnostics(page);
    await page.goto("/setup/ticket-fields");
    await page.locator('input[name="key"]').fill(key);
    await page.locator('input[name="label"]').fill(label);
    await page.getByRole("button", { name: "Crear campo" }).click();
    await expect(page.getByText(label)).toBeVisible();
    diag.assertClean();
  });

  test("inventory-agents: página carga con o sin agentes registrados todavía", async ({ page }) => {
    const diag = diagnostics(page);
    await page.goto("/setup/inventory-agents");
    const emptyState = page.getByText("Sin agentes de inventario todavía.");
    const agentCard = page.locator("li", { hasText: "deviceId:" });
    await expect(emptyState.or(agentCard.first())).toBeVisible();
    diag.assertClean();
  });
});
