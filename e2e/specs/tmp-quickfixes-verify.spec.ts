import { test, expect } from "@playwright/test";

test("1. search works on computers/software/network-equipment asset pages", async ({ page }) => {
  await page.goto("/assets/computers");
  await expect(page.getByPlaceholder("Buscar por nombre, serie o inventario...")).toBeVisible();

  await page.goto("/assets/software");
  await expect(page.getByPlaceholder("Buscar por nombre...")).toBeVisible();

  await page.goto("/assets/network-equipment");
  await expect(page.getByPlaceholder("Buscar por nombre, serie o inventario...")).toBeVisible();
});

test("2. asset type links on /assets are no longer chip-styled", async ({ page }) => {
  await page.goto("/assets");
  const link = page.getByRole("link", { name: /→/ }).first();
  await expect(link).toBeVisible();
  const cls = await link.getAttribute("class");
  expect(cls).not.toContain("border");
  expect(cls).toContain("underline");
});

test("3. dashboard external assistant card renamed", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Asistente externo" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Abrir asistente externo" })).toBeVisible();
});

test("4. login language switcher shows disclaimer", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/login");
  await expect(page.getByText("Esto solo guarda tu preferencia. Todavía no cambia el idioma de la interfaz.")).toBeVisible();
  await context.close();
});

test("5. login and portal h1 use text-2xl", async ({ browser }) => {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/login");
  const loginH1 = page.getByRole("heading", { level: 1, name: "Iniciar sesión" });
  await expect(loginH1).toHaveClass(/text-2xl/);
  await context.close();

  await page.goto("/portal");
  // will redirect to login since unauthenticated context; skip portal check here (done in authenticated test below)
});

test("5b. portal h1 uses text-2xl (authenticated)", async ({ page }) => {
  await page.goto("/portal");
  const h1 = page.getByRole("heading", { level: 1 });
  await expect(h1).toHaveClass(/text-2xl/);
});

test("6. new-user form has confirm-password field with client-side mismatch validation", async ({ page }) => {
  await page.goto("/administration/users");
  await expect(page.getByLabel("Confirmar contraseña")).toBeVisible();
  await expect(page.getByText("Mínimo 8 caracteres.")).toBeVisible();

  const unique = Date.now();
  await page.getByLabel("Nombre para mostrar").fill(`QA Temp ${unique}`);
  await page.getByLabel("Usuario", { exact: true }).fill(`qatemp${unique}`);
  await page.getByLabel("Email", { exact: true }).fill(`qatemp${unique}@example.com`);
  await page.getByLabel("Contraseña", { exact: true }).fill("password123");
  await page.getByLabel("Confirmar contraseña").fill("password124");
  await page.getByRole("button", { name: "Crear usuario" }).click();
  await expect(page.getByText("Las contraseñas no coinciden.")).toBeVisible();
});
