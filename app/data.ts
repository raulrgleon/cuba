import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson';

export type Level = 'ADM1' | 'ADM2';
export type Boundary = Feature<Polygon | MultiPolygon, {name:string; level:Level}> & {id:string};
export type Boundaries = Omit<FeatureCollection<Polygon | MultiPolygon, Boundary['properties']>, 'features'> & {features:Boundary[]};
export type Indicator = {
  id:string; label:string; labelEn:string; unit:string; unitEn:string; source:string;
  url:string; license:string; updated:string; observations:{year:number; value:number}[];
};
export type Sources = {
  retrieved:string;
  boundaries:{id:Level; year:string; license:string; licenseUrl:string; url:string; download:string; provider:string}[];
};

export const bounds = [[-85.25, 19.58], [-74.00, 23.48]] as [[number,number],[number,number]];

export function extent(feature:Boundary): [[number,number],[number,number]] {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  const polygons = feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      for (const [x,y] of ring) {
        west = Math.min(x,west); east = Math.max(x,east);
        south = Math.min(y,south); north = Math.max(y,north);
      }
    }
  }
  return [[west,south],[east,north]];
}

export const normalize = (value:string) => value.normalize('NFD')
  .replace(/\p{Diacritic}/gu,'').toLowerCase().trim();

function oneEdit(a:string,b:string) {
  if (Math.abs(a.length-b.length)>1) return false;
  if (a.length>b.length) return oneEdit(b,a);
  let i=0,j=0,edits=0;
  while (i<a.length && j<b.length) {
    if (a[i]===b[j]) {i++;j++;continue;}
    if (++edits>1) return false;
    if (a.length===b.length) i++;
    j++;
  }
  return edits + b.length-j <= 1;
}

const localNames:Record<string,string> = {
  Havana:'La Habana', 'Isle of Youth':'Isla de la Juventud',
  'Pinar del Rio':'Pinar del Río', 'Ciego de Avila':'Ciego de Ávila', 'Sancti Spiritus':'Sancti Spíritus',
};

export function displayName(feature:Boundary) {
  const name=feature.properties.name;
  return localNames[name] ?? name;
}

export function searchFeatures(features:Boundary[], value:string) {
  const query = normalize(value);
  if (!query) return [];
  return features.map(feature => {
    const names=[normalize(displayName(feature)),normalize(feature.properties.name)];
    const rank=Math.min(...names.map(name=>name===query ? 0 : name.startsWith(query) ? 1 : name.includes(query) ? 2
      : query.length>=4 && name.split(/\s+/).some(word=>oneEdit(query,word)) ? 3 : 4));
    return {feature,rank};
  }).filter(row=>row.rank<4).sort((a,b)=>a.rank-b.rank).slice(0,9).map(row=>row.feature);
}
