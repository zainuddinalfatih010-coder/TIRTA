import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const evidence = ".rescue-evidence/mobile-hardening-7921f5d";
type TouchSession = Awaited<ReturnType<ReturnType<Page["context"]>["newCDPSession"]>>;

async function fresh(page: Page, name: string) {
  await page.goto("/production.html");
  await page.getByLabel("Nama proyek", { exact: true }).fill(name);
  await page.getByRole("button", { name: "Buat proyek baru" }).click();
  await page.getByLabel("Panjang persil").fill("15");
  await page.getByLabel("Lebar persil").fill("10");
  await page.getByRole("button", { name: "Buat persil", exact: true }).click();
  await expect(page.locator(".map-topline")).toContainText("150");
}

async function addZone(page: Page, xStart: number, xEnd: number) {
  const count = await page.locator(".zone-row").count();
  const mobileAdd = page.getByRole("button", { name: "Tambah zona", exact: true });
  if (await mobileAdd.isVisible()) await mobileAdd.click();
  else await page.getByRole("button", { name: "Zona", exact: true }).click();
  const points = await page.locator('[data-testid="parcel-boundary"]').evaluate((el, [start, end]) => {
    const polygon = el as SVGPolygonElement;
    const box = polygon.getBBox();
    const matrix = polygon.getScreenCTM()!;
    const toScreen = (x: number, y: number) => {
      const p = new DOMPoint(box.x + box.width * x / 15, box.y + box.height * y / 10).matrixTransform(matrix);
      return { x: p.x, y: p.y };
    };
    return [toScreen(start, 0), toScreen(end, 10)];
  }, [xStart, xEnd] as const);
  await page.mouse.click(points[0]!.x, points[0]!.y);
  await page.mouse.click(points[1]!.x, points[1]!.y);
  await expect(page.locator(".zone-row")).toHaveCount(count + 1);
}

async function pagePoint(page: Page, x: number, y: number) {
  return page.locator('[data-testid="parcel-boundary"]').evaluate((el, point) => {
    const polygon = el as SVGPolygonElement;
    const box = polygon.getBBox();
    const screen = new DOMPoint(box.x + box.width * point.x / 15, box.y + box.height * point.y / 10).matrixTransform(polygon.getScreenCTM()!);
    return { x: screen.x, y: screen.y };
  }, { x, y });
}

async function changeRoute(page: Page, label: string) {
  await page.getByLabel("Ruang kerja", { exact: true }).selectOption({ label });
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function setCoefficient(page: Page, value: string) {
  await page.getByLabel("Koefisien limpasan", { exact: true }).fill(value);
  await page.locator(".coefficient-help").getByRole("button").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Sumber koefisien", { exact: true }).fill("Asumsi uji pra-perencanaan; perlu diverifikasi");
  await dialog.getByLabel("Nama zona", { exact: true }).fill("Zona uji");
  await dialog.getByRole("button", { name: "Terapkan data zona" }).click();
  await expect(dialog).toHaveCount(0);
}

async function applyRain(page: Page, amount: string) {
  await page.getByLabel("Kedalaman hujan", { exact: true }).fill(amount);
  await page.getByLabel("Dasar hujan", { exact: true }).selectOption("assumption");
  await page.getByRole("button", { name: "Terapkan hujan & hitung ulang", exact: true }).click();
}

async function revealAncestors(field: ReturnType<Page["getByLabel"]>) {
  for (const details of await field.locator("xpath=ancestor::details").all()) {
    if (await details.getAttribute("open") === null) await details.locator(":scope > summary").click();
  }
}

async function startTouch(page: Page, x: number, y: number) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  return cdp;
}

async function moveTouch(cdp: TouchSession, x: number, y: number) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] });
}

async function endTouch(cdp: TouchSession) {
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

async function touchableZonePoint(zone: ReturnType<Page["locator"]>) {
  return zone.evaluate((element) => {
    const shape = element as SVGPolygonElement;
    const bounds = shape.getBoundingClientRect();
    const svg = shape.ownerSVGElement!;
    for (let row = 1; row < 9; row++) {
      for (let column = 1; column < 9; column++) {
        const x = bounds.left + bounds.width * column / 10;
        const y = bounds.top + bounds.height * row / 10;
        const target = document.elementFromPoint(x, y);
        if (target === shape || target?.closest(".zone-shape") === shape) return { x, y };
      }
    }
    throw new Error(`Tidak menemukan titik sentuh pada ${svg.className.baseVal}`);
  });
}

test("mobile Studio dock and real touch scrolling, dragging, drawing, and vertex editing", async ({ browser }) => {
  await mkdir(evidence, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    await fresh(page, "Studio mobile touch");
    await addZone(page, 0, 8);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator(".parcel-svg").scrollIntoViewIfNeeded();

    const dock = page.getByRole("group", { name: "Alat Studio Persil" });
    await expect(dock).toBeVisible();
    await expect(page.locator(".approved-parcel > .map-toolstrip")).toBeHidden();
    await expect(dock.getByRole("button")).toHaveCount(7);
    const dockMetrics = await dock.getByRole("button").evaluateAll((buttons) => buttons.map(button => {
      const box = button.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    }));
    expect(new Set(dockMetrics.map(box => Math.round(box.y))).size).toBe(1);
    expect(dockMetrics.every(box => box.width >= 44 && box.height >= 44)).toBe(true);
    expect((await page.locator(".parcel-context-actions > summary").boundingBox())!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `${evidence}/mobile-studio-idle.png`, fullPage: true });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    const more = page.getByRole("button", { name: "Bantuan gambar" });
    await more.click();
    const popover = page.getByRole("group", { name: "Bantuan gambar" });
    await expect(popover).toBeVisible();
    await page.screenshot({ path: `${evidence}/mobile-more-popover.png`, fullPage: true });
    await popover.getByLabel("Kunci X/Y").check();
    await expect(popover).toBeVisible();
    await popover.getByLabel("Snap ke meteran").uncheck();
    await expect(popover).toBeVisible();
    await popover.getByLabel("Kisi bantu").uncheck();
    await expect(popover).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.keyboard.press("Escape");
    await expect(popover).toHaveCount(0);
    await expect(more).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(popover).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(popover.getByLabel("Kunci X/Y")).toBeFocused();
    await page.keyboard.press("Space");
    await expect(popover.getByLabel("Kunci X/Y")).not.toBeChecked();
    await page.keyboard.press("Escape");
    await expect(more).toBeFocused();
    await more.click();
    await page.getByRole("heading", { level: 1 }).click();
    await expect(popover).toHaveCount(0);

    await page.getByRole("button", { name: "Tambah zona" }).click();
    await expect(page.getByRole("button", { name: "Tambah zona" })).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({ path: `${evidence}/mobile-zone-mode.png`, fullPage: true });
    await page.getByRole("button", { name: "Pilih dan geser" }).click();
    await page.locator(".zone-shape").first().click();
    await page.getByRole("button", { name: "Edit titik zona" }).click();
    await expect(page.locator(".vertex-handle")).toHaveCount(4);
    await page.screenshot({ path: `${evidence}/mobile-vertex-mode.png`, fullPage: true });
    await page.getByRole("button", { name: "Pilih dan geser" }).click();
    await page.locator(".parcel-svg").scrollIntoViewIfNeeded();

    const blank = await page.locator(".parcel-svg").evaluate((svg) => {
      const box = svg.getBoundingClientRect();
      const maxY = Math.min(box.bottom - 18, innerHeight - 20);
      const minY = Math.max(box.top + 22, 145);
      for (let y = maxY; y >= minY; y -= 9) {
        for (let x = box.left + 2; x <= Math.min(box.left + 55, box.right - 2); x += 5) {
          if (document.elementFromPoint(x, y) === svg) return { x, y };
        }
      }
      return null;
    });
    expect(blank, "an idle, empty part of the canvas is available for page scrolling").not.toBeNull();
    const beforeScroll = await page.evaluate(() => window.scrollY);
    const pan = await startTouch(page, blank!.x, blank!.y);
    await moveTouch(pan, blank!.x, blank!.y - 42);
    await page.waitForTimeout(70);
    await moveTouch(pan, blank!.x, blank!.y - 100);
    await endTouch(pan);
    await page.waitForTimeout(100);
    const afterScroll = await page.evaluate(() => window.scrollY);
    console.log(`TOUCH_SCROLL_PROOF idleCanvas: ${beforeScroll} -> ${afterScroll}`);
    expect(afterScroll).toBeGreaterThan(beforeScroll);

    await page.locator(".parcel-svg").scrollIntoViewIfNeeded();
    const shape = page.locator(".zone-shape").first();
    const zoneStart = await touchableZonePoint(shape);
    const pointsBeforeMove = await shape.getAttribute("points");
    const beforeDragScroll = await page.evaluate(() => window.scrollY);
    const drag = await startTouch(page, zoneStart.x, zoneStart.y);
    await moveTouch(drag, zoneStart.x + 14, zoneStart.y);
    await moveTouch(drag, zoneStart.x + 20, zoneStart.y);
    await endTouch(drag);
    await page.waitForTimeout(160);
    expect(await shape.getAttribute("points")).not.toBe(pointsBeforeMove);
    const afterDragScroll = await page.evaluate(() => window.scrollY);
    expect(afterDragScroll).toBe(beforeDragScroll);
    console.log(`TOUCH_SCROLL_PROOF zoneDrag: ${beforeDragScroll} -> ${afterDragScroll}`);

    await page.getByRole("button", { name: "Edit titik zona" }).click();
    const vertex = page.locator(".vertex-handle").nth(2);
    const vertexBox = await vertex.boundingBox();
    expect(vertexBox).not.toBeNull();
    const pointBeforeVertex = await shape.getAttribute("points");
    const beforeVertexScroll = await page.evaluate(() => window.scrollY);
    const vertexDrag = await startTouch(page, vertexBox!.x + vertexBox!.width / 2, vertexBox!.y + vertexBox!.height / 2);
    await moveTouch(vertexDrag, vertexBox!.x + vertexBox!.width / 2 - 5, vertexBox!.y + vertexBox!.height / 2 - 5);
    await endTouch(vertexDrag);
    await page.waitForTimeout(160);
    expect(await shape.getAttribute("points")).not.toBe(pointBeforeVertex);
    const afterVertexScroll = await page.evaluate(() => window.scrollY);
    expect(afterVertexScroll).toBe(beforeVertexScroll);
    console.log(`TOUCH_SCROLL_PROOF vertexDrag: ${beforeVertexScroll} -> ${afterVertexScroll}`);

    await page.getByRole("button", { name: "Pilih dan geser" }).click();
    await page.getByRole("button", { name: "Tambah zona" }).click();
    const drawStart = await pagePoint(page, 9, 1);
    const drawEnd = await pagePoint(page, 14, 9);
    const beforeDrawScroll = await page.evaluate(() => window.scrollY);
    const draw = await startTouch(page, drawStart.x, drawStart.y);
    await moveTouch(draw, drawEnd.x - 18, drawEnd.y - 16);
    await expect(page.getByTestId("live-measurement")).toBeVisible();
    const duringDrawScroll = await page.evaluate(() => window.scrollY);
    expect(duringDrawScroll).toBe(beforeDrawScroll);
    console.log(`TOUCH_SCROLL_PROOF drawing: ${beforeDrawScroll} -> ${duringDrawScroll}`);
    await page.screenshot({ path: `${evidence}/mobile-live-measurement.png` });
    await moveTouch(draw, drawEnd.x, drawEnd.y);
    await endTouch(draw);
    await expect(page.locator(".zone-row")).toHaveCount(2);
    const afterDrawScroll = await page.evaluate(() => window.scrollY);
    expect(afterDrawScroll).toBe(beforeDrawScroll);

    const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    try {
      const desktopPage = await desktop.newPage();
      await fresh(desktopPage, "Desktop toolbar regression");
      await addZone(desktopPage, 0, 8);
      await expect(desktopPage.locator(".approved-parcel > .map-toolstrip")).toBeVisible();
      await expect(desktopPage.locator(".mobile-tool-dock")).toBeHidden();
      await desktopPage.screenshot({ path: `${evidence}/desktop-studio-1440.png`, fullPage: true });
    } finally {
      await desktop.close();
    }
  } finally {
    await context.close();
  }
});

test("mobile disclosures, photo assistance, recovery hierarchy, and notice hit target", async ({ browser }) => {
  await mkdir(evidence, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  try {
    await fresh(page, "Studio bantuan foto");
    await addZone(page, 0, 15);
    await page.getByLabel("Jenis permukaan", { exact: true }).selectOption("roof");
    await setCoefficient(page, "0.85");
    await changeRoute(page, "Hujan & kondisi awal");
    await applyRain(page, "60");
    const runoff = page.locator('.rain-analysis [data-method="runoff"]');
    const runoffSummary = runoff.locator(":scope > summary");
    expect((await runoffSummary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await runoffSummary.click();
    await expect(runoff).toContainText("Cara hitung singkat");
    const technicalSummary = runoff.locator(".calculation-source-technical > summary");
    expect((await technicalSummary.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    await changeRoute(page, "Studio Persil");
    await page.locator(".zone-row").first().click();
    const assist = page.locator(".image-review");
    const assistSummary = assist.locator(":scope > summary");
    await assistSummary.click();
    expect((await assistSummary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const photoInput = page.getByLabel("Pilih foto permukaan", { exact: true });
    await expect(photoInput).toBeAttached();
    await expect(assist.getByText("Pilih foto", { exact: true })).toBeVisible();
    const photoLabelText = await assist.locator(".image-photo-trigger").innerText();
    expect(photoLabelText).not.toMatch(/Choose File|No file chosen/i);
    const nativeStyle = await photoInput.evaluate(element => {
      const style = getComputedStyle(element);
      return { display: style.display, visibility: style.visibility, clipPath: style.clipPath };
    });
    expect(nativeStyle.display).not.toBe("none");
    expect(nativeStyle.visibility).toBe("visible");
    expect(nativeStyle.clipPath).toContain("inset");
    await page.screenshot({ path: `${evidence}/mobile-surface-assist-photo-control.png`, fullPage: true });
    const png = Buffer.from(await page.evaluate(() => {
      const canvas = document.createElement("canvas"); canvas.width = 64; canvas.height = 64;
      const context = canvas.getContext("2d")!; context.fillStyle = "#228040"; context.fillRect(0, 0, 64, 64);
      return canvas.toDataURL("image/png").split(",")[1]!;
    }), "base64");
    await photoInput.focus();
    await expect(photoInput).toBeFocused();
    expect(Number.parseFloat(await photoInput.evaluate(element => getComputedStyle(element.parentElement!).outlineWidth))).toBeGreaterThanOrEqual(3);
    const chooserPromise = page.waitForEvent("filechooser", { timeout: 5000 });
    await page.keyboard.press("Enter");
    const chooser = await chooserPromise;
    await chooser.setFiles({ name: "foto-halaman-timur.png", mimeType: "image/png", buffer: png });
    await expect(assist).toContainText("foto-halaman-timur.png");
    await expect(photoInput).toHaveAttribute("accept", "image/png,image/jpeg,image/webp");
    await expect(assist).toContainText("maks. 5 MiB · 16 megapiksel");
    await expect(assist).toContainText("tidak diunggah");

    await changeRoute(page, "Intervensi");
    const budget = page.getByLabel("Anggaran (Rp)", { exact: true });
    await budget.fill("1000000");
    const budgetSource = page.getByLabel("Sumber / alasan anggaran", { exact: true });
    await revealAncestors(budgetSource);
    await budgetSource.selectOption("Asumsi pribadi");
    await page.getByRole("button", { name: "Terapkan batas rencana", exact: true }).click();
    await page.getByLabel("Ruang kerja", { exact: true }).selectOption({ label: "Alternatif" });
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Intervensi");
    await expect(page.locator(".recovery-resume")).toContainText("1 hal perlu diperiksa · Tunjukkan");
    await expect(page.locator(".readiness-trigger")).toHaveCount(0);
    await expect(page.getByLabel("Lahan tersedia (m²)", { exact: true })).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.screenshot({ path: `${evidence}/mobile-single-issue-recovery.png`, fullPage: true });

    await changeRoute(page, "Proyek");
    await page.getByRole("button", { name: "Buka Contoh", exact: true }).click();
    const dismiss = page.getByRole("button", { name: "Tutup pemberitahuan", exact: true });
    const dismissBox = await dismiss.boundingBox();
    expect(dismissBox).not.toBeNull();
    expect(dismissBox!.width).toBeGreaterThanOrEqual(44);
    expect(dismissBox!.height).toBeGreaterThanOrEqual(44);
    await dismiss.click();
  } finally {
    await context.close();
  }
});
