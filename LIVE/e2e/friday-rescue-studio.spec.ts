import { test, expect } from "@playwright/test";

test("Friday Studio production binding", async ({ page }) => {
  await page.goto("/production.html?view=studio");
  await expect(page.locator(".workspace")).toBeVisible();

  const parcelLength = page.getByLabel("Panjang persil");
  const parcelWidth = page.getByLabel("Lebar persil");
  await expect(parcelLength).toHaveValue("20");
  await expect(parcelWidth).toHaveValue("10");
  await parcelLength.fill("21");
  await parcelWidth.fill("10");
  await page.locator(".parcel-dimension-editor button").click();
  await expect(page.locator(".golden-world-status")).toContainText("Maksimum luas persil 200 m²");
  await expect(page.locator(".parcel-derived-area")).toContainText("200 m²");
  await expect(page.locator('[data-intervention-marker]')).toHaveCount(0);

  const surface = page.getByLabel("Jenis permukaan");
  await surface.selectOption("paved");
  await expect(page.locator(".coefficient-help")).toContainText("Aspal 0,85–0,95");
  await expect(page.locator(".coefficient-help")).toContainText("tidak diisi otomatis");

  const coefficient = page.getByLabel("Koefisien limpasan");
  await coefficient.fill("0.88");
  await coefficient.blur();
  await expect(page.locator(".notice")).toContainText("Data zona diterapkan");

  await page.screenshot({
    path: ".rescue-evidence/studio-production-runtime.png",
    fullPage: true,
  });
});
