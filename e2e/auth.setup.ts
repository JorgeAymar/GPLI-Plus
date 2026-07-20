import { test as setup, expect } from "@playwright/test";

const ADMIN_STATE_PATH = "playwright/.auth/admin.json";

setup("authenticate as admin", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill(process.env.E2E_ADMIN_EMAIL ?? "admin@itsm.local");
  // exact: true - "Mostrar contraseña" (the show/hide toggle button's aria-label) also
  // contains the substring "Contraseña", making an unscoped getByLabel ambiguous.
  await page.getByLabel("Contraseña", { exact: true }).fill(process.env.E2E_ADMIN_PASSWORD ?? "ChangeMe123!");
  await page.getByRole("button", { name: /ingresar/i }).click();
  await page.waitForURL(/\/dashboard/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.context().storageState({ path: ADMIN_STATE_PATH });
});
