import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, readFile } from "node:fs/promises";
import { demoProject, alternativeSearch, fmt } from "../src/direction/productionBridge";
import { evaluatePlan } from "../src/domain/planningEngine";
import { saveRain, saveComponent, readInput } from "../src/domain/planningAuthoring";
import type { ProjectV2 } from "../src/domain/projectV2";

const folder = "evidence/uiux-candidate/plan-workbench";
async function route(page: Page, name: string) {
  const button = page.locator(".app-rail nav").getByRole("button", { name, exact:true, includeHidden:true });
  for (const details of await button.locator("xpath=ancestor::details").all()) if (!await details.getAttribute("open")) await details.locator(":scope > summary").click();
  await button.click();
}
async function chosenPlan(page: Page, missingAdditionalCapacity = false) {
  await page.goto("/tirta.html");
  const input = page.getByLabel("Buka berkas cadangan");
  for (const d of await input.locator("xpath=ancestor::details").all()) if (!await d.getAttribute("open")) await d.locator(":scope > summary").click();
  if (missingAdditionalCapacity) {
    const fixture = JSON.parse(await readFile("evidence/uiux-candidate/fixtures/density-alternatives.tirta.json","utf8")) as { project: ProjectV2 };
    for (const component of fixture.project.components) delete component.performanceByScenario[fixture.project.scenarios[1]!.id];
    await input.setInputFiles({ name:"missing-capacity.tirta.json", mimeType:"application/json", buffer:Buffer.from(JSON.stringify(fixture)) });
  } else await input.setInputFiles("evidence/uiux-candidate/fixtures/density-alternatives.tirta.json");
  await route(page,"Bandingkan");
  await expect(page.getByRole('heading',{level:1,name:'Alternatif',exact:true})).toBeVisible();
  await page.getByRole("button", { name:"Kosongkan perbandingan", exact:true }).click();
  await page.getByLabel("Bandingkan Alternatif 16", { exact:true }).check();
  await page.locator('.comparison-row').filter({hasText:'Alternatif 16'}).getByRole('button',{name:'Pilih rencana ini',exact:true}).click();
  const notice = page.getByRole("button", { name:"Tutup pemberitahuan" }); if (await notice.isVisible().catch(()=>false)) await notice.click({timeout:1000}).catch(()=>{});
}
async function shot(page: Page, name: string) {
  await mkdir(folder, { recursive:true }); await page.evaluate(async () => { await document.fonts.ready; scrollTo(0,0); });
  await page.screenshot({ path:`${folder}/${name}.png`, fullPage:true });
}

test("plan summary is bounded, live, accessible and exportable; deeper views retain notes and field work", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await chosenPlan(page);
  await expect(page.getByRole("tab", { name:"Ringkasan", exact:true })).toHaveAttribute("aria-selected","true");
  await expect(page.locator(".decision-canvas")).toBeVisible();
  await expect(page.locator(".decision-conclusion")).toBeHidden();
  await expect(page.locator(".plan-summary .water-partition .equation-note")).toContainText("6,27 =");
  await expect(page.locator(".plan-option")).toHaveCount(4);
  for (const [width,height] of [[1920,1080],[1440,900],[1366,768],[1366,650],[1024,768],[390,844]] as const) {
    await page.setViewportSize({ width,height });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1)).toBe(true);
    if (width >= 1366) await expect(page.getByRole("button", { name:"Unduh / ekspor", exact:true })).toBeInViewport();
    if (width === 1440 || width === 390) expect((await new AxeBuilder({ page }).include(".view-impact").analyze()).violations).toEqual([]);
    await shot(page,`summary-${width}-${height}`);
  }
  await page.locator(".plan-summary .volume-legend button").last().focus(); await page.keyboard.press("Enter");
  await expect(page.locator(".plan-summary .volume-chart .chart-reading")).toContainText("Sisa limpasan");
  await page.getByRole("button", { name:"Lihat alasan & bukti", exact:true }).click();
  await expect(page.getByRole("tab", { name:"Penjelasan lengkap", exact:true })).toBeFocused();
  await page.getByRole("tab", { name:"Ringkasan", exact:true }).click();
  await page.getByRole("tab", { name:"Ringkasan", exact:true }).focus(); await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name:"Penjelasan lengkap", exact:true })).toBeFocused();
  await page.getByRole("button", { name:"Isi & alasan paket", exact:true }).click();
  await expect(page.locator(".decision-conclusion")).toBeVisible();
  const note = page.getByLabel("Alasan pilihan (opsional)");
  for (const d of await note.locator("xpath=ancestor::details").all()) if (!await d.getAttribute("open")) await d.locator(":scope > summary").click();
  await note.fill("Saya memilih kombinasi ini untuk meninjau biaya dan sisa air bersama pembina.");
  await page.getByRole("tab", { name:"Langkah lapangan", exact:true }).click();
  await expect(page.getByRole("button", { name:"Catat sebelum & sesudah", exact:true })).toBeVisible();
  await page.getByRole("button", { name:"Catat sebelum & sesudah", exact:true }).click();
  await expect(page.getByRole("dialog")).toBeVisible(); await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name:"Catat sebelum & sesudah", exact:true })).toBeFocused();
  await shot(page,"field-mobile");
  await page.getByRole("tab", { name:"Penjelasan lengkap", exact:true }).click(); await page.getByRole("button", {name:"Isi & alasan paket",exact:true}).click(); await expect(note).toHaveValue(/Saya memilih kombinasi/);
  await page.getByRole("tab", { name:"Ringkasan", exact:true }).click();
  await page.getByRole("button", { name:"Unduh / ekspor", exact:true }).click();
  const [download] = await Promise.all([page.waitForEvent("download"),page.getByRole("button", { name:"Laporan HTML", exact:true }).click()]);
  const report = await readFile((await download.path())!,"utf8"); expect(report).toContain("Saya memilih kombinasi"); expect(report).toContain("Metode dan batas penggunaan"); expect(report).toContain("Neraca konservasi");
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width:1440,height:900 });
  await page.locator(".project-actions > summary").click(); await page.getByRole("button", { name:"Simpan", exact:true }).click();
  await page.reload(); await page.locator(".local-projects > summary").click(); await page.locator(".local-projects button").filter({ hasText:"Synthetic alternatives" }).first().click(); await route(page,"Rencana & Dampak");
  await page.getByRole("tab", { name:"Penjelasan lengkap", exact:true }).click();
  await page.getByRole("button", {name:"Isi & alasan paket",exact:true}).click();
  const saved = page.getByLabel("Alasan pilihan (opsional)");
  for (const d of await saved.locator("xpath=ancestor::details").all()) if (!await d.getAttribute("open")) await d.locator(":scope > summary").click();
  await expect(saved).toHaveValue(/Saya memilih kombinasi/);
  expect(errors).toEqual([]);
});

test("recommendation count exposes every implementation check", async ({ page }) => {
  await chooseProject(page,demoProject(true));
  await page.getByRole('tab',{name:'Rekomendasi',exact:true}).click();
  const recommendation=page.locator('.plan-recommendation');
  const headline=(await recommendation.locator('.plan-recommendation-hero h3').innerText()).trim();
  const match=headline.match(/(\d+) pemeriksaan/);expect(match).not.toBeNull();const count=Number(match![1]);expect(count).toBeGreaterThan(6);
  const priority=recommendation.locator('.plan-recommendation-grid').first().locator('section').nth(1);
  await expect(priority.getByRole('button',{name:new RegExp(`Lihat semua ${count} pemeriksaan`,'i')})).toBeVisible();
  await priority.getByRole('button',{name:new RegExp(`Lihat semua ${count} pemeriksaan`,'i')}).click();
  await expect(priority.locator('li')).toHaveCount(count);
  await expect(recommendation).toContainText(/seluruh penanganan dalam paket/i);
});

test("changed rainfall cannot bypass readiness to export an outdated plan", async ({ page }) => {
  await chosenPlan(page); await route(page,"Hujan & kondisi awal");
  await page.getByLabel("Kedalaman hujan", { exact:true }).fill("60");
  await page.getByRole("button", { name:/Terapkan hujan/ }).click(); await route(page,"Rencana & Dampak");
  await expect(page.getByRole("button", { name:"Unduh / ekspor", exact:true })).toHaveCount(0);
  await expect(page.locator(".plan-workbench")).toHaveCount(0);
  await expect(page.getByText(/Data berubah atau rencana belum memenuhi syarat saat ini/)).toBeVisible();
  await shot(page,"stale-plan-recovery");
});

test("a chosen package with UNKNOWN capacity for additional rain opens its explanation without a false result", async ({ page }) => {
  await chosenPlan(page,true);
  await page.locator(".plan-masthead .scenario-switch button").filter({ hasText:"100 mm" }).click();
  await expect(page.getByRole("tab", { name:"Ringkasan", exact:true })).toBeDisabled();
  await expect(page.getByRole("tab", { name:"Penjelasan lengkap", exact:true })).toHaveAttribute("aria-selected","true");
  await expect(page.getByRole("heading", { name:"Kesimpulan belum tersedia" })).toBeVisible();
  await expect(page.getByRole("button", { name:"Unduh / ekspor", exact:true })).toBeDisabled();
  await expect(page.locator(".decision-canvas")).toHaveCount(0);
  await shot(page,"unknown-additional-rain");
});

async function chooseProject(page:Page,project:ProjectV2) {
  await page.goto("/tirta.html"); const input=page.getByLabel("Buka berkas cadangan");
  for(const d of await input.locator("xpath=ancestor::details").all()) if(!await d.getAttribute("open")) await d.locator(":scope > summary").click();
  await input.setInputFiles({name:"plan-visual.tirta.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify({format:"tirta-project",formatVersion:1,project}))});
  await route(page,"Bandingkan");
  await expect(page.getByRole('heading',{level:1,name:'Alternatif',exact:true})).toBeVisible();
  const rows=alternativeSearch(project,project.scenarios[0]!.id).rows;
  const row=[...rows].sort((a,b)=>b.optionIds.length-a.optionIds.length)[0]!;
  await page.getByRole("button",{name:"Kosongkan perbandingan",exact:true}).click();
  await page.getByLabel(`Bandingkan ${row.name}`,{exact:true}).check();
  await page.locator('.comparison-row').filter({hasText:row.name}).getByRole('button',{name:'Pilih rencana ini',exact:true}).click();
  const notice=page.getByRole("button",{name:"Tutup pemberitahuan"});if(await notice.isVisible().catch(()=>false))await notice.click({timeout:1000}).catch(()=>{});
  return row;
}

test("reference plan shows live conservation, all four explanation topics and accessible component details",async({page})=>{
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  const project=demoProject(true),row=await chooseProject(page,project);
  const result=evaluatePlan(project,row.plan,project.scenarios[0]!.id);expect(result.ok).toBe(true);if(!result.ok)return;
  const flow=page.locator(".plan-summary .plan-water-flow");
  await expect(flow.locator(".plan-flow-origin")).toContainText("6,27");
  await expect(flow.locator(".plan-flow-origin")).toContainText("(100%)");
  await expect(flow.locator(".plan-flow-art > svg")).toHaveAttribute("viewBox","0 0 650 205");
  await expect(flow.locator(".plan-flow-leader")).toHaveCount(3);
  await expect(flow.locator("rect[data-terminal]")).toHaveCount(3);
  const terminals=await flow.locator("rect[data-terminal]").evaluateAll(rects=>rects.map(rect=>({x:Number(rect.getAttribute("x")),width:Number(rect.getAttribute("width")),y:Number(rect.getAttribute("y")),height:Number(rect.getAttribute("height"))})));
  expect(terminals.every(rect=>rect.x===563 && rect.width===24 && rect.y>=0 && rect.y+rect.height<=205)).toBe(true);
  const volumes=await flow.locator("svg path[data-volume]").evaluateAll(paths=>paths.map(path=>Number(path.getAttribute("data-volume"))));
  expect(volumes.reduce((a,b)=>a+b,0)).toBeCloseTo(6.27,10);
  await expect(flow.locator(".plan-flow-labels")).toContainText(fmt(result.value.residual));
  await flow.locator(".plan-flow-stage").screenshot({path:`${folder}/reference-flow-detail.png`});
  for(const [width,height] of [[1586,992],[1440,900],[1366,650],[390,844]] as const){
    await page.setViewportSize({width,height});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    if(width>=1366){
      const art=await flow.locator(".plan-flow-art").boundingBox(),labels=await flow.locator(".plan-flow-labels").boundingBox();
      expect(art).not.toBeNull();expect(labels).not.toBeNull();
      expect(art!.x+art!.width).toBeLessThanOrEqual(labels!.x+1);
    }
    await shot(page,`reference-${width}-${height}`);
  }
  await page.locator(".plan-summary .plan-option").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();await expect(page.getByRole("dialog")).toContainText("Kapasitas kejadian");await page.keyboard.press("Escape");
  await expect(page.locator(".plan-summary .plan-option").first()).toBeFocused();
  await page.getByRole("tab",{name:"Penjelasan lengkap",exact:true}).click();
  for(const topic of ["Dampak air","Isi & alasan paket","Data & sumber","Verifikasi"]){
    await page.getByRole("button",{name:topic,exact:true}).click();
    await expect(page.getByRole("button",{name:topic,exact:true})).toHaveAttribute("aria-pressed","true");
    expect((await new AxeBuilder({page}).include(".view-impact").analyze()).violations).toEqual([]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    if(topic==="Dampak air")await expect(page.locator(".plan-explanation-flow")).toBeVisible();
    if(topic==="Isi & alasan paket")await expect(page.locator(".plan-targets")).toBeVisible();
    if(topic==="Data & sumber")await expect(page.locator(".plan-data-provenance")).toBeVisible();
    if(topic==="Verifikasi")await expect(page.locator(".plan-check-provenance")).toBeVisible();
  }
  await page.getByRole("button",{name:"Dampak air",exact:true}).click();await shot(page,"explanation-water-mobile");
  await page.setViewportSize({width:1440,height:900});await shot(page,"explanation-water-desktop");
  expect(errors).toEqual([]);
});

test("plan flow separates reuse from stored water and renders zero runoff without a false percentage",async({page})=>{
  let project=demoProject(true);const rain=project.scenarios[0]!,tank=project.components.find(c=>c.family==="storage")!;
  const perf=tank.performanceByScenario[rain.id]!;if(!("reuse" in perf))throw Error("Expected storage performance");
  project=saveComponent(project,{id:tank.id,name:tank.name,family:tank.family,targets:tank.targets,siteId:tank.installationSiteId!,connection:tank.connectionNote,applicability:perf.applicability,cost:readInput(project,tank.totalCost),area:readInput(project,tank.occupiedArea),scenarioId:rain.id,capacity:readInput(project,perf.availableStorage,rain.id),reuse:{text:"0.1",source:"Explicit synthetic reuse demand",evidence:"DEMO"}});
  const row=await chooseProject(page,project);const result=evaluatePlan(project,row.plan,rain.id);expect(result.ok).toBe(true);if(!result.ok)return;
  expect(result.value.reused).toBe(0.1);
  await expect(page.locator(".plan-summary .plan-flow-labels")).toContainText("Dimanfaatkan");
  const values=await page.locator(".plan-summary svg path[data-volume]").evaluateAll(paths=>paths.map(path=>Number(path.getAttribute("data-volume"))));
  expect(values.reduce((a,b)=>a+b,0)).toBeCloseTo(6.27,10);
  project=saveRain(demoProject(true),rain.id,"Zero-rain scenario",{text:"0",source:"Explicit synthetic zero rain",evidence:"DEMO"},"Synthetic boundary case");
  await chooseProject(page,project);
  await expect(page.locator(".plan-summary .plan-flow-origin")).toContainText("0 m³");
  await expect(page.locator(".plan-summary .plan-flow-labels")).toContainText("Persentase tidak berlaku");
  await expect(page.locator(".plan-summary .plan-impact-strip")).not.toContainText("NaN");
  await expect(page.locator(".plan-summary svg path[data-volume]")).toHaveCount(0);
  await expect(page.locator(".plan-summary rect[data-terminal]")).toHaveCount(0);
  await expect(page.locator(".plan-summary .plan-flow-origin")).not.toContainText("100%");
});
