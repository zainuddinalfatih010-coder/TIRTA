import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { demoProject, setActiveComponents } from '../src/direction/productionBridge';
import { projectBackup } from '../src/persistence/portable';
import { optimize, planningFingerprint } from '../src/domain/planningEngine';
import { saveRain } from '../src/domain/planningAuthoring';
import { packageCandidates } from '../src/assistant/assistance';
import type { ProjectV2 } from '../src/domain/projectV2';

// Legacy filename retained for regression discoverability. Cloud/quota tests are
// archived externally; the current contract is reviewed local guidance only.
const folder = process.env.TIRTA_ASSISTANT_EVIDENCE ?? 'E:/CodexStore/home/audits/tirta-rescue-2026-10-07/guidance/production';
async function open(page: Page, project: ProjectV2) {
  await page.goto('/tirta.html');
  await page.getByLabel('Buka berkas cadangan', { exact: true }).setInputFiles({
    name: 'synthetic-local-guidance.tirta.json', mimeType: 'application/json', buffer: Buffer.from(projectBackup(project)),
  });
  await expect(page.locator('.view-studio')).toBeVisible();
  const notice = page.getByRole('button', { name: 'Tutup pemberitahuan' });
  if (await notice.isVisible()) await notice.click();
  await page.getByRole('button', { name: 'Tanya TIRTA', exact: true }).click();
  await expect(page.locator('.planning-assistant')).toBeVisible();
}
async function ask(page: Page, question: string) {
  await page.getByLabel('Pertanyaan Anda', { exact: true }).fill(question);
  await page.getByRole('button', { name: 'Kirim pertanyaan', exact: true }).click();
}
async function contextPanel(page: Page) {
  const button = page.getByRole('button', { name: 'Konteks', exact: true });
  if (await button.isVisible()) await button.click();
}
function monitor(page: Page) {
  const errors: string[] = [], external: string[] = [], model: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => {
    const url = request.url();
    if (/tirta-ai|\/analysis|huggingface|wllama|\.gguf|embedding/i.test(url)) model.push(url);
    if (/^https?:/.test(url) && !['127.0.0.1', 'localhost'].includes(new URL(url).hostname)) external.push(url);
  });
  return { errors, external, model };
}

test('unsupported synthesis is admitted and repeated local answers have no quota or transport', async ({ page, context }) => {
  const observed = monitor(page);
  await open(page, demoProject(true));
  await expect(page.locator('.assistant-quota,.assistant-mode-picker,.thinking-orb')).toHaveCount(0);
  await ask(page, 'Dari mana angka limpasan?');
  await expect(page.locator('.assistant-context')).toHaveAttribute('data-topic', 'rain');
  await ask(page, 'Gabungkan jurnal dan buat analisis mendalam untuk lokasi ini');
  const unsupported = page.locator('.assistant-answer').last();
  await expect(unsupported).toContainText('Pertanyaan ini belum ada dalam panduan lokal');
  await expect(unsupported).toContainText('tidak diubah menjadi jawaban ilmiah yang belum didukung');
  await expect(unsupported.locator('.assistant-sources')).toHaveCount(0);
  await expect(page.locator('.assistant-context')).toHaveAttribute('data-topic', 'rain');
  await context.setOffline(true);
  for (let index = 0; index < 7; index++) {
    await ask(page, 'Cara simpan proyek?');
    await expect(page.locator('.assistant-answer').last()).toContainText('browser perangkat ini');
  }
  await expect(page.locator('.assistant-answer')).toHaveCount(9);
  await expect(page.getByRole('alert')).toHaveCount(0);
  expect(observed).toEqual({ errors: [], external: [], model: [] });
});

test('named objects and generic follow-ups preserve context; reset and route origins are explicit', async ({ page }) => {
  await open(page, setActiveComponents(demoProject(true), ['tank', 'soak', 'garden']));
  await expect(page.locator('.assistant-context')).toHaveAttribute('data-topic', 'studio');
  await ask(page, 'Berapa C untuk Gedung belajar?');
  await expect(page.locator('#assistant-zone')).toHaveValue('z0');
  await ask(page, 'Bagaimana tangki dikosongkan?');
  await expect(page.locator('.assistant-context')).toHaveAttribute('data-topic', 'interventions');
  await expect(page.locator('#assistant-intervention')).toHaveValue('tank');
  await ask(page, 'Rain garden perlu tanaman apa?');
  await expect(page.locator('#assistant-intervention')).toHaveValue('garden');
  await ask(page, 'Jelaskan lagi dong');
  await expect(page.locator('#assistant-intervention')).toHaveValue('garden');
  await page.getByRole('button', { name: 'Kembali ke konteks langkah', exact: true }).click();
  await expect(page.locator('.assistant-context')).toHaveAttribute('data-topic', 'studio');
  await page.getByRole('button', { name: 'Hujan & kondisi awal', exact: true }).click();
  await page.getByRole('button', { name: 'Tanya TIRTA', exact: true }).click();
  await expect(page.locator('.assistant-context')).toHaveAttribute('data-topic', 'rain');
  await expect(page.locator('.assistant-topic-heading')).toContainText('Langkah sebelumnya');
});

test('blank rain is UNKNOWN while explicit zero and scenario overrides keep their declared values', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const zero = saveRain(demoProject(true), 'r50', 'Tanpa hujan', { text: '0', source: 'Synthetic test declaration', evidence: 'ASSUMPTION' }, '');
  await open(page, zero); await ask(page, 'Dari mana angka limpasan?'); await contextPanel(page);
  await expect(page.locator('.assistant-context-hero')).toContainText('0 mm');
  await expect(page.locator('.assistant-volume')).toContainText('0 m³');
  await expect(page.locator('.assistant-volume-bar > span')).toHaveCount(0);
  const unknown = saveRain(zero, 'r50', 'Hujan belum diisi', { text: '', source: '', evidence: 'UNKNOWN' }, '');
  await open(page, unknown); await ask(page, 'Dari mana angka limpasan?'); await contextPanel(page);
  await expect(page.locator('.assistant-context-hero')).toContainText('Belum diketahui');
  await expect(page.locator('.assistant-volume,.assistant-answer-facts')).toHaveCount(0);
  const overridden = demoProject(true), rainfall = overridden.scenarios[0]!.rainfall;
  overridden.parameters.push({ ...overridden.parameters.find(parameter => parameter.id === rainfall.id)!, id: 'rain-guidance-override', value: 60 });
  overridden.scenarios[0]!.overrides.push({ baseParameterId: rainfall.id, replacement: { ...rainfall, id: 'rain-guidance-override' } });
  await open(page, overridden); await ask(page, 'Dari mana angka limpasan?'); await contextPanel(page);
  await expect(page.locator('.assistant-context-hero')).toContainText('60 mm');
  await expect(page.locator('.assistant-volume')).toContainText('12 m³');
});

test('inspecting an alternative does not replace the selected plan and stale selected metrics are withheld', async ({ page }) => {
  const project = setActiveComponents(demoProject(true), ['tank', 'soak', 'garden']);
  const result = optimize(project, 'r50'); if (!result.ok) throw new Error('Invalid synthetic fixture');
  const candidates = packageCandidates(project, result.value.alternatives, 'r50');
  expect(candidates.length).toBeGreaterThan(1);
  const chosen = candidates[0]!;
  project.selectedPlan = { definition: chosen.plan, reviewedInputFingerprint: planningFingerprint(project), decisionNote: 'Explicit synthetic user selection' };
  await open(page, project); await ask(page, 'Paket mana yang paling efektif?');
  // The UI searches its own declared options. Inspect a rendered alternative,
  // rather than assuming generated IDs from a separate optimization are equal.
  const other = await page.locator('#assistant-package option').evaluateAll((options, chosenName) => options
    .map(option => ({ value: (option as HTMLOptionElement).value, text: option.textContent ?? '' }))
    .find(option => option.value && !option.text.startsWith(`${chosenName} · `)), chosen.plan.name);
  expect(other).toBeDefined();
  await page.locator('#assistant-package').selectOption(other!.value);
  await expect(page.locator('#assistant-priority')).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Tinjau & terapkan', exact: true })).toBeDisabled();
  await ask(page, 'Kesimpulan rencana pilihan saya?');
  await expect(page.locator('.assistant-composition')).toHaveText(chosen.plan.name);
  await expect(page.locator('.assistant-context-rows')).toContainText('Sisa limpasan');
  project.parameters[0]!.source += ' revised declaration';
  await open(page, project); await ask(page, 'Kesimpulan rencana pilihan saya?');
  await expect(page.locator('.assistant-composition')).toHaveText(chosen.plan.name);
  await expect(page.locator('.assistant-context')).toContainText('Data berubah');
  await expect(page.locator('.assistant-context-rows')).toHaveCount(0);
});

test('empty submission, keyboard dispatch and long input respect the local composer boundary', async ({ page }) => {
  const observed = monitor(page);
  await open(page, demoProject(true));
  const input = page.getByLabel('Pertanyaan Anda', { exact: true }), send = page.getByRole('button', { name: 'Kirim pertanyaan', exact: true });
  await expect(input).toBeFocused(); await expect(send).toBeDisabled();
  await input.fill('   '); await expect(send).toBeDisabled(); await input.press('Enter');
  await expect(page.locator('.assistant-answer')).toHaveCount(0);
  await input.fill('Cara simpan proyek?'); await input.press('Shift+Enter');
  await expect(input).toHaveValue('Cara simpan proyek?\n');
  await expect(page.locator('.assistant-answer')).toHaveCount(0);
  await input.press('Enter'); await expect(page.locator('.assistant-answer')).toHaveCount(1);
  await expect(input).toHaveValue('');
  await input.fill('Pertanyaan panjang '.repeat(120));
  expect((await input.inputValue()).length).toBe(1600);
  expect((await input.boundingBox())!.height).toBeLessThanOrEqual(124);
  await input.fill(''); await expect(send).toBeDisabled();
  expect(observed).toEqual({ errors: [], external: [], model: [] });
});

for (const width of [1440, 390]) test(`populated local conversation and context remain usable and accessible at ${width}`, async ({ page }) => {
  const observed = monitor(page);
  await page.setViewportSize({ width, height: width === 1440 ? 900 : 844 });
  await open(page, demoProject(true)); await ask(page, 'Dari mana angka limpasan?');
  await page.locator('.assistant-sources summary').click();
  await expect(page.locator('.assistant-sources')).toContainText('EPA');
  await expect(page.locator('.assistant-answer-facts')).toContainText('6,27 m³');
  const conversationAxe = (await new AxeBuilder({ page }).analyze()).violations;
  expect.soft(conversationAxe).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await mkdir(folder, { recursive: true }); await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${folder}/local-conversation-${width}.png`, fullPage: true });
  await contextPanel(page);
  await expect(page.getByRole('button', { name: 'Buka Hujan', exact: true })).toBeVisible();
  await expect(page.locator('.assistant-volume')).toContainText('10 m³');
  const contextAxe = (await new AxeBuilder({ page }).analyze()).violations;
  expect.soft(contextAxe).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.screenshot({ path: `${folder}/local-context-${width}.png`, fullPage: true });
  await writeFile(`${folder}/local-runtime-${width}.json`, JSON.stringify({ width, ...observed, conversationAxe, contextAxe }, null, 2));
  expect(observed).toEqual({ errors: [], external: [], model: [] });
});

for (const width of [390, 768]) test(`mobile prompt stays reachable while eligibility content scrolls at ${width}`, async ({ page }) => {
  const observed = monitor(page);
  await page.setViewportSize({ width, height: 844 });
  await open(page, demoProject(true));
  const composer = page.locator('.assistant-composer'), input = page.getByLabel('Pertanyaan Anda', { exact: true });
  await expect(composer).toBeInViewport({ ratio: 1 });
  await expect(input).toBeFocused();
  await mkdir(folder, { recursive: true });
  await page.screenshot({ path: `${folder}/reachable-prompt-initial-${width}.png`, fullPage: false });
  await page.locator('.assistant-messages').evaluate(element => { element.scrollTop = 600; });
  await expect.poll(() => page.locator('.assistant-messages').evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await expect(composer).toBeInViewport({ ratio: 1 });
  for (const action of await page.locator('.assistant-site-option button').all()) {
    await action.evaluate(element => element.scrollIntoView({ block: 'center' }));
    expect(await action.evaluate(element => {
      const box = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
    })).toBe(true);
  }
  const comparison = page.getByRole('button', { name: 'Pilih prioritas & bandingkan paket', exact: true });
  await comparison.evaluate(element => element.scrollIntoView({ block: 'center' }));
  expect(await comparison.evaluate(element => {
    const box = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
  })).toBe(true);
  await expect(composer).toBeInViewport({ ratio: 1 });
  await input.fill('Cara simpan proyek?'); await input.press('Enter');
  await expect(page.locator('.assistant-answer').last()).toContainText('browser perangkat ini');
  await expect(composer).toBeInViewport({ ratio: 1 });
  const axe = (await new AxeBuilder({ page }).analyze()).violations;
  expect(axe).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await mkdir(folder, { recursive: true });
  await page.screenshot({ path: `${folder}/reachable-prompt-${width}.png`, fullPage: false });
  await writeFile(`${folder}/reachable-prompt-${width}.json`, JSON.stringify({ width, ...observed, axe }, null, 2));
  expect(observed).toEqual({ errors: [], external: [], model: [] });
});
