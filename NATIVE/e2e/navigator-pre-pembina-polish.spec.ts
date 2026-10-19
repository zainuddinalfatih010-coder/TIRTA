import {test,expect} from '@playwright/test';
import {importNav,orientNav,navOut,watchNavErrors,expectNoNavErrors} from './navigator-helpers';

test('desktop Biopori guided question is compact and question-led',async({page})=>{
 watchNavErrors(page);
 await page.setViewportSize({width:1440,height:900});
 await importNav(page);
 await orientNav(page,'Biopori');
 await page.getByRole('button',{name:'Jelajahi penanganan',exact:true}).click();
 const composer=page.locator('.guided-composer');
 await expect(composer).toBeVisible();
 const capacityGroup=composer.locator('.guided-progress button').filter({hasText:'Kapasitas'}).first();
 await capacityGroup.click();
 await expect(composer.locator('.guided-task-surface h3')).toContainText('kapasitas');
 await expect(composer.locator('.guided-readiness-summary')).toBeVisible();
 const layout=await composer.locator('.guided-layout').boundingBox();
 const task=await composer.locator('.guided-task-surface').boundingBox();
 const status=await composer.locator('.guided-status').boundingBox();
 expect(task!.height).toBeLessThan(520);
 expect(status!.height).toBeLessThan(620);
 expect(layout!.height).toBeLessThan(680);
 await page.screenshot({path:`${navOut}/pre-pembina-biopori-question-1440.png`,fullPage:true});
 expectNoNavErrors(page);
});
