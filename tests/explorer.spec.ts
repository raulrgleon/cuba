import {expect,test} from '@playwright/test';

test('explores the map and national series',async({page})=>{
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://tiles.openfreemap.org/**',route=>route.abort());
  await page.goto('/');
  await expect(page.locator('.map-overview, .map-canvas:not(.preparing)').first()).toBeVisible();
  await expect(page.locator('.map-canvas:not(.preparing)')).toBeVisible();
  await expect(page.getByText('Superficie aproximada · km²')).toBeVisible();
  await page.getByRole('checkbox',{name:'Superficie km²'}).uncheck();
  await expect(page.getByText('Superficie aproximada · km²')).toHaveCount(0);
  await page.getByRole('checkbox',{name:'Superficie km²'}).check();
  const search=page.getByRole('textbox',{name:'Buscar provincia o municipio'});
  await search.fill('La Habana');
  await page.getByRole('button',{name:'La Habana Provincias'}).click();
  await expect(page.getByRole('heading',{name:'La Habana'})).toBeVisible();
  await expect(page.getByText('Aún no hay observaciones publicadas', {exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Guardar territorio'}).click();
  await page.getByRole('button',{name:'Favoritos',exact:true}).click();
  await expect(page.getByRole('button',{name:'La Habana',exact:true})).toBeVisible();
  await page.locator('.drawer').getByRole('button',{name:'Cerrar'}).click();
  await search.fill('Marianao');
  await page.getByRole('button',{name:'Marianao Municipios'}).click();
  await expect(page.getByRole('heading',{name:'Marianao'})).toBeVisible();
  await expect(page.getByRole('checkbox',{name:'Municipios ADM2'})).toBeChecked();
  await page.locator('#year').selectOption('2000');
  await expect(page.locator('.metric')).toContainText('2000');
  await page.getByRole('button',{name:'Fuentes',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Catálogo de fuentes'})).toBeVisible();
  expect(errors).toEqual([]);
});

test('mobile navigation and language fit the viewport',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.route('https://tiles.openfreemap.org/**',route=>route.abort());
  await page.goto('/');
  await page.getByRole('button',{name:'Capas y herramientas'}).click();
  await expect(page.getByRole('checkbox',{name:'Municipios ADM2'})).toBeVisible();
  await expect(page.locator('.shell')).toHaveClass('shell light');
  await page.getByRole('button',{name:'Cambiar tema'}).click();
  await expect(page.locator('.shell')).toHaveClass('shell');
  await page.getByRole('button',{name:'Switch to English'}).click();
  await expect(page.getByRole('textbox',{name:'Search province or municipality'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
