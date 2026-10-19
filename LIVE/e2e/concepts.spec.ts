import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const concepts = ["atelier", "lintasan", "spektrum"];
async function open(page: Page, id: string) {
  await page.goto(`/concepts.html?studio=${id}`);
  await page.evaluate(() => document.fonts.ready);
}
async function resolve(page: Page) {
  await page.getByRole("button", { name: /Gunakan asumsi demo/ }).click();
}
async function chapter(page: Page, id: string, name: string) {
  if (id === "atelier")
    await page.getByRole("button", { name, exact: true }).first().click();
  else if (id === "lintasan")
    await page
      .getByRole("navigation", { name: "Langkah perencanaan" })
      .getByRole("button", { name: new RegExp(name) })
      .click();
}
for (const id of concepts) {
  test(`${id}: UNKNOWN, selection, geometry gestures, source, scenarios and comparison`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await open(page, id);
    if(id!=='atelier')await page.getByRole('button',{name:'Ubah sketsa',exact:true}).click();
    await expect(page.locator('[data-zone="z3"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByTestId("runoff")).toHaveCount(0);
    const polygon = page.locator('[data-zone="z3"] .zone-body');
    const before = await polygon.getAttribute("points");
    await page.getByRole("button", { name: "Geser zona", exact: true }).click();
    const box = await polygon.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(
      box!.x + box!.width * 0.5,
      box!.y + box!.height * 0.5,
    );
    await page.mouse.down();
    await page.mouse.move(
      box!.x + box!.width * 0.5 + 15,
      box!.y + box!.height * 0.5 + 10,
      { steps: 8 },
    );
    await page.mouse.up();
    await expect(polygon).not.toHaveAttribute("points", before!);
    await expect(page.getByText(/90 m² dari data demo/)).toBeVisible();
    await page
      .getByRole("button", { name: "Urungkan perubahan sketsa" })
      .click();
    await expect(polygon).toHaveAttribute("points", before!);
    await page.getByRole("button", { name: "Edit titik", exact: true }).click();
    const vertex = page.locator('[data-zone="z3"] .vertex').first();
    const point = await vertex.boundingBox();
    await page.mouse.move(
      point!.x + point!.width / 2,
      point!.y + point!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      point!.x + point!.width / 2 + 12,
      point!.y + point!.height / 2 + 10,
      { steps: 5 },
    );
    await page.mouse.up();
    await expect(polygon).not.toHaveAttribute("points", before!);
    await page
      .getByRole("button", { name: "Urungkan perubahan sketsa" })
      .click();
    await expect(polygon).toHaveAttribute("points", before!);
    await page.getByRole("button", { name: "Pilih zona", exact: true }).click();
    await page
      .getByRole("button", { name: "Zona Gedung belajar", exact: true })
      .click();
    await expect(page.locator(".zone-field-heading h2")).toHaveText(
      "Gedung belajar",
    );
    await page.getByLabel("Jenis permukaan").selectOption("soil");
    await expect(
      page.getByLabel("Koefisien limpasan", { exact: true }),
    ).toHaveValue("0.9");
    await page.getByRole("button", { name: /Zona Lahan terbuka/ }).click();
    await resolve(page);
    await page.locator(".zone-fields summary").click();
    await expect(page.locator(".zone-fields .sources")).toContainText(
      "bukan bentuk sketsa",
    );
    await chapter(page, id, "Hujan");
    await expect(page.getByTestId("runoff")).toHaveText("29,85m³");
    await page.getByRole("button", { name: "80 mm", exact: true }).click();
    await expect(page.getByTestId("runoff")).toHaveText("47,76m³");
    if(id==='spektrum')await page.locator('.custom-rain summary').click();
    await page.getByLabel("Hujan aktif dalam mm").fill("50");
    await page
      .getByRole("button", { name: "Terapkan hujan", exact: true })
      .click();
    await expect(page.getByTestId("runoff")).toHaveText("29,85m³");
    await page.getByLabel("Hujan aktif dalam mm").fill("");
    await page
      .getByRole("button", { name: "Terapkan hujan", exact: true })
      .click();
    await expect(page.getByTestId("runoff")).toHaveCount(0);
    await expect(page.getByText("Baseline belum dapat dihitung")).toBeVisible();
    await page.getByLabel("Hujan aktif dalam mm").fill("50");
    await page
      .getByRole("button", { name: "Terapkan hujan", exact: true })
      .click();
    if (id === "spektrum")
      await page
        .getByRole("button", { name: "Susun intervensi", exact: true })
        .click();
    else await chapter(page, id, "Intervensi");
    await page.getByRole("button", { name: /^Taman hujan/ }).click();
    await expect(page.locator(".garden-symbol")).toBeVisible();
    if (id === "spektrum")
      await page
        .getByRole("button", { name: "Bandingkan pilihan", exact: true })
        .click();
    else await chapter(page, id, "Bandingkan");
    await expect(page.getByRole("row", { name: /Keduanya/ })).toContainText(
      "14,85",
    );
    await page.getByRole("button", { name: "120 mm", exact: true }).click();
    await expect(page.getByRole("row", { name: /Keduanya/ })).toContainText(
      "56,64",
    );
    expect(errors).toEqual([]);
  });
  test(`${id}: keyboard and populated accessibility`, async ({ page }) => {
    await open(page, id);
    await resolve(page);
    await chapter(page, id, "Hujan");
    const zone = page.locator('[data-zone="z0"]');
    await zone.focus();
    await page.keyboard.press("Enter");
    await expect(zone).toHaveAttribute("aria-pressed", "true");
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      result.violations,
      JSON.stringify(
        result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
      ),
    ).toEqual([]);
  });
  for (const [width, height] of [
    [1920, 1080],
    [1707, 862],
    [1536, 864],
    [1440, 900],
    [1366, 768],
    [1280, 800],
    [768, 1024],
    [390, 844],
    [360, 800],
  ]) {
    test(`${id}: ${width}x${height} composition`, async ({ page }) => {
      await page.setViewportSize({ width: width!, height: height! });
      await open(page, id);
      const check = async () => {
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await expect(page.locator(".site-drawing")).toBeVisible();
        const box = await page.locator(".site-drawing").boundingBox();
        expect(box!.width).toBeGreaterThan(280);
      };
      await check();
      await resolve(page);
      await chapter(page, id, "Hujan");
      await check();
      if (width === 1440 || width === 390)
        await page.screenshot({
          path: `evidence/reset/${id}-${width}-analysis.png`,
          fullPage: true,
        });
      await page.getByRole("button", { name: "Perbesar sketsa" }).click();
      await page
        .getByRole("button", { name: "Tampilkan seluruh persil" })
        .click();
      if (id === "spektrum" && width! < 560) {
        await page
          .getByRole("button", { name: "Data zona", exact: true })
          .click();
        await page.locator(".contribution-row").first().click();
        await expect(page.locator(".zone-field-heading h2")).toHaveText(
          "Gedung belajar",
        );
        await page
          .getByRole("button", { name: "Spasial", exact: true })
          .click();
        await expect(page.locator('[data-zone="z0"]')).toHaveAttribute(
          "aria-pressed",
          "true",
        );
      }
      await chapter(page, id, "Bandingkan");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (width === 1440 || width === 390)
        await page.screenshot({
          path: `evidence/reset/${id}-${width}-comparison.png`,
          fullPage: true,
        });
    });
  }
}
