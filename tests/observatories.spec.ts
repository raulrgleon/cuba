import {expect,test} from '@playwright/test';

test('shows dated electricity data and a sourced human-rights section',async({page})=>{
  await page.route('https://tiles.openfreemap.org/**',route=>route.abort());
  await page.goto('/');
  await page.getByRole('button',{name:/Observatorio eléctrico/}).click();
  const electricity=page.locator('.energy-insights');
  await expect(electricity.getByText('Sistema Eléctrico Nacional')).toBeVisible();
  await expect(page.locator('.energy-legend')).toContainText('Cortes reportados');
  await electricity.locator('#energy-date').selectOption('2026-11-09');
  await electricity.locator('#energy-province').selectOption('villa-clara');
  await expect(electricity).toContainText('Empresa Eléctrica de Villa Clara');
  await expect(electricity).toContainText('172 MW');
  await electricity.locator('#energy-province').selectOption('pinar-del-rio');
  await expect(electricity).toContainText('Sin dato concluyente');
  await expect(electricity).toContainText('No hay un parte provincial');
  await page.getByRole('button',{name:/Derechos humanos/}).click();
  await expect(page.locator('.rights-drawer').getByText('9 de 100', {exact:false})).toBeVisible();
  await expect(page.locator('.rights-drawer').getByText('Puesto 160 de 180',{exact:false})).toBeVisible();
});
