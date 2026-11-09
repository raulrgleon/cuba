import type { Feature, FeatureCollection, Polygon, MultiPolygon } from 'geojson';

export type Level = 'ADM1' | 'ADM2';
export type Boundary = Feature<Polygon | MultiPolygon, {name:string; level:Level}> & {id:string};
export type Boundaries = Omit<FeatureCollection<Polygon | MultiPolygon, Boundary['properties']>, 'features'> & {features:Boundary[]};
export type Indicator = {
  id:string; category:Theme; label:string; labelEn:string; unit:string; unitEn:string; source:string;
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

export const areaPalette=['#bfd8ef','#9ec5e9','#76aade','#4c88c3','#31649b'];
export const areaBreaks=[1000,3000,6000,9000];

export function areaKm2(feature:Boundary) {
  const radians=Math.PI/180;
  const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
  return polygons.reduce((total,polygon)=>total+polygon.reduce((area,ring,index)=>{
    let sum=0;
    for(let i=1;i<ring.length;i++){
      const [x1,y1]=ring[i-1], [x2,y2]=ring[i];
      sum+=(x2-x1)*radians*(Math.sin(y1*radians)+Math.sin(y2*radians));
    }
    return area+(index===0?1:-1)*Math.abs(sum)*6371**2/2;
  },0),0);
}

export function areaColor(feature:Boundary) {
  const area=areaKm2(feature);
  return areaPalette[areaBreaks.filter(limit=>area>=limit).length];
}

export const themes={
  people:{es:'Demografía',en:'Demographics',icon:'◉'},
  economy:{es:'Economía y turismo',en:'Economy and tourism',icon:'◫'},
  energy:{es:'Energía',en:'Energy',icon:'ϟ'},
  transport:{es:'Transporte',en:'Transport',icon:'✈'},
  health:{es:'Salud',en:'Health',icon:'✚'},
  education:{es:'Educación',en:'Education',icon:'▤'},
  connectivity:{es:'Conectividad',en:'Connectivity',icon:'◔'},
  environment:{es:'Medioambiente',en:'Environment',icon:'◇'},
} as const;
export type Theme=keyof typeof themes;
export type AirportCategory='scheduled'|'other'|'military'|'closed';
export type Airport={id:string;iata:string;name:string;town:string;province:string;category:AirportCategory;
  closed:boolean;coordinates:[number,number]|null;source:string};
export type Airports={retrieved:string;source:string;license:string;airports:Airport[]};

export type ProvincialPopulation={source:string;url:string;years:number[];totals:number[];territories:Record<string,number[]>};
export const populationBreaks=[400000,600000,800000,1000000];
export const placeKinds={
  road:{es:'Carreteras principales',en:'Major roads',color:'#d47832'},
  rail:{es:'Ferrocarriles',en:'Railways',color:'#6950a1'},
  station:{es:'Estaciones ferroviarias',en:'Railway stations',color:'#6950a1'},
  port:{es:'Terminales de ferry',en:'Ferry terminals',color:'#027796'},
  health:{es:'Hospitales y clínicas',en:'Hospitals and clinics',color:'#ba3f5d'},
  pharmacy:{es:'Farmacias',en:'Pharmacies',color:'#147b74'},
  school:{es:'Escuelas y centros docentes',en:'Schools and colleges',color:'#4073c0'},
  university:{es:'Universidades',en:'Universities',color:'#3453a5'},
  market:{es:'Mercados y supermercados',en:'Markets and supermarkets',color:'#976c16'},
  park:{es:'Parques',en:'Parks',color:'#357c49'},
  water:{es:'Embalses cartografiados',en:'Mapped reservoirs',color:'#178ca9'},
} as const;
export type PlaceKind=keyof typeof placeKinds;
export type Place=Feature<import('geojson').Point|import('geojson').LineString,{name:string;kind:PlaceKind}> & {id:string};
export type PlaceCollection={type:'FeatureCollection';features:Place[];metadata:{source:string;snapshot:string;license:string;counts:Partial<Record<PlaceKind,number>>}};

export function populationColor(value:number) {
  return areaPalette[populationBreaks.filter(limit=>value>=limit).length];
}
