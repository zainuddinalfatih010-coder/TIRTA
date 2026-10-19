import {expect,type Page} from '@playwright/test';
import {demoProject,setActiveComponents} from '../src/direction/productionBridge';
import {projectBackup} from '../src/persistence/portable';
import type {ProjectV2} from '../src/domain/projectV2';
import {readFile,copyFile} from 'node:fs/promises';
export const navOut=process.env.TIRTA_NAV_EVIDENCE??'E:/CodexStore/home/audits/tirta-pre-pembina-2026-10-10/browser-evidence';
export async function importNav(page:Page,p:ProjectV2=setActiveComponents(demoProject(),[])){
 await page.goto('/tirta.html');await page.getByLabel('Buka berkas cadangan',{exact:true}).setInputFiles({name:'navigator.tirta.json',mimeType:'application/json',buffer:Buffer.from(projectBackup(p))});await expect(page.getByText('Cadangan dibuka sebagai proyek terpisah.',{exact:true})).toBeVisible();await expect(page.locator('.view-studio')).toBeVisible();if(!await page.getByRole('button',{name:'Navigator TIRTA',exact:true}).isVisible())await page.evaluate(()=>{history.pushState(null,'','?view=project');dispatchEvent(new PopStateEvent('popstate'));});await page.getByRole('button',{name:'Navigator TIRTA',exact:true}).click();await expect(page.getByRole('heading',{name:'Apa yang ingin Anda tangani?'})).toBeVisible();
}
export async function orientNav(page:Page,method='Belum tahu, lihat pilihan'){
 await page.getByRole('button',{name:'Lihat pilihan',exact:true}).click();await page.getByRole('button',{name:'Belum punya data',exact:true}).click();await page.getByRole('button',{name:method,exact:true}).click();if(method!=='Belum tahu, lihat pilihan')await page.getByRole('button',{name:'Belum ada prioritas',exact:true}).click();await expect(page.locator('.navigator-task-surface')).toHaveAttribute('aria-busy','false');
}
export async function navBackup(page:Page,name:string):Promise<ProjectV2>{
 if(await page.getByRole('button',{name:'Tutup Navigator',exact:true}).isVisible())await page.getByRole('button',{name:'Tutup Navigator',exact:true}).click();
 if(!await page.locator('.project-actions > summary').isVisible())await page.evaluate(()=>{history.pushState(null,'','?view=project');dispatchEvent(new PopStateEvent('popstate'));});
 const menu=page.locator('.project-actions');if(!await menu.getAttribute('open'))await menu.locator('summary').click();await menu.getByRole('button',{name:'Laporan proyek',exact:true}).click();const d=page.getByRole('dialog');const [dl]=await Promise.all([page.waitForEvent('download'),d.getByRole('button',{name:'Cadangan proyek',exact:true}).click()]);await copyFile((await dl.path())!,`${navOut}/${name}.tirta.json`);const p=JSON.parse(await readFile(`${navOut}/${name}.tirta.json`,'utf8')).project;await d.getByRole('button',{name:'Tutup',exact:true}).click();return p;
}

const errors=new WeakMap<Page,string[]>();
export function watchNavErrors(page:Page){const log:string[]=[];errors.set(page,log);page.on('pageerror',e=>log.push(e.message));page.on('console',m=>{if(m.type()==='error')log.push(m.text());});}
export function expectNoNavErrors(page:Page){expect(errors.get(page)).toEqual([]);}
