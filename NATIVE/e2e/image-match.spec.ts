import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, readFile } from "node:fs/promises";
import type { ProjectV2 } from "../src/domain/projectV2";

const output = "evidence/uiux-candidate/image-match";
async function navigate(page: Page, name: string) {
  const mobile = page.getByLabel("Ruang kerja", { exact: true });
  if (await mobile.isVisible()) await mobile.selectOption({ label: name });
  else await page.locator(".app-rail nav").getByRole("button", { name, exact: true, includeHidden: true }).click();
}
async function cleanShot(page: Page, name: string) {
  const notice = page.getByRole("button", { name: "Tutup pemberitahuan" });
  if (await notice.isVisible()) await notice.click();
  await page.evaluate(async () => { await document.fonts.ready; scrollTo(0, 0); });
  await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
}

test("approved rain composition stays live, linked, accessible and readable at target widths", async ({ page }) => {
  await mkdir(output, { recursive: true });
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.goto("/production.html"); await page.getByRole("button", { name: "Buka Contoh", exact: true }).click();
  await navigate(page, "Hujan & kondisi awal");
  await page.getByRole("radio", { name: "Skenario uji saya", exact: true }).check();
  await page.getByLabel("Kedalaman hujan", { exact: true }).fill("60");
  await page.getByRole("button", { name: "Terapkan hujan & hitung ulang", exact: true }).click();
  await expect(page.locator(".rain-equation")).toContainText("12 m³");
  const contribution = page.locator(".contribution-list button").first(); await contribution.click();
  const selectedName = await contribution.locator(".contribution-name").innerText();
  await expect(page.locator(".rain-parcel-context .zone-shape.selected")).toHaveAttribute("aria-label", new RegExp(selectedName));
  await page.getByRole("button", { name: "Bagian non-limpasan", exact: true }).click();
  await expect(page.locator(".rain-volume-caption")).toHaveCount(0);
  for (const [width, height] of [[1586,992], [1440,900], [1366,768], [1024,768], [390,844]] as const) {
    await page.setViewportSize({ width, height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await expect(page.getByRole("button", { name: "Terapkan hujan & hitung ulang", exact: true })).toBeVisible();
    const ribbon = await page.locator(".volume-ribbons").boundingBox();
    const origin = await page.locator(".volume-origin-label").boundingBox();
    expect(origin!.y).toBeGreaterThanOrEqual(ribbon!.y);
    expect(origin!.y + origin!.height).toBeLessThanOrEqual(ribbon!.y + ribbon!.height);
    for (const reading of await page.locator(".volume-outcomes button").all()) {
      expect(await reading.evaluate(el => el.scrollHeight <= el.clientHeight + 1), `${width}px ${await reading.getAttribute("class")}`).toBe(true);
    }
    await cleanShot(page, `rain-${width}`);
    if (width === 1586 || width === 390) expect((await new AxeBuilder({ page }).include(".rain-atlas").analyze()).violations).toEqual([]);
  }
  await page.getByLabel("Kedalaman hujan", { exact: true }).fill("0"); await page.getByRole("button", { name: "Terapkan hujan & hitung ulang", exact: true }).click();
  await expect(page.locator(".rain-volume-diagram svg[role=img]")).toHaveAttribute("aria-label", /Air hujan di persil: 0 m³/);
  await page.getByLabel("Kedalaman hujan", { exact: true }).fill(""); await page.getByRole("button", { name: "Terapkan hujan & hitung ulang", exact: true }).click();
  await expect(page.locator(".rain-volume-diagram")).toHaveCount(0);
  await expect(page.locator(".rain-analysis")).toContainText("hujan");
  await cleanShot(page, "rain-unknown-mobile"); expect(errors).toEqual([]);
});

test("20-zone rain navigator and zero/full runoff bands retain readable, truthful readings", async ({ page }) => {
  const fixture = JSON.parse(await readFile("evidence/uiux-candidate/fixtures/density-known.tirta.json", "utf8")) as { project: ProjectV2 };
  const coefficientIds = new Set(fixture.project.zones.map(z => z.coefficient.id));
  for (const coefficient of [0, 1]) {
    const backup = structuredClone(fixture);
    for (const parameter of backup.project.parameters) if (coefficientIds.has(parameter.id)) parameter.value = coefficient;
    await page.goto("/production.html");
    const input = page.getByLabel("Buka berkas cadangan");
    for (const details of await input.locator("xpath=ancestor::details").all()) if (!await details.getAttribute("open")) await details.locator(":scope > summary").click();
    await input.setInputFiles({ name:"synthetic-extreme.tirta.json", mimeType:"application/json", buffer:Buffer.from(JSON.stringify(backup)) });
    await navigate(page, "Hujan & kondisi awal");
    await expect(page.locator(".contribution-list button")).toHaveCount(20);
    await expect(page.locator(".external-readings")).toBeVisible();
    await expect(page.locator(coefficient === 0 ? ".runoff-reading strong" : ".other-reading strong")).toHaveText("0 m³");
    await page.getByLabel("Cari zona", { exact:true }).fill("Zona 20 —");
    await expect(page.locator(".contribution-list button")).toHaveCount(1);
    for (const width of [1440,390]) {
      await page.setViewportSize({ width, height:900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      expect((await new AxeBuilder({page}).include(".rain-atlas").analyze()).violations).toEqual([]);
      await cleanShot(page, `rain-extreme-${coefficient}-${width}`);
    }
  }
});

test("four icon-only drags, one canonical editor, visible save and budget editing survive reload", async ({ page }) => {
  await mkdir(output, { recursive: true });
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.setViewportSize({ width:1586, height:992 });
  await page.goto("/production.html"); await page.getByRole("button", { name:"Buka Contoh", exact:true }).click();
  await navigate(page, "Intervensi");
  await page.evaluate(() => {
    const original = DataTransfer.prototype.setDragImage;
    Object.defineProperty(document.body, "dragProof", { value: [], configurable:true });
    DataTransfer.prototype.setDragImage = function(element, x, y) {
      const proof = (document.body as HTMLElement & { dragProof: { tag:string; width:number; height:number; x:number; y:number }[] }).dragProof;
      proof.push({tag:element.tagName,width:(element as HTMLCanvasElement).width,height:(element as HTMLCanvasElement).height,x,y});
      return original.call(this,element,x,y);
    };
  });
  for (const [i,kind] of ["tank", "soak", "garden", "biopori"].entries()) {
    const option = page.locator(`.intervention-palette button[data-option=${kind}]`);
    await expect(option).toHaveAttribute("draggable", "true");
    const canvas=page.locator('.intervention-preview .parcel-svg');const zone=await page.locator('.intervention-preview').getByTestId('zone-z2').boundingBox();const frame=await canvas.boundingBox();
    await option.dragTo(canvas,{targetPosition:{x:zone!.x+zone!.width*(i%2 ? .75 : .25)-frame!.x,y:zone!.y+zone!.height*(i<2 ? .25 : .75)-frame!.y}});
    const id = kind === 'biopori' ? 'soak-3' : `${kind}-2`;
    await expect(page.locator(`[data-intervention-marker=${id}]`)).toBeVisible();
  }
  expect(await page.evaluate(() => (document.body as HTMLElement & { dragProof: unknown[] }).dragProof)).toEqual(Array.from({length:4}, () => ({tag:"CANVAS",width:58,height:48,x:29,y:24})));
  await expect(page.locator("[data-component]")).toHaveCount(4);
  await page.locator("[data-component=tank-2] .instance-select").click();
  const editor = page.locator(".treatment-composer");
  await expect(editor).toHaveCount(1);
  await editor.getByRole("button", { name:/Biaya & lahan/ }).click();
  await expect(editor.getByRole("button", { name:"Simpan penanganan", exact:true })).toBeInViewport();
  await editor.getByLabel("Biaya (Rp)", {exact:true}).fill("3.500.000");
  await editor.getByRole("button", {name:"Simpan penanganan",exact:true}).click();
  await page.getByRole("button", { name:"Ubah batas", exact:true }).click();
  const limits = page.getByRole("dialog", { name:"Batas rencana Anda", exact:true });
  await limits.getByLabel("Anggaran (Rp)", {exact:true}).fill("15.000.000");
  await limits.getByLabel("Lahan tersedia (m²)", {exact:true}).fill("24");
  await limits.getByRole("button", {name:"Terapkan batas rencana",exact:true}).click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".constraint-meters")).toContainText("Rp15 jt");
  for (const [width,height] of [[1586,992],[1440,900],[1366,768],[1024,768],[390,844]] as const) {
    await page.setViewportSize({width,height});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await expect(page.locator(".composer-actions")).toBeVisible();
    await cleanShot(page,`interventions-${width}`);
    if (width === 1586 || width === 390) expect((await new AxeBuilder({page}).include(".intervention-atlas").analyze()).violations).toEqual([]);
  }
  await page.locator(".project-actions > summary").click();
  await page.getByRole("button", {name:"Simpan",exact:true}).click();
  await expect(page.locator(".save-state")).toContainText("Tersimpan");
  await page.reload();
  await page.locator('.local-projects > summary').click();
  const saved = page.locator(".local-projects").getByRole("button",{name:/^Contoh TIRTA/});
  await saved.click(); await navigate(page,"Intervensi");
  await expect(page.locator("[data-component]")).toHaveCount(4);
  await expect(page.locator(".constraint-meters")).toContainText("Rp15 jt");
  await page.locator("[data-component=tank-2] .instance-select").click();
  await page.locator(".treatment-composer").getByRole("button", { name:/Biaya & lahan/ }).click();
  await expect(page.locator(".treatment-composer").getByLabel("Biaya (Rp)",{exact:true})).toHaveValue("3.500.000");
  expect(errors).toEqual([]);
});
