import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, readFile } from "node:fs/promises";
import { alternativeSearch } from "../src/direction/productionBridge";
import { evaluatePlan } from "../src/domain/planningEngine";
import type { ProjectV2 } from "../src/domain/projectV2";

const folder = "evidence/uiux-candidate/comparison-workbench";
async function openComparison(page: Page, transform?: (p: ProjectV2) => void) {
  const fixture = JSON.parse(await readFile("evidence/uiux-candidate/fixtures/density-alternatives.tirta.json", "utf8")) as { project: ProjectV2 };
  transform?.(fixture.project);
  await page.goto("/tirta.html");
  const file = page.getByLabel("Buka berkas cadangan");
  for (const details of await file.locator("xpath=ancestor::details").all()) if (!await details.getAttribute("open")) await details.locator(":scope > summary").click();
  await file.setInputFiles({ name:"compare-stress.tirta.json", mimeType:"application/json", buffer:Buffer.from(JSON.stringify(fixture)) });
  await expect(page.getByRole("heading", { name:"Studio Persil", exact:true })).toBeVisible();
  const notice = page.getByRole("button", { name:"Tutup pemberitahuan" }); if (await notice.isVisible()) await notice.click();
  const nav = page.locator(".app-rail nav").getByRole("button", { name:"Bandingkan", exact:true, includeHidden:true });
  for (const details of await nav.locator("xpath=ancestor::details").all()) if (!await details.getAttribute("open")) await details.locator(":scope > summary").click();
  await nav.click();
  return fixture.project;
}
async function shot(page: Page, name: string) {
  await mkdir(folder, { recursive:true });
  await page.evaluate(async () => { await document.fonts.ready; scrollTo(0,0); });
  await page.screenshot({ path:`${folder}/${name}.png`, fullPage:true });
}

test("comparison shows canonical results, bounded candidates, three overlaid packages and a working decision", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  const project = await openComparison(page);
  await expect(page.locator(".compare-candidate input")).toHaveCount(16);
  await expect(page.locator(".compare-matrix tbody tr")).toHaveCount(3);
  await expect(page.locator(".scenario-chart svg > g[data-series-id]")).toHaveCount(4);
  const expected = alternativeSearch(project, project.scenarios[0]!.id).rows.slice(0,3);
  for (const [index,item] of expected.entries()) {
    const row = page.locator(".compare-matrix tbody tr").nth(index);
    for (const [scenarioIndex,scenario] of project.scenarios.entries()) {
      const result = evaluatePlan(project,item.plan,scenario.id); expect(result.ok).toBe(true);
      await expect(row.locator(".compare-residual").nth(scenarioIndex)).toContainText(result.ok ? new Intl.NumberFormat("id-ID", { maximumFractionDigits:2 }).format(result.value.residual) : "");
    }
  }
  expect(await page.locator(".compare-candidate-list").evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  await page.getByRole("button", { name:"Kosongkan perbandingan" }).click();
  await expect(page.getByRole("heading", { name:"Paket mana yang ingin Anda bandingkan?" })).toBeVisible();
  await page.getByLabel("Cari paket perbandingan").fill("Alternatif 16");
  await expect(page.locator(".compare-candidate")).toHaveCount(1);
  await page.locator(".compare-candidate input").check();
  await page.getByLabel("Cari paket perbandingan").fill("");
  await page.getByLabel("Bandingkan Alternatif 4",{exact:true}).check();
  await page.getByLabel("Bandingkan Alternatif 8",{exact:true}).check();
  await expect(page.getByLabel("Bandingkan Alternatif 2",{exact:true})).toBeDisabled();
  await page.getByRole("button", { name:"Lihat data per hujan" }).first().click();
  await expect(page.getByRole("dialog").locator(".compare-scenario-detail")).toHaveCount(2);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name:"Lihat data per hujan" }).first()).toBeFocused();
  for (const [width,height] of [[1920,1080],[1440,900],[1366,768],[1366,650],[1024,768],[390,844]] as const) {
    await page.setViewportSize({ width,height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
    if (width === 1440 || width === 390) expect((await new AxeBuilder({ page }).include(".comparison-workbench").analyze()).violations).toEqual([]);
    await shot(page, `compare-${width}-${height}`);
  }
  await page.getByRole("button", { name:"Angka & pilihan", exact:true }).click();
  await shot(page,"compare-mobile-matrix");
  expect((await new AxeBuilder({ page }).include(".comparison-workbench").analyze()).violations).toEqual([]);
  await page.locator(".compare-mobile-switch button").last().click();
  await page.locator(".compare-matrix tr.mobile-active .primary").click();
  await expect(page.locator(".decision-canvas")).toBeVisible();
  expect(errors).toEqual([]);
});

test("UNKNOWN scenario stays unavailable with accessible reasons instead of a fabricated zero", async ({ page }) => {
  await openComparison(page, project => {
    const s = project.scenarios[1]!;
    const rain = project.parameters.find(p => p.id === s.rainfall.id)!;
    rain.value = null; rain.evidence = "UNKNOWN"; rain.source = ""; s.rainfall.evidence = "UNKNOWN";
  });
  for (const row of await page.locator(".compare-matrix tbody tr").all()) await expect(row.locator(".compare-residual").nth(1)).toContainText("Belum tersedia");
  await page.getByRole("button", { name:"Lihat data per hujan" }).first().click();
  const section = page.getByRole("dialog").locator(".compare-scenario-detail").nth(1);
  await expect(section).toContainText("Hasil belum tersedia");
  expect(await section.locator("li").count()).toBeGreaterThan(0);
  await shot(page,"unknown-reasons");
});

test("long compositions and five rain scenarios stay inside the workbench on desktop and mobile", async ({ page }) => {
  await openComparison(page, project => {
    for (const component of project.components) component.name = (component.name + " — pemeriksaan sambungan dan pemeliharaan berkala").slice(0,120);
    for (let i=0;i<3;i++) project.scenarios.push({ ...project.scenarios[1]!, id:`extra-${i}`, name:`Skenario tambahan ${i+1} — hujan uji dengan catatan kondisi yang belum lengkap` });
  });
  const longRain = page.locator(".compare-heading-scenarios .scenario-switch button > span").last();
  expect(await longRain.evaluate(el => getComputedStyle(el).textOverflow)).toBe("ellipsis");
  expect(await longRain.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
  const longPackage = page.locator(".compare-candidate").last();
  expect(await longPackage.locator("strong").evaluate(el => getComputedStyle(el).textOverflow)).toBe("ellipsis");
  await longPackage.getByRole("button", { name:/Lihat detail/ }).click();
  await expect(page.getByRole("dialog")).toContainText("pemeriksaan sambungan dan pemeliharaan berkala");
  await expect(page.getByRole("dialog")).toContainText("Skenario tambahan 3 — hujan uji dengan catatan kondisi yang belum lengkap");
  await page.keyboard.press("Escape");
  for (const width of [1366,390]) {
    await page.setViewportSize({ width,height:width===390?844:768 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
    await expect(page.locator(".compare-matrix tbody tr")).toHaveCount(3);
    await expect(page.locator(".compare-matrix tbody tr").first().locator(".compare-residual")).toHaveCount(5);
    if (width === 390) await page.getByRole("button", { name:"Angka & pilihan", exact:true }).click();
    await shot(page,`long-many-rain-${width}`);
  }
});

test('touch comparison keeps the choose action visible and compacts rain detail', async ({ page }) => {
  await page.setViewportSize({ width:820, height:1180 });
  await openComparison(page);
  const choose = page.locator('.compare-matrix tbody tr').first().locator('.compare-actions .primary');
  const box = await choose.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(820);
  expect(box!.width).toBeGreaterThan(600);
  await page.getByRole('button', { name:'Lihat data per hujan' }).first().click();
  await page.setViewportSize({ width:390, height:844 });
  const dialog = page.getByRole('dialog');
  const dialogBox = await dialog.boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(dialogBox!.width).toBeLessThanOrEqual(371);
  expect(dialogBox!.height).toBeLessThanOrEqual(650);
  expect(await dialog.locator('.context-dialog-body').evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
});
