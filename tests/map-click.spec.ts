import {expect,test} from '@playwright/test';

test('opens a provincial record by clicking its polygon',async({page})=>{
  await page.route('https://tiles.openfreemap.org/**',route=>route.abort());
  await page.goto('/');
  await expect(page.locator('.map-canvas:not(.preparing)')).toBeVisible();
  const marker=page.locator('.province-label').filter({hasText:'Camagüey'});
  await expect(marker).toBeVisible();
  const target=await marker.boundingBox();
  if(!target)throw new Error('Missing province position');
  await expect(async()=>{
    await page.mouse.click(target.x+target.width/2,target.y+target.height/2);
    await expect(page.getByRole('heading',{name:'Camagüey',exact:true})).toBeVisible({timeout:800});
  }).toPass({timeout:12_000});
  await expect(page.locator('.provincial-metric')).toContainText('653.203');
});
