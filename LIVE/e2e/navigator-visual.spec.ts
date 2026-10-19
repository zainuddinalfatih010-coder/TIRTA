import {test,expect,type Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import {demoProject,setActiveComponents} from '../src/direction/productionBridge';
import {importNav,orientNav,navOut,watchNavErrors,expectNoNavErrors} from './navigator-helpers';
async function audit(page:Page,name:string){
 await expect(page.locator('.navigator-task-surface')).toHaveAttribute('aria-busy','false');await page.evaluate(()=>document.fonts.ready);await expect(page.locator('.notice-info,.notice-success')).toHaveCount(0);const metrics=await page.evaluate(()=>{
 const root=document.documentElement;const surface=document.querySelector('.navigator-task-surface')!.getBoundingClientRect();const icons=[...document.querySelectorAll('.navigator-parcel figcaption svg,.navigator-parcel-empty svg')].map(e=>e.getBoundingClientRect().width);
 return {width:innerWidth,scroll:root.scrollWidth,task:surface.toJSON(),icons};});
 expect(metrics.scroll).toBeLessThanOrEqual(metrics.width+1);expect(metrics.task.width).toBeGreaterThan(300);expect(metrics.task.right).toBeLessThanOrEqual(metrics.width);expect(metrics.icons.every(w=>w<=42)).toBe(true);await writeFile(`${navOut}/${name}.json`,JSON.stringify(metrics,null,2));await page.screenshot({path:`${navOut}/${name}.png`,fullPage:true});
}
test.beforeEach(async({page})=>{await mkdir(navOut,{recursive:true});watchNavErrors(page);});test.afterEach(({page})=>expectNoNavErrors(page));
for(const width of [1920,1440,1366,1280,1024,768,390])test(`Navigator real states at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});await importNav(page);await audit(page,`${width}-orientation`);await page.getByRole('button',{name:'Limpasan halaman',exact:true}).click();await audit(page,`${width}-knowledge`);await page.getByLabel('Perkiraan biaya',{exact:true}).check();await page.getByRole('button',{name:'Lanjutkan',exact:true}).click();await page.getByRole('button',{name:'Belum tahu, lihat pilihan',exact:true}).click();await audit(page,`${width}-task`);await page.getByRole('button',{name:'Buka rencana data',exact:true}).click();await audit(page,`${width}-data-plan`);if(width===390)expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
});
test('390 short viewport, keyboard focus and reduced motion',async({page})=>{
 await page.setViewportSize({width:390,height:500});await page.emulateMedia({reducedMotion:'reduce'});await importNav(page);await page.getByRole('button',{name:'Limpasan atap',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.locator('.navigator-task-surface h2')).toBeFocused();await expect(page.getByRole('checkbox',{name:'Kapasitas penanganan',exact:true})).toBeVisible();await page.getByRole('button',{name:'Belum punya data',exact:true}).scrollIntoViewIfNeeded();await page.getByRole('button',{name:'Belum punya data',exact:true}).click();await page.getByRole('button',{name:'Belum tahu, lihat pilihan',exact:true}).click();await audit(page,'390-short-reduced');expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations).toEqual([]);
});
test('ready selected plan stays user-owned in data plan',async({page})=>{
 const p=setActiveComponents(demoProject(),['tank']);const {snapshotPlan,planningFingerprint}=await import('../src/domain/planningEngine');p.selectedPlan={definition:snapshotPlan(p,['tank'],'explicit','Pilihan pengguna'),reviewedInputFingerprint:planningFingerprint(p),decisionNote:'Pilihan pengguna, fixture uji'};
 await importNav(page,p);await orientNav(page);await page.getByRole('button',{name:'Buka rencana data',exact:true}).click();await expect(page.getByRole('button',{name:'Buka rencana pilihan',exact:true})).toBeVisible();await audit(page,'selected-ready-desktop');await page.setViewportSize({width:390,height:844});await audit(page,'selected-ready-mobile');await page.getByRole('button',{name:'Buka rencana pilihan',exact:true}).click();await expect(page.getByRole('heading',{name:'Rencana pilihan Anda',exact:true})).toBeVisible();
});
