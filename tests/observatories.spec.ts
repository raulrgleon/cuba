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

test('energy map distinguishes outages, restorations and expired notices',async({page})=>{
  await page.route('https://tiles.openfreemap.org/**',route=>route.abort());
  const checked=new Date().toISOString();
  const stale=new Date(Date.now()-7*3600_000).toISOString();
  const sources={'Empresa Eléctrica de La Habana':'https://t.me/EmpresaElectricaDeLaHabana/1'};
  const fixture=(circuit:string,state:'on'|'off',at:string)=>({province:'La Habana',municipality:'Marianao',circuit,state,at,sources});
  await page.route('**/data/power-live.json?*',route=>route.fulfill({json:{checked,windowHours:6,sources:[],
    reports:[fixture('A490','on',checked),fixture('S514','off',checked),fixture('OLD','off',stale)],
    circuitDirectory:[{id:'la habana::a9999',province:'La Habana',municipalities:['Marianao'],
      circuit:'A9999',name:'Circuito A9999',source:'Apagones La Habana',url:'https://apagoneshabana.lat/',
      lastNotice:{state:'off',at:stale,sources}}]}}));
  await page.goto('/');
  await page.getByRole('button',{name:'Energía',exact:true}).click();
  await expect(page.locator('.map-power-bulb.on')).toHaveCSS('animation-name','power-glow');
  await expect(page.locator('.map-power-bulb.off')).toHaveCount(1);
  await page.getByRole('button',{name:'La Habana · Con servicio según aviso (1)'}).click();
  await expect(page.getByRole('button',{name:'Marianao · Con servicio según aviso (1)'})).toBeVisible();
  await page.getByRole('button',{name:'Marianao · Con servicio según aviso (1)'}).click();
  await expect(page.locator('.power-filter')).toContainText('Marianao');
  await expect(page.locator('.power-list')).toContainText('A490');
  await expect(page.locator('.power-list')).toContainText('S514');
  await expect(page.locator('.power-list')).not.toContainText('OLD');
  await page.getByRole('textbox',{name:'Buscar circuito o municipio'}).fill('S514');
  await expect(page.locator('.power-list li')).toHaveCount(1);
  await page.getByRole('textbox',{name:'Buscar circuito o municipio'}).fill('A9999');
  await expect(page.locator('.power-list li')).toContainText('Sin confirmación reciente');
  await expect(page.locator('.power-list li')).toContainText('Último aviso registrado');
});
