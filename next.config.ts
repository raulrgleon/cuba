import {copyFileSync,mkdirSync} from 'node:fs';
import type { NextConfig } from 'next';

const worker='node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs';
mkdirSync('public/vendor',{recursive:true});
copyFileSync(worker,'public/vendor/maplibre-worker.mjs');

const config: NextConfig = {output:'export', trailingSlash:true, devIndicators:false};
export default config;
