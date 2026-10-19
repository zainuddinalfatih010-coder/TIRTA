import {watchNavErrors,expectNoNavErrors} from './navigator-helpers';
import {test,expect} from '@playwright/test';
import {demoProject,setActiveComponents} from '../src/direction/productionBridge';
import {navOut,navBackup,importNav,orientNav} from './navigator-helpers';
test('first meaningful answer resumes at remaining orientation instead of restarting',async({page})=>{
 await page.goto('/tirta.html');await page.getByPlaceholder('Nama lahan atau bangunan').fill('Rumah tersimpan');await page.getByRole('button',{name:'Buat proyek baru',exact:true}).click();await page.getByRole('button',{name:'Limpasan atap',exact:true}).click();await expect(page.locator('.navigator-task-footer [role=status]')).toHaveText('Progres tersimpan');await page.reload();await expect(page.locator('.landing-resume')).toContainText('Rumah tersimpan');await expect(page.locator('.landing-resume')).toContainText('Data apa yang sudah Anda punya?');await page.getByRole('button',{name:'Lanjutkan dari sini',exact:true}).click();await expect(page.locator('.navigator-task-surface h2')).toHaveText('Data apa yang sudah Anda punya?');
});
test('deferred fact remains in data plan after offline interruption and resume',async({page,context})=>{
 await importNav(page,setActiveComponents(demoProject(),[]));await orientNav(page);await page.getByRole('button',{name:'Belum tahu',exact:true}).click();await expect(page.locator('.navigator-task-footer [role=status]')).toHaveText('Progres tersimpan');await context.setOffline(true);await page.getByRole('button',{name:'Terpandu',exact:true}).click();await expect(page.locator('.navigator-task-footer [role=status]')).toHaveText('Progres tersimpan');await context.setOffline(false);await page.reload();await page.getByRole('button',{name:'Lanjutkan dari sini',exact:true}).click();await expect(page.locator('.navigator-task-surface h2')).not.toHaveText('Pilihan penanganan');await page.getByRole('button',{name:'Buka rencana data',exact:true}).click();await expect(page.locator('.navigator-data-plan')).toContainText('Perlu dicari');
});
test('canonical change after checkpoint is reconciled on landing resume',async({page})=>{
 await importNav(page,setActiveComponents(demoProject(),[]));await orientNav(page);await page.getByRole('button',{name:'Tutup Navigator',exact:true}).click();await page.getByRole('button',{name:'Hujan & kondisi awal',exact:true}).click();await page.getByRole('spinbutton',{name:'Kedalaman hujan',exact:true}).fill('');await page.getByRole('button',{name:'Terapkan hujan & hitung ulang',exact:true}).click();await expect(page.getByRole('status',{name:'Tersimpan lokal',exact:true})).toBeVisible();await page.reload();await page.getByRole('button',{name:'Lanjutkan dari sini',exact:true}).click();await expect(page.locator('.navigator-task-surface h2')).toHaveText('Hujan yang diuji');
});

test.beforeEach(({page})=>watchNavErrors(page));
test.afterEach(({page})=>expectNoNavErrors(page));

test('portable backup resumes orientation after import as a separate project',async({page})=>{await importNav(page);await page.getByRole('button',{name:'Limpasan atap',exact:true}).click();await expect(page.locator('.navigator-task-footer [role=status]')).toHaveText('Progres tersimpan');await navBackup(page,'portable-progress');await page.goto('/tirta.html');await page.getByLabel('Buka berkas cadangan',{exact:true}).setInputFiles(`${navOut}/portable-progress.tirta.json`);await page.getByRole('button',{name:'Navigator TIRTA',exact:true}).click();await expect(page.locator('.navigator-task-surface h2')).toHaveText('Data apa yang sudah Anda punya?');});
