import { test, expect } from "@playwright/test";

function uniqueTitle(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

test("ticket create shows toast + moves focus off body", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto("/assistance/tickets");
  const title = uniqueTitle("TOAST-TICKET");
  await page.locator('input[name="title"]').fill(title);
  await page.locator('textarea[name="content"]').fill("contenido de verificación de toast");
  // fill any required dynamic fields defensively
  const dynamicRequired = page.locator("[name^='field_'][required]");
  const dCount = await dynamicRequired.count();
  for (let i = 0; i < dCount; i++) {
    const el = dynamicRequired.nth(i);
    const tag = await el.evaluate((n) => n.tagName);
    const type = await el.evaluate((n) => (n as HTMLInputElement).type);
    if (tag === "SELECT") await el.selectOption({ index: 1 });
    else if (type === "checkbox") await el.check();
    else await el.fill("x");
  }

  await page.getByRole("button", { name: "Crear ticket" }).click();

  // toast should appear with role=status and the success message
  const toast = page.getByRole("status");
  await expect(toast).toContainText("Ticket creado.", { timeout: 5000 });
  await expect(toast).toBeVisible();

  // focus should not be on <body>
  const activeTag = await page.evaluate(() => document.activeElement?.tagName);
  const isBody = await page.evaluate(() => document.activeElement === document.body);
  console.log("TICKET focus tag:", activeTag, "isBody:", isBody);
  expect(isBody).toBe(false);

  // form should be cleared
  await expect(page.locator('input[name="title"]')).toHaveValue("");

  console.log("TICKET console/page errors:", JSON.stringify(errors));
});

test("computer create shows toast + moves focus off body", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto("/assets/computers");
  const name = uniqueTitle("TOAST-COMPUTER");
  await page.locator('input[name="name"]').fill(name);
  await page.getByRole("button", { name: "Crear computadora" }).click();

  const toast = page.getByRole("status");
  await expect(toast).toContainText("Computadora creada.", { timeout: 5000 });

  const isBody = await page.evaluate(() => document.activeElement === document.body);
  const activeTag = await page.evaluate(() => document.activeElement?.tagName);
  console.log("COMPUTER focus tag:", activeTag, "isBody:", isBody);
  expect(isBody).toBe(false);

  await expect(page.locator('input[name="name"]')).toHaveValue("");

  console.log("COMPUTER console/page errors:", JSON.stringify(errors));
});

test("contact create shows toast + moves focus off body", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto("/management/contacts");
  const first = uniqueTitle("TOAST-FIRST");
  await page.locator('input[name="firstName"]').fill(first);
  await page.locator('input[name="lastName"]').fill("Apellido");
  await page.getByRole("button", { name: "Crear contacto" }).click();

  const toast = page.getByRole("status");
  await expect(toast).toContainText("Contacto creado.", { timeout: 5000 });

  const isBody = await page.evaluate(() => document.activeElement === document.body);
  const activeTag = await page.evaluate(() => document.activeElement?.tagName);
  console.log("CONTACT focus tag:", activeTag, "isBody:", isBody);
  expect(isBody).toBe(false);

  await expect(page.locator('input[name="firstName"]')).toHaveValue("");

  console.log("CONTACT console/page errors:", JSON.stringify(errors));
});
