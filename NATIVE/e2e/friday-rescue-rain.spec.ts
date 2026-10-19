import { test, expect } from "@playwright/test";

test("Friday rain editor recalculates and keeps blank unknown", async ({ page }) => {
  await page.goto("/production.html");
  await page.getByRole("button", { name: /Jelajahi contoh lengkap/i }).click();
  await page.getByRole("button", { name: /Uji hujan pada persil ini/i }).click();

  const rain = page.getByLabel("Kedalaman hujan");
  await expect(rain).toHaveValue("50");
  await expect(page.locator(".rain-split-label").first()).toContainText("5,64 m³");

  await rain.fill("60");
  await page.getByRole("button", { name: "Terapkan hujan & hitung ulang" }).click();
  await expect(page.locator(".rain-split-label").first()).toContainText("6,77 m³");
  await expect(page.locator(".notice")).toContainText("Skenario hujan diterapkan");

  const rainAfterUpdate = page.getByLabel("Kedalaman hujan");
  await rainAfterUpdate.fill("");
  await page.getByRole("button", { name: "Terapkan hujan & hitung ulang" }).click();
  await expect(page.locator(".missing-state")).toContainText("Hasil ditahan");
  await expect(page.locator(".rain-split")).toHaveCount(0);

  await page.screenshot({
    path: ".rescue-evidence/rain-production-runtime.png",
    fullPage: true,
  });
});
