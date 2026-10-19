import { test, expect, type Page, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

const evidence = "evidence/uiux-candidate";
const runtimeErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  await mkdir(evidence, { recursive: true });
  page.setDefaultTimeout(10000);
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
});
test.afterEach(async ({ page }) => { expect(runtimeErrors.get(page)).toEqual([]); });
async function reveal(target: Locator) {
  for (const details of await target.locator("xpath=ancestor::details").all()) if (!await details.getAttribute("open")) await details.locator(":scope > summary").click();
}
async function route(page: Page, name: string) {
  const mobile = page.getByLabel("Ruang kerja", { exact: true });
  if (await mobile.isVisible()) await mobile.selectOption({ label: name });
  else { const button = page.locator(".app-rail nav").getByRole("button", { name, exact: true, includeHidden: true }); await reveal(button); await button.click(); }
}
async function imported(page: Page, name: string) {
  await page.goto("/production.html");
  const file = page.getByLabel("Buka berkas cadangan"); await reveal(file);
  await file.setInputFiles(`${evidence}/fixtures/${name}.tirta.json`);
  await expect(page.getByRole("heading", { name: "Studio Persil", exact: true })).toBeVisible();
  const notice = page.getByRole("button", {name:"Tutup pemberitahuan"}); if (await notice.isVisible()) await notice.click();
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}
async function shot(page: Page, name: string) {
  await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: `${evidence}/${name}.png`, fullPage: true });
}

test("fresh parcel, missing coefficient recovery, contextual help, delete and undo", async ({ page }) => {
  await page.goto("/production.html"); await shot(page, "project");
  await page.getByLabel("Nama proyek", { exact: true }).fill("Rumah — uji kandidat UI");
  await page.getByRole("button", { name: "Buat proyek baru" }).click();
  await page.getByLabel("Panjang persil").fill("15"); await page.getByLabel("Lebar persil").fill("10");
  await page.getByRole("button", { name: "Buat persil", exact: true }).click();
  await page.getByRole("button", { name: "Zona", exact: true }).click();
  await page.getByRole("button", { name: "Seluruh persil" }).click();
  await page.getByLabel("Jenis permukaan", { exact: true }).selectOption("roof");
  await route(page, "Hujan & kondisi awal");
  await expect(page.locator('.coefficient-launch')).toBeFocused();
  await shot(page, "studio-incomplete");
  const closeGuide = page.getByRole("button", { name: "Tutup petunjuk" }); if (await closeGuide.isVisible()) await closeGuide.click();
  await page.getByRole("button", { name: "Mengapa C?", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Dasar TIRTA" })).toContainText("Permukaan & koefisien");
  await shot(page, "dasar-coefficient");
  await page.getByRole("dialog", { name: "Dasar TIRTA", exact: true }).getByRole("button", { name: "Kembali ke pekerjaan saya" }).click();
  await expect(page.getByRole("dialog", { name: "Dasar TIRTA", exact: true })).toBeHidden();
  await page.locator('.coefficient-launch').click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Terapkan", exact:true })).toBeInViewport();
  await dialog.getByRole("button", { name: /Tengah rentang/ }).first().click();
  await dialog.getByRole("button", { name: "Terapkan", exact:true }).click();
  await expect(page.locator(".register-total")).toContainText("150 / 150");
  await page.locator(".parcel-svg").focus(); await page.keyboard.press("Delete");
  await page.getByRole("button", { name: "Ya, hapus zona" }).click(); await expect(page.locator(".zone-row")).toHaveCount(0);
  await page.getByRole("button", { name: "Urungkan sketsa" }).click(); await expect(page.locator(".zone-row")).toHaveCount(1);
  await route(page, "Hujan & kondisi awal");
  await page.getByLabel("Kedalaman hujan", { exact: true }).fill("60");
  await page.getByRole("button", { name: /Terapkan hujan & hitung/ }).click();
  await expect(page.locator(".rain-equation")).toContainText("9 m³"); await shot(page, "rainfall");
  await noOverflow(page);
});

test("normal Studio: header and instruments do not collide across desktop and mobile", async ({ page }) => {
  await page.goto("/production.html"); await page.getByRole("button", { name: "Buka Contoh", exact: true }).click();
  await page.locator(".zone-row").nth(3).click();
  await page.getByRole("button", { name: "Tutup pemberitahuan" }).click();
  await page.locator(".zone-shape").first().hover();
  await expect(page.locator(".property-bench h2")).toHaveText("Taman");
  await expect(page.locator(".map-zone-readout")).toContainText("Terpilih: Taman");
  for (const [width, height] of [[1920,1080],[1707,1067],[1536,864],[1440,900],[1366,650],[1280,800],[1024,768],[834,1112],[390,844]] as const) {
    await page.setViewportSize({ width, height }); await noOverflow(page);
    const navCenters = await page.locator(".workflow-navigation > button, .comparison-navigation > summary").evaluateAll(elements => elements.map(element => { const b = element.getBoundingClientRect(); return b.y + b.height / 2; }));
    expect(Math.max(...navCenters) - Math.min(...navCenters)).toBeLessThanOrEqual(1);
    if (width <= 960) await expect(page.locator(".mobile-zone-summary")).toBeVisible();
    if (width > 960) {
      const tool = await page.locator(".map-toolstrip").boundingBox(); const panel = await page.locator(".property-bench").boundingBox();
      expect(tool!.x + tool!.width + 12).toBeLessThanOrEqual(panel!.x);
      const canvas = await page.locator(".studio-layout .parcel-svg").boundingBox();
      expect(panel!.x + panel!.width + 12).toBeLessThanOrEqual(canvas!.x);
      await expect(page.locator('.coefficient-launch')).toBeInViewport();
      if (height >= 864) {
        const next = await page.locator(".register-next .primary").boundingBox();
        expect(next!.y + next!.height).toBeLessThanOrEqual(height);
      }
      if (width > 1120) {
        const bounds = await page.locator(".app-rail .wordmark, .app-rail nav, .project-header, .rail-bottom").evaluateAll(elements => elements.map(element => element.getBoundingClientRect().toJSON()));
        for (let i = 1; i < bounds.length; i++) expect(bounds[i - 1]!.right).toBeLessThanOrEqual(bounds[i]!.left + 1);
      }
    }
    await shot(page, `studio-${width}`);
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.locator(".mobile-zone-summary").click();
  await expect(page.getByRole("dialog", {name:"Data zona", exact:true})).toBeVisible();
  await page.getByRole("button", { name: "Mengapa C?", exact: true }).click();
  await expect(page.getByRole("dialog", { name:"Dasar TIRTA", exact:true }).getByRole("button", { name: /Kembali/ })).toBeInViewport();
  await shot(page, "dasar-mobile"); await noOverflow(page);
});

test("20 zones: bounded navigator, full active name, UNKNOWN and persistent selection data", async ({ page }) => {
  await imported(page, "density-unknown"); await expect(page.locator(".zone-row")).toHaveCount(20);
  await expect(page.locator(".register-title")).toContainText("20 zona");
  await expect(page.locator(".register-title")).toBeVisible();
  expect(await page.locator(".zone-navigator-list").evaluate(e => e.scrollHeight > e.clientHeight)).toBe(true);
  await page.getByLabel("Cari zona").fill("Zona 20 —"); await expect(page.locator(".zone-row")).toHaveCount(1);
  await page.locator(".zone-row").click(); await expect(page.locator(".property-bench h2")).toContainText("Zona 20 — halaman belajar dan fasilitas bersama");
  await noOverflow(page); await shot(page, "density-studio");
  await page.getByLabel("Cari zona").fill("Zona 1 —"); await page.locator(".zone-row").click();
  await expect(page.locator('.coefficient-launch')).toContainText('Belum dipilih');
  for (const width of [1440,390]) { await page.setViewportSize({ width, height:width===390?844:900 }); await noOverflow(page); await shot(page, `density-unknown-${width}`); }
  const save = page.getByRole("button", { name: "Simpan", exact: true, includeHidden: true }); await reveal(save); await save.click();
  await expect(page.locator(".save-state")).toContainText("Tersimpan"); await page.reload();
  await page.locator(".local-projects > summary").click();
  await page.locator(".local-projects button").filter({ hasText:"Synthetic density" }).first().click();
  await expect(page.locator(".zone-row")).toHaveCount(20);
});

test("12 canonical intervention instances remain visible and only the chosen instance opens an editor", async ({ page }) => {
  await imported(page, "density-known"); await route(page,"Hujan & kondisi awal");
  await page.locator(".scenario-switch button").filter({ hasText:"Skenario 2 —" }).click();
  await route(page,"Intervensi"); await expect(page.locator("[data-component]")).toHaveCount(12);
  const row=page.locator('[data-component="density-instance-11"]');
  await row.locator(".instance-actions > summary").click();
  await row.getByRole("button",{name:"Atur intervensi",exact:true}).click();
  await expect(page.locator(".treatment-composer")).toHaveCount(1); await expect(page.locator(".treatment-composer")).toContainText("Intervensi 12"); await noOverflow(page); await shot(page,"density-interventions");
  await page.setViewportSize({width:390,height:844}); await noOverflow(page); await shot(page,"density-interventions-mobile");
});

test("16 alternatives use compact rows, search and pinned comparison without changing the option space", async ({ page }) => {
  await imported(page,"density-alternatives"); await route(page,"Alternatif");
  await expect(page.locator(".compare-candidate")).toHaveCount(16);
  await page.getByLabel("Cari paket perbandingan").fill("Alternatif 16"); await expect(page.locator(".compare-candidate")).toHaveCount(1);
  await page.getByLabel("Cari paket perbandingan").fill(""); await shot(page,"density-alternatives");
  await route(page,"Bandingkan");
  await expect(page.locator(".compare-candidate input")).toHaveCount(16);
  await page.getByRole("button", { name:"Kosongkan perbandingan" }).click();
  await page.getByLabel("Bandingkan Alternatif 2",{exact:true}).check(); await page.getByLabel("Bandingkan Alternatif 6",{exact:true}).check();
  await expect(page.locator(".compare-matrix tbody tr")).toHaveCount(2);
  await shot(page,"comparison-focused");
  await page.setViewportSize({width:390,height:844}); await noOverflow(page); await shot(page,"comparison-focused-mobile");
  await page.getByRole("button", { name:"Angka & pilihan", exact:true }).click();
  await page.locator(".compare-matrix tr.mobile-active .primary").click();
  await expect(page.locator(".decision-canvas")).toBeVisible(); await noOverflow(page); await shot(page,"plan-mobile");
});

test("live analytics: volume readings, keyboard package plot and scenario comparison retain real data", async ({ page }) => {
  await imported(page, "density-alternatives");
  await route(page, "Hujan & kondisi awal");
  const rainfall = page.locator(".rain-split");
  await expect(rainfall.getByRole("img")).toHaveAttribute("aria-label", /10 m³/);
  await rainfall.getByRole("button", { name: /Bagian non-limpasan/ }).click();
  await expect(rainfall.locator(".chart-reading")).toHaveCount(0);
  expect((await new AxeBuilder({ page }).include(".rain-split").analyze()).violations).toEqual([]);
  await route(page, "Alternatif");
  await expect(page.locator(".scenario-chart svg > g[data-series-id]")).toHaveCount(4);
  expect((await new AxeBuilder({ page }).include(".comparison-workbench").analyze()).violations).toEqual([]);
  const detail = page.getByRole("button", { name:"Lihat data per hujan" }).last();
  await detail.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog").locator(".compare-scenario-detail")).toHaveCount(2);
  await page.keyboard.press("Escape"); await expect(detail).toBeFocused();
  await route(page, "Bandingkan");
  const chart = page.getByRole("region", { name: "Grafik lintas skenario hujan" });
  await chart.locator(".candidate-legend button").last().click();
  await chart.getByText("Angka tiap hujan", { exact:true }).click();
  await chart.locator(".scenario-readings button").last().click();
  await expect(chart.locator(".chart-reading")).toContainText("100");
  await page.setViewportSize({ width: 390, height: 844 });
  await noOverflow(page);
  const violations = (await new AxeBuilder({ page }).include(".scenario-chart").analyze()).violations;
  expect(violations).toEqual([]);
  await page.getByRole("button", { name:"Angka & pilihan", exact:true }).click();
  await page.locator(".compare-mobile-switch button").last().click();
  await page.locator(".compare-matrix tr.mobile-active .primary").click();
  await expect(page.locator(".plan-summary .water-partition .volume-chart")).toBeVisible();
  await expect(page.locator(".plan-summary .water-partition .equation-note")).toContainText("6,27 =");
  await noOverflow(page);
});

test("full scientific registry remains searchable, readable and keyboard dismissible", async ({ page }) => {
  await page.goto("/production.html"); await page.getByRole("button",{name:"Buka Contoh",exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  await page.getByRole("button",{name:"Dasar TIRTA",exact:true}).click();
  await page.getByRole("button",{name:"Jelajahi seluruh referensi",exact:true}).click();
  const dialog=page.getByRole("dialog", {name:"Dasar ilmiah TIRTA",exact:true}); await expect(dialog.locator(".scientific-references > li")).toHaveCount(32);
  await dialog.locator(".evidence-record").first().locator("summary").click();
  await shot(page,"registry-mobile"); await noOverflow(page);
  await dialog.getByLabel("Cari referensi").fill("Jakarta"); await expect(dialog.locator(".scientific-references > li")).toHaveCount(1);
  await page.keyboard.press("Escape"); await expect(page.getByRole("button",{name:"Jelajahi seluruh referensi",exact:true})).toBeFocused();
});


test("mobile editing sheet keeps drafts, restores focus, reveals missing C and survives resizing", async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto("/production.html"); await page.getByRole("button",{name:"Buka Contoh",exact:true}).click();
  await expect(page.locator(".workflow-navigation .nav-step")).toHaveCount(5);
  await expect(page.locator(".route-project")).toContainText("Contoh TIRTA");
  await page.locator(".zone-row").nth(3).click();
  const launch=page.locator(".mobile-zone-summary"); await expect(launch).toContainText("Taman");
  await launch.click();
  const sheet=page.getByRole("dialog",{name:"Data zona",exact:true});
  const coefficient=sheet.locator('.coefficient-launch');
  await coefficient.click();
  const data=page.getByRole('dialog',{name:'Pilih dari patokan',exact:true});
  await data.getByRole('button',{name:'Isi custom',exact:true}).click();
  await data.getByLabel('Koefisien untuk perhitungan',{exact:true}).fill('0.23');
  await page.keyboard.press('Escape'); await expect(coefficient).toBeFocused();
  await page.keyboard.press("Escape"); await expect(sheet).toBeHidden(); await expect(launch).toBeFocused();
  await launch.click();
  await sheet.getByRole("button",{name:"Mengapa C?",exact:true}).click();
  await page.keyboard.press("Escape"); await expect(sheet.getByRole("button",{name:"Mengapa C?",exact:true})).toBeFocused();
  await coefficient.click();
  await expect(data.getByLabel('Koefisien untuk perhitungan',{exact:true})).toHaveValue('0.23');
  await expect(data.getByRole("button",{name:"Terapkan",exact:true})).toBeInViewport();
  await data.getByLabel("Koefisien untuk perhitungan",{exact:true}).fill("");
  await data.getByRole("button",{name:"Terapkan",exact:true}).click();
  await page.keyboard.press("Escape");
  await route(page,"Hujan & kondisi awal");
  await expect(sheet).toBeVisible(); await expect(coefficient).toBeFocused();
  await expect(sheet.locator(".studio-editor-footer button")).toBeInViewport();
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await shot(page,"studio-mobile-recovery");
  await page.screenshot({path:`${evidence}/studio-mobile-sheet.png`});
  await page.keyboard.press("Escape"); await expect(sheet).toBeHidden();
  await page.setViewportSize({width:1440,height:900});
  await expect(page.getByRole("region",{name:"Data zona",exact:true})).toBeVisible();
  await expect(page.locator('.coefficient-launch')).toContainText('Belum dipilih');
  await page.setViewportSize({width:390,height:844}); await expect(sheet).toBeHidden();
  await noOverflow(page);
});


test("contextual basics remain keyboard accessible beside the new dedicated assistant", async ({page}) => {
  await page.goto("/production.html"); await page.getByRole("button",{name:"Buka Contoh",exact:true}).click();
  await expect(page.getByRole("button",{name:"Pahami langkah ini",exact:true})).toHaveCount(0);
  const actions=page.locator(".project-actions > summary"); await actions.click();
  await expect(page.getByRole("button",{name:"Tanya TIRTA",exact:true})).toHaveCount(1);
  await expect(page.getByRole("button",{name:"Simpan",exact:true})).toBeVisible();
  await page.keyboard.press("Escape"); await expect(actions).toBeFocused();
  const help=page.getByRole("button",{name:"Dasar TIRTA",exact:true}); await help.click();
  const dialog=page.getByRole("dialog",{name:"Dasar TIRTA",exact:true});
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape"); await expect(dialog).toBeHidden(); await expect(help).toBeFocused();
  await page.setViewportSize({width:390,height:844}); await help.click();
  await expect(dialog).toBeVisible(); await noOverflow(page); await page.keyboard.press("Escape");
  await expect(help).toBeFocused();
});
