import { test, expect } from "@playwright/test";

test("Friday save and reload uses IndexedDB production persistence", async ({ page }) => {
  await page.goto("/production.html");
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase("tirta-friday-rescue");
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
      req.onblocked = () => resolve();
    });
  });
  await page.reload();

  await page.getByRole("button", { name: /Jelajahi contoh lengkap/i }).click();
  await page.getByRole("button", { name: "Hujan & kondisi awal", exact: true }).click();

  const rain = page.getByLabel("Kedalaman hujan");
  await rain.fill("60");
  await page.getByRole("button", { name: "Terapkan hujan & hitung ulang" }).click();
  await expect(page.locator(".rain-split-label").first()).toContainText("6,77 m³");

  await page.getByRole("button", { name: "Simpan", exact: true }).click();
  await expect(page.locator(".notice")).toContainText("Proyek tersimpan di browser ini.");

  await page.reload();
  await page.getByRole("button", { name: "Buka simpanan lokal" }).click();
  await expect(page.locator(".notice")).toContainText("Simpanan IndexedDB");

  await page.getByRole("button", { name: "Hujan & kondisi awal", exact: true }).click();
  await expect(page.getByLabel("Kedalaman hujan")).toHaveValue("60");
  await expect(page.locator(".rain-split-label").first()).toContainText("6,77 m³");
});
