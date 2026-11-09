import {copyFileSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import type { NextConfig } from 'next';

const worker='node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs';
mkdirSync('public/vendor',{recursive:true});
copyFileSync(worker,'public/vendor/maplibre-worker.mjs');

writeFileSync('public/data/places.geojson.gz',gzipSync(readFileSync('public/data/places.geojson')));

const config: NextConfig = {output:'export', trailingSlash:true, devIndicators:false};
export default config;
