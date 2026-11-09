import {defineConfig} from '@playwright/test';

const port=Number(process.env.CUBAOS_TEST_PORT)||18873;
const baseURL=`http://127.0.0.1:${port}`;

export default defineConfig({
  testDir:'./tests',
  timeout:60_000,
  expect:{timeout:20_000},
  use:{
    baseURL,
    launchOptions:{
      executablePath:process.env.CUBAOS_CHROMIUM,
      args:['--enable-unsafe-swiftshader','--use-angle=swiftshader'],
    },
  },
  webServer:{
    command:`python3 scripts/serve.py --port ${port}`,
    url:baseURL,
    reuseExistingServer:false,
  },
});
