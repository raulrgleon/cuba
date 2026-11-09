import {useState} from 'react';
import {displayName,normalize,type Boundary} from './data';

export type PowerReport={province:string;municipality:string;circuit:string;state:'on'|'off';at:string;source:string;url:string;sources:Record<string,string>};
export type PowerSnapshot={checked:string;windowHours:number;sources:{name:string;ok:boolean;records:number}[];reports:PowerReport[]};
export type PowerMarker={feature:Boundary;province:string;on:number;off:number};

const copy={
  es:{title:'Avisos por circuito',on:'Con servicio según aviso',off:'Sin servicio según aviso',
    note:'Cada bombillo representa circuitos con avisos recientes. Acércate para ver los municipios. Sin bombillo significa sin confirmación reciente.',
    missing:'Aún no hay avisos verificables en esta vista.',failed:'La actualización no está disponible. Se muestran los avisos aún vigentes.',
    loading:'Consultando avisos eléctricos…',checked:'Última consulta',window:'Ventana de avisos',all:'Ver todos los circuitos',
    search:'Buscar circuito o municipio',sources:'Fuentes consultadas',unavailable:'sin respuesta',additional:'Más fuentes y mapas',
    select:'Pulsa un bombillo para ver los circuitos y la hora de cada aviso.'},
  en:{title:'Circuit notices',on:'Service reported on',off:'Service reported off',
    note:'Bulbs represent circuits with recent notices. Zoom in to see municipalities. No bulb means no recent confirmation.',
    missing:'There are no verifiable notices in this view yet.',failed:'The refresh is unavailable. Notices still within the time window are shown.',
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
    if(!feature)continue;
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

export function LivePower({snapshot,reports,territory,language,failed,onClear}:{
  snapshot:PowerSnapshot|null;reports:PowerReport[];territory:Boundary|null;language:'es'|'en';failed:boolean;onClear:()=>void;
}){
  const [query,setQuery]=useState('');
  const t=copy[language];
  const filtered=reports.filter(row=>(!territory||normalize(territory.properties.level==='ADM1'?row.province:row.municipality)===normalize(displayName(territory)))
    &&normalize(row.circuit+' '+row.municipality+' '+row.province).includes(normalize(query)));
  const date=new Intl.DateTimeFormat(language==='es'?'es-CU':'en-US',{timeZone:'America/Havana',dateStyle:'medium',timeStyle:'short'});
  return <section className="power-live" aria-label={t.title}>
    <h3>{t.title}</h3>
    <div className="power-legend">{(['on','off'] as const).map(state=><span key={state}>
      <i className={'power-bulb '+state} dangerouslySetInnerHTML={{__html:bulbSvg}}/>{t[state]}</span>)}</div>
    <p className="muted">{t.note} {t.select}</p>
    {snapshot&&<p className="power-checked">{t.checked} {date.format(new Date(snapshot.checked))} (Cuba) · {t.window} {snapshot.windowHours} h</p>}
    {failed&&<p className="muted" role="status">{t.failed}</p>}
    {territory&&<div className="power-filter"><strong>{displayName(territory)}</strong><button type="button" onClick={onClear}>{t.all}</button></div>}
    {snapshot&&<><input className="power-search" aria-label={t.search} placeholder={t.search} value={query} onChange={event=>setQuery(event.target.value)}/>
      {filtered.length?<ul className="power-list">{filtered.map(row=><li key={row.province+':'+row.municipality+':'+row.circuit}>
        <i className={'power-bulb '+row.state} dangerouslySetInnerHTML={{__html:bulbSvg}}/>
        <div><strong>{row.circuit} · {row.municipality}</strong>
          <small>{t[row.state]} · {date.format(new Date(row.at))}</small>
          <small>{Object.entries(row.sources).map(([source,url])=><a key={source} href={url} target="_blank" rel="noreferrer">{source}</a>)}</small>
        </div>
      </li>)}</ul>:<p className="muted">{t.missing}</p>}</>}
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
