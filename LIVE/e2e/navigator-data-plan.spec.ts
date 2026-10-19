import {watchNavErrors,expectNoNavErrors} from './navigator-helpers';
import {snapshotPlan,planningFingerprint} from '../src/domain/planningEngine';
import {test,expect} from '@playwright/test';
import {demoProject,setActiveComponents} from '../src/direction/productionBridge';
import {importNav,orientNav,navOut} from './navigator-helpers';
import {mkdir} from 'node:fs/promises';
test.beforeEach(async()=>{await mkdir(navOut,{recursive:true});});
test('user with no data gets a useful data plan without fabricated zero',async({page})=>{
 await page.goto('/tirta.html');await page.getByPlaceholder('Nama lahan atau bangunan').fill('Belum tahu');await page.getByRole('button',{name:'Buat proyek baru',exact:true}).click();await orientNav(page);await page.getByRole('button',{name:'Belum tahu',exact:true}).click();await page.getByRole('button',{name:'Buka rencana data',exact:true}).click();await expect(page.locator('.navigator-data-plan')).toContainText('Belum dapat dihitung');await expect(page.locator('.navigator-data-plan')).toContainText('Yang perlu dilengkapi');await expect(page.locator('.navigator-data-plan')).not.toContainText('0 m³');await page.screenshot({path:navOut+'/data-plan-empty.png',fullPage:true});
});
test('Field mode groups observations at the same location and never claims unknown evidence',async({page})=>{
 const p=setActiveComponents(demoProject(),['tank']),c=p.components.find(x=>x.id==='tank')!;
 c.treatment={installationZoneId:'z2',sharedSourceMode:'unresolved',allocationNote:'',catchmentReviewed:true};const e=p.science!.interventions.tank!;e.condition='unknown';e.maintenance='';e.fieldVerified=false;e.verificationSource='';e.overflow={kind:'outside',note:'Deklarasi sintetis'};p.selectedPlan={definition:snapshotPlan(p,['tank'],'chosen','Tangki pilihan'),reviewedInputFingerprint:planningFingerprint(p),decisionNote:'Pilihan eksplisit pengguna dalam fixture'};
 await importNav(page,p);await orientNav(page);await page.getByRole('button',{name:'Lapangan',exact:true}).click();if(await page.getByRole('button',{name:'Atur aliran atap',exact:true}).isVisible())await page.getByRole('button',{name:'Belum tahu',exact:true}).click();await expect(page.locator('[data-task-kind=field-mission]')).toBeVisible();await expect(page.locator('.navigator-task-surface')).toContainText('Periksa lokasi ini');await page.screenshot({path:navOut+'/field-mission-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:navOut+'/field-mission-mobile.png',fullPage:true});await page.getByRole('button',{name:'Buka rencana data',exact:true}).click();await expect(page.locator('.navigator-data-plan')).toContainText('Pemeriksaan');
});
test('valid alternatives hand off to existing comparison without a hidden best',async({page})=>{
 await importNav(page,setActiveComponents(demoProject(),['tank','soak','garden']));await orientNav(page);await page.getByRole('button',{name:'Buka rencana data',exact:true}).click();await page.getByRole('button',{name:'Bandingkan pilihan yang siap',exact:true}).click();await expect(page.locator('.comparison-workbench')).toBeVisible();await expect(page.locator('.comparison-workbench')).not.toContainText('Terbaik otomatis');
});

test.beforeEach(({page})=>watchNavErrors(page));
test.afterEach(({page})=>expectNoNavErrors(page));

test('roof task grouping preserves missing coefficient beside one coherent roof action',async({page})=>{const p=setActiveComponents(demoProject(),[]),z=p.zones[0]!;Object.assign(p.parameters.find(v=>v.id===z.coefficient.id)!,{value:null,evidence:'UNKNOWN',source:''});z.coefficient.evidence='UNKNOWN';await importNav(page,p);await page.getByRole('button',{name:'Limpasan atap',exact:true}).click();await page.getByRole('button',{name:'Belum punya data',exact:true}).click();await page.getByRole('button',{name:'Belum tahu, lihat pilihan',exact:true}).click();await page.getByRole('button',{name:'Buka rencana data',exact:true}).click();const group=page.locator('.navigator-gap-group').filter({hasText:'Gedung belajar'});await group.locator('summary').click();await expect(group).toContainText('Patokan');await expect(group).toContainText('Atur aliran Gedung belajar');await expect(group.locator('li')).toHaveCount(2);});
