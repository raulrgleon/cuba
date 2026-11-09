import {expect,test} from '@playwright/test';

test('filters the airport catalog and finds a public office',async({page})=>{
  await page.route('https://tiles.openfreemap.org/**',route=>route.abort());
  await page.goto('/?directorio=aeropuertos');
  const airports=page.locator('.civic-drawer');
  await expect(airports.getByRole('heading',{name:'Catálogo de aeropuertos'})).toBeVisible();
  await airports.locator('#airport-kind').selectOption('military');
  await airports.locator('#airport-search').fill('San Antonio');
  await expect(airports.getByRole('heading',{name:/San Antonio de los Baños/})).toBeVisible();
  await expect(airports.getByRole('button',{name:'Ver en el mapa'})).toHaveCount(0);
  await airports.locator('#airport-kind').selectOption('scheduled');
  await airports.locator('#airport-search').fill('HAV');
  await expect(airports.getByRole('heading',{name:/José Martí/})).toBeVisible();
  await airports.getByRole('button',{name:'Ver en el mapa'}).click();
  await expect(page.locator('.insights').getByRole('heading',{name:/José Martí/})).toBeVisible();
  await page.getByRole('button',{name:/Quién es quién/}).click();
  const offices=page.locator('.civic-drawer');
  await offices.locator('#office-search').fill('Energía');
  await expect(offices.getByRole('heading',{name:'Vicente de la O Levy'})).toBeVisible();
  await expect(offices.getByRole('heading',{name:'Manuel Marrero Cruz'})).toHaveCount(0);
});
