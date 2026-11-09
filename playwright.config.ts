import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir:'./tests',
  timeout:60_000,
  expect:{timeout:20_000},
  use:{
    baseURL:'http://127.0.0.1:18873',
    launchOptions:{
      executablePath:process.env.CUBAOS_CHROMIUM,
      args:['--enable-unsafe-swiftshader','--use-angle=swiftshader'],
    },
  },
  webServer:{
    command:'python3 scripts/serve.py --port 18873',
    url:'http://127.0.0.1:18873',
    reuseExistingServer:false,
  },
});
