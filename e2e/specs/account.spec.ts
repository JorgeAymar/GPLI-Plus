import { test, expect, type Page } from "@playwright/test";

/**
 * E2E coverage for /account: personal MCP tokens (create/list/revoke) and the
 * language preference selector. All specs run authenticated as admin (see
 * e2e/auth.setup.ts + playwright.config.ts).
 */

interface Diagnostics {
  consoleErrors: string[];
  requestErrors: string[];
  assertClean(): void;
}

function diagnostics(page: Page): Diagnostics {
  const consoleErrors: string[] = [];
  const requestErrors: string[] = [];

  page.on("console", (msg) => {
    if (msg.type() === "error" && !/^Failed to load resource:/.test(msg.text())) consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    consoleErrors.push(`pageerror: ${err.message}`);
  });
  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("/_next/") || url.endsWith("/favicon.ico")) return;
    if (response.status() >= 400) requestErrors.push(`${response.status()} ${url}`);
  });

  return {
    consoleErrors,
    requestErrors,
    assertClean() {
      expect(consoleErrors, `console errors:\n${consoleErrors.join("\n")}`).toEqual([]);
      expect(requestErrors, `network errors:\n${requestErrors.join("\n")}`).toEqual([]);
    },
  };
}

function uniqueTitle(prefix: string): string {
  return `E2E-${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

test.describe("Mi cuenta (/account)", () => {
  test("la página carga con datos del usuario, selector de idioma y form de tokens", async ({ page }) => {
    const diag = diagnostics(page);
    await page.goto("/account");

    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { level: 1, name: "Mi cuenta" })).toBeVisible();
    await expect(page.locator("select[name=\"language\"]")).toHaveValue("es");
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.getByRole("button", { name: "Crear token" })).toBeVisible();

    diag.assertClean();
  });

  test("cambiar el idioma persiste tras recargar", async ({ page }) => {
    const diag = diagnostics(page);
    await page.goto("/account");

    await page.locator('select[name="language"]').selectOption("fr");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Guardado.")).toBeVisible();

    await page.reload();
    await expect(page.locator('select[name="language"]')).toHaveValue("fr");

    // Reset so other tests/manual QA see the default again.
    await page.locator('select[name="language"]').selectOption("es");
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText("Guardado.")).toBeVisible();

    diag.assertClean();
  });

  test("crear un token MCP lo revela una vez y lo lista; revocar lo marca como Revocado", async ({ page }) => {
    const diag = diagnostics(page);
    const name = uniqueTitle("ACCOUNT-TOKEN");

    await page.goto("/account");
    await page.locator('input[name="name"]').fill(name);
    await page.getByRole("button", { name: "Crear token" }).click();

    const keyBlock = page.locator("pre");
    await expect(keyBlock).toBeVisible();
    const rawKey = (await keyBlock.textContent())?.trim() ?? "";
    expect(rawKey).toMatch(/^pat_[0-9a-f]{40,48}$/);

    const row = page.locator("tbody tr", { hasText: name });
    await expect(row).toContainText("Activo");

    await row.getByRole("button", { name: "Revocar" }).click();
    await page.waitForLoadState("networkidle");
    await expect(row).toContainText("Revocado", { timeout: 10_000 });
    await expect(row.getByRole("button", { name: "Revocar" })).toHaveCount(0);

    diag.assertClean();
  });
});
