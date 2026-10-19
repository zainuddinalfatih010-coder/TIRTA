import { test, expect } from "@playwright/test";

test("Friday optimizer selection survives into compare and impact", async ({ page }) => {
  await page.goto("/production.html");
  await page.getByRole("button", { name: /Jelajahi contoh lengkap/i }).click();
  await page.getByRole("button", { name: "Intervensi", exact: true }).click();
  for (const name of [
    "Tangki atap",
    "Sumur / area resapan",
    "Rain garden halaman",
    "Permukaan berpori",
  ]) {
    await page.getByRole("button", { name: `Tambahkan ${name}` }).click();
  }
  await page.getByRole("button", { name: "Alternatif", exact: true }).click();

  await expect(page.locator(".search-contract strong")).toContainText("16 kombinasi");
  const alternatives = page.locator("article.alternative");
  const alternativeCount = await alternatives.count();
  expect(alternativeCount).toBeGreaterThan(0);

  const chosenCard = page.locator("article.alternative:has(.domain-glyph)").first();
  await expect(chosenCard).toBeVisible();
  const selectedComponentCount = await chosenCard.locator(".domain-glyph").count();
  expect(selectedComponentCount).toBeGreaterThan(0);

  await chosenCard.getByRole("button", { name: "Pilih rencana ini" }).click();
  await expect(page.getByText("Pilihan Anda", { exact: true })).toBeVisible();
  await expect(page.locator(".plan-option")).toHaveCount(selectedComponentCount);
  await expect(page.locator(".decision-accounting")).toBeVisible();

  await page.getByRole("button", { name: "Bandingkan", exact: true }).click();
  const scenarioCount = await page.locator(".scenario-column").count();
  expect(scenarioCount).toBe(2);
  await expect(page.locator(".comparison-row")).toHaveCount(
    alternativeCount * scenarioCount,
  );

  await page.screenshot({
    path: ".rescue-evidence/compare-production-runtime.png",
    fullPage: true,
  });
});
