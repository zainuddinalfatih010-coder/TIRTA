import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

const output = "evidence/uiux-candidate/density-repair";
async function route(page: Page, name: string) {
  const mobile = page.getByLabel("Ruang kerja", { exact: true });
  if (await mobile.isVisible()) await mobile.selectOption({ label: name });
  else {
    const button = page.locator(".app-rail nav").getByRole("button", { name, exact: true, includeHidden: true });
    for (const details of await button.locator("xpath=ancestor::details").all())
      if (!await details.getAttribute("open")) await details.locator(":scope > summary").click();
    await button.click();
  }
}
async function shot(page: Page, name: string) {
  await mkdir(output, { recursive: true });
  await page.evaluate(async () => { await document.fonts.ready; scrollTo(0, 0); });
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
}

test("Studio retains its desktop inspector, stable parcel framing and precisely aligned tools", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.goto("/production.html"); await page.getByRole("button", { name: "Buka Contoh", exact: true }).click();
  await route(page, "Studio Persil");
  await expect(page.locator(".app-footer")).toHaveCount(0);
  await expect(page.locator(".local-planning-assistant")).toHaveCount(0);
  for (const [width, height] of [[1920,1080],[1440,900],[1366,768],[1366,650],[1024,768],[390,844]] as const) {
    await page.setViewportSize({ width, height });
    const canvas = page.locator(".studio-layout .parcel-svg"); await canvas.focus(); await page.keyboard.press("Escape");
    if (width > 960) {
      await expect(page.locator(".empty-zone-bench")).toBeVisible();
      await expect(page.locator(".studio-inspector")).toBeVisible();
    } else await expect(page.locator(".empty-zone-bench")).toBeHidden();
    // ResizeObserver fits the SVG after a viewport resize; await that fit before comparing selection.
    await expect.poll(() => canvas.evaluate(el => {
      const box=el.getBoundingClientRect(), view=(el as SVGSVGElement).viewBox.baseVal;
      return Math.abs(view.width/view.height-box.width/box.height);
    })).toBeLessThan(0.001);
    await expect(page.locator(".studio-layout .inspect-zone")).toBeHidden();
    const idleCanvas = await canvas.boundingBox();
    const idleViewBox = await canvas.getAttribute("viewBox");
    await expect(page.locator(".canvas-paper").first()).toBeHidden();
    await expect(page.locator(".canvas-grid").first()).toBeHidden();
    for (const button of await page.locator(".studio-layout .map-access button, .studio-layout .zoom-controls button:not(.inspect-zone)").all()) {
      const style=await button.evaluate(el => ({border:getComputedStyle(el).borderWidth,background:getComputedStyle(el).backgroundColor}));
      expect(style.border).toBe("0px"); expect(style.background).toBe("rgba(0, 0, 0, 0)");
    }
    await expect(page.getByText("Tindakan lainnya", { exact: true })).toHaveCount(0);
    const help = width > 960 ? page.locator(".tool-constraints > summary") : page.locator(".mobile-studio-tools").getByRole("button", { name: "Bantuan gambar" });
    await help.click();
    const settings = width > 960 ? page.locator(".tool-settings") : page.locator(".mobile-help-popover");
    await expect(settings.getByLabel("Sejajar X/Y", { exact: true })).toBeVisible();
    await settings.getByLabel("Sejajar X/Y", { exact: true }).uncheck();
    await settings.getByLabel("Sejajar X/Y", { exact: true }).check();
    await settings.getByRole("button", { name: "Ubah dimensi awal", exact: true }).click();
    await expect(page.getByLabel("Panjang persil")).toBeVisible();
    await page.locator(".parcel-start").getByRole("button", { name: "Batal", exact: true }).click();
    await page.evaluate(() => scrollTo(0, 0));
    if (width >= 1366 && height >= 768) await expect(page.locator(".register-next .primary")).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.locator(".zone-register .zone-row").first().click();
    if (width > 960) {
      await expect(page.getByLabel("Jenis permukaan", { exact: true })).toBeVisible();
      const tools = await page.locator(".map-toolstrip").boundingBox();
      const register = await page.locator(".zone-register").boundingBox();
      expect(tools!.y + tools!.height).toBeLessThanOrEqual(register!.y);
      const selectedCanvas = await canvas.boundingBox();
      expect(selectedCanvas!.x).toBeCloseTo(idleCanvas!.x,0);
      expect(selectedCanvas!.width).toBeCloseTo(idleCanvas!.width,0);
      expect(selectedCanvas!.height).toBeCloseTo(idleCanvas!.height,0);
      await expect(canvas).toHaveAttribute("viewBox",idleViewBox!);
      if (height >= 900) expect(selectedCanvas!.height).toBeGreaterThan(450);
      const positions = await page.locator(".map-toolstrip").evaluate(el => {
        const dock = el.getBoundingClientRect();
        const bounds = [...el.querySelectorAll(".tool-modes > button, .tool-edits > button, .tool-constraints > summary")].map(button => {
          const b = button.getBoundingClientRect(); const icon = button.querySelector("svg")!.getBoundingClientRect();
          return { label:button.getAttribute("aria-label") || button.textContent!.trim(), left:b.left, right:b.right, center:icon.x+icon.width/2, y:b.y, h:b.height };
        });
        return { left:dock.left,right:dock.right,center:dock.x+dock.width/2,bounds };
      });
      for(const button of positions.bounds) {
        expect(button.left).toBeGreaterThanOrEqual(positions.left);
        expect(button.right).toBeLessThanOrEqual(positions.right);
        if (!["Urungkan sketsa","Ulangi sketsa"].includes(button.label)) expect(Math.abs(button.center-positions.center)).toBeLessThan(1);
      }
      const undo=positions.bounds.find(b=>b.label==="Urungkan sketsa")!;const redo=positions.bounds.find(b=>b.label==="Ulangi sketsa")!;
      expect(Math.abs((undo.center+redo.center)/2-positions.center)).toBeLessThan(1);
      expect(undo.y).toBeCloseTo(redo.y,0);
    }
    await canvas.focus(); await page.keyboard.press("Escape"); await canvas.blur();
    await shot(page, `studio-idle-${width}-${height}`);
  }
  expect(errors).toEqual([]);
});

test("dense candidates remain browseable and rain context does not stretch into blank space", async ({ page }) => {
  await page.goto("/production.html");
  const file = page.getByLabel("Buka berkas cadangan");
  for (const details of await file.locator("xpath=ancestor::details").all())
    if (!await details.getAttribute("open")) await details.locator(":scope > summary").click();
  await file.setInputFiles("evidence/uiux-candidate/fixtures/density-alternatives.tirta.json");
  const notice = page.getByRole("button", { name: "Tutup pemberitahuan" }); if (await notice.isVisible()) await notice.click();
  await route(page, "Alternatif");
  const list = page.getByRole("region", { name: "Daftar paket perbandingan", exact: true });
  await expect(page.locator(".compare-candidate input")).toHaveCount(16);
  await page.getByRole("button", { name:"Kosongkan perbandingan" }).click();
  await list.focus(); await page.keyboard.press("End");
  await expect.poll(() => list.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await page.getByLabel("Bandingkan Alternatif 16", { exact:true }).check();
  await page.locator(".compare-matrix .primary").click();
  await expect(page.locator(".decision-canvas")).toBeVisible();
  await route(page, "Hujan & kondisi awal");
  await page.setViewportSize({ width:1440, height:900 });
  const context = await page.locator(".rain-parcel-context").boundingBox();
  const dock = await page.locator(".rain-dock").boundingBox();
  expect(context!.height).toBeLessThan(dock!.height);
  const contribution = await page.locator(".rain-contribution-region").boundingBox();
  expect(contribution!.y).toBeLessThan(dock!.y + dock!.height);
  await shot(page, "rain-dense-desktop");
  await page.setViewportSize({ width:390, height:844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect((await new AxeBuilder({ page }).include(".rain-atlas").analyze()).violations).toEqual([]);
  await shot(page, "rain-dense-mobile");
});

test("intervention tools stay in the palette and scientific support is available without a detached bottom section", async ({ page }) => {
  await page.goto("/production.html"); await page.getByRole("button", { name: "Buka Contoh", exact: true }).click();
  await route(page, "Intervensi");
  for (const name of ["Tangki", "Sumur / area resapan", "Rain garden", "Biopori"]) {
    await page.getByRole("button", { name: `Tambahkan ${name}`, exact: true }).click();
    await expect(page.locator(".inline-editor")).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Letakkan di tengah persil", exact: true })).toHaveCount(0);
  }
  await expect(page.getByRole("heading", { name: "Lanjutkan perencanaan", exact: true })).toHaveCount(0);
  for (const [width,height] of [[1586,992],[1440,900],[1366,768],[390,844]] as const) {
    await page.setViewportSize({ width,height });
    await page.getByRole("button", { name: "Paket & kondisi", exact: true }).click();
    const dialog = page.getByRole("dialog", { name:"Paket & kondisi", exact:true });
    await expect(dialog).toBeVisible();
    for (const topic of ["Siapkan paket", "Kesesuaian persil", "Varian tersimpan", "Prioritas rencana"]) {
      await dialog.getByRole("button", { name:topic, exact:true }).click();
      await expect(dialog.getByRole("region", { name:topic, exact:true })).toBeVisible();
    }
    await page.keyboard.press("Escape"); await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name:"Paket & kondisi", exact:true })).toBeFocused();
    await expect(page.locator(".intervention-ledger-region .ledger-sources")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await shot(page, `intervention-compact-${width}`);
    if (width===1586) await page.screenshot({path:`${output}/intervention-reference-viewport.png`});
    if (width===390) expect((await new AxeBuilder({ page }).include(".intervention-atlas").analyze()).violations).toEqual([]);
  }
});
