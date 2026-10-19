import { test, expect } from "@playwright/test";

test("Friday interventions expose four families and edit production values", async ({ page }) => {
  await page.goto("/production.html");
  await page.getByRole("button", { name: /Jelajahi contoh lengkap/i }).click();
  await page.getByRole("button", { name: "Intervensi", exact: true }).click();

  for (const name of [
    "Tangki atap",
    "Sumur / area resapan",
    "Rain garden halaman",
    "Permukaan berpori",
  ]) {
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  }

  const soakCapacity = page.getByLabel("Kapasitas Sumur / area resapan");
  await expect(soakCapacity).toHaveValue("2.5");
  await soakCapacity.fill("2.8");
  await soakCapacity.blur();
  await expect(page.locator(".notice")).toContainText("Parameter intervensi diterapkan");
  await expect(page.getByLabel("Kapasitas Sumur / area resapan")).toHaveValue("2.8");

  const soakCost = page.getByLabel("Biaya Sumur / area resapan");
  await soakCost.fill("2600000");
  await soakCost.blur();
  await expect(page.getByLabel("Biaya Sumur / area resapan")).toHaveValue("2600000");

  await page.getByRole("button", { name: "Tambahkan Sumur / area resapan" }).click();
  await expect(page.getByRole("button", { name: "Lepas Sumur / area resapan" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: "Tambahkan Permukaan berpori" }).click();
  await expect(page.getByRole("button", { name: "Lepas Permukaan berpori" })).toHaveAttribute("aria-pressed", "true");

  await expect(page.locator(".impact-inline")).toBeVisible();
  await page.screenshot({
    path: ".rescue-evidence/interventions-production-runtime.png",
    fullPage: true,
  });
});
