import {test,expect,type Page} from '@playwright/test';

async function demo(page:Page){
  await page.goto('/production.html');
  await page.getByRole('button',{name:'Buka Contoh',exact:true}).click();
}
async function go(page:Page,label:string){
  const mobile=page.getByLabel('Ruang kerja',{exact:true});
  if(await mobile.isVisible()) await mobile.selectOption({label});
  else await page.locator('.app-rail nav').getByRole('button',{name:label,exact:true,includeHidden:true}).click();
}

test('mobile comparison selection visibly emphasizes the chosen series',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await demo(page); await go(page,'Bandingkan');
  const chips=page.locator('.comparison-top .candidate-legend button');
  expect(await chips.count()).toBeGreaterThanOrEqual(2);
  await chips.nth(1).click();
  await expect(chips.nth(1)).toHaveAttribute('aria-pressed','true');
  const active=page.locator('.comparison-top g[data-series-active="true"]');
  const muted=page.locator('.comparison-top g[data-series-active="false"]');
  await expect(active).toHaveCount(1);
  expect(await muted.count()).toBeGreaterThanOrEqual(1);
  const activeStroke=Number(await active.locator('path').first().getAttribute('stroke-width'));
  const mutedStroke=Number(await muted.locator('path').first().getAttribute('stroke-width'));
  expect(activeStroke).toBeGreaterThan(mutedStroke);
});

test('mobile Studio centers lower controls inside the same visual rhythm',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await demo(page);
  const bottom=await page.locator('.view-studio .map-bottomline').boundingBox();
  const zoom=await page.locator('.view-studio .zoom-controls').boundingBox();
  expect(bottom&&zoom).toBeTruthy();
  const topPad=zoom!.y-bottom!.y;
  const bottomPad=(bottom!.y+bottom!.height)-(zoom!.y+zoom!.height);
  expect(Math.abs(topPad-bottomPad)).toBeLessThanOrEqual(8);
  const boundary=await page.locator('[data-testid="parcel-boundary"]').boundingBox();
  const canvas=await page.locator('.view-studio .parcel-svg').boundingBox();
  expect(boundary&&canvas).toBeTruthy();
  const canvasTop=boundary!.y-canvas!.y;
  const canvasBottom=(canvas!.y+canvas!.height)-(boundary!.y+boundary!.height);
  console.log(`STUDIO_CANVAS_GAPS top=${canvasTop} bottom=${canvasBottom}`);
  expect(Math.abs(canvasTop-canvasBottom)).toBeLessThanOrEqual(18);
});

test('mobile plan action rows align their icons and text on one rail',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await demo(page); await go(page,'Bandingkan');
  await page.getByRole('button',{name:'Angka & pilihan',exact:true}).click();
  const choose=page.locator('.comparison-row.mobile-active .compare-actions .primary');
  await expect(choose).toBeVisible(); await choose.click();
  const rows=page.locator('.plan-action-strip .plan-action-item');
  await expect(rows).toHaveCount(3);
  const boxes=await rows.evaluateAll(es=>es.map(e=>{const b=e.getBoundingClientRect();const icon=e.querySelector('svg')!.getBoundingClientRect();const text=e.querySelector('span')!.getBoundingClientRect();return{x:b.x,width:b.width,iconX:icon.x,textX:text.x}}));
  expect(Math.max(...boxes.map(b=>b.x))-Math.min(...boxes.map(b=>b.x))).toBeLessThanOrEqual(1);
  expect(Math.max(...boxes.map(b=>b.width))-Math.min(...boxes.map(b=>b.width))).toBeLessThanOrEqual(1);
  expect(Math.max(...boxes.map(b=>b.iconX))-Math.min(...boxes.map(b=>b.iconX))).toBeLessThanOrEqual(1);
  expect(Math.max(...boxes.map(b=>b.textX))-Math.min(...boxes.map(b=>b.textX))).toBeLessThanOrEqual(1);
});


test('mobile workspace Navigator orb is geometrically centered in its border',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await demo(page);
  const button=page.locator('.app-rail.is-project-workspace .rail-bottom .assistant-entry');
  const circle=button.locator('.navigator-orb circle').first();
  const [b,c]=await Promise.all([button.boundingBox(),circle.boundingBox()]);
  expect(b&&c).toBeTruthy();
  expect(Math.abs((b!.x+b!.width/2)-(c!.x+c!.width/2))).toBeLessThanOrEqual(.75);
  expect(Math.abs((b!.y+b!.height/2)-(c!.y+c!.height/2))).toBeLessThanOrEqual(.75);
});

test('mobile Studio is compact by default and grows only when the map is zoomed',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await demo(page);
  const svg=page.locator('.view-studio .parcel-svg');
  const register=page.locator('.view-studio .zone-register');
  const before=await svg.boundingBox();
  const registerBefore=await register.evaluate(e=>e.getBoundingClientRect().top+scrollY);
  expect(before).toBeTruthy();
  expect(before!.height).toBeLessThanOrEqual(210);
  await page.getByRole('button',{name:'Perbesar sketsa',exact:true}).click();
  await page.waitForTimeout(220);
  const after=await svg.boundingBox();
  const registerAfter=await register.evaluate(e=>e.getBoundingClientRect().top+scrollY);
  expect(after).toBeTruthy();
  expect(after!.height).toBeGreaterThan(before!.height+35);
  expect(registerAfter).toBeGreaterThan(registerBefore+30);
});
