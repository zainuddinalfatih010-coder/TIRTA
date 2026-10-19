import { test, expect } from "@playwright/test";

test("Friday notice dismisses by X and Escape with focus recovery", async ({ page }) => {
  await page.goto("/production.html");

  await page.getByRole("button", { name: /Jelajahi contoh lengkap/i }).click();
  const notice = page.locator(".notice");
  await expect(notice).toBeVisible();

  await page.getByRole("button", { name: "Tutup pemberitahuan" }).click();
  await expect(notice).toHaveCount(0);
  await expect(page.locator("h1").first()).toBeFocused();

  await page.getByRole("button", { name: "Proyek", exact: true }).click();
  await page.getByRole("button", { name: /Jelajahi contoh lengkap/i }).click();
  await expect(page.locator(".notice")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".notice")).toHaveCount(0);
  await expect(page.locator("h1").first()).toBeFocused();
});
