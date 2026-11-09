'use client';

import {useMemo,useState} from 'react';
import {normalize,type Airport,type AirportCategory,type Airports} from './data';

export const airportCategories={
  scheduled:{es:'Servicio comercial programado',en:'Scheduled commercial service'},
  other:{es:'Otros aeródromos y helipuertos',en:'Other airfields and heliports'},
  military:{es:'Uso militar documentado',en:'Documented military use'},
  closed:{es:'Cerrados o históricos',en:'Closed or historical'},
};

type AirportProps={data:Airports;language:'es'|'en';onSelect:(airport:Airport)=>void;initialProvince?:string};

export function AirportDirectory({data,language,onSelect,initialProvince}:AirportProps){
  const es=language==='es';
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState<AirportCategory|''>(initialProvince?'military':'');
  const [province,setProvince]=useState(initialProvince??'');
  const [limit,setLimit]=useState(40);
  const provinces=useMemo(()=>[...new Set(data.airports.map(item=>item.province).filter(Boolean))].sort((a,b)=>a.localeCompare(b,language)),[data,language]);
  const matches=data.airports.filter(item=>(!category||item.category===category)&&(!province||item.province===province)&&
    normalize([item.name,item.iata,item.id,item.town,item.province].join(' ')).includes(normalize(query)));
  return <div className="directory">
    <p className="muted">{es?'Inventario público de aeropuertos, aeródromos y helipuertos de Cuba. El servicio programado y el estado proceden de la edición consultada.':'Public inventory of airports, airfields and heliports in Cuba. Scheduled service and status reflect the source edition.'}</p>
    <div className="field"><label htmlFor="airport-search">{es?'Buscar por nombre, código o lugar':'Search by name, code or place'}</label>
      <input id="airport-search" type="search" value={query} onChange={event=>{setQuery(event.target.value);setLimit(40);}}/></div>
    <div className="directory-filters">
      <div className="field"><label htmlFor="airport-kind">{es?'Tipo':'Type'}</label>
        <select id="airport-kind" value={category} onChange={event=>{setCategory(event.target.value as AirportCategory|'');setLimit(40);}}>
          <option value="">{es?'Todos los tipos':'All types'}</option>
          {(Object.keys(airportCategories) as AirportCategory[]).map(key=><option key={key} value={key}>{airportCategories[key][language]}</option>)}
        </select></div>
      <div className="field"><label htmlFor="airport-province">{es?'Provincia':'Province'}</label>
        <select id="airport-province" value={province} onChange={event=>{setProvince(event.target.value);setLimit(40);}}>
          <option value="">{es?'Todas las provincias':'All provinces'}</option>
          {provinces.map(name=><option key={name}>{name}</option>)}
        </select></div>
    </div>
    <p className="muted" role="status">{matches.length} {es?'resultados':'results'} · {data.retrieved}</p>
    {matches.slice(0,limit).map(item=><article key={item.id}>
      <p className="eyebrow">{airportCategories[item.category][language]}</p>
      <h3>{item.name}</h3>
      <p>{[item.iata,item.town,item.province].filter(Boolean).join(' · ')}</p>
      {item.closed&&<p>{es?'Figura como cerrado en la fuente.':'Listed as closed in the source.'}</p>}
      {item.category==='military'&&<p>{es?'Referencia documental. Estado operativo actual sin verificar.':'Documentary reference. Current operational status unverified.'}</p>}
      {item.coordinates&&<button onClick={()=>onSelect(item)}>{es?'Ver en el mapa':'View on map'}</button>}
      <a href={item.source} target="_blank" rel="noreferrer">{es?'Fuente':'Source'} ↗</a>
    </article>)}
    {matches.length>limit&&<button onClick={()=>setLimit(limit+40)}>{es?'Mostrar más':'Show more'}</button>}
  </div>;
}

const publicOffices=[
  {name:'Miguel Díaz-Canel Bermúdez',institution:'Presidencia',institutionEn:'Presidency',
   role:'Presidente de la República y primer secretario del Partido Comunista de Cuba',
   roleEn:'President of the Republic and First Secretary of the Communist Party of Cuba',
   date:'2026-07-29',source:'Asamblea Nacional / Granma',
   url:'https://www.granma.cu/cuba/2026-07-29/declaracion-de-la-asamblea-nacional-del-poder-popular-29-07-2026-11-07-00'},
  {name:'Salvador Valdés Mesa',institution:'Presidencia',institutionEn:'Presidency',
   role:'Vicepresidente de la República',roleEn:'Vice President of the Republic',
   date:'2023-04-19',source:'Granma · Reelección',
   url:'https://www.granma.cu/cuba/2023-04-19/ratificado-miguel-diaz-canel-bermudez-como-presidente-de-la-republica-de-cuba'},
  {name:'Manuel Marrero Cruz',institution:'Consejo de Ministros',institutionEn:'Council of Ministers',
   role:'Primer ministro',roleEn:'Prime Minister',date:'2026-10-27',source:'Gaceta Oficial · copia en vLex',
   url:'https://cuba.vlex.com/vid/diario-oficial-republica-cuba-1138294778'},
  {name:'Esteban Lazo Hernández',institution:'Asamblea Nacional',institutionEn:'National Assembly',
   role:'Presidente de la Asamblea Nacional y del Consejo de Estado',
   roleEn:'President of the National Assembly and the Council of State',
   date:'2026-05-27',source:'Parlamento Cubano / Granma',
   url:'https://www.granma.cu/cuba/2026-05-27/ejerce-presidente-de-la-asamblea-nacional-del-poder-popular-iniciativa-de-diplomacia-parlamentaria-en-defensa-de-la-paz-y-la-soberania-del-pueblo-cubano'},
  {name:'Bruno Rodríguez Parrilla',institution:'Ministerios',institutionEn:'Ministries',
   role:'Ministro de Relaciones Exteriores',roleEn:'Minister of Foreign Affairs',
   date:'2026-11-06',source:'Declaraciones del ministro · Cubainformación',
   url:'https://www.cubainformacion.tv/cuba/20261106/125927/125927-antes-cambiara-la-politica-de-ee-uu-que-los-cubanos-nos-cansemos-de-defender-nuestra-soberania-bruno-rodriguez-en-entrevista-a-the-new-york-times'},
  {name:'Vicente de la O Levy',institution:'Ministerios',institutionEn:'Ministries',
   role:'Ministro de Energía y Minas',roleEn:'Minister of Energy and Mines',
   date:'2026-07-14',source:'Granma',
   url:'https://www.granma.cu/cuba/2026-07-14/ministro-de-energia-y-minas-informa-sobre-la-situacion-actual-del-sistema-electrico-nacional-14-07-2026-19-07-11'},
  {name:'Joaquín Alonso Vázquez',institution:'Ministerios',institutionEn:'Ministries',
   role:'Ministro de Economía y Planificación',roleEn:'Minister of Economy and Planning',
   date:'2026-05-09',source:'Granma',
   url:'https://www.granma.cu/cuba/2026-05-09/programa-economico-social-2026-donde-estan-todas-nuestras-grandes-metas-y-compromisos-09-05-2026-09-05-59'},
  {name:'Oscar Pérez-Oliva Fraga',institution:'Ministerios',institutionEn:'Ministries',
   role:'Vice primer ministro y ministro del Comercio Exterior y la Inversión Extranjera',
   roleEn:'Deputy Prime Minister and Minister of Foreign Trade and Investment',
   date:'2026-06-26',source:'Granma',
   url:'https://www.granma.cu/cuba/2026-06-26/actualizacion-del-programa-de-gobierno-fortalece-las-prioridades-economicas-y-sociales-del-pais'},
];

export function WhoIsWho({language}:{language:'es'|'en'}){
  const es=language==='es';
  const [query,setQuery]=useState('');
  const offices=publicOffices.filter(item=>normalize([item.name,item.role,item.roleEn,item.institution,item.institutionEn].join(' ')).includes(normalize(query)));
  return <div className="directory">
    <p className="muted">{es?'Directorio inicial de cargos públicos nacionales. Cada ficha indica la fecha de su fuente. Revisión editorial: 9 de noviembre de 2026.':'Initial directory of national public offices. Each entry shows its source date. Editorial review: November 9, 2026.'}</p>
    <div className="field"><label htmlFor="office-search">{es?'Buscar por persona, cargo o institución':'Search by person, office or institution'}</label>
      <input id="office-search" type="search" value={query} onChange={event=>setQuery(event.target.value)}/></div>
    {offices.length===0&&<p>{es?'Sin coincidencias':'No matches'}</p>}
    {offices.map(item=><article key={item.name}>
      <p className="eyebrow">{es?item.institution:item.institutionEn}</p>
      <h3>{item.name}</h3><p>{es?item.role:item.roleEn}</p>
      <a href={item.url} target="_blank" rel="noreferrer">{item.source} · {item.date} ↗</a>
    </article>)}
  </div>;
}
