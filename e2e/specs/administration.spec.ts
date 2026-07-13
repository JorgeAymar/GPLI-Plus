import { test, expect, type ConsoleMessage, type Request } from "@playwright/test";

/**
 * E2E coverage for the "Administración" module + the post-login dashboard.
 *
 * Scope (per source read of apps/web/app/(central)/administration/** and
 * apps/web/app/(central)/dashboard/**):
 *   /dashboard
 *   /administration/entities
 *   /administration/users
 *   /administration/groups, /administration/groups/[id]
 *   /administration/profiles, /administration/profiles/[id]
 *   /administration/audit-log
 *
 * Runs already authenticated as admin (storageState from e2e/auth.setup.ts).
 * Config: single "chromium" project, workers: 1, fullyParallel: false - tests in
 * this file execute strictly top-to-bottom, which some of the flows below rely on
 * (documented at each dependency). Do NOT reorder the describe blocks or make this
 * file parallel-safe without re-checking those dependencies.
 *
 * Known product gaps found while writing this spec (see final report for detail):
 *   - No delete/soft-delete affordance exists anywhere for entities (no UI button,
 *     no action, no core function). Per the task's own guardrail, we therefore
 *     never create a test entity here (ltree hierarchy would be left with
 *     unremovable junk) - the Entities section is read-only.
 *   - No edit or delete UI/action exists for users either (no [id] route, no
 *     updateUser/deleteUser in packages/core) - the Users flow stops at create+verify.
 *   - Fixed in this session (within the allowed zone):
 *       - apps/web/actions/{entities,users,groups,profiles}.actions.ts never called
 *         recordAuditLog, so /administration/audit-log was structurally unable to
 *         show anything for the very module it belongs to. Wired it up.
 *       - Several admin form <label>s were not associated to their <input>/<select>
 *         via htmlFor/id, breaking both a11y and getByLabel()-based testing. Added
 *         id/htmlFor pairs in entity-form, user-form, group-form, add-member-form,
 *         profile-form and assign-form.
 */

function uniqueSuffix(): string {
  return `${Date.now()}${Math.floor(Math.random() * 900 + 100)}`;
}

// ---------------------------------------------------------------------------
// Console/network error capture, for every test in this file.
// ---------------------------------------------------------------------------

let consoleErrors: string[] = [];
let pageErrors: string[] = [];
let failedRequests: string[] = [];

test.beforeEach(async ({ page }) => {
  consoleErrors = [];
  pageErrors = [];
  failedRequests = [];

  page.on("console", (msg: ConsoleMessage) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => pageErrors.push(String(err)));
  page.on("requestfailed", (req: Request) => {
    const failure = req.failure();
    // net::ERR_ABORTED is the normal signature of a cancelled prefetch/navigation,
    // not a real failure - everything else is worth failing the test over.
    if (failure && failure.errorText !== "net::ERR_ABORTED") {
      failedRequests.push(`${req.method()} ${req.url()} :: ${failure.errorText}`);
    }
  });
});

test.afterEach(() => {
  expect(consoleErrors, `Unexpected browser console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
  expect(pageErrors, `Unexpected uncaught page errors:\n${pageErrors.join("\n")}`).toEqual([]);
  expect(failedRequests, `Unexpected failed network requests:\n${failedRequests.join("\n")}`).toEqual([]);
});

// ---------------------------------------------------------------------------
// Dashboard - the page auth.setup.ts already lands on post-login.
// ---------------------------------------------------------------------------

test.describe("Dashboard (/dashboard)", () => {
  test("loads with heading and active entity/profile info", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();

    const info = page.locator("p");
    await expect(info).toContainText("Entidad activa:");
    await expect(info).toContainText("Perfil activo:");
    // Seeded by packages/core/scripts/seed.ts - must always be present.
    await expect(info).toContainText("Global");
    await expect(info).toContainText("Super-Admin");
  });

  test("sidebar links reach every Administration page", async ({ page }) => {
    // 6 real navigations in one test (dashboard + 5 round trips) - generous timeout to absorb
    // Next.js dev-mode on-demand route compilation on a cold page, not a sign of an app bug.
    test.setTimeout(60_000);
    await page.goto("/dashboard");
    const targets: Array<[string, RegExp]> = [
      ["Entidades", /\/administration\/entities$/],
      ["Usuarios", /\/administration\/users$/],
      ["Grupos", /\/administration\/groups$/],
      ["Perfiles", /\/administration\/profiles$/],
      ["Registro de auditoría", /\/administration\/audit-log$/],
    ];
    for (const [label, urlPattern] of targets) {
      await page.locator("nav").getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(urlPattern);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.goto("/dashboard");
    }
  });
});

// ---------------------------------------------------------------------------
// Entities - read-only. See header comment: no delete affordance exists, so we
// never create a test entity (would permanently pollute the seeded ltree root).
// ---------------------------------------------------------------------------

test.describe("Entities (/administration/entities) - read-only", () => {
  test("loads the entity tree with the seeded root and a well-formed create form", async ({ page }) => {
    await page.goto("/administration/entities");
    await expect(page.getByRole("heading", { level: 1, name: "Entidades" })).toBeVisible();

    const treeHeading = page.getByRole("heading", { level: 2, name: "Árbol de entidades" });
    await expect(treeHeading).toBeVisible();
    // The root entity's row renders as "Global (<path>)" (name + path in a nested
    // span), so an exact-text match on just "Global" never matches any single
    // element - use a substring match instead.
    const treeContainer = treeHeading.locator("xpath=following-sibling::div[1]");
    await expect(treeContainer.getByText("Global", { exact: false }).first()).toBeVisible();

    const nameInput = page.getByLabel("Nombre");
    await expect(nameInput).toHaveAttribute("required", "");
    await expect(nameInput).toHaveJSProperty("tagName", "INPUT");

    const parentSelect = page.getByLabel("Entidad padre");
    await expect(parentSelect.locator("option").first()).toHaveText("(raíz)");
    await expect(parentSelect.getByRole("option", { name: "Global" })).toHaveCount(1);

    await expect(page.getByLabel("Comentario")).toHaveJSProperty("tagName", "TEXTAREA");
    await expect(page.getByRole("button", { name: "Crear entidad" })).toBeVisible();
  });

  test("blocks creating an entity with an empty name (required-field validation)", async ({ page }) => {
    await page.goto("/administration/entities");
    const nameInput = page.getByLabel("Nombre");
    const isValid = await nameInput.evaluate((el) => (el as HTMLInputElement).checkValidity());
    expect(isValid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

test.describe("Users (/administration/users) - page", () => {
  test("loads with the users table and a well-formed create form", async ({ page }) => {
    await page.goto("/administration/users");
    await expect(page.getByRole("heading", { level: 1, name: "Usuarios" })).toBeVisible();

    for (const header of ["Nombre", "Email", "Usuario"]) {
      await expect(page.getByRole("columnheader", { name: header })).toBeVisible();
    }
    // Seeded admin user must always be present.
    await expect(page.locator("tbody tr", { hasText: "admin@itsm.local" })).toBeVisible();

    await expect(page.getByLabel("Email")).toHaveAttribute("type", "email");
    await expect(page.getByLabel("Contraseña")).toHaveAttribute("type", "password");
    await expect(page.getByLabel("Contraseña")).toHaveAttribute("minlength", "8");
    await expect(page.getByRole("button", { name: "Crear usuario" })).toBeVisible();
  });
});

test.describe.serial("Users - create flow (E2E-ADMIN)", () => {
  const suffix = uniqueSuffix();
  const displayName = `E2E-ADMIN-USER-${suffix}`;
  const username = `e2e-admin-user-${suffix}`;
  const email = `e2e-admin-user-${suffix}@example.test`;
  const password = "E2eAdmin!2026";

  // NOTE (finding, not fixed - see final report): there is no edit or delete
  // UI/action for users anywhere in the product (no administration/users/[id]
  // route, no updateUser/deleteUser in packages/core). This flow therefore stops
  // at create + verify; nothing is left to edit or clean up.

  test("creates a user with generated data", async ({ page }) => {
    await page.goto("/administration/users");
    await page.getByLabel("Nombre para mostrar").fill(displayName);
    await page.getByLabel("Usuario").fill(username);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByLabel("Entidad por defecto").selectOption({ label: "Global" });
    await page.getByRole("button", { name: "Crear usuario" }).click();

    await expect(page.locator("tbody tr", { hasText: username })).toBeVisible();
  });

  test("the new user is still listed after a fresh page load", async ({ page }) => {
    await page.goto("/administration/users");
    const row = page.locator("tbody tr", { hasText: username });
    await expect(row).toBeVisible();
    await expect(row).toContainText(displayName);
    await expect(row).toContainText(email);
  });
});

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

test.describe("Groups (/administration/groups) - page", () => {
  test("loads with the groups list and create form", async ({ page }) => {
    await page.goto("/administration/groups");
    await expect(page.getByRole("heading", { level: 1, name: "Grupos" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Existentes" })).toBeVisible();
    await expect(page.getByLabel("Nombre")).toBeVisible();
    await expect(page.getByRole("button", { name: "Crear grupo" })).toBeVisible();
  });
});

test.describe.serial("Groups - create + add/remove member flow (E2E-ADMIN)", () => {
  const suffix = uniqueSuffix();
  const groupName = `E2E-ADMIN-GROUP-${suffix}`;
  let groupUrl = "";

  test("creates a group with generated data", async ({ page }) => {
    await page.goto("/administration/groups");
    await page.getByLabel("Nombre").fill(groupName);
    await page.getByRole("button", { name: "Crear grupo" }).click();

    const link = page.getByRole("link", { name: groupName, exact: true });
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");
    expect(href).toBeTruthy();
    groupUrl = href!;
  });

  test("the group detail page loads with an empty member list and add-member form", async ({ page }) => {
    await page.goto(groupUrl);
    await expect(page.getByRole("heading", { level: 1, name: groupName })).toBeVisible();
    await expect(page.getByText("Sin miembros todavía.")).toBeVisible();
    await expect(page.getByLabel("Usuario")).toBeVisible();
  });

  test("adds the seeded admin as a member - this group's 'edit' step", async ({ page }) => {
    await page.goto(groupUrl);
    await page.getByLabel("Usuario").selectOption({ label: "Administrador" });
    await page.getByLabel("Es responsable del grupo").check();
    await page.getByRole("button", { name: "Agregar al grupo" }).click();

    const memberRow = page.locator("li", { hasText: "Administrador" });
    await expect(memberRow).toBeVisible();
    await expect(memberRow).toContainText("(responsable)");
  });

  test("removes the member again, restoring the group to empty (cleanup)", async ({ page }) => {
    await page.goto(groupUrl);
    const memberRow = page.locator("li", { hasText: "Administrador" });
    await expect(memberRow).toBeVisible();
    await memberRow.getByRole("button", { name: "Quitar" }).click();
    await expect(page.getByText("Sin miembros todavía.")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

test.describe("Profiles (/administration/profiles) - page", () => {
  test("loads with the profiles table, create form, and assign-profile form", async ({ page }) => {
    await page.goto("/administration/profiles");
    await expect(page.getByRole("heading", { level: 1, name: "Perfiles" })).toBeVisible();
    // Seeded by packages/core/scripts/seed.ts - must always be present.
    await expect(page.locator("tbody tr", { hasText: "Super-Admin" })).toBeVisible();

    await expect(page.getByLabel("Nombre")).toBeVisible();
    await expect(page.getByRole("button", { name: "Crear perfil" })).toBeVisible();
    // Assign-profile form: presence only - deliberately not submitted in this spec,
    // since a wrong entity/profile/isDefault combination could reassign a real
    // user's default profile on a shared dev environment.
    // exact: true - "Perfil" is otherwise a substring of the "Perfil por defecto" checkbox label too.
    await expect(page.getByLabel("Perfil", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Asignar" })).toBeVisible();
  });
});

test.describe.serial("Profiles - create + permission matrix toggle/persist (E2E-ADMIN)", () => {
  const suffix = uniqueSuffix();
  const profileName = `E2E-ADMIN-PROFILE-${suffix}`;
  let detailUrl = "";

  test("creates a profile with generated data", async ({ page }) => {
    await page.goto("/administration/profiles");
    await page.getByLabel("Nombre").fill(profileName);
    await page.getByLabel("Interfaz").selectOption({ label: "Central (admin/técnico)" });
    await page.getByLabel("Descripción").fill("Perfil de prueba E2E - seguro de ignorar.");
    await page.getByRole("button", { name: "Crear perfil" }).click();

    const row = page.locator("tbody tr", { hasText: profileName });
    await expect(row).toBeVisible();
    const link = row.getByRole("link", { name: "Permisos →" });
    const href = await link.getAttribute("href");
    expect(href).toBeTruthy();
    detailUrl = href!;
  });

  test("the new profile's permission matrix starts fully unchecked", async ({ page }) => {
    await page.goto(detailUrl);
    await expect(page.getByRole("heading", { level: 1, name: profileName })).toBeVisible();
    const row = page.locator("tr", { hasText: "administration.entity" });
    await expect(row).toBeVisible();
    await expect(row.getByRole("checkbox").first()).not.toBeChecked();
  });

  test("toggling a right checkbox persists across reload, in both directions", async ({ page }) => {
    await page.goto(detailUrl);
    const row = () => page.locator("tr", { hasText: "administration.entity" });
    const checkbox = () => row().getByRole("checkbox").first();

    await checkbox().click();
    await expect(checkbox()).toBeChecked();
    // The checkbox is disabled={isPending} while its Server Action call is in flight
    // (permission-matrix.tsx) - wait for that round trip to actually finish before
    // reloading, or the reload can race ahead of the persisted write.
    await expect(checkbox()).toBeEnabled();
    await page.waitForLoadState("networkidle");

    await page.reload();
    await expect(checkbox()).toBeChecked();

    await checkbox().click();
    await expect(checkbox()).not.toBeChecked();
    await expect(checkbox()).toBeEnabled();
    await page.waitForLoadState("networkidle");

    await page.reload();
    await expect(checkbox()).not.toBeChecked();
  });
});

// ---------------------------------------------------------------------------
// Audit log - read-only, filters + pagination. Declared last on purpose: it
// exercises real rows written by the Users/Groups/Profiles flows above (which
// only exist because this session wired recordAuditLog into the four actions
// files - see header comment).
// ---------------------------------------------------------------------------

test.describe("Audit log (/administration/audit-log)", () => {
  test("loads with filters, table headers and pagination info", async ({ page }) => {
    await page.goto("/administration/audit-log");
    await expect(page.getByRole("heading", { level: 1, name: "Registro de auditoría" })).toBeVisible();

    await expect(page.getByLabel("Tipo de objeto")).toBeVisible();
    await expect(page.getByLabel("Usuario (UUID)")).toBeVisible();
    await expect(page.getByLabel("Desde")).toHaveAttribute("type", "date");
    await expect(page.getByLabel("Hasta")).toHaveAttribute("type", "date");
    await expect(page.getByRole("button", { name: "Filtrar" })).toBeVisible();

    for (const header of ["Fecha", "Acción", "Tipo", "Objeto", "Usuario", "Cambios"]) {
      await expect(page.getByRole("columnheader", { name: header })).toBeVisible();
    }
    await expect(page.getByText(/Página \d+ de \d+/)).toBeVisible();
  });

  test("filtering by objectType=user surfaces the E2E-ADMIN user created earlier", async ({ page }) => {
    await page.goto("/administration/audit-log?objectType=user");
    await expect(page.locator("tbody tr").first()).toBeVisible();
    await expect(page.locator("tbody")).toContainText("create");
  });

  test("filtering by a non-existent objectType returns zero rows", async ({ page }) => {
    const bogusType = `e2e-nonexistent-${uniqueSuffix()}`;
    await page.goto("/administration/audit-log");
    await page.getByLabel("Tipo de objeto").fill(bogusType);
    await page.getByRole("button", { name: "Filtrar" }).click();

    await expect(page).toHaveURL(new RegExp(`objectType=${bogusType}`));
    await expect(page.getByText("Sin registros de auditoría para estos filtros.")).toBeVisible();
    await expect(page.getByText(/\(0 registros\)/)).toBeVisible();
  });

  test("filtering by a far-future 'from' date returns zero rows", async ({ page }) => {
    await page.goto("/administration/audit-log");
    await page.getByLabel("Desde").fill("2099-01-01");
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(page).toHaveURL(/from=2099-01-01/);
    await expect(page.getByText("Sin registros de auditoría para estos filtros.")).toBeVisible();
  });

  test("a page=2 query param renders an 'Anterior' link back to page 1", async ({ page }) => {
    await page.goto("/administration/audit-log?page=2");
    await expect(page.getByText(/Página 2 de/)).toBeVisible();
    const prevLink = page.getByRole("link", { name: "Anterior" });
    await expect(prevLink).toBeVisible();
    await expect(prevLink).toHaveAttribute("href", /page=1/);
  });
});
