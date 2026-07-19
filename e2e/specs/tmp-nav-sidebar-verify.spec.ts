import { test, expect } from "@playwright/test";

test.describe("nav sidebar - visual + contrast check (temp verification)", () => {
  test("screenshot of active link + sticky sidebar mid-scroll, and computed contrast", async ({
    page,
  }) => {
    await page.goto("/assistance/tickets");
    await page.evaluate(() => window.scrollTo(0, 1500));
    await page.waitForTimeout(200);
    await page.screenshot({ path: "test-results/nav-sidebar-sticky-scrolled.png" });

    // Compute actual rendered contrast ratio for the "Asistencia" section header
    // against its effective background, using the real computed styles (not a
    // hand calculation), for both light and dark color schemes.
    const contrast = await page.evaluate(() => {
      function srgbToLinear(c: number) {
        const cs = c / 255;
        return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
      }
      function relLuminance([r, g, b]: number[]) {
        return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
      }
      function parseRgb(str: string) {
        const m = str.match(/rgba?\(([^)]+)\)/);
        if (!m) return [0, 0, 0];
        return m[1].split(",").slice(0, 3).map((n) => parseFloat(n));
      }
      const el = Array.from(document.querySelectorAll("nav div")).find(
        (e) => e.textContent?.trim() === "Asistencia",
      ) as HTMLElement;
      const cs = getComputedStyle(el);
      const fg = parseRgb(cs.color);
      const opacity = parseFloat(cs.opacity);
      const bg = parseRgb(getComputedStyle(document.body).backgroundColor);
      // blend fg (with its opacity) over bg, since opacity is applied via CSS opacity
      const blended = fg.map((c, i) => opacity * c + (1 - opacity) * bg[i]);
      const lFg = relLuminance(blended);
      const lBg = relLuminance(bg);
      const lighter = Math.max(lFg, lBg);
      const darker = Math.min(lFg, lBg);
      const ratio = (lighter + 0.05) / (darker + 0.05);
      return { fg, bg, opacity, blended, ratio };
    });
    console.log("LIGHT MODE contrast:", JSON.stringify(contrast));
    expect(contrast.ratio).toBeGreaterThanOrEqual(4.5);

    // Now force dark mode via emulateMedia and re-check.
    await page.emulateMedia({ colorScheme: "dark" });
    await page.waitForTimeout(100);
    const contrastDark = await page.evaluate(() => {
      function srgbToLinear(c: number) {
        const cs = c / 255;
        return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
      }
      function relLuminance([r, g, b]: number[]) {
        return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
      }
      function parseRgb(str: string) {
        const m = str.match(/rgba?\(([^)]+)\)/);
        if (!m) return [0, 0, 0];
        return m[1].split(",").slice(0, 3).map((n) => parseFloat(n));
      }
      const el = Array.from(document.querySelectorAll("nav div")).find(
        (e) => e.textContent?.trim() === "Asistencia",
      ) as HTMLElement;
      const cs = getComputedStyle(el);
      const fg = parseRgb(cs.color);
      const opacity = parseFloat(cs.opacity);
      const bg = parseRgb(getComputedStyle(document.body).backgroundColor);
      const blended = fg.map((c, i) => opacity * c + (1 - opacity) * bg[i]);
      const lFg = relLuminance(blended);
      const lBg = relLuminance(bg);
      const lighter = Math.max(lFg, lBg);
      const darker = Math.min(lFg, lBg);
      const ratio = (lighter + 0.05) / (darker + 0.05);
      return { fg, bg, opacity, blended, ratio };
    });
    console.log("DARK MODE contrast:", JSON.stringify(contrastDark));
    expect(contrastDark.ratio).toBeGreaterThanOrEqual(4.5);
  });
});
