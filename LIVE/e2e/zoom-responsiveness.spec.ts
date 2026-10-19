import { chromium, test, expect, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const folder = 'evidence/uiux-candidate/zoom';
const names = { project:'Proyek', studio:'Studio Persil', rain:'Hujan & kondisi awal', interventions:'Intervensi', alternatives:'Alternatif', compare:'Bandingkan', impact:'Rencana & Dampak' };
async function navigate(page: Page, route: keyof typeof names | 'assistant') {
  const mobile = page.getByLabel('Ruang kerja', { exact:true });
  if (route !== 'assistant' && await mobile.isVisible()) await mobile.selectOption({ label:names[route] });
  else {
    const control = route === 'assistant' ? page.getByRole('button', { name:'Tanya TIRTA', exact:true }) : page.locator('.app-rail nav').getByRole('button', { name:names[route], exact:true, includeHidden:true });
    for (const details of await control.locator('xpath=ancestor::details').all()) await details.evaluate(el => (el as HTMLDetailsElement).open = true);
    // Native browser zoom changes input coordinate scaling; keyboard is also a real user path.
    await control.focus(); await page.keyboard.press('Enter');
  }
  await expect(page.locator(`.view-${route}`)).toBeVisible();
  const notice = page.getByRole('button', { name:'Tutup pemberitahuan' });
  if (await notice.isVisible()) await notice.click();
  await page.evaluate(() => document.fonts.ready);
}
async function openProject(page: Page, baseURL: string) {
  await page.goto(`${baseURL}/tirta.html`);
  await page.bringToFront();
  const file = page.getByLabel('Buka berkas cadangan');
  for (const details of await file.locator('xpath=ancestor::details').all()) await details.evaluate(el => (el as HTMLDetailsElement).open = true);
  await file.setInputFiles('evidence/uiux-candidate/treatment/declared-four-family-demo.tirta.json');
  // Import restores IndexedDB asynchronously; concurrent PDF/browser audits can
  // take longer than Playwright's default assertion window on this host.
  await expect(page.getByRole('heading', { name:'Studio Persil', exact:true })).toBeVisible({timeout:15000});
}

test('native Chrome zoom minimum to maximum: eight populated pages across three browser windows', async ({ baseURL }, testInfo) => {
  test.setTimeout(240000); await mkdir(folder, { recursive:true });
  const reports: object[] = [], errors: string[] = [];
  for (const [width,height] of [[1366,768],[1440,900],[1920,1080]]) {
    const context = await chromium.launchPersistentContext(join(testInfo.outputDir, `profile-${width}`), { channel:'chrome', headless:true, viewport:null, reducedMotion:'reduce', args:[`--window-size=${width},${height}`, '--lang=en-US'] });
    try {
      const settings = await context.newPage(); await settings.goto('chrome://settings/appearance');
      const zoom = settings.locator('select').filter({ has:settings.locator('option', { hasText:'500%' }) });
      const options = await zoom.locator('option').evaluateAll(items => items.map(el => (el as HTMLOptionElement).value));
      const factors = ['1', ...options.filter(value => value !== '1' && Number(value) >= .25 && Number(value) <= 5)];
      expect(Math.min(...factors.map(Number))).toBe(.25); expect(Math.max(...factors.map(Number))).toBe(5);
      await zoom.selectOption('1'); const page = context.pages()[0]!;
      page.on('pageerror', e => errors.push(e.message)); page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
      await openProject(page, baseURL!);
      const initialDpr = await page.evaluate(() => devicePixelRatio);
      const cdp = await context.newCDPSession(page);
      for (const factor of factors) {
        await zoom.selectOption(factor);
        await expect.poll(() => page.evaluate(baseDpr => devicePixelRatio / baseDpr, initialDpr)).toBeCloseTo(Number(factor), 2);
        for (const route of [...Object.keys(names), 'assistant'] as (keyof typeof names | 'assistant')[]) {
          await navigate(page, route);
          const metric = await page.evaluate(() => ({ width:innerWidth, height:innerHeight, dpr:devicePixelRatio, scrollWidth:document.documentElement.scrollWidth, shellHeight:document.querySelector('.direction-app')!.getBoundingClientRect().height, background:getComputedStyle(document.querySelector('.direction-app')!).backgroundColor, workspaceBackground:getComputedStyle(document.querySelector('.workspace')!).backgroundColor, editorHeight:document.querySelector('.treatment-composer')?.getBoundingClientRect().height ?? null }));
          reports.push({ windowWidth:width, windowHeight:height, factor:Number(factor), route, ...metric });
          expect(metric.scrollWidth, `${width}/${factor}/${route} page overflow`).toBeLessThanOrEqual(metric.width + 1);
          expect(metric.shellHeight).toBeGreaterThanOrEqual(metric.height - 1);
          if (route === 'interventions') expect(metric.editorHeight).toBeGreaterThan(100);
          if (Number(factor) < 1 && ['studio','rain','interventions'].includes(route)) { expect(metric.background).toBe('rgb(204, 239, 252)'); expect(metric.workspaceBackground).toBe('rgba(0, 0, 0, 0)'); }
          if (width === 1440 && ['0.25','1','2','5'].includes(factor) && ['studio','rain','interventions'].includes(route)) {
            const screenshot = await cdp.send('Page.captureScreenshot', { format:'png', fromSurface:true, captureBeyondViewport:false });
            await writeFile(`${folder}/${route}-${Number(factor)*100}.png`, Buffer.from(screenshot.data, 'base64'));
          }
        }
      }
      await zoom.selectOption('1');
    } finally { await context.close(); }
  }
  await writeFile(`${folder}/native-metrics.json`, JSON.stringify({ reports, errors }, null, 2)); expect(errors).toEqual([]);
});

test('500% zoom: capacity editing, save, zone sheet and coefficient action remain reachable', async ({ baseURL }, testInfo) => {
  test.setTimeout(90000); await mkdir(folder, { recursive:true });
  const context = await chromium.launchPersistentContext(join(testInfo.outputDir, 'interaction-profile'), { channel:'chrome', headless:true, viewport:null, reducedMotion:'reduce', args:['--window-size=1366,768', '--lang=en-US'] });
  try {
    const settings = await context.newPage(); await settings.goto('chrome://settings/appearance');
    const zoom = settings.locator('select').filter({ has:settings.locator('option', { hasText:'500%' }) }); await zoom.selectOption('1');
    const page = context.pages()[0]!; await openProject(page, baseURL!); await zoom.selectOption('5');
    await navigate(page, 'interventions');
    const stage = page.locator('.treatment-composer').getByRole('button', { name:/Kapasitas/ }); await stage.focus(); await page.keyboard.press('Enter');
    const capacity = page.getByLabel('Tampungan tersedia per kejadian (m³/event)', { exact:true }); await capacity.focus();
    await expect(capacity).toBeInViewport({ratio:.5}); await capacity.fill('2.55');
    const save = page.locator('.treatment-composer').getByRole('button', { name:'Simpan draft', exact:true }); await save.focus(); await expect(save).toBeInViewport({ratio:.5});
    expect(await save.evaluate(el => { const b=el.getBoundingClientRect(); return el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)); })).toBe(true);
    await page.keyboard.press('Enter');
    await expect(page.locator('.composer-saved')).toContainText('Draf tersimpan');
    await navigate(page, 'studio'); await page.locator('[data-testid="zone-z0"]').focus(); await page.keyboard.press('Enter');
    await page.locator('.mobile-zone-summary').focus(); await page.keyboard.press('Enter');
    const sheet = page.locator('.studio-inspector[open]'); await expect(sheet).toBeVisible();
    const help = sheet.locator('.coefficient-launch'); await help.focus(); await expect(help).toBeInViewport({ratio:.5}); await page.keyboard.press('Enter');
    const modal = page.getByRole('dialog', { name:'Pilih dari patokan', exact:true }); await expect(modal).toBeVisible();
    const apply = modal.getByRole('button', { name:'Terapkan', exact:true }); await apply.focus(); await expect(apply).toBeInViewport({ratio:.5});
    expect(await apply.evaluate(el => { const b=el.getBoundingClientRect(); return el.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)); })).toBe(true);
    const cdp = await context.newCDPSession(page); const screenshot = await cdp.send('Page.captureScreenshot', { format:'png', fromSurface:true, captureBeyondViewport:false }); await writeFile(`${folder}/coefficient-500.png`, Buffer.from(screenshot.data, 'base64'));
    await page.keyboard.press('Escape'); await expect(modal).toBeHidden(); await expect(help).toBeFocused();
    await page.keyboard.press('Escape'); await expect(sheet).toBeHidden(); await zoom.selectOption('1');
  } finally { await context.close(); }
});
