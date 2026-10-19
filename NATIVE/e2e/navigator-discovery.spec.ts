import {test,expect} from '@playwright/test';

test('Navigator is spotlighted once when a project workspace opens',async({page})=>{
  await page.goto('/tirta.html');
  await page.getByLabel('Nama proyek').fill('Navigator Spotlight QA');
  await page.getByRole('button',{name:'Buat proyek baru',exact:true}).click();
  await expect(page).toHaveURL(/view=studio/);
  const hint=page.locator('.navigator-discovery-hint');
  await expect(hint).toBeVisible();
  await expect(hint).toContainText('Bingung harus mulai dari mana?');
  await expect(hint).toContainText('Buka Navigator untuk melihat langkah berikutnya kapan pun.');
  const navigatorButton=page.getByRole('button',{name:'Navigator TIRTA',exact:true});
  await navigatorButton.click();
  await expect(page).toHaveURL(/view=navigator/);
  await expect(hint).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(/view=studio/);
  await expect(hint).toHaveCount(0);
});
