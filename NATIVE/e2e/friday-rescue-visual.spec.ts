import { test, expect } from "@playwright/test";

test("Friday six-screen visual evidence", async ({ page }) => {
  await page.goto("/production.html");
  await page.getByRole("button", { name: /Jelajahi contoh lengkap/i }).click();
  await page.getByRole("button", { name: "Tutup pemberitahuan" }).click();

  const shot = async (name: string) => {
    await expect(page.locator(".workspace")).toBeVisible();
    await page.screenshot({
      path: `.rescue-evidence/current-golden/${name}.png`,
      fullPage: true,
    });
  };

  await shot("studio");

  await page.getByRole("button", { name: "Hujan & kondisi awal", exact: true }).click();
  await shot("hujan");

  await page.getByRole("button", { name: "Intervensi", exact: true }).click();
  await shot("intervensi");
  for (const name of [
    "Tangki atap",
    "Sumur / area resapan",
    "Rain garden halaman",
    "Permukaan berpori",
  ]) {
    await page.getByRole("button", { name: `Tambahkan ${name}` }).click();
  }

  await page.getByRole("button", { name: "Alternatif", exact: true }).click();
  await shot("alternatif");

  const chosenCard = page.locator("article.alternative:has(.domain-glyph)").first();
  await chosenCard.getByRole("button", { name: "Pilih rencana ini" }).click();
  await shot("rencana-dampak");

  await page.getByRole("button", { name: "Bandingkan", exact: true }).click();
  await shot("bandingkan");
});
