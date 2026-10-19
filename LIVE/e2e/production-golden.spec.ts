import { test, expect, type Page, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
const campaignRoot = process.env.TIRTA_GOLDEN_EVIDENCE ?? "evidence/production";
const output = (relative: string) => `${campaignRoot}/${relative}`;
const evidence = output("journey");
const repairEvidence = output("studio-recovery/screenshots");
const labelEvidence = output("zone-labels/after");
const sourceEvidence = output("calculation-sources");

async function reviewTankScience(page: Page) {
  const row = page.locator('[data-component="tank"]');
  await row.getByRole("button", { name: /tinjau dasar/ }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Dasar kapasitas", exact: true }).click();
  await dialog.locator('select[name="origin"]').selectOption('user-entered');
  await dialog.locator('input[name="performanceSource"]').fill('TEST ONLY: available empty storage declared for this event, not a measured installation');
  await dialog.locator('input[name="nominal"]').fill('10');
  await dialog.locator('select[name="nominalOrigin"]').selectOption('user_supplied');
  await dialog.locator('input[name="nominalSource"]').fill('TEST ONLY: nominal capacity declared by test owner');
  await dialog.getByRole("button", { name: "Simpan tinjauan" }).click();
  await row.getByRole("button", { name: /tinjau dasar/ }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Sumber & luapan", exact: true }).click();
  for (const checkbox of await dialog.locator('input[name="connected"]').all()) await checkbox.check();
  await dialog.locator('select[name="via"]').selectOption('gutter-downpipe');
  await dialog.locator('input[name="connectionSource"]').fill('TEST ONLY: declared proposed gutter route, subject to field inspection');
  await dialog.getByRole("button", { name: "Simpan tinjauan" }).click();
}

test("calculation sources: runoff, conservation and Pareto disclose without changing results", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await mkdir(sourceEvidence, { recursive: true });
  await page.goto("/production.html");
  await page.getByRole("button", { name: "Buka Contoh", exact: true }).click();
  await page.getByRole("button", { name: "Kontribusi hujan", exact: true }).click();
  const overlaySource = page.locator('.studio-layout + [data-method="runoff"]');
  await expect(overlaySource).not.toHaveAttribute("open");
  await overlaySource.locator(":scope > summary").click();
  await expect(overlaySource).toContainText("Kontribusi zona = limpasan zona / limpasan persil");
  await page.getByRole("button", { name: "Permukaan", exact: true }).click();
  await expect(overlaySource).toHaveCount(0);
  await route(page, "Hujan & kondisi awal");
  await expect(page.locator(".rain-equation")).toContainText("10 m³");
  await expect(page.locator(".rain-split")).toContainText("6,27 m³");
  const original = await page.locator(".contribution-list").innerText();
  const runoff = page.locator('.rain-analysis [data-method="runoff"]');
  await expect(runoff).not.toHaveAttribute("open");
  await expect(runoff.locator("a")).toBeHidden();
  await runoff.locator(":scope > summary").focus();
  await page.keyboard.press("Enter");
  await expect(runoff).toHaveAttribute("open");
  await expect(runoff).toContainText("volumetric runoff coefficient");
  await expect(runoff).toContainText("mengubah mm menjadi meter");
  await expect(runoff).toContainText("bukan rumus debit puncak Rational Method");
  await expect(runoff.locator("a")).toHaveAttribute("href", "https://nepis.epa.gov/Exe/ZyPURL.cgi?Dockey=901X0A00.TXT");
  await expect(page.locator(".contribution-list")).toHaveText(original, { useInnerText: true });
  await page.screenshot({ path: `${sourceEvidence}/runoff-1440.png`, fullPage: true });
  await page.keyboard.press("Space");
  await expect(runoff).not.toHaveAttribute("open");
  await expect(runoff.locator("a")).toBeHidden();
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await runoff.locator(":scope > summary").click();
    await expect(runoff.locator(".calculation-source-technical")).not.toHaveAttribute("open");
    await runoff.locator(".calculation-source-technical > summary").click();
    await expect(runoff.locator("a")).toBeVisible();
    expect(await runoff.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect(await runoff.locator("p").first().evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(13);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    if (width === 390) {
      expect((await runoff.locator(":scope > summary").boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await page.screenshot({ path: `${sourceEvidence}/runoff-390.png`, fullPage: true });
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
    await runoff.locator(".calculation-source-technical > summary").click();
    await runoff.locator(":scope > summary").click();
  }
  await route(page, "Intervensi");
  await page.getByRole("button", { name: "Tambahkan Tangki", exact: true }).click();
  const ledger = page.locator('.intervention-preview [data-method="ledger"]');
  await expect(ledger).not.toHaveAttribute("open");
  await ledger.locator("summary").click();
  await expect(ledger).toContainText("conservation ledger");
  await expect(ledger).toContainText("Air yang sama tidak dihitung dua kali");
  await route(page, "Alternatif");
  await page.locator('[data-method="ledger"] > summary').click();
  await expect(page.locator('[data-method="ledger"]')).toContainText("dibatasi oleh limpasan yang tersedia");
  await page.locator("summary", { hasText: "Bagaimana memilih alternatif?" }).click();
  const pareto = page.locator('[data-method="pareto"]');
  await expect(pareto).not.toHaveAttribute("open");
  await pareto.locator("summary").click();
  await expect(pareto).toContainText("Pareto dominance / multi-objective filtering");
  await expect(pareto).toContainText("Tidak ada skor berbobot");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await route(page, "Bandingkan");
  const comparison = page.locator('[data-method="ledger"]');
  await comparison.locator("summary").click();
  await expect(comparison).toContainText("bukan rumus empiris");
  await route(page, "Alternatif");
  await page.locator(".alternative").filter({ hasText: "Tangki" }).first().getByRole("button", { name: "Pilih rencana ini" }).click();
  const partition = page.locator(".water-partition");
  const accounting = await partition.locator(".equation-note").innerText();
  const partitionMethod = partition.locator('[data-method="ledger"]');
  await expect(partitionMethod).not.toHaveAttribute("open");
  await partitionMethod.locator(":scope > summary").click();
  await expect(partition.locator(".equation-note")).toHaveText(accounting, { useInnerText: true });
  await expect(partitionMethod).toContainText("ditampung + dimanfaatkan + diinfiltrasikan + sisa limpasan");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${sourceEvidence}/ledger-390.png`, fullPage: true });
  expect(errors).toEqual([]);
});

test("calculation sources: coefficient references follow all five surfaces and stay optional", async ({ page }) => {
  await fresh(page, "Sumber koefisien");
  await page.getByRole("button", { name: "Zona", exact: true }).click();
  await page.getByRole("button", { name: "Seluruh persil" }).click();
  for (const surface of ["roof", "paved", "soil", "vegetation", "porous"]) {
    await page.getByLabel("Jenis permukaan", { exact: true }).selectOption(surface);
    const source = page.locator('.coefficient-help [data-method="coefficient"]');
    await expect(source).not.toHaveAttribute("open");
    await source.locator(":scope > summary").click();
    await expect(source.locator(".calculation-source-technical")).not.toHaveAttribute("open");
    await source.locator(".calculation-source-technical > summary").click();
    await expect(source.locator("a")).toBeVisible();
    await expect(source.locator("a")).toContainText(surface === "porous" ? "Selbig & Buer (2018)" : "TxDOT");
    if (surface === "porous") {
      await expect(source).toContainText("Tidak ada satu angka universal");
      await expect(source).not.toContainText("TxDOT");
    } else {
      await expect(source).toContainText("terutama untuk debit puncak");
      await expect(source).toContainText("bukan kalibrasi lokasi");
    }
    await expect(page.getByLabel("Koefisien limpasan", { exact: true })).toHaveValue("");
  }
  await page.getByLabel("Jenis permukaan", { exact: true }).selectOption("roof");
  await page.getByRole("button", { name: "Sumber & data zona", exact: true }).click();
  let dialog = page.getByRole("dialog");
  const desktopApply = dialog.getByRole("button", { name: "Terapkan data zona" });
  const desktopApplyBox = await desktopApply.boundingBox();
  expect(desktopApplyBox).not.toBeNull();
  expect(desktopApplyBox!.y + desktopApplyBox!.height).toBeLessThanOrEqual(900);
  expect(await desktopApply.isVisible()).toBe(true);
  await mkdir(sourceEvidence, { recursive: true });
  await dialog.screenshot({ path: `${sourceEvidence}/coefficient-1440.png` });
  await dialog.getByRole("button", { name: "Tutup" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Sumber & data zona", exact: true }).click();
  dialog = page.getByRole("dialog");
  const source = dialog.locator('[data-method="coefficient"]');
  await expect(source.locator("a")).toBeHidden();
  await source.locator(":scope > summary").click();
  await expect(source.locator(".calculation-source-technical")).not.toHaveAttribute("open");
  await source.locator(".calculation-source-technical > summary").click();
  await expect(source.locator("a")).toBeVisible();
  expect(await source.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  const mobileApplyBox = await dialog.getByRole("button", { name: "Terapkan data zona" }).boundingBox();
  expect(mobileApplyBox).not.toBeNull();
  expect(mobileApplyBox!.y + mobileApplyBox!.height).toBeLessThanOrEqual(844);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await mkdir(sourceEvidence, { recursive: true });
  await dialog.screenshot({ path: `${sourceEvidence}/coefficient-390.png` });
});

test("main rainfall input distinguishes assumed scenarios from sourced rainfall", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await fresh(page, "Hujan uji tanpa referensi");
  await zone(page, "0", "15");
  await page.getByLabel("Jenis permukaan", { exact: true }).selectOption("roof");
  await coefficient(page, "Atap", "0.85");
  await route(page, "Hujan & kondisi awal");
  await page.getByLabel("Dasar hujan", { exact: true }).selectOption("assumption");
  await page.getByLabel("Kedalaman hujan", { exact: true }).fill("60");
  await expect(page.getByRole("button", { name: "+ Tambah catatan (opsional)", exact: true })).toBeVisible();
  await expect(page.locator(".rain-basis-help")).toContainText("membandingkan respons persil");
  await mkdir(output("human-usability"), { recursive: true });
  await page.screenshot({ path: output("human-usability/rain-assumption.png"), fullPage: true });
  await page.getByRole("button", { name: "Terapkan hujan & hitung ulang", exact: true }).click();
  await expect(page.locator(".rain-analysis")).toContainText("7,65 m³");
  const calculation = page.locator('.rain-analysis [data-method="runoff"]');
  await expect(calculation).not.toHaveAttribute("open");
  await calculation.locator(":scope > summary").click();
  await expect(calculation).toContainText("Cara hitung singkat");
  await expect(calculation).toContainText("Volume hujan = A × P / 1.000");
  await expect(calculation.locator(".calculation-source-technical")).not.toHaveAttribute("open");
  await calculation.locator(".calculation-source-technical > summary").click();
  await expect(calculation.locator(".calculation-source-technical")).toContainText("bukan rumus debit puncak Rational Method");
  await page.screenshot({ path: output("human-usability/rain-source-expanded.png"), fullPage: true });
  await page.getByLabel("Dasar hujan", { exact: true }).selectOption("reference");
  await page.getByLabel("Kedalaman hujan", { exact: true }).fill("70");
  await expect(page.locator(".rain-pending-note")).toContainText("masih memakai 60 mm");
  await page.getByLabel("Sumber hujan", { exact: true }).fill("");
  await page.getByRole("button", { name: "Terapkan hujan & hitung ulang", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("memerlukan sumber");
  await expect(page.getByLabel("Kedalaman hujan", { exact: true })).toHaveValue("70");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: output("human-usability/rain-assumption-390.png"), fullPage: true });
  expect(errors).toEqual([]);
});

test("intervention palette drag image carries only the compact family icon", async ({ page }) => {
  await fresh(page, "Uji ikon intervensi");
  await zone(page, "0", "7.5");
  await page.getByLabel("Jenis permukaan", { exact: true }).selectOption("roof");
  await coefficient(page, "Atap", "0.85");
  await zone(page, "7.5", "7.5");
  await page.getByLabel("Jenis permukaan", { exact: true }).selectOption("vegetation");
  await coefficient(page, "Vegetasi", "0.25");
  await route(page, "Hujan & kondisi awal");
  await page.getByLabel("Kedalaman hujan", { exact: true }).fill("60");
  await page.getByLabel("Dasar hujan", { exact: true }).selectOption("assumption");
  await page.getByRole("button", { name: "Terapkan hujan & hitung ulang", exact: true }).click();
  await route(page, "Intervensi");
  await page.evaluate(() => {
    const w = window as Window & { __tirtaDragImages?: Array<{ tag: string; width: number; height: number; left: number; connected: boolean; offsetX: number; offsetY: number; transparentCorners: boolean; artworkPixels: number; dataUrl: string }> };
    w.__tirtaDragImages = [];
    const native = DataTransfer.prototype.setDragImage;
    DataTransfer.prototype.setDragImage = function (image, offsetX, offsetY) {
      const box = image.getBoundingClientRect();
      const canvas = image instanceof HTMLCanvasElement ? image : null;
      const pixels = canvas?.getContext("2d")?.getImageData(0, 0, canvas.width, canvas.height).data;
      let transparentCorners = false;
      let artworkPixels = 0;
      if (canvas && pixels) {
        const alphaAt = (x: number, y: number) => pixels[(y * canvas.width + x) * 4 + 3] ?? 0;
        transparentCorners = [[0, 0], [canvas.width - 1, 0], [0, canvas.height - 1], [canvas.width - 1, canvas.height - 1]].every(([x, y]) => alphaAt(x!, y!) === 0);
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i]! > 0) artworkPixels++;
      }
      w.__tirtaDragImages!.push({ tag: image.tagName, width: box.width, height: box.height, left: box.left, connected: image.isConnected, offsetX, offsetY, transparentCorners, artworkPixels, dataUrl: canvas?.toDataURL("image/png") ?? "" });
      native.call(this, image, offsetX, offsetY);
    };
  });
  const canvas = page.locator(".intervention-preview .parcel-svg");
  for (const name of ["Tangki", "Sumur / area resapan", "Rain garden", "Permukaan berpori"]) {
    await page.getByRole("button", { name: `Tambahkan ${name}`, exact: true }).dragTo(canvas);
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
  }
  const previews = await page.evaluate(() => (window as Window & { __tirtaDragImages?: Array<{ tag: string; width: number; height: number; left: number; connected: boolean; offsetX: number; offsetY: number; transparentCorners: boolean; artworkPixels: number; dataUrl: string }> }).__tirtaDragImages ?? []);
  expect(previews).toHaveLength(4);
  await mkdir(output("drag-images"), { recursive: true });
  for (const [index, preview] of previews.entries()) {
    expect(preview.tag.toLowerCase()).toBe("canvas");
    expect(preview.connected).toBe(true);
    expect(preview.left).toBeLessThan(-9000);
    expect(preview.width).toBe(58);
    expect(preview.height).toBe(48);
    expect(preview.offsetX).toBe(29);
    expect(preview.offsetY).toBe(24);
    expect(preview.transparentCorners).toBe(true);
    expect(preview.artworkPixels).toBeGreaterThan(100);
    await writeFile(output(`drag-images/family-${index + 1}.png`), Buffer.from(preview.dataUrl.split(",")[1] ?? "", "base64"));
  }
});

test("sidebar readiness uses quiet water states without visible status words", async ({ page, browser }) => {
  await page.goto("/production.html");
  await page.getByLabel("Nama proyek", { exact: true }).fill("Uji progres sidebar");
  await page.getByRole("button", { name: "Buat proyek baru" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Studio Persil");
  const nav = page.locator(".app-rail nav");
  const labels = ["Proyek", "Studio Persil", "Hujan & kondisi awal", "Intervensi", "Alternatif", "Bandingkan", "Rencana & Dampak"];
  await expect(nav.locator(".readiness-waterfall")).toHaveCount(1);
  await expect(nav.locator("button .readiness-water")).toHaveCount(0);
  await expect(nav.locator("button")).toHaveCount(labels.length);
  expect(await nav.locator("button").evaluateAll(buttons => buttons.map(button => button.getAttribute("aria-label")))).toEqual(labels);
  await expect(nav.locator(".nav-readiness")).toHaveCount(0);
  await expect(nav.locator("button.readiness-blocked").first()).toHaveAttribute("data-readiness", "blocked");
  await expect(nav.locator("button.readiness-partial").first()).toHaveAttribute("data-readiness", "partial");
  await expect(nav.locator("button.readiness-complete").first()).toHaveAttribute("data-readiness", "complete");
  await expect(nav).toContainText("Proyek");
  const visibleNavigation = (await nav.locator("button > span:not(.sr-only):not(.readiness-water)").allInnerTexts()).join("\n");
  expect(visibleNavigation).not.toMatch(/Selesai|Isi dulu|Belum siap/);
  await expect(nav.getByRole("button", { name: "Studio Persil", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("button", { name: "Intervensi", exact: true })).toHaveAttribute("aria-describedby", "nav-state-interventions");
  const earlyDepth = Number((await nav.locator(".readiness-waterfall").getAttribute("style"))?.match(/[\d.]+/)?.[0] ?? 0);
  expect(earlyDepth).toBeGreaterThan(0);
  await page.screenshot({ path: output("sidebar-early.png") });
  await page.screenshot({ path: output("sidebar-empty.png") });
  expect((await new AxeBuilder({ page }).include(".app-rail nav").analyze()).violations).toEqual([]);
  await page.getByLabel("Panjang persil").fill("15");
  await page.getByLabel("Lebar persil").fill("10");
  await page.getByRole("button", { name: "Buat persil", exact: true }).click();
  await zone(page, "0", "15");
  await page.getByLabel("Jenis permukaan", { exact: true }).selectOption("roof");
  await coefficient(page, "Atap", "0.85");
  const middleDepth = Number((await nav.locator(".readiness-waterfall").getAttribute("style"))?.match(/[\d.]+/)?.[0] ?? 0);
  expect(middleDepth).toBeGreaterThanOrEqual(earlyDepth);
  await page.screenshot({ path: output("sidebar-middle.png") });
  await route(page, "Hujan & kondisi awal");
  await page.getByLabel("Kedalaman hujan", { exact: true }).fill("60");
  await page.getByLabel("Dasar hujan", { exact: true }).selectOption("assumption");
  await page.getByRole("button", { name: "Terapkan hujan & hitung ulang", exact: true }).click();
  await route(page, "Intervensi");
  await page.screenshot({ path: output("sidebar-after-rain.png") });
  const sampleContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const samplePage = await sampleContext.newPage();
  await samplePage.goto("/production.html");
  await samplePage.getByRole("button", { name: "Buka Contoh", exact: true }).click();
  await expect(samplePage.locator(".app-rail nav")).toHaveAttribute("data-water-state", "flowing");
  const lateDepth = Number((await samplePage.locator(".app-rail nav .readiness-waterfall").getAttribute("style"))?.match(/[\d.]+/)?.[0] ?? 0);
  expect(lateDepth).toBeGreaterThan(middleDepth);
  await samplePage.screenshot({ path: output("sidebar-late.png") });
  await samplePage.screenshot({ path: output("sidebar-example.png") });
  await samplePage.setViewportSize({ width: 390, height: 844 });
  expect(await samplePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await samplePage.screenshot({ path: output("sidebar-mobile.png"), fullPage: true });
  expect((await new AxeBuilder({ page: samplePage }).include(".mobile-route").analyze()).violations).toEqual([]);
  await sampleContext.close();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await expect(nav).toBeHidden();
});

test("Studio rulers follow declared parcel dimensions and selected-zone labels use geometry", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await fresh(page, "Uji penggaris persil");
  await expect(page.getByTestId("parcel-ruler-horizontal")).toHaveAttribute("data-length", "15");
  await expect(page.getByTestId("parcel-ruler-vertical")).toHaveAttribute("data-length", "10");
  await page.locator(".parcel-context-actions").evaluate(el => { (el as HTMLDetailsElement).open = true; });
  await page.getByRole("button", { name: "Ubah dimensi awal", exact: true }).click();
  await page.getByLabel("Panjang persil").fill("10");
  await page.getByLabel("Lebar persil").fill("10");
  await page.getByRole("button", { name: "Terapkan ukuran", exact: true }).click();
  await expect(page.getByTestId("parcel-ruler-horizontal")).toHaveAttribute("data-length", "10");
  await expect(page.getByTestId("parcel-ruler-vertical")).toHaveAttribute("data-length", "10");
  await page.locator(".parcel-context-actions").evaluate(el => { (el as HTMLDetailsElement).open = true; });
  await page.getByRole("button", { name: "Ubah dimensi awal", exact: true }).click();
  await page.getByLabel("Panjang persil").fill("15");
  await page.getByLabel("Lebar persil").fill("10");
  await page.getByRole("button", { name: "Terapkan ukuran", exact: true }).click();
  await page.getByRole("button", { name: "Zona", exact: true }).click();
  await page.getByRole("button", { name: "Bentuk bebas", exact: true }).click();
  for (const [x, y] of [[1, 1], [5, 1], [5, 4], [1, 4]]) {
    const p = await canvasPoint(page, x!, y!);
    await page.mouse.click(p.x, p.y);
  }
  await page.getByRole("button", { name: "Selesai", exact: true }).click();
  const rectangleLabels = await page.locator(".zone-dimension").evaluateAll(nodes => nodes.map(node => Number(node.getAttribute("data-length-m")).toFixed(0)).sort());
  expect(rectangleLabels).toEqual(["3", "3", "4", "4"]);
  await page.getByRole("button", { name: "Zona", exact: true }).click();
  await page.getByRole("button", { name: "Bentuk bebas", exact: true }).click();
  for (const [x, y] of [[7, 1], [14, 1], [14, 3], [10, 3], [10, 8], [7, 8]]) {
    const p = await canvasPoint(page, x!, y!);
    await page.mouse.click(p.x, p.y);
  }
  await page.getByRole("button", { name: "Selesai", exact: true }).click();
  await expect(page.getByTestId("zone-dimensions")).toBeVisible();
  const labels = await page.locator(".zone-dimension").evaluateAll(nodes => nodes.map(node => Number(node.getAttribute("data-length-m"))).sort((a, b) => a - b));
  expect(labels.length).toBeLessThanOrEqual(4);
  expect(labels).toContain(7);
  expect(labels).toContain(5);
  expect(await page.locator(".zone-dimension").count()).toBe(4);
  await mkdir(output("studio-measurements"), { recursive: true });
  await page.screenshot({ path: output("studio-measurements/selected-l-zone-desktop.png") });
  const empty = await canvasPoint(page, 14.5, 9);
  await page.mouse.click(empty.x, empty.y);
  await expect(page.getByTestId("zone-dimensions")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  const selectedPoint = await canvasPoint(page, 8, 2);
  await page.mouse.click(selectedPoint.x, selectedPoint.y);
  await expect(page.getByTestId("zone-dimensions")).toBeVisible();
  await expect(page.getByTestId("parcel-ruler-horizontal")).toBeVisible();
  const mobileReadability = await page.locator(".parcel-ruler-x text, .zone-dimension text").evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
  expect(mobileReadability.every(height => height >= 8)).toBe(true);
  await page.screenshot({ path: output("studio-measurements/selected-l-zone-mobile.png") });
  expect(errors).toEqual([]);
});

test("Studio X/Y lock and meter snap constrain only later geometry movement", async ({ page }) => {
  await fresh(page, "Uji gerak sumbu");
  await page.getByRole("button", { name: "Zona", exact: true }).click();
  await page.getByRole("button", { name: "Bentuk bebas", exact: true }).click();
  for (const [x, y] of [[2, 2], [6, 2], [6, 6], [2, 6]]) {
    const p = await canvasPoint(page, x!, y!);
    await page.mouse.click(p.x, p.y);
  }
  await page.getByRole("button", { name: "Selesai", exact: true }).click();
  const polygon = page.locator(".zone-shape.selected");
  const before = await polygon.evaluate(el => [...(el as SVGPolygonElement).points].map(p => ({ x: p.x, y: p.y })));
  const unit = await page.getByTestId("parcel-boundary").evaluate(el => (el as SVGPolygonElement).getBBox().width / 15);
  await page.getByLabel("Snap ke meteran").uncheck();
  await page.getByLabel("Kunci X/Y").check();
  const from = await canvasPoint(page, 4, 4), to = await canvasPoint(page, 7, 5);
  await page.mouse.move(from.x, from.y); await page.mouse.down(); await page.mouse.move(to.x, to.y, { steps: 4 }); await page.mouse.up();
  let after = await polygon.evaluate(el => [...(el as SVGPolygonElement).points].map(p => ({ x: p.x, y: p.y })));
  expect((after[0]!.x - before[0]!.x) / unit).toBeCloseTo(3, 1);
  expect((after[0]!.y - before[0]!.y) / unit).toBeCloseTo(0, 1);
  await page.getByLabel("Kunci X/Y").uncheck();
  const freeFrom = await canvasPoint(page, 8, 4), freeTo = await canvasPoint(page, 9, 5);
  await page.mouse.move(freeFrom.x, freeFrom.y); await page.mouse.down(); await page.mouse.move(freeTo.x, freeTo.y, { steps: 4 }); await page.mouse.up();
  after = await polygon.evaluate(el => [...(el as SVGPolygonElement).points].map(p => ({ x: p.x, y: p.y })));
  expect((after[0]!.x - before[0]!.x) / unit).toBeCloseTo(4, 1);
  expect((after[0]!.y - before[0]!.y) / unit).toBeCloseTo(1, 1);
  await page.getByLabel("Snap ke meteran").check();
  await page.getByLabel("Kunci X/Y").check();
  const snapFrom = await canvasPoint(page, 10, 5), snapTo = await canvasPoint(page, 11.36, 5.18);
  await page.mouse.move(snapFrom.x, snapFrom.y); await page.mouse.down(); await page.mouse.move(snapTo.x, snapTo.y, { steps: 4 }); await page.mouse.up();
  after = await polygon.evaluate(el => [...(el as SVGPolygonElement).points].map(p => ({ x: p.x, y: p.y })));
  expect((after[0]!.x - before[0]!.x) / unit).toBeCloseTo(5.5, 1);
  expect((after[0]!.y - before[0]!.y) / unit).toBeCloseTo(1, 1);
});
async function revealField(field: Locator) {
  for (const details of await field.locator("xpath=ancestor::details").all()) {
    if (await details.getAttribute("open") === null) await details.locator(":scope > summary").click();
  }
}
async function saveProject(page: Page) {
  const button = page.getByRole("button", { name: "Simpan", exact: true, includeHidden: true });
  await revealField(button);
  await button.click();
}
async function route(page: Page, name: string) {
  const compact = page.getByLabel("Ruang kerja", { exact: true });
  if (await compact.isVisible()) await compact.selectOption({ label: name });
  else {
    if (name === "Alternatif" || name === "Bandingkan") await page.locator(".comparison-navigation > summary").click();
    await page.locator(".app-rail nav").getByRole("button", { name, exact: true }).click();
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}
async function fresh(page: Page, name = "Rumah Keluarga") {
  page.setDefaultTimeout(10000);
  await page.goto("/production.html");
  await page.getByLabel("Nama proyek", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Buat proyek baru" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Studio Persil");
  await page.getByLabel("Panjang persil").fill("15");
  await page.getByLabel("Lebar persil").fill("10");
  await page.getByRole("button", { name: "Buat persil", exact: true }).click();
  await expect(page.locator(".map-topline")).toContainText("150");
}
async function zone(page: Page, x: string, width: string) {
  await page.getByRole("button", { name: "Zona", exact: true }).click();
  const count = await page.locator(".zone-row").count();
  await page.locator(".approved-parcel > svg").scrollIntoViewIfNeeded();
  const locations = await page.locator('[data-testid="parcel-boundary"]').evaluate((el, args) => {
    const polygon = el as SVGPolygonElement; const b = polygon.getBBox(), matrix = polygon.getScreenCTM()!;
    const a = new DOMPoint(b.x + b.width * Number(args.x) / 15, b.y).matrixTransform(matrix);
    const c = new DOMPoint(b.x + b.width * (Number(args.x) + Number(args.width)) / 15, b.y + b.height).matrixTransform(matrix);
    return { a: { x: a.x, y: a.y }, c: { x: c.x, y: c.y } };
  }, { x, width });
  await page.mouse.click(locations.a.x, locations.a.y);
  await page.mouse.click(locations.c.x, locations.c.y);
  await expect(page.locator(".zone-row")).toHaveCount(count + 1);
}
async function coefficient(page: Page, name: string, value: string) {
  await page.getByLabel("Koefisien limpasan", { exact: true }).fill(value);
  await page.locator(".coefficient-help").getByRole("button").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Sumber koefisien", { exact: true }).fill("Asumsi pra-perencanaan pengguna; perlu verifikasi material");
  await dialog.getByLabel("Nama zona", { exact: true }).fill(name);
  await dialog.getByRole("button", { name: "Terapkan data zona" }).click();
  await expect(dialog).toHaveCount(0);
}
async function rain(page: Page, value: string) {
  await page.getByLabel("Kedalaman hujan", { exact: true }).fill(value);
  await page.getByLabel("Dasar hujan", { exact: true }).selectOption("assumption");
  await expect(page.getByLabel("Kedalaman hujan", { exact: true })).toHaveValue(value);
  await page.getByRole("button", { name: "Terapkan hujan & hitung ulang", exact: true }).click();
}

test("freeform finish preserves valid shared edges and exposes rejected drafts beside Finish", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await fresh(page);
  const draw = async (points: number[][]) => {
    await page.getByRole("button", { name: "Zona", exact: true }).click();
    await page.getByRole("button", { name: "Bentuk bebas", exact: true }).click();
    await page.locator(".parcel-svg").scrollIntoViewIfNeeded();
    for (const [x, y] of points) { const p = await canvasPoint(page, x!, y!); await page.mouse.click(p.x, p.y); }
    await page.getByRole("button", { name: "Selesai", exact: true }).click();
  };
  await draw([[0,0],[7,0],[7,5],[0,5]]);
  await expect(page.locator(".zone-row")).toHaveCount(1);
  await draw([[7,0],[15,0],[15,8],[10,8],[10,5],[7,5]]);
  await expect(page.locator(".zone-row")).toHaveCount(2);
  await draw([[0,5],[0,10],[10,10],[10,4]]);
  await expect(page.locator(".drawing-actions [role=alert]")).toContainText("bertumpang tindih");
  await expect(page.locator(".draft-point")).toHaveCount(4);
  await expect(page.locator(".zone-draft")).toHaveAttribute("class", /draft-rejected/);
  expect(await page.locator(".zone-draft").evaluate(el => (el as SVGPolygonElement).points.numberOfItems)).toBe(4);
  await mkdir(output("freeform-finish"), { recursive: true });
  await page.locator(".drawing-actions").screenshot({ path: output("freeform-finish/rejection.png") });
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.locator(".drawing-error")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  await page.getByRole("button", { name: "Urungkan titik terakhir", exact: true }).click();
  await page.locator(".parcel-svg").scrollIntoViewIfNeeded();
  const p = await canvasPoint(page, 10, 5); await page.mouse.click(p.x, p.y);
  await page.getByRole("button", { name: "Selesai", exact: true }).click();
  await expect(page.locator(".zone-row")).toHaveCount(3);
  await expect(page.locator(".drawing-error")).toHaveCount(0);
  await expect(page.locator(".zone-draft")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("porous editor permits one target, saves UNKNOWN drafts and defers without blocking other plans", async ({ page }) => {
  const folder = output("intervention-recovery/screenshots");
  await mkdir(folder, { recursive: true });
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("/production.html");
  await page.getByRole("button", { name: "Buka Contoh", exact: true }).click();
  await route(page, "Intervensi");
  await page.getByRole("button", { name: "Tambahkan Tangki", exact: true }).click();
  await page.getByRole("button", { name: "Tambahkan Permukaan berpori", exact: true }).click();
  const porous = page.locator('[data-component="porous"]');
  const configure = porous.getByRole("button", { name: "Atur intervensi" });
  await configure.click();
  const dialog = page.getByRole("dialog");
  const targets = dialog.locator('input[name="target"]');
  await targets.nth(0).check();
  await targets.nth(1).check();
  await expect(dialog.locator('input[name="target"]:checked')).toHaveCount(1);
  await expect(dialog.getByLabel("Rencana sambungan air", { exact: true })).toHaveCount(0);
  await revealField(dialog.getByLabel("Luas yang diganti (m²)", { exact: true }));
  await dialog.getByLabel("Luas yang diganti (m²)", { exact: true }).fill("");
  await dialog.getByLabel("Air yang dapat diresapkan (m³/event)", { exact: true }).fill("");
  await dialog.getByRole("button", { name: "Terapkan intervensi" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Intervensi belum siap");
  await dialog.getByRole("button", { name: "Simpan untuk nanti", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Tambahkan Permukaan berpori", exact: true }).click();
  await configure.click();
  await expect(dialog.getByLabel("Air yang dapat diresapkan (m³/event)", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Luas yang diganti (m²)", { exact: true })).toHaveValue("");
  await dialog.getByLabel("Biaya (Rp)", { exact: true }).fill("-5");
  await dialog.getByRole("button", { name: "Simpan untuk nanti", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Biaya");
  await expect(dialog.getByRole("alert")).not.toContainText('"code"');
  await dialog.getByLabel("Biaya (Rp)", { exact: true }).fill("2000000");
  for (const width of [1440, 1280, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await dialog.getByRole("button", { name: "Tutup", exact: true }).focus();
    await dialog.evaluate(el => { el.scrollTop = 0; });
    await dialog.screenshot({ path: `${folder}/porous-draft-${width}.png` });
    await dialog.evaluate(el => { el.scrollTop = el.scrollHeight; });
    await dialog.screenshot({ path: `${folder}/porous-actions-${width}.png` });
    expect(await dialog.evaluate(el => el.scrollWidth > el.clientWidth + 1)).toBe(false);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await dialog.getByRole("button", { name: "Simpan untuk nanti" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Tambahkan Permukaan berpori", exact: true })).toBeFocused();
  await expect(page.locator(".intervention-palette")).toContainText("Isian tersimpan");
  await expect(page.locator(".planning-next-step")).toContainText("Isian siap");
  await page.locator(".planning-next-step").screenshot({ path: `${folder}/next-step-390.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.locator(".planning-next-step").getByRole("button", { name: "Bandingkan pilihan" }).click();
  await expect(page.locator(".search-contract")).toBeVisible();
  await expect(page.locator(".save-state")).toContainText("Tersimpan");
  await page.reload();
  await page.locator(".local-projects").getByRole("button", { name: /^Contoh TIRTA/ }).click();
  await route(page, "Intervensi");
  await page.getByRole("button", { name: "Tambahkan Permukaan berpori", exact: true }).click();
  await configure.click();
  await expect(dialog.getByLabel("Luas yang diganti (m²)", { exact: true })).toHaveValue("");
  await expect(dialog.locator('input[name="target"]:checked')).toHaveCount(1);
  await expect(dialog.getByLabel("Air yang dapat diresapkan (m³/event)", { exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Air yang dapat diresapkan (m³/event)", { exact: true })).toHaveValue("");
  expect(errors).toEqual([]);
});

test("readable rupiah edits and change previews preserve unknown, cancellation and saved numbers", async ({ page }) => {
  const folder = output("planning-number-preview");
  await mkdir(folder, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await page.goto("/production.html");
  await page.getByRole("button", { name: "Buka Contoh", exact: true }).click();
  await route(page, "Intervensi");
  const constraints = page.locator(".constraint-editor");
  const budget = constraints.getByLabel("Anggaran (Rp)", { exact: true });
  await expect(budget).toHaveValue("12.000.000");
  await budget.fill("12500000");
  await expect(budget).toHaveValue("12.500.000");
  await expect(constraints.locator('[data-change="budget"]')).toContainText("+Rp500.000");
  await constraints.getByLabel("Lahan tersedia (m²)", { exact: true }).fill("25");
  for (const width of [1440, 1280, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await constraints.screenshot({ path: `${folder}/constraints-${width}.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await constraints.getByRole("button", { name: "Terapkan batas rencana" }).click();
  await expect(constraints.locator(".number-change-summary")).toContainText("Angka tetap sama");
  await page.getByRole("button", { name: "Tambahkan Tangki", exact: true }).click();
  const configure = page.locator('[data-component="tank"]').getByRole("button", { name: "Atur intervensi" });
  await configure.click();
  const dialog = page.getByRole("dialog");
  const cost = dialog.getByLabel("Biaya (Rp)", { exact: true });
  await expect(cost).toHaveValue("3.000.000");
  await cost.fill("3500000");
  await expect(dialog.locator('[data-change="cost"]')).toContainText("+Rp500.000");
  await revealField(dialog.getByLabel("Ruang terpakai (m²)", { exact: true }));
  await dialog.getByLabel("Ruang terpakai (m²)", { exact: true }).fill("3");
  await expect(dialog.locator('[data-change="area"]')).toContainText("+1 m²");
  for (const width of [1440, 1280, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await dialog.locator(".number-change-summary").scrollIntoViewIfNeeded();
    await dialog.screenshot({ path: `${folder}/intervention-${width}.png` });
    expect(await dialog.evaluate(el => el.scrollWidth > el.clientWidth + 1)).toBe(false);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await page.keyboard.press("Escape");
  await configure.click();
  await expect(cost).toHaveValue("3.000.000");
  await expect(dialog.getByLabel("Ruang terpakai (m²)", { exact: true })).toHaveValue("2");
  await cost.fill("");
  await expect(dialog.locator('[data-change="cost"]')).toContainText("Menjadi belum diketahui");
  await expect(dialog.locator('[data-change="cost"]')).not.toContainText("−Rp");
  await cost.pressSequentially("1200000,50");
  await expect(cost).toHaveValue("1.200.000,50");
  await cost.fill("1200000");
  await cost.pressSequentially(".50");
  await expect(cost).toHaveValue("1.200.000,50");
  await cost.fill("1200000");
  // Editing in the middle must not jump the caret to the end.
  await cost.evaluate(el => (el as HTMLInputElement).setSelectionRange(1, 1));
  await cost.press("9");
  await expect(cost).toHaveValue("19.200.000");
  expect(await cost.evaluate(el => (el as HTMLInputElement).selectionStart)).toBe(2);
  // Backspace/Delete beside a generated separator delete a digit, not a stuck dot.
  await cost.evaluate(el => (el as HTMLInputElement).setSelectionRange(3, 3));
  await cost.press("Backspace");
  await expect(cost).toHaveValue("1.200.000");
  await cost.evaluate(el => (el as HTMLInputElement).setSelectionRange(1, 1));
  await cost.press("Delete");
  await expect(cost).toHaveValue("100.000");
  await cost.evaluate(el => (el as HTMLInputElement).select());
  await cost.evaluate(el => { const data = new DataTransfer(); data.setData("text/plain", "1.5"); el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true })); });
  await expect(cost).toHaveAttribute("aria-invalid", "true");
  await expect(dialog.locator('[data-change="cost"]')).toContainText("Belum dapat dibandingkan");
  await dialog.getByRole("button", { name: "Terapkan intervensi" }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await cost.evaluate(el => (el as HTMLInputElement).select());
  await cost.evaluate(el => { const data = new DataTransfer(); data.setData("text/plain", "Rp3.500.000,50"); el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true })); });
  await expect(cost).toHaveValue("3.500.000,50");
  await dialog.getByRole("button", { name: "Terapkan intervensi" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".save-state")).toContainText("Tersimpan");
  await page.reload();
  await page.locator(".local-projects").getByRole("button", { name: /^Contoh TIRTA/ }).click();
  await route(page, "Intervensi");
  await expect(budget).toHaveValue("12.500.000");
  await configure.click();
  await expect(cost).toHaveValue("3.500.000,5");
  await expect(dialog.locator('[data-change="cost"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("compact provenance preserves legacy sources and supports explicit changes", async ({ page }) => {
  await page.goto("/production.html");
  await page.getByRole("button", { name: "Buka Contoh", exact: true }).click();
  await route(page, "Intervensi");
  await page.getByRole("button", { name: "Tambahkan Tangki", exact: true }).click();
  await page.locator('[data-component="tank"]').getByRole("button", { name: "Atur intervensi" }).click();
  const dialog = page.getByRole("dialog");
  const source = dialog.locator('input[name="costSource"]');
  const previousSource = await source.inputValue();
  const previousEvidence = await dialog.locator('input[name="costEvidence"]').inputValue();
  expect(previousSource).not.toBe("");
  for (const select of await dialog.locator('.source-choice select').all()) await expect(select.locator('option:not([disabled])')).toHaveCount(3);
  await dialog.getByRole("button", { name: "Terapkan intervensi", exact: true }).click();
  await page.locator('[data-component="tank"]').getByRole("button", { name: "Atur intervensi" }).click();
  await expect(source).toHaveValue(previousSource);
  await expect(dialog.locator('input[name="costEvidence"]')).toHaveValue(previousEvidence);
  await revealField(dialog.getByLabel("Sumber / alasan biaya", { exact: true }));
  await dialog.getByLabel("Sumber / alasan biaya", { exact: true }).selectOption("Asumsi pribadi");
  await expect(dialog.locator('input[name="costEvidence"]')).toHaveValue("ASSUMPTION");
  await dialog.getByRole("button", { name: "Terapkan intervensi", exact: true }).click();
  await expect(page.locator(".save-state")).toContainText("Tersimpan");
  await page.reload();
  await page.locator(".local-projects").getByRole("button", { name: /^Contoh TIRTA/ }).click();
  await route(page, "Intervensi");
  await page.locator('[data-component="tank"]').getByRole("button", { name: "Atur intervensi" }).click();
  await expect(dialog.getByLabel("Sumber / alasan biaya", { exact: true })).toHaveValue("Asumsi pribadi");
  await expect(dialog.locator('input[name="costEvidence"]')).toHaveValue("ASSUMPTION");
  await expect(source).toHaveValue(`Asumsi pribadi · ${previousSource}`);
});

test("atlas labels stay compact through zoom and link hover, keyboard and touch to full zone identity", async ({ page }) => {
  await mkdir(labelEvidence, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/production.html");
  await page.getByRole("button", { name: "Buka Contoh", exact: true }).click();
  await page.locator(".notice").waitFor({ state: "hidden" });
  const roof = page.getByRole("button", { name: "Pilih zona Gedung belajar", exact: true });
  const soil = page.getByRole("button", { name: "Pilih zona Tanah timur", exact: true });
  const readout = page.locator(".map-zone-readout");
  await soil.hover();
  await expect(readout).toContainText("Tanah timur");
  await expect(readout).toContainText("30 m²");
  await expect(roof).toHaveAttribute("aria-pressed", "true");
  await soil.focus();
  await page.keyboard.press("Enter");
  await expect(soil).toHaveAttribute("aria-pressed", "true");
  await page.mouse.move(0, 0);
  await page.keyboard.press("Escape");
  await expect(page.locator(".zone-shape.selected")).toHaveCount(0);
  await expect(readout).toContainText("Sorot atau pilih zona");
  for (const [width, height] of [[1920,1080],[1707,862],[1536,864],[1440,900],[1366,768],[1280,800],[768,1024],[375,812]]) {
    await page.setViewportSize({ width: width!, height: height! });
    await page.getByRole("button", { name: "Pas ke layar", exact: true }).click();
    const mark = page.locator(".zone-mark").nth(2);
    // A label is an annotation, so clicking its pixels must still select the underlying zone.
    await mark.scrollIntoViewIfNeeded();
    const point = await mark.boundingBox();
    await page.mouse.click(point!.x + point!.width / 2, point!.y + point!.height / 2);
    await expect(soil).toHaveAttribute("aria-pressed", "true");
    await expect(readout).toContainText("Tanah timur");
    for (const zoomAction of ["Perbesar sketsa", "Perbesar sketsa", "Perkecil sketsa", "Pas ke layar"]) {
      await page.getByRole("button", { name: zoomAction, exact: true }).click();
      await expect.poll(async () => page.locator(".zone-mark-paper").evaluateAll(els => els.every(el => {
        const box = el.getBoundingClientRect(); return box.height <= 27 && box.height >= 25 && box.width <= 145;
      }))).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
    await page.locator(".studio-layout").screenshot({ path: `${labelEvidence}/studio-${width}.png` });
  }
  expect(errors).toEqual([]);
});

test("thin zone uses a dot while its full name and UNKNOWN remain accessible and persist", async ({ page }) => {
  await fresh(page, "Label zona tipis");
  await zone(page, "0", "0.5");
  const fullName = "Jalur sempit di sisi timur bangunan utama";
  await page.getByRole("button", { name: "Sumber & data zona", exact: true }).click();
  await page.getByLabel("Nama zona", { exact: true }).fill(fullName);
  await page.getByRole("button", { name: "Terapkan data zona", exact: true }).click();
  await expect(page.locator('.zone-mark[data-label-kind="dot"]')).toHaveCount(1);
  await expect(page.locator(".map-zone-readout")).toContainText(fullName);
  await expect(page.locator(".map-zone-readout")).toContainText("Permukaan belum dikonfirmasi");
  await page.setViewportSize({ width: 375, height: 812 });
  await page.locator(".zone-mark").scrollIntoViewIfNeeded();
  const point = await page.locator(".zone-mark").boundingBox();
  await page.mouse.click(point!.x + point!.width / 2, point!.y + point!.height / 2);
  await expect(page.locator(".map-zone-readout")).toContainText(fullName);
  await page.locator(".studio-layout").screenshot({ path: `${labelEvidence}/thin-zone-375.png` });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await expect(page.locator(".save-state")).toContainText("Tersimpan");
  await page.reload();
  await page.locator(".local-projects").getByRole("button", { name: /^Label zona tipis/ }).click();
  await expect(page.getByRole("button", { name: `Pilih zona ${fullName}`, exact: true })).toBeVisible();
  await expect(page.locator('.zone-mark[data-label-kind="dot"]')).toHaveCount(1);
});

test("Studio drawing table composition and selected-only zone labels", async ({ page }) => {
  const review = output("studio-composition-review/screenshots");
  await mkdir(review, { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/production.html");
  await page.getByRole("button", { name: "Buka Contoh", exact: true }).click();
  await expect(page.locator(".zone-shape")).toHaveCount(5);
  await expect(page.locator(".studio-waterline path")).toHaveCount(3);
  expect(await page.locator(".studio-waterline").evaluate(el => {
    const group = el as SVGGElement;
    const a = group.getBBox(), b = (group.ownerSVGElement!.querySelector(".parcel-boundary") as SVGPolygonElement).getBBox();
    return a.x + a.width <= b.x || a.x >= b.x + b.width || a.y + a.height <= b.y || a.y >= b.y + b.height;
  })).toBe(true);
  const zones = page.locator(".zone-shape");
  const labels = page.locator(".zone-mark");
  await page.locator(".parcel-svg").focus();
  await page.keyboard.press("Escape");
  await expect(page.locator(".zone-shape.selected")).toHaveCount(0);
  await expect(page.locator('.zone-mark[data-label-kind="name"]')).toHaveCount(0);
  await expect(page.locator('.zone-mark[data-label-kind="number"]')).toHaveCount(5);
  await page.locator(".parcel-svg").evaluate(el => (el as SVGSVGElement).blur());
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${review}/studio-1440-idle.png`, fullPage: true });

  const axisLock = page.getByLabel("Kunci X/Y", { exact: true });
  const meterSnap = page.getByLabel("Snap ke meteran", { exact: true });
  const grid = page.getByLabel("Kisi bantu", { exact: true });
  await axisLock.check();
  await meterSnap.uncheck();
  await grid.uncheck();
  await expect(axisLock).toBeChecked();
  await expect(meterSnap).not.toBeChecked();
  await expect(grid).not.toBeChecked();
  await meterSnap.check();
  await grid.check();

  await zones.nth(0).click();
  await zones.nth(2).hover();
  await expect(labels.nth(2)).toHaveAttribute("data-label-kind", "number");
  await expect(labels.nth(2)).toHaveClass(/is-hovered/);
  await page.evaluate(() => window.scrollTo(0, 0));
  await zones.nth(2).hover();
  await page.screenshot({ path: `${review}/studio-1440-hover-unselected.png`, fullPage: true });

  await zones.nth(2).click();
  await expect(zones.nth(2)).toHaveAttribute("aria-pressed", "true");
  await expect(labels.nth(2)).toHaveAttribute("data-label-kind", "number");
  await expect(labels.nth(2)).toHaveClass(/is-selected/);
  await expect(page.locator(".map-zone-readout")).toContainText("Tanah timur");
  await page.evaluate(() => window.scrollTo(0, 0));
  await zones.nth(2).hover();
  await page.screenshot({ path: `${review}/studio-1440-selected-zone.png`, fullPage: true });
  await zones.nth(1).hover();
  await expect(labels.nth(2)).toHaveAttribute("data-label-kind", "number");
  await expect(labels.nth(1)).toHaveAttribute("data-label-kind", "number");

  await page.keyboard.press("Escape");
  await zones.nth(2).focus();
  await expect(zones.nth(2)).toBeFocused();
  await expect(labels.nth(2)).toHaveAttribute("data-label-kind", "number");
  expect(await zones.nth(2).evaluate(el => el.matches(":focus-visible") && getComputedStyle(el).filter.includes("drop-shadow"))).toBe(true);
  await page.keyboard.press("Enter");
  await expect(zones.nth(2)).toHaveAttribute("aria-pressed", "true");
  await expect(labels.nth(2)).toHaveAttribute("data-label-kind", "number");
  await expect(labels.nth(2)).toHaveClass(/is-selected/);

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Titik", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Mengedit titik" })).toBeVisible();
  await page.screenshot({ path: `${review}/studio-1440-titik-mode.png`, fullPage: true });
  await page.getByRole("button", { name: "Pilih", exact: true }).click();
  await page.getByRole("button", { name: "Zona", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Menggambar zona" })).toBeVisible();
  await page.screenshot({ path: `${review}/studio-1440-zona-mode.png`, fullPage: true });
  expect((await new AxeBuilder({ page }).include(".map-toolstrip").analyze()).violations).toEqual([]);

  const mobile = { width: 390, height: 844 };
  await page.setViewportSize(mobile);
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.scrollTo(0, 0));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: `${review}/studio-390-mobile.png`, fullPage: true });

  await page.setViewportSize({ width: 1440, height: 900 });
  await fresh(page, "Ukuran draf");
  await page.locator(".approved-parcel > svg").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Zona", exact: true }).click();
  await page.getByRole("button", { name: "Persegi panjang", exact: true }).click();
  const start = await canvasPoint(page, 2, 2);
  const end = await canvasPoint(page, 10, 7);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 4 });
  await expect(page.getByTestId("live-measurement")).toBeVisible();
  await expect(page.locator(".parcel-svg")).toHaveCSS("outline-style", "none");
  await page.locator(".parcel-frame").screenshot({ path: `${review}/studio-1440-live-measurement.png` });
  await page.mouse.up();
  expect(errors).toEqual([]);
});

test("real project: calibrated geometry, actual pixels, rain, alternatives, selected plan and reload", async ({ page }) => {
  await mkdir(evidence, { recursive: true });
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await fresh(page);
  await expect(page.locator("body")).not.toContainText("Sekolah Taman Sari");
  await expect(page.locator("[data-intervention-marker]")).toHaveCount(0);
  await zone(page, "0", "8");
  await page.getByRole("button", { name: "Titik", exact: true }).click();
  await page.getByRole("button", { name: "Sisipkan titik pada sisi 1", exact: true }).click();
  await expect(page.locator(".vertex-handle")).toHaveCount(5);
  await expect(page.locator(".register-total")).toContainText("80 / 150");
  // Upload real encoded pixels through the UI; this is an explicit synthetic test image, not an app fixture.
  await page.locator(".image-review > summary").click();
  const png = await page.evaluate(() => { const c = document.createElement("canvas"); c.width = 100; c.height = 100; const x = c.getContext("2d")!; x.fillStyle = "#209040"; x.fillRect(0, 0, 65, 100); x.fillStyle = "#888888"; x.fillRect(65, 0, 35, 100); return c.toDataURL().split(",")[1]!; });
  await page.getByLabel("Pilih foto permukaan", { exact: true }).setInputFiles({ name: "pixel-evidence.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
  await expect(page.locator(".image-region-results")).toContainText("65%");
  await expect(page.getByLabel("Jenis permukaan", { exact: true })).toHaveValue("");
  await page.locator('input[name="surface-confirmation"][value="roof"]').check();
  await page.getByLabel("Asal foto / catatan pemeriksaan").fill("Foto milik pengguna; zona adalah atap, warna hijau berasal dari cat");
  await page.locator(".image-review form button.primary").click();
  await expect(page.getByLabel("Jenis permukaan", { exact: true })).toHaveValue("roof");
  await expect(page.getByLabel("Koefisien limpasan", { exact: true })).toHaveValue("");
  await page.screenshot({ path: `${evidence}/image-processing.png`, fullPage: true });
  await coefficient(page, "Atap rumah", "0.8");
  await zone(page, "8", "7");
  await page.getByLabel("Jenis permukaan", { exact: true }).selectOption("paved");
  await coefficient(page, "Halaman depan", "0.6");
  await page.screenshot({ path: `${evidence}/studio.png`, fullPage: true });
  await route(page, "Hujan & kondisi awal");
  await rain(page, "60");
  await expect(page.locator(".rain-split")).toContainText("6,36");
  await page.screenshot({ path: `${evidence}/rain.png`, fullPage: true });
  await route(page, "Intervensi");
  await expect(page.locator("[data-intervention-marker]")).toHaveCount(0);
  const constraints = page.locator(".constraint-inputs");
  await constraints.getByLabel("Anggaran (Rp)", { exact: true }).fill("4000000");
  await revealField(constraints.getByLabel("Sumber / alasan anggaran", { exact: true }));
  await constraints.getByLabel("Sumber / alasan anggaran", { exact: true }).selectOption("Asumsi pribadi");
  await constraints.getByLabel("Lahan tersedia (m²)", { exact: true }).fill("10");
  await revealField(constraints.getByLabel("Sumber / alasan lahan tersedia", { exact: true }));
  await constraints.getByLabel("Sumber / alasan lahan tersedia", { exact: true }).selectOption("Asumsi pribadi");
  await constraints.getByRole("button", { name: "Terapkan batas rencana" }).click();
  await page.getByRole("button", { name: "Tambahkan Tangki", exact: true }).click();
  const tankRow = page.locator(".intervention-option").filter({ has: page.getByRole("heading", { name: "Tangki", exact: true }) });
  await tankRow.getByRole("button", { name: "Atur intervensi" }).click();
  const tank = page.getByRole("dialog", { name: "Atur Tangki" });
  await tank.getByLabel("Atap rumah", { exact: true }).check();
  await expect(tank.getByLabel("Sumber / alasan biaya", { exact: true })).toHaveValue("Asumsi pribadi");
  await tank.getByLabel("Biaya (Rp)", { exact: true }).fill("1000000");
  await revealField(tank.getByLabel("Sumber / alasan biaya", { exact: true }));
  await tank.getByLabel("Sumber / alasan biaya", { exact: true }).selectOption("Asumsi pribadi");
  await revealField(tank.getByLabel("Ruang terpakai (m²)", { exact: true }));
  await tank.getByLabel("Ruang terpakai (m²)", { exact: true }).fill("2");
  await revealField(tank.getByLabel("Sumber / alasan ruang terpakai", { exact: true }));
  await tank.getByLabel("Sumber / alasan ruang terpakai", { exact: true }).selectOption("Asumsi pribadi");
  await tank.getByLabel("Tampungan tersedia per kejadian (m³/event)", { exact: true }).fill("3");
  await revealField(tank.getByLabel("Sumber / alasan tampungan tersedia per kejadian", { exact: true }));
  await tank.getByLabel("Sumber / alasan tampungan tersedia per kejadian", { exact: true }).selectOption("Asumsi pribadi");
  await tank.getByRole("button", { name: "Terapkan intervensi" }).click();
  await reviewTankScience(page);
  await expect(page.locator(".impact-inline")).toContainText("3,36");
  await expect(tank).toHaveCount(0);
  await page.screenshot({ path: `${evidence}/interventions.png`, fullPage: true });
  await mkdir(output("human-usability"), { recursive: true });
  await page.screenshot({ path: output("human-usability/interventions.png"), fullPage: true });
  await route(page, "Hujan & kondisi awal");
  await page.locator(".scenario-create > summary").click();
  await page.getByLabel("Nama skenario", { exact: true }).fill("Hujan lebih berat");
  await page.getByRole("button", { name: "Buat skenario", exact: true }).click();
  await expect(page.getByLabel("Kedalaman hujan", { exact: true })).toHaveValue("");
  await rain(page, "100");
  await expect(page.locator(".rain-split")).toContainText("10,6");
  await route(page, "Intervensi");
  await tankRow.getByRole("button", { name: "Atur intervensi" }).click();
  const heavyTank = page.getByRole("dialog", { name: "Atur Tangki" });
  await expect(heavyTank.getByLabel("Tampungan tersedia per kejadian (m³/event)", { exact: true })).toHaveValue("");
  await heavyTank.getByLabel("Tampungan tersedia per kejadian (m³/event)", { exact: true }).fill("3");
  await revealField(heavyTank.getByLabel("Sumber / alasan tampungan tersedia per kejadian", { exact: true }));
  await heavyTank.getByLabel("Sumber / alasan tampungan tersedia per kejadian", { exact: true }).selectOption("Asumsi pribadi");
  await heavyTank.getByRole("button", { name: "Terapkan intervensi" }).click();
  await reviewTankScience(page);
  await expect(page.locator(".impact-inline")).toContainText("7,6");
  await route(page, "Hujan & kondisi awal");
  await page.locator(".scenario-switch").getByRole("button", { name: /Hujan uji/ }).click();
  await route(page, "Intervensi");
  await route(page, "Alternatif");
  await expect(page.locator(".search-contract")).toContainText("2 kemungkinan diperiksa");
  await expect(page.locator(".alternative")).toHaveCount(2);
  await page.screenshot({ path: `${evidence}/alternatives.png`, fullPage: true });
  await mkdir(output("human-usability"), { recursive: true });
  await page.screenshot({ path: output("human-usability/alternatives.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const alternative = page.locator(".alternative").filter({ hasText: "3,36" });
  await alternative.getByRole("button", { name: "Pilih rencana ini" }).click();
  await expect(page.locator(".plan-composition .plan-option")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Unduh ringkasan" })).toBeEnabled();
  await expect(page.locator(".decision-meaning")).toContainText("Tanpa rencana");
  await expect(page.locator(".decision-meaning")).toContainText("Ditangani pada neraca");
  await expect(page.locator(".decision-meaning")).toContainText("Sisa limpasan");
  await expect(page.locator(".decision-meaning")).toContainText("bukan prediksi genangan atau kedalaman banjir");
  await page.locator(".decision-provenance").first().locator("summary").click();
  await expect(page.locator(".decision-provenance").first()).toContainText("Hujan.");
  await page.locator(".decision-provenance").nth(1).locator("summary").click();
  const [summaryDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Unduh ringkasan" }).click(),
  ]);
  const summaryPath = await summaryDownload.path();
  const summaryText = await readFile(summaryPath!, "utf8");
  expect(summaryText).toContain("Limpasan tertangani menurut selisih neraca");
  expect(summaryText).toContain("Neraca konservasi:");
  expect(summaryText).toContain("Kelas permukaan dan provenance foto:");
  expect(summaryText).toContain("Rencana ini dipilih pengguna");
  await page.screenshot({ path: `${evidence}/decision.png`, fullPage: true });
  const decision = await page.locator(".decision-accounting").innerText();
  await saveProject(page);
  await expect(page.locator(".save-state")).toContainText("Tersimpan");
  await page.reload();
  await page.locator(".local-projects").getByRole("button", { name: /^Rumah Keluarga/ }).click();
  await expect(page.locator(".register-total")).toContainText("150 / 150");
  await page.locator(".zone-row").filter({ hasText: "Atap rumah" }).click();
  await page.locator(".image-review > summary").click();
  await expect(page.locator(".image-review")).toContainText("Pemeriksaan tersimpan: Atap");
  await route(page, "Rencana & Dampak");
  await expect(page.locator(".decision-accounting")).toHaveText(decision, { useInnerText: true });
  await expect(page.getByRole("button", { name: "Unduh ringkasan" })).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".decision-meaning")).toContainText("Ditangani pada neraca");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: `${evidence}/decision-390.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await route(page, "Bandingkan");
  await expect(page.locator(".scenario-column")).toHaveCount(2);
  await expect(page.locator(".scenario-column").nth(1)).toContainText("7,6 m³");
  await page.screenshot({ path: `${evidence}/compare.png`, fullPage: true });
  const a11y = await new AxeBuilder({ page }).analyze();
  expect(a11y.violations).toEqual([]);
  for (const [width, height] of [[1920,1080],[1707,862],[1536,864],[1440,900],[1366,768],[1280,800],[768,1024],[390,844]]) {
    await page.setViewportSize({ width:width!, height:height! });
    if (width === 390) await page.getByLabel("Ruang kerja", { exact: true }).selectOption("studio");
    else await route(page, "Studio Persil");
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), `overflow at ${width}`).toBe(false);
    await page.screenshot({ path: `${evidence}/studio-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await route(page, "Proyek");
  await page.locator(".project-backup > summary").click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Unduh cadangan proyek" }).click();
  const backup = await downloading; const file = await backup.path();
  await page.getByLabel("Buka berkas cadangan").setInputFiles(file!);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Studio Persil");
  await route(page, "Rencana & Dampak");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Alternatif");
  await expect(page.locator(".readiness-checklist")).toHaveCount(0);
  await page.locator(".recovery-resume").click();
  await expect(page.locator(".readiness-checklist")).toContainText("Data berubah");
  await page.getByRole("button", { name: "Tutup panduan isian" }).click();
  await page.locator(".alternative").filter({hasText:"3,36"}).getByRole("button",{name:"Pilih rencana ini"}).click();
  await expect(page.locator(".decision-accounting")).toHaveText(decision, { useInnerText: true });
  await route(page, "Hujan & kondisi awal");
  await rain(page, "80");
  await route(page, "Rencana & Dampak");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Alternatif");
  await expect(page.locator(".readiness-checklist")).toHaveCount(0);
  await page.locator(".recovery-resume").click();
  await expect(page.locator(".readiness-checklist")).toContainText("Data berubah");
  await page.getByRole("button", { name: "Tutup panduan isian" }).click();
  await expect(page.getByRole("button", { name: "Unduh ringkasan" })).toHaveCount(0);
  await route(page,"Studio Persil");
  await page.locator(".zone-row").filter({hasText:"Atap rumah"}).click();
  await coefficient(page,"Atap rumah","0.7");
  await expect(page.getByLabel("Koefisien limpasan",{exact:true})).toHaveValue("0.7");
  expect(errors).toEqual([]);
});

async function canvasPoint(page: Page, x: number, y: number) {
  return page.getByTestId("parcel-boundary").evaluate((el, p) => {
    const polygon = el as SVGPolygonElement, b = polygon.getBBox();
    const point = new DOMPoint(b.x + b.width * p.x / 15, b.y + b.height * p.y / 10).matrixTransform(polygon.getScreenCTM()!);
    return { x: point.x, y: point.y };
  }, { x, y });
}
test("Studio live measurements follow the active snapped geometry and clear on completion", async ({ page }) => {
  await mkdir(output("studio-surface-refinement"), { recursive: true });
  await fresh(page, "Ukuran garis langsung");
  await page.locator(".approved-parcel > svg").scrollIntoViewIfNeeded();
  await page.screenshot({ path: output("studio-surface-refinement/studio-idle-desktop.png"), fullPage: true });
  await expect(page.getByRole("group", { name: "Mode kanvas" })).toBeVisible();
  await page.getByRole("button", { name: "Zona", exact: true }).click();
  await page.getByRole("button", { name: "Bentuk bebas", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Menggambar zona" })).toBeVisible();
  await page.screenshot({ path: output("studio-surface-refinement/studio-drawing-mode.png"), fullPage: true });
  const origin = await canvasPoint(page, 2, 2);
  await page.mouse.click(origin.x, origin.y);
  const rawTarget = await canvasPoint(page, 5.16, 6.21);
  await page.keyboard.down("Shift");
  await page.mouse.move(rawTarget.x, rawTarget.y, { steps: 4 });
  await page.keyboard.up("Shift");
  const measurement = page.getByTestId("live-measurement");
  await expect(measurement).toHaveAttribute("data-kind", "segment");
  await expect(measurement.locator(".live-measurement-primary")).toHaveText("4 m");
  await page.screenshot({ path: output("studio-freeform-live.png") });
  await page.screenshot({ path: output("studio-surface-refinement/studio-live-measurement.png") });
  const constrained = await canvasPoint(page, 2, 6);
  await page.mouse.click(constrained.x, constrained.y);
  await expect(measurement).toHaveCount(0);
  const next = await canvasPoint(page, 5.16, 6.21);
  await page.mouse.move(next.x, next.y, { steps: 3 });
  await expect(measurement.locator(".live-measurement-primary")).toHaveText("3 m");
  await page.getByRole("button", { name: "Batalkan menggambar" }).click();
  await expect(measurement).toHaveCount(0);

  await page.getByRole("button", { name: "Zona", exact: true }).click();
  await page.getByRole("button", { name: "Persegi panjang", exact: true }).click();
  const rectangleStart = await canvasPoint(page, 2, 2), rectangleEnd = await canvasPoint(page, 12.16, 9.91);
  await page.mouse.move(rectangleStart.x, rectangleStart.y);
  await page.mouse.down();
  await page.mouse.move(rectangleEnd.x, rectangleEnd.y, { steps: 4 });
  await expect(measurement).toHaveAttribute("data-kind", "rectangle");
  await expect(measurement.locator(".live-measurement-primary")).toHaveText("10 × 8 m");
  await expect(measurement.locator(".live-measurement-secondary")).toHaveText("80 m²");
  await page.screenshot({ path: output("studio-rectangle-live.png") });
  await page.mouse.up();
  await expect(measurement).toHaveCount(0);
});

test("Studio live measurement follows constrained vertex edits and remains inside the mobile canvas", async ({ page }) => {
  await fresh(page, "Ukuran edit titik");
  await zone(page, "2", "4");
  await page.getByRole("button", { name: "Titik", exact: true }).click();
  await page.getByLabel("Kunci X/Y").check();
  await page.locator(".approved-parcel > svg").scrollIntoViewIfNeeded();
  const firstHandle = page.locator(".vertex-handle").first();
  const handleBox = await firstHandle.boundingBox();
  expect(handleBox).not.toBeNull();
  const from = { x: handleBox!.x + handleBox!.width / 2, y: handleBox!.y + handleBox!.height / 2 };
  const rawTarget = await canvasPoint(page, 2.16, 2.36);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(rawTarget.x, rawTarget.y, { steps: 4 });
  const measurement = page.getByTestId("live-measurement");
  await expect(measurement).toHaveAttribute("data-kind", "edge");
  await expect(measurement.locator(".live-measurement-primary")).toHaveText("7,5 m");
  await page.screenshot({ path: output("studio-vertex-live.png") });
  const placement = await measurement.boundingBox();
  const canvas = await page.locator(".approved-parcel > svg").boundingBox();
  expect(placement && canvas && placement.x >= canvas.x && placement.y >= canvas.y
    && placement.x + placement.width <= canvas.x + canvas.width
    && placement.y + placement.height <= canvas.y + canvas.height).toBeTruthy();
  await page.mouse.up();
  await expect(measurement).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".approved-parcel > svg").scrollIntoViewIfNeeded();
  const mobileHandle = await firstHandle.boundingBox();
  expect(mobileHandle).not.toBeNull();
  const mobileFrom = { x: mobileHandle!.x + mobileHandle!.width / 2, y: mobileHandle!.y + mobileHandle!.height / 2 };
  const mobileTarget = await canvasPoint(page, 2.16, 4.36);
  await page.mouse.move(mobileFrom.x, mobileFrom.y);
  await page.mouse.down();
  await page.mouse.move(mobileTarget.x, mobileTarget.y, { steps: 4 });
  await expect(measurement.locator(".live-measurement-primary")).toHaveText("5,5 m");
  await page.screenshot({ path: output("studio-live-mobile.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.mouse.up();
  await expect(measurement).toHaveCount(0);
});

test("Studio drawing gestures do not select labels and preserve editable text selection", async ({ page }) => {
  await mkdir(output("studio-surface-refinement"), { recursive: true });
  await fresh(page, "Uji seleksi kanvas");
  const label = page.locator(".parcel-ruler text").first();
  await expect(label).toBeVisible();
  await page.screenshot({ path: output("studio-surface-refinement/studio-idle-selection-test.png"), fullPage: true });
  const box = await label.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 55, box!.y + box!.height / 2 + 18, { steps: 5 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.getSelection()?.toString() ?? "")).toBe("");
  await page.mouse.dblclick(box!.x + box!.width / 2, box!.y + box!.height / 2);
  expect(await page.evaluate(() => window.getSelection()?.toString() ?? "")).toBe("");
  await page.getByRole("button", { name: "Zona", exact: true }).click();
  await page.getByRole("button", { name: "Seluruh persil" }).click();
  await page.getByRole("button", { name: "Titik", exact: true }).click();
  await page.screenshot({ path: output("studio-surface-refinement/studio-vertex-mode.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: output("studio-surface-refinement/studio-mobile.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator(".property-bench").getByRole("button", { name: "Sumber & data zona" }).click();
  const zoneName = page.getByRole("dialog").getByLabel("Nama zona");
  await zoneName.focus();
  await page.keyboard.press("Control+A");
  expect(await zoneName.evaluate(el => (el as HTMLInputElement).selectionEnd! - (el as HTMLInputElement).selectionStart!)).toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await page.goto("/production.html");
  await page.getByLabel("Nama proyek", { exact: true }).fill("Uji input di dalam kanvas");
  await page.getByRole("button", { name: "Buat proyek baru" }).click();
  const length = page.getByLabel("Panjang persil");
  await length.fill("15");
  await length.focus();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText("16");
  await expect(length).toHaveValue("16");
});

test("approved canvas: custom polygon, drag, invalid geometry, undo and keyboard editing", async ({ page }) => {
  await fresh(page, "Uji bentuk");
  await page.getByRole("button", { name: "Zona", exact: true }).click();
  await page.getByRole("button", { name: "Bentuk bebas", exact: true }).click();
  await page.locator(".approved-parcel > svg").scrollIntoViewIfNeeded();
  for (const [i, [x,y]] of [[1,1],[6,2],[6,4],[4,4],[4,7],[1,7]].entries()) { const p = await canvasPoint(page,x!,y!); if (i === 1) await page.keyboard.down("Shift"); await page.mouse.click(p.x,p.y); if (i === 1) await page.keyboard.up("Shift"); }
  await page.getByRole("button", { name: "Selesai", exact: true }).click();
  await expect(page.locator(".register-total")).toContainText("24 / 150");
  await page.getByLabel("Jenis permukaan", { exact: true }).selectOption("vegetation");
  await coefficient(page, "Taman berbentuk L", "0.2");
  await page.getByRole("button", { name: "Titik", exact: true }).click();
  const first = page.locator(".vertex-handle").first();
  await first.focus(); await page.keyboard.press("ArrowRight");
  await expect(page.locator(".register-total")).toContainText("23,7 / 150");
  await page.getByRole("button", { name: "Urungkan sketsa" }).click();
  await expect(page.locator(".register-total")).toContainText("24 / 150");
  await expect(page.getByLabel("Koefisien limpasan", { exact: true })).toHaveValue("0.2");
  await page.getByRole("button", { name: "Ulangi sketsa" }).click();
  await expect(page.locator(".register-total")).toContainText("23,7 / 150");
  await page.getByRole("button", { name: "Urungkan sketsa" }).click();
  await page.getByRole("button", { name: "Pilih", exact: true }).click();
  await page.locator(".approved-parcel > svg").scrollIntoViewIfNeeded();
  const a = await canvasPoint(page,2,2), b = await canvasPoint(page,3,2);
  await page.mouse.move(a.x,a.y); await page.mouse.down(); await page.mouse.move(b.x,b.y,{steps:5}); await page.mouse.up();
  await expect(page.locator(".map-message")).toContainText("Bentuk diperbarui");
  await expect(page.locator(".register-total")).toContainText("24 / 150");
  await page.getByRole("button", { name: "Titik", exact: true }).click();
  await page.locator(".vertex-handle").first().focus();
  for (let i=0;i<5;i++) await page.keyboard.press("Shift+ArrowLeft");
  await expect(page.locator(".map-message")).toContainText("batas persil");
  await page.screenshot({ path: `${evidence}/invalid-geometry.png`, fullPage:true });
  await page.getByRole("button", { name: "Edit batas", exact: true }).click();
  await expect(page.locator(".vertex-handle")).toHaveCount(4);
  await page.getByRole("button", { name: "Sisipkan titik pada sisi 1", exact:true }).click();
  await expect(page.locator(".vertex-handle")).toHaveCount(5);
  await saveProject(page);
  await expect(page.locator(".save-state")).toContainText("Tersimpan");
  await page.reload();
  await page.locator(".local-projects").getByRole("button", { name: /^Uji bentuk/ }).click();
  await expect(page.locator(".zone-row")).toContainText("Taman berbentuk L");
});

test("explicit sample: four families, finite alternatives, infeasible budget and modal dismissal", async ({ page }) => {
  page.setDefaultTimeout(10000);
  await page.goto("/production.html");
  await page.getByRole("button", { name: "Buka Contoh", exact:true }).click();
  await route(page,"Alternatif");
  await expect(page.locator(".search-contract")).toContainText("0 kemungkinan diperiksa");
  await route(page,"Intervensi");
  for (const name of ["Tangki", "Sumur / area resapan", "Rain garden", "Permukaan berpori"]) await page.getByRole("button", {name:`Tambahkan ${name}`,exact:true}).click();
  await expect(page.locator("[data-intervention-marker]")).toHaveCount(4);
  const trigger = page.getByRole("button",{name:"Atur intervensi"}).first();
  await trigger.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const a11y = await new AxeBuilder({page}).analyze(); expect(a11y.violations).toEqual([]);
  await page.keyboard.press("Escape"); await expect(page.getByRole("dialog")).toHaveCount(0); await expect(trigger).toBeFocused();
  await trigger.click(); await page.getByRole("button",{name:"Tutup",exact:true}).click(); await expect(page.getByRole("dialog")).toHaveCount(0);
  await route(page,"Alternatif");
  await expect(page.locator(".search-contract")).toContainText("16 kemungkinan diperiksa");
  expect(await page.locator(".alternative").count()).toBeGreaterThan(1);
  await route(page,"Intervensi");
  await trigger.click();
  const reuseDialog=page.getByRole("dialog");
  await reuseDialog.getByText("Pemakaian kembali selama kejadian",{exact:true}).click();
  await reuseDialog.getByLabel("Isi penggunaan air selama hujan").check();
  await reuseDialog.getByLabel("Kebutuhan penggunaan air (m³/event)",{exact:true}).fill("1");
  await revealField(reuseDialog.getByLabel("Sumber / alasan kebutuhan penggunaan air", { exact: true }));
  await reuseDialog.getByLabel("Sumber / alasan kebutuhan penggunaan air", { exact: true }).selectOption("Asumsi pribadi");
  await reuseDialog.getByRole("button",{name:"Terapkan intervensi"}).click();
  await route(page,"Alternatif");
  await page.locator(".alternative").filter({hasText:"Tangki"}).first().getByRole("button",{name:"Pilih rencana ini"}).click();
  await expect(page.locator(".partition-labels")).toContainText("Dimanfaatkan");
  await expect(page.locator(".partition-labels > div")).toHaveCount(4);
  await page.screenshot({path:`${evidence}/reuse-accounting.png`,fullPage:true});
  await page.setViewportSize({width:390,height:844});
  expect(await page.locator(".partition-labels > div").evaluateAll(nodes => nodes.every(n => n.scrollWidth <= n.clientWidth + 1))).toBe(true);
  await page.screenshot({path:`${evidence}/reuse-mobile.png`,fullPage:true});
  await page.setViewportSize({width:1440,height:900});
  await route(page,"Intervensi");
  await page.getByLabel("Anggaran (Rp)",{exact:true}).fill("1");
  await page.getByRole("button",{name:"Terapkan batas rencana"}).click();
  await route(page,"Alternatif");
  await expect(page.locator(".alternative")).toHaveCount(1);
  await expect(page.locator(".feasibility-note")).toContainText("anggaran");
  await page.screenshot({path:`${evidence}/infeasible-budget.png`,fullPage:true});
});
test("invalid dimensions and independent-tab revision conflict preserve both projects", async ({page,context}) => {
  await page.goto("/production.html");
  await page.getByLabel("Nama proyek",{exact:true}).fill("Dua tab " + "X".repeat(112));
  await page.getByRole("button",{name:"Buat proyek baru"}).click();
  await page.getByLabel("Panjang persil").fill("21"); await page.getByLabel("Lebar persil").fill("10");
  await page.getByRole("button",{name:"Buat persil",exact:true}).click();
  await expect(page.locator(".parcel-start [role=alert]")).toContainText("200");
  await expect(page.getByTestId("parcel-boundary")).toHaveCount(0);
  await page.getByLabel("Panjang persil").fill("15"); await page.getByRole("button",{name:"Buat persil",exact:true}).click();
  await saveProject(page);
  await expect(page.locator(".save-state")).toContainText("Tersimpan");
  const other = await context.newPage(); await other.goto("/production.html");
  await other.locator(".local-projects").getByRole("button",{name: /^Dua tab/}).click();
  await page.getByRole("button",{name:"Zona",exact:true}).click(); await page.getByRole("button",{name:"Seluruh persil"}).click();
  await saveProject(page); await expect(page.locator(".save-state")).toContainText("Tersimpan");
  await other.getByRole("button",{name:"Zona",exact:true}).click(); await other.getByRole("button",{name:"Seluruh persil"}).click();
  await saveProject(other);
  await expect(other.locator(".storage-error")).toBeVisible();
  await other.getByRole("button",{name:"Simpan perubahan sebagai salinan"}).click();
  await expect(other.locator(".route-project")).toContainText("salinan pemulihan");
  await expect(other.locator(".save-state")).toContainText("Tersimpan");
  await other.close();
});
test("production build reloads and computes offline", async ({page,context}) => {
  test.skip(!process.env.TIRTA_PRODUCTION_PREVIEW, "Run against the built production preview to test its service worker.");
  await fresh(page,"Proyek offline");
  await page.getByRole("button",{name:"Zona",exact:true}).click(); await page.getByRole("button",{name:"Seluruh persil"}).click();
  await page.getByLabel("Jenis permukaan",{exact:true}).selectOption("roof"); await coefficient(page,"Atap offline","0.8");
  await saveProject(page); await expect(page.locator(".save-state")).toContainText("Tersimpan");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await context.setOffline(true);
  await page.reload(); await page.locator(".local-projects").getByRole("button",{name: /^Proyek offline/}).click();
  await route(page,"Hujan & kondisi awal"); await rain(page,"60");
  await expect(page.locator(".rain-split")).toContainText("7,2");
  await rain(page,""); await expect(page.locator(".rain-split")).toHaveCount(0);
  await rain(page,"0"); await expect(page.locator(".rain-split")).toContainText("0 m³");
  await saveProject(page); await expect(page.locator(".save-state")).toContainText("Tersimpan");
  await page.screenshot({path:`${evidence}/offline-zero-rain.png`,fullPage:true});
  await context.setOffline(false);
});

test("touch Studio uses the same authoring and selected-object path", async ({browser}) => {
  const context = await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,baseURL:process.env.TIRTA_RESCUE_URL ?? "http://127.0.0.1:4173"});
  const page=await context.newPage(); await fresh(page,"Persil sentuh");
  await page.getByRole("button",{name:"Tambah zona",exact:true}).tap();
  await page.locator(".approved-parcel > svg").scrollIntoViewIfNeeded();
  const a=await canvasPoint(page,1,1), b=await canvasPoint(page,8,8);
  await page.touchscreen.tap(a.x,a.y); await page.touchscreen.tap(b.x,b.y);
  await expect(page.locator(".zone-row")).toHaveCount(1);
  await expect(page.locator(".register-total")).toContainText("49 / 150");
  await page.getByRole("button",{name:"Edit titik zona",exact:true}).tap();
  await page.getByRole("button",{name:"Sisipkan titik pada sisi 1",exact:true}).tap();
  await expect(page.locator(".vertex-handle")).toHaveCount(5);
  await page.screenshot({path:`${evidence}/touch-studio.png`,fullPage:true});
  await context.close();
});


const uxScreens = process.env.TIRTA_UX_EVIDENCE ?? output("ux-assistance/screenshots");
test("coefficient assistance: five classes, explicit picks, custom warning and persisted source", async ({page}) => {
  await mkdir(uxScreens, { recursive: true });
  await fresh(page, "Patokan pengguna");
  await page.getByRole("button", {name:"Zona",exact:true}).click(); await page.getByRole("button", {name:"Seluruh persil"}).click();
  for (const [surface, reference] of [["roof","TxDOT"],["paved","TxDOT"],["soil","TxDOT"],["vegetation","TxDOT"],["porous","USGS"]]) {
    await page.getByLabel("Jenis permukaan",{exact:true}).selectOption(surface!);
    await expect(page.getByLabel("Koefisien limpasan",{exact:true})).toHaveValue("");
    await page.getByRole("button",{name:"Sumber & data zona",exact:true}).click();
    const dialog=page.getByRole("dialog");
    await expect(dialog.locator(".coefficient-guide")).toContainText(reference!);
    await expect(dialog.getByLabel("Koefisien untuk perhitungan")).toHaveValue("");
    if(surface==="porous") { await expect(dialog).toContainText("Tidak ada satu angka universal"); await expect(dialog.locator(".coefficient-picks")).toHaveCount(0); }
    else await expect(dialog.locator(".coefficient-picks").first()).toBeVisible();
    await page.keyboard.press("Escape");
  }
  await page.getByLabel("Jenis permukaan",{exact:true}).selectOption("roof");
  await page.getByRole("button",{name:"Sumber & data zona",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await dialog.getByRole("button",{name:"Atap: Tengah rentang · C 0,85",exact:true}).click();
  await expect(dialog.getByLabel("Koefisien untuk perhitungan")).toHaveValue("0.85");
  await expect(dialog.getByLabel("Sumber koefisien",{exact:true})).toHaveValue(/Pilihan pengguna C=0.85.*TxDOT/);
  await page.screenshot({path:`${uxScreens}/coefficient-guide-1440.png`,fullPage:true});
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await dialog.getByRole("button",{name:"Terapkan data zona"}).click();
  await saveProject(page); await expect(page.locator(".save-state")).toContainText("Tersimpan");
  await page.reload(); await page.locator(".local-projects").getByRole("button",{name: /^Patokan pengguna/}).click();
  await page.locator(".zone-row").first().click();
  await expect(page.getByLabel("Koefisien limpasan",{exact:true})).toHaveValue("0.85");
  await page.getByRole("button",{name:"Sumber & data zona",exact:true}).click();
  await expect(dialog.getByLabel("Sumber koefisien",{exact:true})).toHaveValue(/Pilihan pengguna C=0.85.*TxDOT/);
  await dialog.getByLabel("Koefisien untuk perhitungan").fill("2");
  await dialog.getByRole("button",{name:"Terapkan data zona"}).click();
  await expect(dialog.locator("#coefficient-error")).toBeVisible();
  await expect(dialog.getByLabel("Koefisien untuk perhitungan")).toHaveAttribute("aria-invalid","true");
  await dialog.getByLabel("Koefisien untuk perhitungan").fill("0.4");
  await expect(dialog.locator(".field-warning")).toContainText("di luar patokan");
  await dialog.getByRole("button",{name:"Terapkan data zona"}).click();
  await expect(dialog.locator("#coefficient-error")).toBeVisible();
  await expect(dialog.getByLabel("Sumber koefisien",{exact:true})).toHaveAttribute("aria-invalid","true");
  await expect(page.locator(".notice")).toHaveCount(0,{timeout:3000});
  await expect(dialog.locator("#coefficient-error")).toBeVisible();
  await page.screenshot({path:`${uxScreens}/coefficient-validation-1440.png`,fullPage:true});
  await dialog.getByLabel("Sumber koefisien",{exact:true}).fill("Hasil pengukuran kejadian di atap ini; data pemilik");
  await dialog.getByRole("button",{name:"Terapkan data zona"}).click();
  await expect(page.getByLabel("Koefisien limpasan",{exact:true})).toHaveValue("0.4");
});

test("readiness: multiple incomplete zones, focus recovery, blank rain versus zero, incomplete intervention", async ({page}) => {
  await fresh(page,"Alur bertahap"); await zone(page,"0","8"); await zone(page,"8","7");
  await mkdir(output("human-usability"), { recursive: true });
  await mkdir(output("recovery/mobile-hardening"), { recursive: true });
  await page.getByRole("button",{name:"Uji hujan pada persil ini"}).click();
  await expect(page.getByRole("heading",{level:1})).toHaveText("Studio Persil");
  await expect(page.locator(".readiness-checklist li")).toHaveCount(4);
  await expect(page.getByLabel("Jenis permukaan",{exact:true})).toBeFocused();
  await expect(page.getByLabel("Jenis permukaan",{exact:true})).toHaveAttribute("aria-invalid","true");
  await page.screenshot({ path: output("human-usability/incomplete-studio.png"), fullPage: true });
  await page.screenshot({path:`${uxScreens}/studio-blocked-1440.png`,fullPage:true});
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await page.getByLabel("Jenis permukaan",{exact:true}).selectOption("roof"); await coefficient(page,"Atap","0.8");
  await page.locator(".readiness-checklist").getByRole("button",{name:/jenis permukaan/}).click();
  await expect(page.getByLabel("Jenis permukaan",{exact:true})).toBeFocused();
  await page.getByLabel("Jenis permukaan",{exact:true}).selectOption("vegetation"); await coefficient(page,"Taman","0.2");
  await expect(page.locator(".readiness-checklist")).toContainText("sudah lengkap");
  await route(page,"Hujan & kondisi awal");
  await route(page,"Intervensi");
  await expect(page.getByRole("heading",{level:1})).toHaveText("Hujan & kondisi awal");
  await expect(page.getByLabel("Kedalaman hujan",{exact:true})).toBeFocused();
  await expect(page.locator(".readiness-checklist")).toHaveCount(0);
  await expect(page.locator(".recovery-resume")).toContainText("1 hal perlu diperiksa · Tunjukkan");
  await expect(page.locator(".readiness-trigger")).toHaveCount(0);
  await expect(page.locator("#rain-help")).toContainText("Isi dan terapkan hujan");
  await rain(page,"0"); await route(page,"Intervensi");
  await expect(page.getByRole("heading",{level:1})).toHaveText("Intervensi");
  await route(page,"Alternatif");
  await expect(page.locator(".readiness-checklist")).toHaveCount(0);
  await expect(page.locator(".recovery-resume")).toContainText("1 hal perlu diperiksa · Tunjukkan");
  await expect(page.locator(".readiness-trigger")).toHaveCount(0);
  await expect(page.getByLabel("Anggaran (Rp)",{exact:true})).toBeFocused();
  await expect(page.locator(".constraint-editor")).toContainText("Isi batas saat siap membandingkan alternatif");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: output("recovery/mobile-hardening/mobile-single-issue-recovery.png"), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByLabel("Anggaran (Rp)",{exact:true}).fill("1000000");
  await page.getByLabel("Lahan tersedia (m²)",{exact:true}).fill("2");
  await revealField(page.getByLabel("Sumber / alasan anggaran", { exact: true }));
  await page.getByLabel("Sumber / alasan anggaran", { exact: true }).selectOption("Asumsi pribadi");
  await revealField(page.getByLabel("Sumber / alasan lahan tersedia", { exact: true }));
  await page.getByLabel("Sumber / alasan lahan tersedia", { exact: true }).selectOption("Asumsi pribadi");
  await page.getByRole("button",{name:"Terapkan batas rencana"}).click();
  await page.getByRole("button",{name:"Tambahkan Tangki",exact:true}).click();
  await route(page,"Alternatif");
  await expect(page.getByRole("heading",{level:1})).toHaveText("Alternatif");
  await expect(page.locator(".alternative")).toHaveCount(1);
  await expect(page.locator(".alternative")).toContainText("Tanpa intervensi");
  await expect(page.locator(".feasibility-note")).toContainText("Tangki");
  await route(page,"Intervensi");
  await page.locator('[data-component="tank"]').getByRole('button', { name: 'Atur intervensi', exact: true }).click();
  const dialog=page.getByRole("dialog"); await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Tampungan tersedia per kejadian (m³/event)",{exact:true})).toHaveValue("");
  await revealField(dialog.getByLabel("Ruang terpakai (m²)",{exact:true}));
  await dialog.getByLabel("Ruang terpakai (m²)",{exact:true}).fill("3");
  await expect(dialog.locator(".field-warning")).toContainText("melebihi");
  await expect(dialog.getByLabel("Ruang terpakai (m²)",{exact:true})).toHaveValue("3");
  await page.screenshot({path:`${uxScreens}/intervention-blocked-1440.png`,fullPage:true});
  await page.keyboard.press("Escape");
  await page.getByRole("button",{name:/Lepas Tangki|Hapus Tangki|Keluarkan Tangki/}).click();
  await route(page,"Alternatif"); await expect(page.locator(".search-contract")).toContainText("0 kemungkinan diperiksa");
});

test("notices and preventive inputs remain usable on narrow screens", async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto("/production.html"); await page.getByLabel("Nama proyek",{exact:true}).fill("Isian mobile"); await page.getByRole("button",{name:"Buat proyek baru"}).click();
  await expect(page.locator(".notice-success")).toBeVisible();
  await page.waitForTimeout(170);
  const overlap = await page.locator(".notice").evaluate(el => {
    const a=el.getBoundingClientRect(); return [...document.querySelectorAll('.map-toolstrip button,.parcel-start input,.parcel-start button,.header-actions button')].some(b => { const r=b.getBoundingClientRect(); return a.left < r.right && a.right > r.left && a.top < r.bottom && a.bottom > r.top; });
  });
  expect(overlap).toBe(false);
  await page.screenshot({path:`${uxScreens}/success-notice-390.png`,fullPage:true});
  await expect(page.locator(".notice")).toHaveCount(0,{timeout:2200});
  await page.getByLabel("Panjang persil").fill("21"); await page.getByLabel("Lebar persil").fill("10");
  await expect(page.locator(".parcel-start output")).toContainText("210 m² · melebihi");
  await page.getByRole("button",{name:"Buat persil",exact:true}).click();
  await expect(page.locator(".parcel-start [role=alert]")).toContainText("200");
  await expect(page.getByLabel("Panjang persil")).toHaveValue("21");
  await page.waitForTimeout(2800);
  await expect(page.locator(".parcel-start [role=alert]")).toBeVisible();
  await page.screenshot({path:`${uxScreens}/dimensions-error-390.png`,fullPage:true});
  await page.getByLabel("Panjang persil").fill("15"); await expect(page.locator(".parcel-start output")).toContainText("150 m²");
  await page.getByRole("button",{name:"Buat persil",exact:true}).click();
  await saveProject(page);
  await page.getByRole("button",{name:"Tutup pemberitahuan"}).click(); await expect(page.locator(".notice")).toHaveCount(0);
  await saveProject(page); await page.keyboard.press("Escape"); await expect(page.locator(".notice")).toHaveCount(0);
  await page.getByRole("button",{name:"Tambah zona",exact:true}).click(); await page.getByRole("button",{name:"Seluruh persil"}).click();
  await page.getByRole("button",{name:"Uji hujan pada persil ini"}).click();
  await expect(page.getByLabel("Jenis permukaan",{exact:true})).toBeFocused();
  await page.screenshot({path:`${uxScreens}/studio-blocked-390.png`,fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
});


test("image assistance measures local features, keeps hypotheses reversible and uses real context", async ({page}) => {
  page.setDefaultTimeout(10000);
  const errors:string[]=[]; page.on("pageerror",e=>errors.push(e.message));
  await mkdir(output("studio-surface-refinement"), { recursive: true });
  await page.goto("/production.html"); await page.getByRole("button",{name:"Buka Contoh",exact:true}).click();
  const before=await page.getByLabel("Koefisien limpasan",{exact:true}).inputValue();
  expect(before).not.toBe("");
  await page.locator(".parcel-svg").focus(); await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Kenali permukaan dari foto" }).click();
  await expect(page.locator(".image-review-empty")).toContainText("Pilih satu zona pada persil");
  await page.screenshot({ path: output("studio-surface-refinement/surface-assist-no-zone.png"), fullPage: true });
  await page.locator(".zone-row").first().click();
  await page.locator(".image-review > summary").click();
  await expect(page.locator(".image-review")).toContainText("5 MiB");
  await expect(page.locator(".image-zone-context")).toContainText("Zona 1");
  await page.screenshot({ path: output("studio-surface-refinement/surface-assist-before-photo.png"), fullPage: true });
  const upload=async(pattern:"green"|"stripes")=>{
    const png=await page.evaluate(pattern=>{const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const ctx=canvas.getContext('2d')!;
      if(pattern==='green'){ctx.fillStyle='#208030';ctx.fillRect(0,0,64,64);}else{for(let x=0;x<64;x++){ctx.fillStyle=x%4<2?'#000':'#fff';ctx.fillRect(x,0,1,64);}}
      return canvas.toDataURL().split(',')[1]!;},pattern);
    await page.getByLabel("Pilih foto permukaan", { exact: true }).setInputFiles({name:`${pattern}.png`,mimeType:'image/png',buffer:Buffer.from(png,'base64')});
    await expect(page.locator('input[name="surface-confirmation"]').first()).toBeVisible();
  };
  await upload("green");
  await page.screenshot({ path: output("studio-surface-refinement/surface-assist-analysis.png"), fullPage: true });
  await expect(page.locator(".visual-feature-strip")).toContainText("Saturasi rata-rata");
  await expect(page.locator(".visual-candidates li").first()).toContainText("Vegetasi");
  await expect(page.getByLabel("Jenis permukaan",{exact:true})).toHaveValue("roof");
  await expect(page.locator('input[name="surface-confirmation"]:checked')).toHaveCount(0);
  await page.locator('input[name="surface-confirmation"][value="vegetation"]').check();
  await expect(page.locator(".image-before-after")).toContainText("Atap");
  await expect(page.locator(".image-before-after")).toContainText("Vegetasi");
  await expect(page.getByRole("button", { name: "Terapkan ke Zona 1" })).toBeVisible();
  await page.screenshot({ path: output("studio-surface-refinement/surface-assist-before-after.png"), fullPage: true });
  await expect(page.locator(".image-recommendation")).toContainText("m³ limpasan");
  await expect(page.locator(".image-recommendation")).toContainText("bukan hasil foto");
  await page.getByLabel("Asal foto / catatan pemeriksaan").fill("Uji gambar sintetis; atap dicat hijau, diverifikasi pengguna");
  await page.getByRole("button",{name:"Terapkan ke Zona 1"}).click();
  await expect(page.locator(".image-applied")).toContainText("Koefisien limpasan direset");
  await expect(page.getByLabel("Jenis permukaan",{exact:true})).toHaveValue("vegetation");
  await expect(page.getByLabel("Koefisien limpasan",{exact:true})).toHaveValue("");
  await page.screenshot({ path: output("studio-surface-refinement/surface-assist-applied.png"), fullPage: true });
  await page.locator(".image-applied").getByRole("button", { name: /Pilih koefisien/ }).click();
  await expect(page.getByLabel("Koefisien limpasan",{exact:true})).toBeFocused();
  await page.screenshot({ path: output("studio-surface-refinement/surface-assist-coefficient-followup.png"), fullPage: true });
  await expect(page.getByLabel("Koefisien limpasan",{exact:true})).toHaveValue("");
  await saveProject(page); await expect(page.locator(".save-state")).toContainText("Tersimpan");
  await page.reload(); await page.locator(".local-projects").getByRole("button",{name: /^Contoh TIRTA/}).click(); await page.locator(".zone-row").first().click();
  await expect(page.getByLabel("Jenis permukaan",{exact:true})).toHaveValue("vegetation");
  await expect(page.getByLabel("Koefisien limpasan",{exact:true})).toHaveValue("");
  await page.locator(".image-review > summary").click();
  await expect(page.locator(".visual-feature-strip")).toContainText("Saturasi rata-rata");
  await upload("stripes"); await expect(page.locator(".visual-feature-strip")).toContainText("4 piksel");
  await expect(page.locator(".visual-candidates")).toContainText("Belum ada petunjuk yang cukup");
  await page.locator('input[name="surface-confirmation"][value="porous"]').check();
  await expect(page.locator(".image-recommendation")).toContainText("kredit ganda");
  for(const width of [1440,1280,768,390]){
    await page.setViewportSize({width,height:width<500?844:900});
    await page.locator(".image-review").screenshot({path:output(`studio-surface-refinement/surface-assist-${width}.png`)});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
  }
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await page.getByLabel("Asal foto / catatan pemeriksaan").fill("Pola garis ambigu; pemeriksaan diabaikan oleh pengguna");
  await page.getByRole("button",{name:"Abaikan foto"}).click();
  await expect(page.locator(".image-review")).toContainText("Foto diabaikan; jenis permukaan zona tidak diubah.");
  await expect(page.getByLabel("Jenis permukaan",{exact:true})).toHaveValue("vegetation");
  await expect(page.getByLabel("Koefisien limpasan",{exact:true})).toHaveValue("");
  await expect(page.locator("[data-intervention-marker]")).toHaveCount(0);
  expect(errors).toEqual([]);
});


test("keyboard entry, reduced motion and informational notice duration", async ({page}) => {
  await page.emulateMedia({reducedMotion:"reduce"});
  await page.goto("/production.html");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link",{name:"Langsung ke ruang kerja"})).toBeFocused();
  await page.keyboard.press("Enter");
  await page.getByRole("button",{name:"Buka Contoh",exact:true}).click();
  await expect(page.locator(".notice-info")).toBeVisible();
  expect(await page.locator(".notice").evaluate(e=>getComputedStyle(e).animationName)).toBe("none");
  await page.waitForTimeout(1900); await expect(page.locator(".notice-info")).toBeVisible();
  await expect(page.locator(".notice-info")).toHaveCount(0,{timeout:1200});
});

const comfortScreens = process.env.TIRTA_RECOVERY_EVIDENCE ?? output("visual-comfort/screenshots");
test("guided correction: real field lens, responsive popup, dismissal and free backward navigation", async ({page}) => {
  await mkdir(comfortScreens, {recursive:true});
  const errors:string[]=[]; page.on("pageerror",e=>errors.push(e.message));
  await fresh(page,"Panduan yang jelas"); await zone(page,"0","8"); await zone(page,"8","7");
  await page.getByRole("button",{name:"Tahap Hujan",exact:true}).click();
  const popup=page.getByRole("region",{name:"Kelengkapan untuk melanjutkan"});
  await expect(popup.locator("li")).toHaveCount(4);
  const surface=page.getByLabel("Jenis permukaan",{exact:true});
  await expect(surface).toBeFocused();
  for(const [width,height] of [[1920,1080],[1707,862],[1536,864],[1440,900],[1366,768],[1280,800],[768,1024],[390,844]]) {
    await page.setViewportSize({width:width!,height:height!});
    await surface.evaluate(el=>el.scrollIntoView({block:"center"}));
    await expect.poll(()=>popup.evaluate(el=>getComputedStyle(el).opacity)).toBe("1");
    await expect.poll(async()=>{
      const a=await surface.boundingBox(),b=await popup.boundingBox(),lens=await page.locator(".recovery-lens").boundingBox();
      if(!a||!b||!lens)return false;
      return !(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y) && b.y>=0 && b.y+b.height<=height!+1 && b.x>=0 && b.x+b.width<=width!+1 && lens.x<=a.x && lens.y<=a.y;
    }).toBe(true);
    expect(await page.locator(".recovery-lens").evaluate(el=>getComputedStyle(el).pointerEvents)).toBe("none");
    await page.screenshot({path:`${comfortScreens}/recovery-${width}.png`});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
  }
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await popup.getByRole("button",{name:/Zona 2.*koefisien/}).click();
  const coefficientInput=page.getByLabel("Koefisien limpasan",{exact:true});
  await expect(coefficientInput).toBeFocused(); await coefficientInput.click(); await coefficientInput.fill("0.37");
  await expect(coefficientInput).toHaveValue("0.37");
  await page.keyboard.press("Escape"); await expect(popup).toHaveCount(0);
  await expect(coefficientInput).toHaveAttribute("aria-invalid","true");
  await page.getByRole("button",{name:/isian perlu dilengkapi · Tunjukkan/}).click();
  await expect(popup).toBeVisible();
  await popup.getByRole("button",{name:"Tutup panduan isian"}).click(); await expect(popup).toHaveCount(0);
  await route(page,"Proyek"); await expect(page.getByRole("heading",{level:1})).toHaveText("Proyek");
  expect(errors).toEqual([]);
});

test("native required fields use the same guide and preserve keyboard recovery", async ({page}) => {
  await page.goto("/production.html");
  await page.getByRole("button",{name:"Buat proyek baru"}).click();
  const popup=page.getByRole("region",{name:"Kelengkapan untuk melanjutkan"});
  await expect(popup).toContainText("Nama proyek — isi terlebih dahulu");
  await expect(page.getByLabel("Nama proyek",{exact:true})).toBeFocused();
  await page.getByLabel("Nama proyek",{exact:true}).fill("Pemulihan isian");
  await expect(popup).toContainText("Kolom ini sudah terisi");
  await popup.getByRole("button",{name:"Periksa & terapkan"}).click();
  await expect(page.getByRole("heading",{level:1})).toHaveText("Studio Persil");
  await expect(popup).toHaveCount(0);
  await page.getByRole("button",{name:"Buat persil",exact:true}).click();
  await expect(popup).toContainText("Panjang persil");
  await popup.getByRole("button",{name:"Tutup panduan isian"}).click();
  await expect(popup).toHaveCount(0);
  await expect(page.getByLabel("Panjang persil")).toBeFocused();
  await page.getByRole("button",{name:"Buat persil",exact:true}).click();
  await page.getByLabel("Panjang persil").fill("15");
  await page.getByRole("button",{name:"Buat persil",exact:true}).click();
  await expect(popup).toContainText("Lebar persil");
  await expect(page.getByLabel("Lebar persil")).toBeFocused();
  await page.getByLabel("Lebar persil").fill("10");
  await popup.getByRole("button",{name:"Periksa & terapkan"}).click();
  await expect(popup).toHaveCount(0);
  await expect(page.locator(".map-topline")).toContainText("150");
});

test("correction lens respects reduced motion and text zoom", async ({page}) => {
  await page.emulateMedia({reducedMotion:"reduce"});
  await fresh(page,"Tanpa gerakan");
  await page.getByRole("button",{name:"Zona",exact:true}).click(); await page.getByRole("button",{name:"Seluruh persil"}).click();
  await page.getByRole("button",{name:"Tahap Hujan",exact:true}).click();
  const popup=page.locator(".recovery-popup"); await expect(popup).toBeVisible();
  expect(await popup.evaluate(el=>getComputedStyle(el).animationName)).toBe("none");
  expect(await page.locator(".recovery-lens").evaluate(el=>getComputedStyle(el).animationName)).toBe("none");
  await page.evaluate(()=>{document.documentElement.style.zoom="2";});
  await page.getByLabel("Jenis permukaan",{exact:true}).evaluate(el=>el.scrollIntoView({block:"center"}));
  await expect.poll(async()=>{const r=await popup.boundingBox();return !!r&&r.x>=0&&r.x+r.width<=1441&&r.y>=0&&r.y+r.height<=901;}).toBe(true);
  await page.screenshot({path:`${comfortScreens}/recovery-zoom200.png`});
  await page.keyboard.press("Escape"); await expect(popup).toHaveCount(0);
});

test("coverage recovery: filled zone fields do not disguise unmodelled parcel area", async ({page}) => {
  await mkdir(repairEvidence,{recursive:true});
  await fresh(page,"Cakupan persil"); await zone(page,"0","5");
  await page.getByLabel("Jenis permukaan",{exact:true}).selectOption("roof");
  await coefficient(page,"Atap lengkap","0.8");
  await expect(page.locator(".register-total")).toContainText("100 m² belum menjadi zona");
  await expect(page.locator(".register-total")).not.toContainText("Semua zona siap");
  await page.locator(".readiness-trigger").click();
  const popup=page.locator(".recovery-popup");
  await expect(popup).toContainText("100 m² belum menjadi zona");
  await expect(page.locator(".parcel-coverage")).toBeFocused();
  await expect(page.locator(".coverage-gap")).toBeVisible();
  await expect.poll(()=>popup.evaluate(el=>getComputedStyle(el).opacity)).toBe("1");
  await page.screenshot({path:`${repairEvidence}/coverage-desktop.png`,fullPage:true});
  await popup.getByRole("button",{name:"Tutup panduan isian"}).click();
  await zone(page,"5","10");
  await page.getByLabel("Jenis permukaan",{exact:true}).selectOption("vegetation");
  await coefficient(page,"Taman lengkap","0.2");
  await expect(page.locator(".current-result")).toContainText("Model persil siap untuk hujan");
  await page.getByRole("button",{name:"Uji hujan pada persil ini",exact:true}).click();
  await page.locator(".readiness-trigger").click();
  await expect(page.getByLabel("Kedalaman hujan",{exact:true})).toBeFocused();
  await popup.getByRole("button",{name:"Tutup panduan isian"}).click();
  await rain(page,"50");
  await expect(page.locator(".rain-split-label").first()).toContainText("3 m³");
  await expect(page.locator(".missing-state")).toHaveCount(0);
  await expect(page.locator(".save-state")).toContainText("Tersimpan di browser");
  await page.reload(); await page.locator(".local-projects").getByRole("button",{name: /^Cakupan persil/}).click();
  await route(page,"Hujan & kondisi awal");
  await expect(page.locator(".rain-split-label").first()).toContainText("3 m³");
});

test("Studio selection clears on blank ground and Escape; freeform has recoverable points", async ({page}) => {
  await fresh(page,"Pilihan dan bentuk"); await zone(page,"0","5");
  await page.locator(".approved-parcel > svg").scrollIntoViewIfNeeded();
  const empty=await canvasPoint(page,12,8);
  await page.mouse.click(empty.x,empty.y);
  await expect(page.locator(".zone-shape.selected")).toHaveCount(0);
  await expect(page.locator(".zone-row.selected")).toHaveCount(0);
  await expect(page.getByLabel("Jenis permukaan",{exact:true})).toHaveCount(0);
  await expect(page.locator("#zone-properties")).toContainText("Pilih zona untuk melihat datanya");
  await page.locator(".zone-row").first().click();
  await page.getByRole("button",{name:"Pilih zona Zona 1",exact:true}).focus();
  await page.keyboard.press("Escape");
  await expect(page.locator(".zone-shape.selected")).toHaveCount(0);
  await page.getByRole("button",{name:"Zona",exact:true}).click();
  await page.getByRole("button",{name:"Bentuk bebas",exact:true}).click();
  await page.locator(".approved-parcel > svg").scrollIntoViewIfNeeded();
  for (const [x,y] of [[6,1],[12,1],[12,6]]) { const p=await canvasPoint(page,x!,y!); await page.mouse.click(p.x,p.y); }
  await expect(page.locator(".draft-point")).toHaveCount(3);
  await page.getByRole("button",{name:"Urungkan titik terakhir"}).click();
  await expect(page.locator(".draft-point")).toHaveCount(2);
  for (const [x,y] of [[12,7],[6,7]]) { const p=await canvasPoint(page,x!,y!); await page.mouse.click(p.x,p.y); }
  await page.screenshot({path:`${repairEvidence}/freeform-desktop.png`,fullPage:true});
  await page.getByRole("button",{name:"Tutup bentuk pada titik pertama"}).click();
  await expect(page.locator(".zone-row")).toHaveCount(2);
  await expect(page.locator(".drawing-actions")).toHaveCount(0);
  await expect(page.locator(".register-total")).toContainText("86 / 150");
  await page.getByRole("button",{name:"Zona",exact:true}).click();
  await page.getByRole("button",{name:"Bentuk bebas",exact:true}).click();
  const p=await canvasPoint(page,7,8); await page.mouse.click(p.x,p.y);
  await page.keyboard.press("Escape");
  await expect(page.locator(".zone-draft")).toHaveCount(0);
  await expect(page.locator(".zone-row")).toHaveCount(2);
  await page.getByRole("button",{name:"Zona",exact:true}).click();
  await page.getByRole("button",{name:"Bentuk bebas",exact:true}).click();
  for(const [x,y] of [[6,8],[9,8],[9,9]]){const q=await canvasPoint(page,x!,y!);await page.mouse.click(q.x,q.y);}
  await page.keyboard.press("Backspace");await expect(page.locator(".draft-point")).toHaveCount(2);
  for(const [x,y] of [[9,9],[6,9]]){const q=await canvasPoint(page,x!,y!);await page.mouse.click(q.x,q.y);}
  await page.keyboard.press("Enter");
  await expect(page.locator(".zone-row")).toHaveCount(3);
});

test("offline application updates replace cached UI without deleting the local project", async ({page,context}) => {
  const {createServer}=await import("node:http");
  const {readFile}=await import("node:fs/promises");
  const {resolve,extname}=await import("node:path");
  const root=resolve("dist"), worker=await readFile(resolve(root,"tirta-sw.js"),"utf8");
  let legacy=true;
  const absent:string[]=[];
  const oldWorker=`self.addEventListener('install',e=>e.waitUntil(caches.open('tirta-approved-legacy-test').then(c=>c.addAll(['/production.html'])).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{if(e.request.mode==='navigate')e.respondWith(caches.match('/production.html').then(r=>r||fetch(e.request)));});`;
  const server=createServer(async(req,res)=>{
    const pathname=new URL(req.url??"/","http://localhost").pathname;
    res.setHeader("Cache-Control","no-store");
    if(pathname==="/tirta-sw.js"){res.setHeader("Content-Type","text/javascript");res.end(legacy?oldWorker:worker);return;}
    const entry=pathname==="/"?"/index.html":["/tirta","/production"].includes(pathname)?"/production.html":pathname;
    const file=resolve(root, `.${entry}`);
    if(!file.startsWith(root)){res.writeHead(403).end();return;}
    try {
      let body=await readFile(file);
      if(legacy&&pathname.endsWith(".html"))body=Buffer.from(body.toString().replace("<head>",'<head><meta name="legacy-cache-probe" content="old">'));
      const types:Record<string,string>={".html":"text/html",".js":"text/javascript",".css":"text/css",".svg":"image/svg+xml",".ttf":"font/ttf"};
      res.setHeader("Content-Type",types[extname(file)]??"application/octet-stream");res.end(body);
    }catch{if(pathname!=="/favicon.ico")absent.push(pathname);res.writeHead(404).end();}
  });
  await new Promise<void>(done=>server.listen(0,"127.0.0.1",done));
  try {
    const address=server.address();if(!address||typeof address==="string")throw new Error("No test server port");
    const url=`http://127.0.0.1:${address.port}/production.html`;
    await page.goto(url);await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
    await page.getByLabel("Nama proyek",{exact:true}).fill("Proyek tetap ada setelah update");
    await page.getByRole("button",{name:"Buat proyek baru",exact:true}).click();
    await expect(page.locator(".save-state")).toContainText("Tersimpan");
    await expect(page.locator('meta[name="legacy-cache-probe"]')).toHaveCount(1);
    legacy=false;
    await page.evaluate(async()=>{
      const updated=new Promise<void>(done=>navigator.serviceWorker.addEventListener("controllerchange",()=>done(),{once:true}));
      const registration=await navigator.serviceWorker.getRegistration();await registration!.update();await updated;
    });
    await expect(page.getByRole("heading",{level:1})).toHaveText("Studio Persil");
    await page.reload();
    await expect(page.locator('meta[name="legacy-cache-probe"]')).toHaveCount(0);
    await page.locator(".local-projects").getByRole("button",{name: /^Proyek tetap ada setelah update/}).click();
    await expect(page.locator(".project-identity")).toContainText("Proyek tetap ada setelah update");
    await context.setOffline(true);await page.reload();
    await expect(page.locator(".local-projects")).toContainText("Proyek tetap ada setelah update");
    expect(absent).toEqual([]);
  }finally{await context.setOffline(false);await new Promise<void>((done,reject)=>server.close(e=>e?reject(e):done()));}
});

test("reported 50.5 of 100 m2 parcel exposes the exact gap across viewport sizes", async ({page}) => {
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
  await page.goto("/production.html");
  await page.getByLabel("Nama proyek",{exact:true}).fill("Uji cakupan 100 m²");
  await page.getByRole("button",{name:"Buat proyek baru",exact:true}).click();
  await page.getByLabel("Panjang persil").fill("10");await page.getByLabel("Lebar persil").fill("10");
  await page.getByRole("button",{name:"Buat persil",exact:true}).click();
  const zones=[{a:[.5,1],b:[3.5,8.5],surface:"porous",c:"1"},{a:[4,1],b:[8,3.5],surface:"paved",c:"0.01"},{a:[4,4],b:[8,8.5],surface:"soil",c:"0.17"}];
  for(const [i,z] of zones.entries()){
    await page.getByRole("button",{name:"Zona",exact:true}).click();
    await page.locator(".approved-parcel > svg").scrollIntoViewIfNeeded();
    for(const [x,y] of [z.a,z.b]){const p=await canvasPoint(page,x!*1.5,y!);await page.mouse.click(p.x,p.y);}
    await page.getByLabel("Jenis permukaan",{exact:true}).selectOption(z.surface);
    await coefficient(page,`Zona ${i+1}`,z.c);
  }
  await expect(page.locator(".register-total")).toContainText("50,5 / 100 m²");
  await expect(page.locator(".register-total")).toContainText("49,5 m² belum menjadi zona");
  for(const [width,height] of [[1920,1080],[1707,862],[1536,864],[1440,900],[1366,768],[1280,800],[768,1024],[390,844]]){
    await page.setViewportSize({width:width!,height:height!});await page.evaluate(()=>scrollTo(0,0));
    await page.locator(".readiness-trigger, .recovery-resume").click();
    await expect(page.locator(".parcel-coverage")).toBeFocused();
    await expect(page.locator(".recovery-popup")).toContainText("49,5 m² belum menjadi zona");
    await expect(page.locator(".register-total")).toContainText("49,5 m² belum menjadi zona");
    await expect.poll(()=>page.locator(".recovery-popup").evaluate(el=>getComputedStyle(el).opacity)).toBe("1");
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
    await page.screenshot({path:`${repairEvidence}/reported-gap-${width}.png`});
    expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
    await page.getByRole("button",{name:"Tutup panduan isian"}).click();
    await expect(page.locator(".recovery-popup")).toHaveCount(0);
  }
  await page.getByRole("button",{name:"Uji hujan pada persil ini",exact:true}).click();
  await expect(page.getByRole("heading",{level:1})).toHaveText("Studio Persil");
  await expect(page.locator(".recovery-popup")).toHaveCount(0);
  await expect(page.locator(".register-total")).toContainText("49,5 m² belum menjadi zona");
  expect(errors).toEqual([]);
});


test("workspace repair: Delete removes zones and parcel, undo restores and fields remain safe", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await fresh(page, "Hapus aman"); await zone(page, "0", "15");
  await page.getByLabel("Koefisien limpasan", { exact: true }).focus();
  await page.keyboard.press("Delete"); await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.locator(".parcel-svg").focus(); await page.keyboard.press("Delete");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", {name:"Ya, hapus zona",exact:true}).click();
  await expect(page.locator(".zone-row")).toHaveCount(0);
  await page.getByRole("button",{name:"Urungkan sketsa",exact:true}).click();
  await expect(page.locator(".zone-row")).toHaveCount(1);
  await page.getByRole("button",{name:"Edit batas",exact:true}).click();
  await page.getByRole("button",{name:"Hapus persil",exact:true}).click();
  await page.getByRole("button",{name:"Ya, hapus persil",exact:true}).click();
  await expect(page.getByRole("button",{name:"Buat persil",exact:true})).toBeVisible();
  await expect(page.locator(".zone-row")).toHaveCount(0);
  await page.getByRole("button",{name:"Urungkan sketsa",exact:true}).click();
  await expect(page.locator(".zone-row")).toHaveCount(1);
  await page.getByRole("button",{name:"Ulangi sketsa",exact:true}).click();
  await expect(page.locator(".zone-row")).toHaveCount(0);
  await expect(page.locator(".save-state")).toContainText("Tersimpan");
  await page.reload(); await page.locator(".local-projects").getByRole("button",{name: /^Hapus aman/}).click();
  await route(page,"Studio Persil"); await expect(page.getByRole("button",{name:"Buat persil",exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});

test("workspace repair: budget saves on Enter without sources or land, palette placement persists", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message)); page.on("console",m=>{if(m.type()==="error") errors.push(m.text());});
  await page.goto("/production.html"); await page.getByRole("button",{name:"Buka Contoh",exact:true}).click(); await route(page,"Intervensi");
  await expect(page.locator(".workspace-toolbar .scenario-switch")).toHaveCount(1);
  await expect(page.locator(".scenario-switch button[aria-pressed=true]")).toHaveText("Hujan 50 mm");
  const limits=page.locator(".constraint-editor");
  await limits.getByLabel("Lahan tersedia (m²)",{exact:true}).fill("");
  await limits.getByLabel("Anggaran (Rp)",{exact:true}).fill("13500000");
  await limits.getByLabel("Anggaran (Rp)",{exact:true}).press("Enter");
  await expect(limits.getByRole("status")).toContainText("13.500.000");
  await expect(limits.getByRole("status")).toContainText("lahan belum diketahui");
  await limits.getByLabel("Lahan tersedia (m²)",{exact:true}).fill("20");
  await limits.getByLabel("Lahan tersedia (m²)",{exact:true}).press("Enter");
  await expect(limits.getByRole("status")).toContainText("20 m²");
  await page.getByRole("button",{name:"Tambahkan Tangki",exact:true}).click();
  await page.getByRole("button",{name:"Letakkan di tengah persil",exact:true}).click();
  const marker=page.locator('[data-intervention-marker="tank"]');
  await expect(marker).toBeVisible(); await marker.press("Enter");
  const dialog=page.getByRole("dialog");
  await expect(dialog.getByLabel("Lokasi pemasangan")).toHaveCount(0);
  await expect(dialog.locator('.planning-declaration')).toHaveCount(0);
  await expect(dialog.getByLabel("Tampungan tersedia per kejadian (m³/event)",{exact:true})).toBeVisible();
  await dialog.getByLabel("Biaya (Rp)",{exact:true}).fill("1750000");
  await dialog.getByLabel("Tampungan tersedia per kejadian (m³/event)",{exact:true}).fill("3");
  await dialog.getByRole("button",{name:"Terapkan intervensi",exact:true}).click();
  const before=await marker.getAttribute("transform");
  const box=(await marker.boundingBox())!;
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+28,box.y+box.height/2+12,{steps:5});await page.mouse.up();
  await expect(marker).not.toHaveAttribute("transform",before!);
  const placed=await marker.getAttribute("transform");
  await mkdir(output("workspace-repair"),{recursive:true});
  await page.screenshot({path:output("workspace-repair/interventions-1440.png"),fullPage:true});
  for(const width of [1280,768,390]){
    await page.setViewportSize({width,height:900});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);
    await page.screenshot({path:output(`workspace-repair/interventions-${width}.png`),fullPage:true});
  }
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await page.setViewportSize({width:1440,height:900});
  await expect(page.locator(".save-state")).toContainText("Tersimpan");
  await page.reload();await page.locator(".local-projects").getByRole("button",{name: /^Contoh TIRTA/}).click();await route(page,"Intervensi");
  await expect(limits.getByLabel("Anggaran (Rp)",{exact:true})).toHaveValue("13.500.000");
  await expect(marker).toHaveAttribute("transform",placed!);
  await marker.press("Enter");await expect(dialog.getByLabel("Biaya (Rp)",{exact:true})).toHaveValue("1.750.000");
  await expect(dialog.getByLabel("Tampungan tersedia per kejadian (m³/event)",{exact:true})).toHaveValue("3");
  await dialog.screenshot({path:output("workspace-repair/simple-editor.png")});
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  expect(errors).toEqual([]);
});


test("workspace repair: native drag/drop keeps water sources explicit and rejects outside placement", async ({ page }) => {
  const errors: string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await fresh(page,"Drag rencana");await zone(page,"0","15");
  await page.getByLabel("Jenis permukaan",{exact:true}).selectOption("roof");
  await coefficient(page,"Atap","0.8");await route(page,"Hujan & kondisi awal");await rain(page,"80");await route(page,"Intervensi");
  const palette=page.getByRole("button",{name:"Tambahkan Tangki",exact:true});
  await palette.dragTo(page.locator(".intervention-preview .parcel-svg"));
  const dialog=page.getByRole("dialog");await expect(dialog).toBeVisible();
  await expect(dialog.locator('input[name="target"]:checked')).toHaveCount(0);
  await dialog.getByLabel("Biaya (Rp)",{exact:true}).fill("1200000");
  await dialog.getByLabel("Tampungan tersedia per kejadian (m³/event)",{exact:true}).fill("2");
  await dialog.getByLabel("Atap",{exact:true}).check();
  await dialog.getByRole("button",{name:"Terapkan intervensi",exact:true}).click();
  await expect(dialog.getByRole("alert")).toContainText("Intervensi belum siap");
  await dialog.getByRole("button",{name:"Simpan untuk nanti",exact:true}).click();
  await route(page,"Hujan & kondisi awal"); await route(page,"Intervensi");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await palette.click();
  const marker=page.locator('[data-intervention-marker="tank"]');await expect(marker).toBeVisible();
  const previous=await marker.getAttribute("transform");
  await page.getByRole("button",{name:"Pindahkan simbol",exact:true}).click();
  const svg=page.locator('.intervention-preview .parcel-svg');await svg.click({position:{x:5,y:5}});
  await expect(page.locator('.notice')).toContainText("di dalam batas persil");
  await expect(marker).toHaveAttribute("transform",previous!);
  await page.getByRole("button",{name:"Batal",exact:true}).click();
  await expect(page.locator('.option-draft-note')).toContainText("belum lengkap");
  await page.locator('[data-component="tank"]').getByRole("button",{name:"Atur intervensi",exact:true}).click();
  await expect(dialog.getByLabel("Ruang terpakai (m²)",{exact:true})).toHaveValue("");
  await expect(dialog.locator('input[name="costEvidence"]')).toHaveValue("ASSUMPTION");
  await page.setViewportSize({width:390,height:844});
  await dialog.screenshot({path:output("workspace-repair/real-editor-390.png")});
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  expect(errors).toEqual([]);
});


test("rain templates: custom count, explicit depths, scenario switching and reload", async ({page}) => {
  const errors: string[]=[];page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error") errors.push(m.text());});
  await page.goto("/production.html");await page.getByRole("button",{name:"Buka Contoh",exact:true}).click();
  await route(page,"Hujan & kondisi awal");await page.getByRole("button",{name:"+ Buat template hujan",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"Template hujan Anda"});
  await dialog.getByLabel("Jumlah template baru").fill("3");
  await expect(dialog.getByLabel("Hujan 1 (mm)",{exact:true})).toHaveValue("");
  await dialog.getByLabel("Nama template 1").fill("Uji nol");
  await dialog.getByLabel("Hujan 1 (mm)",{exact:true}).fill("0");
  await dialog.getByLabel("Hujan 2 (mm)",{exact:true}).fill("35.5");
  await dialog.getByLabel("Hujan 3 (mm)",{exact:true}).fill("125");
  await dialog.getByLabel("Dasar hujan").selectOption("reference");
  await dialog.getByRole("button",{name:"Buat 3 skenario",exact:true}).click();
  await expect(dialog).toBeVisible();await expect(page.locator('.scenario-switch button')).toHaveCount(2);
  await dialog.getByLabel("Dasar hujan").selectOption("assumption");
  await mkdir(output("rain-templates"),{recursive:true});
  await dialog.getByRole("button", {name:"Tutup",exact:true}).focus(); await dialog.evaluate(el=>{el.scrollTop=0;});
  await dialog.screenshot({path:output("rain-templates/templates-1440.png")});
  await page.setViewportSize({width:390,height:844});
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  expect(await dialog.evaluate(el=>el.scrollWidth>el.clientWidth+1)).toBe(false);
  await dialog.screenshot({path:output("rain-templates/templates-390.png")});
  await dialog.getByRole("button",{name:"Buat 3 skenario",exact:true}).click();await expect(dialog).toHaveCount(0);
  await expect(page.locator('.scenario-switch button')).toHaveCount(5);
  await expect(page.getByLabel("Kedalaman hujan",{exact:true})).toHaveValue("0");
  await expect(page.getByLabel("Dasar hujan",{exact:true})).toHaveValue("assumption");
  await expect(page.locator(".rain-basis-help")).toContainText("Angka uji yang Anda tentukan sendiri");
  await expect(page.getByRole("button",{name:"+ Tambah catatan (opsional)",exact:true})).toBeVisible();
  await route(page,"Intervensi");
  await page.locator('.scenario-switch').getByRole("button",{name:"Hujan 35,5 mm",exact:true}).click();
  await expect(page.locator('.scenario-switch button[aria-pressed=true]')).toHaveText("Hujan 35,5 mm");
  await page.getByRole("button",{name:"Tambahkan Tangki",exact:true}).click();
  await page.getByRole("button",{name:"Batal",exact:true}).click();
  await page.locator('[data-intervention-marker="tank"]').press("Enter");
  await page.getByRole("dialog").getByRole("button",{name:"Tutup",exact:true}).click();
  await page.locator('.scenario-switch').getByRole("button",{name:"Hujan 125 mm",exact:true}).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.locator('.scenario-switch').getByRole("button",{name:"Hujan 35,5 mm",exact:true}).click();
  await page.screenshot({path:output("rain-templates/intervention-switch-390.png"),fullPage:true});
  await expect(page.locator('.save-state')).toContainText("Tersimpan");
  await page.reload();await page.locator('.local-projects').getByRole("button",{name: /^Contoh TIRTA/,exact:false}).filter({has:page.locator('svg')}).first().click();
  await route(page,"Hujan & kondisi awal");await expect(page.getByLabel("Kedalaman hujan",{exact:true})).toHaveValue("35.5");
  await expect(page.locator('.scenario-switch button')).toHaveCount(5);
  expect(errors).toEqual([]);
});

test("project list: cancel, delete inactive and active project, no resurrection after reload", async ({page}) => {
  const errors: string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await fresh(page,"Tetap disimpan");await route(page,"Proyek");
  await page.getByLabel("Nama proyek",{exact:true}).fill("Hapus saya");await page.getByRole("button",{name:"Buat proyek baru",exact:true}).click();
  await page.getByLabel("Panjang persil").fill("2");await page.getByLabel("Lebar persil").fill("3");await page.getByRole("button",{name:"Buat persil",exact:true}).click();
  await route(page,"Proyek");
  await expect(page.locator('.local-project-row')).toHaveCount(2);
  await page.getByRole("button",{name:"Hapus proyek Tetap disimpan",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"Hapus proyek tersimpan?"});
  await dialog.getByRole("button",{name:"Batal",exact:true}).click();await expect(page.locator('.local-project-row')).toHaveCount(2);
  await page.setViewportSize({width:390,height:844});
  await page.getByRole("button",{name:"Hapus proyek Hapus saya",exact:true}).click();
  await expect(dialog).toContainText("Hapus saya");
  expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
  await dialog.getByRole("button",{name:"Ya, hapus proyek",exact:true}).click();
  await expect(page.locator('.local-project-row')).toHaveCount(1);
  await page.waitForTimeout(700); // A pending 500ms autosave must not recreate the deleted active project.
  await expect(page.locator('.local-project-row')).toHaveCount(1);
  await page.screenshot({path:output("rain-templates/project-list-390.png"),fullPage:true});
  await page.reload();await expect(page.locator('.local-project-row')).toHaveCount(1);
  await expect(page.locator('.local-project-row')).toContainText("Tetap disimpan");
  await page.getByRole("button",{name:"Hapus proyek Tetap disimpan",exact:true}).click();
  await dialog.getByRole("button",{name:"Ya, hapus proyek",exact:true}).click();
  await expect(page.locator('.local-project-row')).toHaveCount(0);
  await page.reload();await expect(page.locator('.local-projects')).toHaveCount(0);
  await expect(page.getByRole("button",{name:"Buat proyek baru",exact:true})).toBeEnabled();
  expect(errors).toEqual([]);
});

test("mobile Studio lets idle canvas scroll but captures an active authoring swipe", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, baseURL: process.env.TIRTA_RESCUE_URL ?? "http://127.0.0.1:4173" });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await fresh(page, "Uji geser kanvas");
  const canvas = page.locator(".approved-parcel > svg");
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width * 0.65;
  const idleStartY = Math.min(box!.y + box!.height * 0.75, 790);
  const cdp = await context.newCDPSession(page);
  const swipe = async (from: { x: number; y: number }, to: { x: number; y: number }) => {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 1, ...from, radiusX: 4, radiusY: 4, force: 1 }], });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ id: 1, ...to, radiusX: 4, radiusY: 4, force: 1 }], });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  };
  const idleBefore = await page.evaluate(() => window.scrollY);
  await swipe({ x, y: idleStartY }, { x, y: idleStartY - 110 });
  await page.waitForTimeout(160);
  const idleAfter = await page.evaluate(() => window.scrollY);
  expect(idleAfter, "vertical touch on an idle canvas should scroll the page").toBeGreaterThan(idleBefore);
  await page.getByRole("button", { name: "Tambah zona", exact: true }).tap();
  await canvas.scrollIntoViewIfNeeded();
  const first = await canvasPoint(page, 2, 2);
  const last = await canvasPoint(page, 8, 8);
  const activeBefore = await page.evaluate(() => window.scrollY);
  await swipe(first, last);
  await page.waitForTimeout(160);
  const activeAfter = await page.evaluate(() => window.scrollY);
  await expect(page.locator(".zone-row")).toHaveCount(1);
  expect(activeAfter, "active drawing gesture should not scroll the page").toBe(activeBefore);
  await mkdir(output("mobile-touch"), { recursive: true });
  await page.screenshot({ path: output("mobile-touch/authoring-after-swipe.png"), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
  await cdp.detach();
  await context.close();
});

test("rainfall browser inputs preserve zero, reject negative values and recover after malformed entry", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await fresh(page, "Uji nilai hujan");
  await zone(page, "0", "15");
  await page.getByLabel("Jenis permukaan", { exact: true }).selectOption("roof");
  await coefficient(page, "Atap uji", "0.85");
  await route(page, "Hujan & kondisi awal");
  const rainfall = page.getByLabel("Kedalaman hujan", { exact: true });
  const apply = page.getByRole("button", { name: "Terapkan hujan & hitung ulang", exact: true });
  await page.getByLabel("Dasar hujan", { exact: true }).selectOption("assumption");
  await rainfall.fill("0");
  await expect(apply).toBeEnabled();
  await apply.click();
  await expect(page.locator(".rain-split")).toContainText("0 m³");
  await rainfall.fill("0.1");
  await apply.click();
  await expect(page.locator(".rain-split")).toContainText("0,01 m³");
  await rainfall.fill("-1");
  await expect(rainfall).toHaveValue("-1");
  expect(await rainfall.evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(false);
  await mkdir(output("input-torture"), { recursive: true });
  await page.screenshot({ path: output("input-torture/rainfall-negative.png"), fullPage: true });
  await apply.click();
  await expect(page.getByRole("alert")).toContainText("Hujan harus nol atau positif");
  await expect(page.locator(".rain-split")).toContainText("0,01 m³");
  await rainfall.fill("1e309");
  const overflowValue = await rainfall.inputValue();
  expect(["", "1e309"]).toContain(overflowValue);
  await apply.click();
  await expect(page.locator(".rain-split")).toHaveCount(0);
  await rainfall.fill("60");
  await expect(apply).toBeEnabled();
  await apply.click();
  await expect(page.locator(".rain-split")).toContainText("7,65 m³");
  await saveProject(page);
  await expect(page.locator(".save-state")).toContainText("Tersimpan");
  await page.reload();
  await page.locator(".local-projects").getByRole("button", { name: /^Uji nilai hujan/ }).click();
  await route(page, "Hujan & kondisi awal");
  await expect(page.getByLabel("Kedalaman hujan", { exact: true })).toHaveValue("60");
  await rainfall.fill("0");
  await apply.click();
  await expect(page.locator(".rain-split")).toContainText("0 m³");
  await saveProject(page);
  await expect(page.locator(".save-state")).toContainText("Tersimpan");
  await page.reload();
  await page.locator(".local-projects").getByRole("button", { name: /^Uji nilai hujan/ }).click();
  await route(page, "Hujan & kondisi awal");
  await expect(page.getByLabel("Kedalaman hujan", { exact: true })).toHaveValue("0");
  await expect(page.locator(".rain-split")).toContainText("0 m³");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: output("input-torture/rainfall-recovered-mobile.png"), fullPage: true });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(errors).toEqual([]);
});

test("ten isolated fresh-user demo rehearsals create, model, calculate, compare and reload", async ({ browser }) => {
  test.setTimeout(360000);
  const records: Array<{ run: number; ok: boolean; durationMs: number; errors: string[]; failure?: string }> = [];
  for (let run = 1; run <= 10; run++) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, baseURL: process.env.TIRTA_RESCUE_URL ?? "http://127.0.0.1:4173" });
    const page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    const started = Date.now();
    try {
      await fresh(page, `Latihan demo ${String(run).padStart(2, "0")}`);
      await zone(page, "0", "15");
      await page.getByLabel("Jenis permukaan", { exact: true }).selectOption("roof");
      await coefficient(page, "Atap rumah", "0.85");
      await route(page, "Hujan & kondisi awal");
      await rain(page, "60");
      await expect(page.locator(".rain-split")).toContainText("7,65 m³");
      await route(page, "Intervensi");
      const limits = page.locator(".constraint-editor");
      await limits.getByLabel("Anggaran (Rp)", { exact: true }).fill("4000000");
      await limits.getByLabel("Anggaran (Rp)", { exact: true }).press("Enter");
      await limits.getByLabel("Lahan tersedia (m²)", { exact: true }).fill("10");
      await limits.getByLabel("Lahan tersedia (m²)", { exact: true }).press("Enter");
      await page.getByRole("button", { name: "Tambahkan Tangki", exact: true }).click();
      const tankRow = page.locator(".intervention-option").filter({ has: page.getByRole("heading", { name: "Tangki", exact: true }) });
      await tankRow.getByRole("button", { name: "Atur intervensi" }).click();
      const tank = page.getByRole("dialog", { name: "Atur Tangki" });
      await tank.getByLabel("Atap rumah", { exact: true }).check();
      await tank.getByLabel("Biaya (Rp)", { exact: true }).fill("1000000");
      await revealField(tank.getByLabel("Ruang terpakai (m²)", { exact: true }));
      await tank.getByLabel("Ruang terpakai (m²)", { exact: true }).fill("2");
      await tank.getByLabel("Tampungan tersedia per kejadian (m³/event)", { exact: true }).fill("3");
      await tank.getByRole("button", { name: "Terapkan intervensi", exact: true }).click();
      await reviewTankScience(page);
      await route(page, "Alternatif");
      await expect(page.locator(".alternative")).toHaveCount(2);
      await expect(page.locator(".search-contract")).toContainText("2 kemungkinan diperiksa");
      await page.locator(".alternative").first().getByRole("button", { name: "Pilih rencana ini" }).click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("Rencana & Dampak");
      await expect(page.locator(".decision-accounting")).toContainText("Sisa limpasan");
      await saveProject(page);
      await expect(page.locator(".save-state")).toContainText("Tersimpan");
      await page.reload();
      await page.locator(".local-projects button.open-project").filter({ hasText: `Latihan demo ${String(run).padStart(2, "0")}` }).click();
      await route(page, "Rencana & Dampak");
      await expect(page.getByRole("button", { name: "Unduh ringkasan" })).toBeEnabled();
      await expect(page.locator(".decision-accounting")).toContainText("Sisa limpasan");
      if (run === 1) {
        await mkdir(output("demo-rehearsal"), { recursive: true });
        await page.screenshot({ path: output("demo-rehearsal/fresh-decision-1440.png"), fullPage: true });
      }
      if (errors.length) throw new Error(`Runtime errors: ${errors.join(" | ")}`);
      records.push({ run, ok: true, durationMs: Date.now() - started, errors });
    } catch (cause) {
      records.push({ run, ok: false, durationMs: Date.now() - started, errors, failure: cause instanceof Error ? cause.message : String(cause) });
      await mkdir(output("demo-rehearsal"), { recursive: true });
      if (!page.isClosed()) await page.screenshot({ path: output(`demo-rehearsal/failure-${String(run).padStart(2, "0")}.png`), fullPage: true }).catch(() => undefined);
    } finally {
      await context.close();
    }
  }
  await mkdir(output("demo-rehearsal"), { recursive: true });
  await writeFile(output("demo-rehearsal/runs.json"), JSON.stringify(records, null, 2));
  expect(records, "every fresh rehearsal should reach a reloaded current Decision Canvas").toHaveLength(10);
  expect(records.filter(record => record.ok), JSON.stringify(records, null, 2)).toHaveLength(10);
});

test("rapid project create and Save input does not duplicate local project records", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/production.html");
  await page.getByLabel("Nama proyek", { exact: true }).fill("Uji klik beruntun");
  const create = page.getByRole("button", { name: "Buat proyek baru", exact: true });
  await create.evaluate(button => {
    for (let attempt = 0; attempt < 5; attempt++) button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Studio Persil");
  const save = page.getByRole("button", { name: "Simpan", exact: true });
  await save.evaluate(button => {
    for (let attempt = 0; attempt < 8; attempt++) button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await expect(page.locator(".save-state")).toContainText("Tersimpan");
  await route(page, "Proyek");
  await expect(page.locator(".local-project-row")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".local-project-row")).toHaveCount(1);
  await mkdir(output("panic-user"), { recursive: true });
  await page.screenshot({ path: output("panic-user/project-list-after-click-spam.png"), fullPage: true });
  expect(errors).toEqual([]);
});

test("production routes fit the adversarial responsive viewport matrix", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("/production.html");
  await page.getByRole("button", { name: "Buka Contoh", exact: true }).click();
  const routes = ["Proyek", "Studio Persil", "Hujan & kondisi awal", "Intervensi", "Alternatif", "Bandingkan", "Rencana & Dampak"];
  const viewports = [[320, 640], [360, 740], [390, 844], [412, 915], [768, 1024], [1024, 768], [1280, 800], [1366, 768], [1440, 900], [1536, 864], [1707, 862], [1920, 1080]] as const;
  const measurements: Array<{ route: string; width: number; height: number; pageWidth: number; scrollWidth: number }> = [];
  await mkdir(output("responsive-matrix"), { recursive: true });
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width, height });
    for (const name of routes) {
      await route(page, name);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const metric = await page.evaluate(() => ({ pageWidth: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
      measurements.push({ route: name, width, height, ...metric });
      expect(metric.scrollWidth, `horizontal page overflow on ${name} at ${width}×${height}`).toBeLessThanOrEqual(metric.pageWidth + 1);
      if (width === 390) await page.screenshot({ path: output(`responsive-matrix/${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-390.png`), fullPage: true });
    }
  }
  await writeFile(output("responsive-matrix/measurements.json"), JSON.stringify(measurements, null, 2));
  expect(errors).toEqual([]);
});

test("malformed backup import leaves active and stored project data intact", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await fresh(page, "Proyek tetap aman");
  await zone(page, "0", "15");
  await page.getByLabel("Jenis permukaan", { exact: true }).selectOption("roof");
  await coefficient(page, "Atap aman", "0.8");
  await saveProject(page);
  await expect(page.locator(".save-state")).toContainText("Tersimpan");
  await route(page, "Proyek");
  await page.locator(".project-backup > summary").click();
  await page.getByLabel("Buka berkas cadangan", { exact: true }).setInputFiles({
    name: "cadangan-rusak.tirta.json",
    mimeType: "application/json",
    buffer: Buffer.from("{\"format\":\"tirta-project\",\"formatVersion\":1,\"project\":"),
  });
  await expect(page.locator(".notice")).toContainText("data tersimpan tidak berubah");
  await expect(page.locator(".local-project-row")).toHaveCount(1);
  await expect(page.locator(".project-header")).toContainText("Proyek tetap aman");
  await mkdir(output("import-torture"), { recursive: true });
  await page.screenshot({ path: output("import-torture/malformed-backup-rejected.png"), fullPage: true });
  await route(page, "Studio Persil");
  await expect(page.locator(".map-topline")).toContainText("150");
  await page.reload();
  await page.locator(".local-projects button.open-project").filter({ hasText: "Proyek tetap aman" }).click();
  await expect(page.locator(".project-header")).toContainText("Proyek tetap aman");
  await expect(page.locator(".register-total")).toContainText("150 / 150");
  await expect(page.locator(".zone-row")).toContainText("Atap aman");
  expect(errors).toEqual([]);
});

test("sidebar vertical layout keeps navigation and guidance reachable across desktop heights", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  const evidenceDir = output("sidebar-vertical");
  await mkdir(evidenceDir, { recursive: true });
  await page.goto("/production.html");
  await page.getByRole("button", { name: "Buka Contoh", exact: true }).click();

  const sizes = [[1366, 768], [1536, 864], [1440, 900], [1920, 1080], [1366, 650]] as const;
  const measurements: Array<Record<string, unknown>> = [];
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    for (const state of ["expanded", "collapsed"] as const) {
      const guideLabel = state === "expanded" ? "Sembunyikan petunjuk" : "Tampilkan petunjuk";
      const guide = page.locator(".rail-bottom button");
      if ((await guide.innerText()).trim() !== guideLabel) await guide.evaluate(button => (button as HTMLButtonElement).click());

      const layout = await page.evaluate(() => {
        const rect = (element: Element) => {
          const { top, bottom, height } = element.getBoundingClientRect();
          return { top, bottom, height };
        };
        const rail = document.querySelector(".app-rail")!;
        const nav = rail.querySelector("nav")!;
        const footer = rail.querySelector(".rail-bottom")!;
        const guide = footer.querySelector("button")!;
        const items = [...nav.querySelectorAll("button")];
        return {
          pageWidth: document.documentElement.scrollWidth,
          nav: rect(nav),
          navScrollHeight: nav.scrollHeight,
          navClientHeight: nav.clientHeight,
          navOverflowY: getComputedStyle(nav).overflowY,
          finalItem: rect(items.at(-1)!),
          itemHeights: items.map(item => item.getBoundingClientRect().height),
          footer: rect(footer),
          guide: rect(guide),
        };
      });

      expect(layout.pageWidth).toBeLessThanOrEqual(width + 1);
      expect(layout.footer.top).toBeGreaterThanOrEqual(0);
      expect(layout.footer.bottom).toBeLessThanOrEqual(height + 1);
      expect(layout.guide.top).toBeGreaterThanOrEqual(0);
      expect(layout.guide.bottom).toBeLessThanOrEqual(height + 1);
      expect(layout.nav.top).toBeGreaterThanOrEqual(0);
      expect(layout.nav.bottom).toBeLessThanOrEqual(height + 1);
      expect(layout.itemHeights.every(itemHeight => itemHeight >= 48)).toBe(true);

      const nav = page.locator(".app-rail nav");
      const finalItem = nav.getByRole("button", { name: "Rencana & Dampak", exact: true });
      if (layout.navScrollHeight > layout.navClientHeight) {
        expect(layout.navOverflowY).toMatch(/auto|scroll/);
        await finalItem.scrollIntoViewIfNeeded();
        const reachable = await finalItem.evaluate(item => {
          const itemRect = item.getBoundingClientRect();
          const navRect = item.closest("nav")!.getBoundingClientRect();
          return itemRect.top >= navRect.top - 1 && itemRect.bottom <= navRect.bottom + 1;
        });
        expect(reachable).toBe(true);
        await nav.evaluate(element => { element.scrollTop = 0; });
      } else {
        expect(layout.finalItem.bottom).toBeLessThanOrEqual(layout.nav.bottom + 1);
      }

      const screenshot =
        (width === 1366 && height === 768) ||
        (state === "expanded" && ((width === 1536 && height === 864) || (width === 1920 && height === 1080)));
      if (screenshot && (state === "expanded" || (width === 1366 && state === "collapsed"))) {
        await page.screenshot({ path: `${evidenceDir}/${width}x${height}-${state}.png` });
      }
      measurements.push({ viewport: [width, height], state, ...layout });
    }
  }

  await writeFile(`${evidenceDir}/measurements.json`, JSON.stringify(measurements, null, 2));
  expect(errors).toEqual([]);
});

test("audit repair: unavailable storage never offers or announces a saved rescue copy", async ({ page }) => {
  await page.addInitScript(() => { IDBFactory.prototype.open = () => { throw new DOMException("Storage unavailable", "SecurityError"); }; });
  await page.goto("/production.html");
  await page.getByLabel("Nama proyek", { exact: true }).fill("Pemulihan gagal");
  await page.getByRole("button", { name: "Buat proyek baru" }).click();
  await expect(page.getByRole("button", { name: "Simpan perubahan sebagai salinan" })).toBeDisabled();
  await expect(page.locator("body")).not.toContainText("Perubahan disimpan sebagai proyek pemulihan terpisah.");
});

test("audit repair: valid long project names stay inside desktop and mobile layouts", async ({ page }) => {
  await fresh(page, "W".repeat(120));
  for (const width of [1440, 1366, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    await expect(page.getByRole("button", { name: "Simpan", exact: true })).toBeVisible();
  }
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
});

test("audit repair: unapplied rain drafts survive navigation and remain isolated by scenario", async ({ page }) => {
  await page.goto("/production.html");
  await page.getByRole("button", { name: "Buka Contoh", exact: true }).click();
  await route(page, "Hujan & kondisi awal");
  await page.getByLabel("Dasar hujan", { exact: true }).selectOption("assumption");
  await page.getByRole("button", { name: "+ Tambah catatan (opsional)" }).click();
  await page.getByLabel("Sumber hujan", { exact: true }).fill("Draft pribadi");
  await page.getByLabel("Kedalaman hujan", { exact: true }).fill("60");
  await route(page, "Intervensi");
  await route(page, "Hujan & kondisi awal");
  await expect(page.getByLabel("Kedalaman hujan", { exact: true })).toHaveValue("60");
  await expect(page.getByLabel("Dasar hujan", { exact: true })).toHaveValue("assumption");
  await expect(page.getByLabel("Sumber hujan", { exact: true })).toHaveValue("Draft pribadi");
  await expect(page.locator(".rain-equation")).toContainText("10 m³");
  await page.locator(".scenario-switch").getByRole("button", { name: "Hujan 100 mm", exact: true }).click();
  await expect(page.getByLabel("Kedalaman hujan", { exact: true })).toHaveValue("100");
  await page.locator(".scenario-switch").getByRole("button", { name: "Hujan 50 mm", exact: true }).click();
  await expect(page.getByLabel("Kedalaman hujan", { exact: true })).toHaveValue("60");
  await page.getByRole("button", { name: "Terapkan hujan & hitung ulang" }).click();
  await expect(page.locator(".rain-equation")).toContainText("12 m³");
  await route(page, "Intervensi"); await route(page, "Hujan & kondisi awal");
  await expect(page.getByRole("button", { name: "Terapkan hujan & hitung ulang" })).toBeDisabled();
});

test("audit repair: tirta.html alias opens offline like the production entry", async ({ page, context }) => {
  test.skip(!process.env.TIRTA_PRODUCTION_PREVIEW, "Requires built service worker.");
  await page.goto("/tirta.html");
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await context.setOffline(true);
  try {
    const offline = await context.newPage();
    await offline.goto("/tirta.html");
    await expect(offline.getByRole("heading", { level: 1 })).toHaveText("Proyek");
    await offline.getByLabel("Nama proyek", { exact: true }).fill("Alias offline");
    await offline.getByRole("button", { name: "Buat proyek baru" }).click();
    await expect(offline.getByRole("heading", { level: 1 })).toHaveText("Studio Persil");
  } finally { await context.setOffline(false); }
});
