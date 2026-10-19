import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, readFile } from "node:fs/promises";
import type { ProjectV2 } from "../src/domain/projectV2";
import { alternativeSearch, demoProject, fmt } from "../src/direction/productionBridge";
import { evaluatePlan } from "../src/domain/planningEngine";

const folder = "evidence/uiux-candidate/alternatives-reference";
async function route(page:Page,name:string) {
  const mobile=page.getByLabel("Ruang kerja",{exact:true});
  if(await mobile.isVisible()) await mobile.selectOption({label:name});
  else {
    const button=page.locator(".app-rail nav").getByRole("button",{name,exact:true,includeHidden:true});
    for(const details of await button.locator("xpath=ancestor::details").all()) if(!await details.getAttribute("open")) await details.locator(":scope > summary").click();
    await button.click();
  }
  await page.evaluate(()=>scrollTo(0,0));
}
async function imported(page:Page,count:4|16) {
  const fixture=JSON.parse(await readFile("evidence/uiux-candidate/fixtures/density-alternatives.tirta.json","utf8")) as {project:ProjectV2};
  if(count===4) {
    fixture.project.optionGroups=fixture.project.optionGroups.filter(g=>["choice-soak","choice-porous"].includes(g.id));
    fixture.project.components.forEach(c=>{if(!["soak","porous"].includes(c.id)) c.enabled=false; c.name=c.name.split(" — ")[0]!;});
  }
  await page.goto("/tirta.html");
  const file=page.getByLabel("Buka berkas cadangan");
  for(const details of await file.locator("xpath=ancestor::details").all()) if(!await details.getAttribute("open")) await details.locator(":scope > summary").click();
  await file.setInputFiles({name:"synthetic-layout.tirta.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(fixture))});
  await expect(page.getByRole("heading",{name:"Studio Persil",exact:true})).toBeVisible();
  const notice=page.getByRole("button",{name:"Tutup pemberitahuan"});if(await notice.isVisible())await notice.click();
  return fixture.project;
}
async function shot(page:Page,name:string) {
  await mkdir(folder,{recursive:true});
  await page.evaluate(async()=>{await document.fonts.ready;scrollTo(0,0);});
  await page.screenshot({path:`${folder}/${name}.png`,fullPage:true});
}

test("Alternatif itself uses the reference navigator, live chart and compact matrix",async({page})=>{
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  const project=await imported(page,4);await route(page,"Alternatif");
  const expected=alternativeSearch(project,project.scenarios[0]!.id).rows;
  expect(expected).toHaveLength(4);
  await expect(page.locator(".compare-candidate input")).toHaveCount(4);
  await expect(page.locator(".compare-matrix tbody tr")).toHaveCount(3);
  for(const [index,row] of expected.slice(0,3).entries()) await expect(page.locator(".compare-matrix tbody tr").nth(index).locator(".compare-residual").first()).toContainText(fmt(row.result!.residual));
  for(const [width,height] of [[1920,1080],[1586,992],[1440,900],[1366,768],[1366,650],[1024,768],[390,844]] as const) {
    await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));
    if(width>=1366) {
      const chart=await page.locator(".scenario-chart").boundingBox();const navigator=await page.locator(".compare-navigator").boundingBox();
      expect(Math.abs(navigator!.y-chart!.y)).toBeLessThan(2);expect(chart!.y).toBeLessThan(310);
      expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBeLessThan(1500);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await shot(page,`alternatif-reference-${width}-${height}`);
  }
  expect((await new AxeBuilder({page}).include(".comparison-workbench").analyze()).violations).toEqual([]);
  expect(errors).toEqual([]);
});

test("scientific search and package explanations remain reachable without displacing the chart",async({page})=>{
  await imported(page,4);await route(page,"Alternatif");
  await expect(page.locator(".alternatives-method")).toHaveCount(0);
  const source=page.getByRole("button",{name:"Dasar pencarian & pilihan tersisih"});
  await source.click();await expect(page.getByRole("dialog")).toContainText("Pareto");
  await expect(page.getByRole("dialog")).toContainText("pilih");
  await page.keyboard.press("Escape");await expect(source).toBeFocused();
  const detail=page.getByRole("button",{name:"Lihat data per hujan"}).nth(1);
  await detail.click();await expect(page.getByRole("dialog")).toContainText("Kelebihan & konsekuensi");
  await expect(page.getByRole("dialog").locator(".compare-scenario-detail")).toHaveCount(2);
  await page.keyboard.press("Escape");await expect(detail).toBeFocused();
});

test("sixteen alternatives retain bounded browsing, filtering, pin transfer and a working choice",async({page})=>{
  await imported(page,16);await route(page,"Alternatif");
  const list=page.getByRole("region",{name:"Daftar paket perbandingan",exact:true});
  await expect(page.locator(".compare-candidate input")).toHaveCount(16);
  expect(await list.evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
  const search=page.getByLabel("Cari paket perbandingan");await search.fill("tidak-ada-paket-ini");
  await expect(list).toContainText("Tidak ada paket lain yang cocok");
  await search.fill("");await page.getByRole("button",{name:"Kosongkan perbandingan"}).click();
  await list.focus();await page.keyboard.press("End");
  await expect.poll(()=>list.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
  await page.getByLabel("Bandingkan Alternatif 16",{exact:true}).check();
  await expect(page.locator(".compare-matrix tbody tr")).toHaveCount(1);
  await route(page,"Bandingkan");await expect(page.getByLabel("Bandingkan Alternatif 16",{exact:true})).toBeChecked();
  await route(page,"Alternatif");
  for(const width of [1440,1366,390]) {
    await page.setViewportSize({width,height:width===390?844:768});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await shot(page,`alternatif-sixteen-${width}`);
  }
  await page.getByRole("button",{name:"Angka & pilihan",exact:true}).click();
  await page.locator(".compare-matrix tr.mobile-active .primary").click();
  await expect(page.locator(".decision-canvas")).toBeVisible();
});

test("reference comparison labels stay inside their bounds and represent canonical values",async({page})=>{
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  const project=await imported(page,16);await route(page,"Bandingkan");
  await page.getByRole("button",{name:"Kosongkan perbandingan"}).click();
  for(const n of [9,5,13]) await page.getByLabel(`Bandingkan Alternatif ${n}`,{exact:true}).check();
  const selected=alternativeSearch(project,project.scenarios[0]!.id).rows.filter(row=>["Alternatif 9","Alternatif 5","Alternatif 13"].includes(row.name));
  for(const [width,height] of [[1586,992],[1440,900],[1366,650],[390,844]] as const) {
    await page.setViewportSize({width,height});
    if(width>=1366) {
      const navigator=await page.locator(".compare-navigator").boundingBox();const chart=await page.locator(".scenario-chart").boundingBox();
      expect(Math.abs(navigator!.y-chart!.y)).toBeLessThan(2);
      expect(await page.locator(".compare-pinned-list").getByRole("checkbox",{checked:true}).count()).toBe(3);
      const annotations=page.locator(".endpoint-label");await expect(annotations).toHaveCount(4);
      for(const label of await annotations.all()) {
        const fits=await label.evaluate(el=>{const a=el.getBoundingClientRect();const b=el.parentElement!.getBoundingClientRect();return a.top>=b.top-1&&a.bottom<=b.bottom+1;});expect(fits).toBe(true);
      }
      await expect(page.locator(".scenario-chart .plot-value")).toHaveCount(8);
      for(const row of selected) {
        const evaluated=evaluatePlan(project,row.plan,project.scenarios[1]!.id);expect(evaluated.ok).toBe(true);
        if(evaluated.ok) await expect(page.locator(".scenario-chart svg")).toContainText(fmt(evaluated.value.residual));
      }
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    if(width===1586) expect((await new AxeBuilder({page}).include(".comparison-workbench").analyze()).violations).toEqual([]);
    if(width===390) {
      await page.getByRole("button",{name:"Pilih paket",exact:true}).click();
      await expect(page.locator(".compare-navigator")).toBeVisible();
      await expect(page.locator(".scenario-chart")).toBeHidden();
      await page.getByRole("button",{name:"Grafik hujan",exact:true}).click();
      await expect(page.locator(".compare-navigator")).toBeHidden();
      await expect(page.locator(".scenario-chart")).toBeVisible();
      await page.getByRole("button",{name:"Angka & pilihan",exact:true}).click();
      await expect(page.locator(".comparison-top")).toBeHidden();
      await expect(page.locator(".compare-matrix-section")).toBeVisible();
    }
    await shot(page,`reference-compare-${width}-${height}`);
  }
  expect((await new AxeBuilder({page}).include(".comparison-workbench").analyze()).violations).toEqual([]);
  expect(errors).toEqual([]);
});


test("representative authored demo follows the reference composition with visibly distinct canonical curves",async({page})=>{
  const project=demoProject(true);
  project.optionGroups=project.optionGroups.filter(g=>["choice-tank","choice-soak"].includes(g.id));
  project.components.forEach(c=>{c.enabled=["tank","soak"].includes(c.id);});
  await page.goto("/tirta.html");
  const file=page.getByLabel("Buka berkas cadangan");
  for(const details of await file.locator("xpath=ancestor::details").all()) if(!await details.getAttribute("open")) await details.locator(":scope > summary").click();
  await file.setInputFiles({name:"representative-synthetic.tirta.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify({format:"tirta-project",formatVersion:1,project}))});
  await expect(page.getByRole("heading",{name:"Studio Persil",exact:true})).toBeVisible();
  const notice=page.getByRole("button",{name:"Tutup pemberitahuan"});if(await notice.isVisible())await notice.click();
  await page.setViewportSize({width:1586,height:992});await route(page,"Alternatif");
  await page.getByRole("button",{name:"Kosongkan perbandingan"}).click();
  const rows=alternativeSearch(project,project.scenarios[0]!.id).rows;
  for(const row of rows.filter(r=>r.optionIds.length))await page.getByLabel(`Bandingkan ${row.name}`,{exact:true}).check();
  await expect(page.locator(".annotated-scenario-chart")).toBeVisible();
  for(const row of rows.filter(r=>r.optionIds.length)){
    const evaluated=evaluatePlan(project,row.plan,project.scenarios[0]!.id);
    expect(evaluated.ok).toBe(true);
    if(evaluated.ok)await expect(page.locator(".scenario-chart svg")).toContainText(fmt(evaluated.value.residual));
  }
  await shot(page,"reference-representative-1586");
});
