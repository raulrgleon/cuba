import {useState} from 'react';
import {displayName,normalize,type Boundary} from './data';

type PowerNotice={state:'on'|'off'|'partial';at:string;sources:Record<string,string>};
export type PowerReport=PowerNotice&{province:string;municipality:string;circuit:string;source:string;url:string};
type CircuitEntry={id:string;province:string;municipalities:string[];circuit:string;name:string;source:string;url:string;lastNotice?:PowerNotice};
export type PowerSnapshot={checked:string;windowHours:number;sources:{name:string;ok:boolean;records:number}[];reports:PowerReport[];circuitDirectory?:CircuitEntry[]};
export type PowerMarker={feature:Boundary;province:string;on:number;off:number};

const copy={
  es:{title:'Avisos por circuito',on:'Con servicio según aviso',off:'Sin servicio según aviso',
    note:'Cada bombillo representa circuitos con avisos recientes. Acércate para ver los municipios. Sin bombillo significa sin confirmación reciente.',
    missing:'No se encontraron circuitos.',catalog:'Catálogo de circuitos',unknown:'Sin confirmación reciente',partial:'Afectación parcial según aviso',last:'Último aviso registrado',inventory:'Circuitos identificados',more:'Mostrar más',province:'Provincia',allProvinces:'Todas las provincias',noMunicipality:'Municipio por confirmar',failed:'La actualización no está disponible. Se muestran los avisos aún vigentes.',
    loading:'Consultando avisos eléctricos…',checked:'Última consulta',window:'Ventana de avisos',all:'Ver todos los circuitos',
    search:'Buscar circuito o municipio',sources:'Fuentes consultadas',unavailable:'sin respuesta',additional:'Más fuentes y mapas',
    select:'Pulsa un bombillo para ver los circuitos y la hora de cada aviso.'},
  en:{title:'Circuit notices',on:'Service reported on',off:'Service reported off',
    note:'Bulbs represent circuits with recent notices. Zoom in to see municipalities. No bulb means no recent confirmation.',
    missing:'No circuits match.',catalog:'Circuit directory',unknown:'No recent confirmation',partial:'Partial outage reported',last:'Last notice on record',inventory:'Identified circuits',more:'Show more',province:'Province',allProvinces:'All provinces',noMunicipality:'Municipality unconfirmed',failed:'The refresh is unavailable. Notices still within the time window are shown.',
    loading:'Checking power notices…',checked:'Last checked',window:'Notice window',all:'View all circuits',
    search:'Find a circuit or municipality',sources:'Sources checked',unavailable:'unavailable',additional:'More sources and maps',
    select:'Select a bulb to see the circuits and timestamps.'},
};

export function powerMarkers(boundaries:Boundary[],reports:PowerReport[]):PowerMarker[]{
  const features=new Map(boundaries.map(feature=>[normalize(displayName(feature)),feature]));
  const markers=new Map<string,PowerMarker>();
  for(const report of reports){
    const name=normalize(report.municipality);
    const feature=features.get(name);
    if(!feature||report.state==='partial')continue;
    const marker=markers.get(name)??{feature,province:report.province,on:0,off:0};
    marker[report.state]++;
    markers.set(name,marker);
  }
  return [...markers.values()];
}

export const bulbSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path class="bulb-rays" d="M12 1v2M4 5l2 2m12 0 2-2M2 12h2m16 0h2"/><path d="M9 18c0-2-3-3-3-6a6 6 0 0 1 12 0c0 3-3 4-3 6H9zm0 3h6m-4 2h2"/><path class="bulb-slash" d="M3 3l18 18"/></svg>';

export function powerMarkerTitle(language:'es'|'en',state:'on'|'off',count:number,feature:Boundary){
  return `${displayName(feature)} · ${copy[language][state]} (${count})`;
}

function circuitId(province:string,municipality:string,circuit:string){
  const code=normalize(circuit);
  const key=/^[a-z]{0,5}[ -]*\d{1,6}[a-z]?$/.test(code)?code.replace(/[ -]/g,''):code;
  return `${normalize(province)}:${province==='La Habana'?'':normalize(municipality)}:${key}`;
}

export function LivePower({snapshot,reports,territory,language,failed,onClear}:{
  snapshot:PowerSnapshot|null;reports:PowerReport[];territory:Boundary|null;language:'es'|'en';failed:boolean;onClear:()=>void;
}){
  const [query,setQuery]=useState('');
  const [province,setProvince]=useState('');
  const [limit,setLimit]=useState(30);
  const t=copy[language];
  const live=new Map<string,PowerReport>();
  const entries=new Map((snapshot?.circuitDirectory??[]).map(row=>[row.id,row]));
  for(const row of reports){
    const id=circuitId(row.province,row.municipality,row.circuit);
    const existing=entries.get(id);
    const municipalities=existing?.municipalities??[];
    entries.set(id,{...(existing??{id,province:row.province,circuit:row.circuit,name:row.circuit,source:row.source,url:row.url}),
      municipalities:[...new Set([...municipalities,row.municipality])]});
    if(!live.has(id))live.set(id,row);
  }
  const directory=[...entries.values()];
  const provinces=[...new Set(directory.map(row=>row.province))].sort((a,b)=>a.localeCompare(b,language));
  const area=territory?normalize(displayName(territory)):'';
  const search=normalize(query);
  const words=search.split(/\s+/).filter(Boolean);
  const codeMatches=(row:CircuitEntry)=>!!search&&normalize(row.circuit).replace(/[ -]/g,'')===search.replace(/[ -]/g,'');
  const filtered=directory.filter(row=>{
    if(territory){
      if(territory.properties.level==='ADM1'&&normalize(row.province)!==area)return false;
      if(territory.properties.level==='ADM2'&&!row.municipalities.some(name=>normalize(name)===area))return false;
    }else if(province&&row.province!==province)return false;
    const haystack=normalize([row.circuit,row.name,row.province,...row.municipalities].join(' '));
    return codeMatches(row)||words.every(word=>haystack.includes(word));
  }).sort((a,b)=>{
    return Number(codeMatches(b))-Number(codeMatches(a))||Number(live.has(b.id))-Number(live.has(a.id))||a.circuit.localeCompare(b.circuit,language,{numeric:true});
  });
  const date=new Intl.DateTimeFormat(language==='es'?'es-CU':'en-US',{timeZone:'America/Havana',dateStyle:'medium',timeStyle:'short'});
  return <section className="power-live" aria-label={t.catalog}>
    <h3>{t.title}</h3>
    <div className="power-legend">{(['on','off'] as const).map(state=><span key={state}>
      <i className={'power-bulb '+state} dangerouslySetInnerHTML={{__html:bulbSvg}}/>{t[state]}</span>)}</div>
    <p className="muted">{t.note} {t.select}</p>
    {snapshot&&<p className="power-checked">{t.checked} {date.format(new Date(snapshot.checked))} (Cuba) · {t.window} {snapshot.windowHours} h</p>}
    {failed&&<p className="muted" role="status">{t.failed}</p>}
    <h3>{t.catalog}</h3>
    {territory&&<div className="power-filter"><strong>{displayName(territory)}</strong><button type="button" onClick={()=>{setProvince('');setLimit(30);onClear();}}>{t.all}</button></div>}
    {snapshot&&<>
      {!territory&&<select className="power-search" aria-label={t.province} value={province} onChange={event=>{setProvince(event.target.value);setLimit(30);}}>
        <option value="">{t.allProvinces}</option>
        {provinces.map(name=><option key={name}>{name}</option>)}
      </select>}
      <input className="power-search" aria-label={t.search} placeholder={t.search} value={query} onChange={event=>{setQuery(event.target.value);setLimit(30);}}/>
      <p className="power-count muted">{t.inventory} · {filtered.length}</p>
      {filtered.length?<ul className="power-list">{filtered.slice(0,limit).map(row=>{
        const recent=live.get(row.id);
        const notice=recent??row.lastNotice;
        return <li key={row.id}>
          <i className={'power-bulb '+(recent?.state??'unknown')} dangerouslySetInnerHTML={{__html:bulbSvg}}/>
          <div><strong>{row.circuit} · {row.municipalities.join(', ')||t.noMunicipality}</strong>
            <small>{row.province}{row.name!==row.circuit?' · '+row.name:''}</small>
            <small>{recent?t[recent.state]:t.unknown}</small>
            {notice&&<small>{!recent?`${t.last} · ${t[notice.state]} · `:''}{date.format(new Date(notice.at))}</small>}
            <small>{Object.entries(notice?.sources??{[row.source]:row.url}).map(([source,url])=><a key={source} href={url} target="_blank" rel="noreferrer">{source}</a>)}</small>
          </div>
        </li>;
      })}</ul>:<p className="muted">{t.missing}</p>}
      {filtered.length>limit&&<button type="button" onClick={()=>setLimit(limit+30)}>{t.more}</button>}
    </>}
    {!snapshot&&!failed&&<p className="muted">{t.loading}</p>}
    <details className="power-sources"><summary>{t.sources}</summary>
      {snapshot&&<ul>{snapshot.sources.map(source=><li key={source.name}>{source.name}{source.ok?'':` · ${t.unavailable}`}</li>)}</ul>}
      <strong>{t.additional}</strong>
      <ul><li><a href="https://cubaverso.com/apagones-cuba-hoy" target="_blank" rel="noreferrer">Cubaverso</a></li>
        <li><a href="https://circuitos.masvoces.net/" target="_blank" rel="noreferrer">elTOQUE · Circuitos</a></li>
        <li><a href="https://www.cibercuba.com/apagones/mapa/" target="_blank" rel="noreferrer">CiberCuba · {language==='es'?'Mapa':'Map'}</a></li>
        <li><a href="https://cubaaltanto.org/" target="_blank" rel="noreferrer">Cuba al Tanto</a></li></ul>
    </details>
  </section>;
}
