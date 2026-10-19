import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, readdir, readFile } from 'node:fs/promises';
import { retiredModelKey } from '../src/persistence/retiredModelCache';

const folder = 'evidence/uiux-candidate/ai-removal';
for (const width of [1440, 390]) test(`retired local model remains absent, core help and project actions still work at ${width}`, async ({ page }) => {
  const errors: string[] = [], downloads: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  page.on('request', r => { if (/huggingface|hf\.co|localLanguage|wllama/i.test(r.url())) downloads.push(r.url()); });
  await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
  await page.goto('/tirta.html');
  await page.getByRole('button', { name: 'Buka Contoh', exact: true }).click();
  const actions = page.locator('.project-actions > summary');
  await actions.click();
  await expect(page.getByRole('button', { name: 'Tanya TIRTA', exact: true })).toBeVisible();
  await expect(page.getByTestId('local-planning-assistant')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Simpan', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Buka simpanan lokal', exact: true })).toBeVisible();
  await mkdir(folder, { recursive: true });
  await page.screenshot({ path: `${folder}/menu-${width}.png` });
  await page.getByRole('button', { name: 'Simpan', exact: true }).click();
  await expect(page.locator('.local-save-indicator')).toHaveAttribute('aria-label', 'Tersimpan lokal');
  await page.reload();
  await page.locator('.local-projects > summary').click();
  await page.locator('.local-projects').getByRole('button', { name: /^Contoh TIRTA/ }).click();
  await expect(page.locator('.route-project')).toContainText('Contoh TIRTA');
  await expect(page.getByTestId('local-planning-assistant')).toHaveCount(0);
  const help = page.getByRole('button', { name: 'Dasar TIRTA', exact: true });
  await help.click();
  const dialog = page.getByRole('dialog', { name: 'Dasar TIRTA', exact: true });
  await expect(dialog).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)).toBe(false);
  await page.keyboard.press('Escape');
  await expect(help).toBeFocused();
  expect(downloads).toEqual([]); expect(errors).toEqual([]);
});

test('retired model files are cleaned without deleting unrelated OPFS, IndexedDB or offline caches', async ({ page }) => {
  await page.goto('/tirta.html');
  await page.evaluate(async key => {
    const root = await navigator.storage.getDirectory();
    const cache = await root.getDirectoryHandle('cache', { create: true });
    for (const name of [key, `__metadata__${key}`, 'keep-project-backup.json', 'keep-other-model.gguf']) {
      const file = await cache.getFileHandle(name, { create: true });
      const writer = await file.createWritable(); await writer.write('Synthetic sentinel'); await writer.close();
    }
    const offline = await caches.open('tirta-protected-test-cache');
    await offline.put('/test-sentinel', new Response('keep offline assets'));
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('tirta-protected-test-db', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('project');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction('project', 'readwrite');
        tx.objectStore('project').put('keep user data', 'sentinel');
        tx.oncomplete = () => { db.close(); resolve(); };
      };
    });
  }, retiredModelKey);
  await page.reload();
  await expect.poll(() => page.evaluate(async key => {
    const root = await navigator.storage.getDirectory(), cache = await root.getDirectoryHandle('cache');
    try { await cache.getFileHandle(key); return true; } catch { return false; }
  }, retiredModelKey)).toBe(false);
  const preserved = await page.evaluate(async key => {
    const root = await navigator.storage.getDirectory(), cache = await root.getDirectoryHandle('cache');
    const exists = async (name: string) => { try { await cache.getFileHandle(name); return true; } catch { return false; } };
    const dbValue = await new Promise<unknown>((resolve, reject) => {
      const request = indexedDB.open('tirta-protected-test-db', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, get = db.transaction('project').objectStore('project').get('sentinel');
        get.onsuccess = () => { db.close(); resolve(get.result); };
      };
    });
    return { metadata: await exists(`__metadata__${key}`), backup: await exists('keep-project-backup.json'), otherModel: await exists('keep-other-model.gguf'), dbValue, offline: await (await caches.match('/test-sentinel'))?.text() };
  }, retiredModelKey);
  expect(preserved).toEqual({ metadata: false, backup: true, otherModel: true, dbValue: 'keep user data', offline: 'keep offline assets' });
});

test('production artifacts no longer contain the language worker, WASM runtime or model downloader', async () => {
  const assets = await readdir('dist/assets');
  expect(assets.filter(name => /localLanguage|wllama|\.wasm$|\.gguf$/i.test(name))).toEqual([]);
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
  expect(packageJson.dependencies['@wllama/wllama']).toBeUndefined();
  const headers = await readFile('dist/_headers', 'utf8');
  expect(headers).not.toMatch(/huggingface|hf\.co|wasm-unsafe-eval/);
  const sw = await readFile('dist/tirta-sw.js', 'utf8');
  expect(sw).not.toMatch(/localLanguage|wllama|\.wasm/);
});
