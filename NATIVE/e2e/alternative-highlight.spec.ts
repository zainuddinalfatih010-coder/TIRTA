import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

test("runoff recommendation is explicit, explainable, responsive, and never selects a plan", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto(process.env.TIRTA_PREVIEW_URL ?? "/tirta.html");
  await page.getByRole("button", { name: "Buka Contoh", exact: true }).click();
  await page.locator(".app-rail nav").getByRole("button", { name: "Intervensi", exact: true }).click();
  for (const family of ["Tangki", "Sumur / area resapan", "Rain garden", "Biopori"]) {
    await page.getByRole("button", { name: `Tambahkan ${family}`, exact: true }).click();
  }
  await page.locator(".app-rail nav").getByRole("button", { name: "Alternatif", exact: true }).click();
  const highlighted = page.locator(".alternative.runoff-recommended");
  await expect(highlighted).toHaveCount(1);
  await expect(highlighted).toContainText("Rekomendasi TIRTA · fokus limpasan");
  await expect(highlighted).toContainText("sisa paling kecil");
  await page.getByRole("button", { name: "Lihat paket rekomendasi", exact: true }).click();
  await expect(highlighted).toBeFocused();
  await expect(highlighted.getByRole("button", { name: "Pilih rencana ini", exact: true })).toBeEnabled();
  const order = await page.locator(".alternative h2").allTextContents();
  const reasons = highlighted.getByTestId("runoff-recommendation");
  const disclosure = reasons.locator("details");
  await expect(disclosure).not.toHaveAttribute("open");
  await disclosure.locator("summary").click();
  await expect(disclosure).toContainText("Tidak ada skor gabungan atau bobot tersembunyi");
  await expect(disclosure).toContainText("belum tentu paling murah");
  await expect(disclosure).toContainText("masih perlu diperiksa");
  await disclosure.locator("summary").click();
  const dir = ".design/decision-support/screenshots";
  await mkdir(dir, { recursive: true });
  for (const [width, height] of [[1440, 900], [1366, 768], [390, 844]]) {
    await page.setViewportSize({ width: width!, height: height! });
    await reasons.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await expect(highlighted.getByRole("button", { name: "Pilih rencana ini", exact: true })).toBeEnabled();
    await page.screenshot({ path: `${dir}/recommended-package-${width}.png`, fullPage: true });
    if (width === 390) {
      await highlighted.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${dir}/recommended-package-mobile-viewport.png` });
    }
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole("heading", { level: 1, name: "Alternatif", exact: true })).toBeVisible();
  expect(await page.locator(".alternative h2").allTextContents()).toEqual(order);
  await highlighted.getByRole("button", { name: "Pilih rencana ini", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Rencana & Dampak", exact: true, level: 1 })).toBeVisible();
  expect(errors).toEqual([]);
});
