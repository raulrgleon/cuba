'use client';

export type ProvincialReport={
  name:string;source:string;latest_outage_mw:number|null;latest_outage_time:string|null;
  latest_served_mw:number|null;latest_served_time:string|null;max_outage_mw:number|null;
  circuits_affected:number|null;service_hours_min:number|null;service_hours_max:number|null;source_posts:string[];
};
type NationalReport={
  date:string;morning_time:string|null;morning_available_mw:number|null;morning_demand_mw:number|null;
  morning_outage_mw:number|null;forecast_peak_mw:number|null;peak_deficit_mw:number|null;
  peak_available_mw:number|null;peak_demand_mw:number|null;max_outage_yesterday_mw:number|null;solar_mwh:number|null;source_url:string|null;
};
export type EnergyData={
  source:string;license:string;checked:string;nationalUpdated:string;regionalUpdated:string;
  national:NationalReport[];provinces:Record<string,Record<string,ProvincialReport>>;
};

export const energyLegend=[
  {color:'#a72b39',es:'Cortes reportados',en:'Reported outages'},
  {color:'#3570b1',es:'Servicio parcial reportado',en:'Reported service load'},
  {color:'#477b61',es:'Cero MW afectados en el parte',en:'Zero MW affected in report'},
  {color:'#88969f',es:'Sin dato concluyente',en:'No conclusive data'},
];

export function energyColor(row?:ProvincialReport) {
  if(!row)return energyLegend[3].color;
  if((row.latest_outage_mw??0)>0||(row.circuits_affected??0)>0)return energyLegend[0].color;
  if(row.latest_outage_mw===0)return energyLegend[2].color;
  if((row.latest_served_mw??0)>0)return energyLegend[1].color;
  return energyLegend[3].color;
}

type EnergyProps={
  data:EnergyData|null;date:string;onDate:(date:string)=>void;province:string;
  provinces:{key:string;name:string}[];onProvince:(key:string)=>void;language:'es'|'en';failed:boolean;onRetry:()=>void;
};

export function Electricity({data,date,onDate,province,provinces,onProvince,language,failed,onRetry}:EnergyProps){
  const es=language==='es';
  if(!data)return <p role="status">{failed
    ? <>{es?'No se pudo cargar la edición eléctrica.':'The electricity snapshot could not load.'} <button onClick={onRetry}>{es?'Reintentar':'Retry'}</button></>
    : es?'Cargando datos eléctricos…':'Loading electricity data…'}</p>;
  const dates=[...new Set([...Object.keys(data.provinces),...data.national.map(item=>item.date)])].sort().reverse();
  const selected=date||dates[0];
  const report=data.provinces[selected]?.[province];
  const national=data.national.find(item=>item.date===selected);
  const number=new Intl.NumberFormat(language);
  const show=(value:number|null|undefined,unit='MW')=>value===null||value===undefined?'—':number.format(value)+(unit?' '+unit:'');
  const when=(value:string)=>new Intl.DateTimeFormat(language,{timeZone:'America/Havana',dateStyle:'short',timeStyle:'short'}).format(new Date(value));
  const stale=Date.now()-Date.parse(data.regionalUpdated)>36*60*60*1000;
  const localStatus=energyLegend.find(item=>item.color===energyColor(report));
  return <div className="electricity-panel">
    <p className="muted">{es?'Los partes describen lo publicado a determinadas horas. Para saber si un domicilio tiene luz ahora hace falta confirmación local.':'Reports describe published conditions at specific times. A household’s current service requires local confirmation.'}</p>
    {(stale||failed)&&<p className="muted" role="status">{es?'Se muestra la última edición disponible. No se ha confirmado una edición provincial más reciente.':'Showing the last available edition. A newer provincial edition has not been confirmed.'}</p>}
    <div className="field"><label htmlFor="energy-date">{es?'Fecha del parte':'Report date'}</label>
      <select id="energy-date" value={selected} onChange={event=>onDate(event.target.value)}>{dates.map(item=><option key={item}>{item}</option>)}</select></div>
    <div className="field"><label htmlFor="energy-province">{es?'Provincia':'Province'}</label>
      <select id="energy-province" value={province} onChange={event=>onProvince(event.target.value)}>
        <option value="">{es?'Selecciona en el mapa':'Select on the map'}</option>
        {provinces.map(item=><option key={item.key} value={item.key}>{item.name}</option>)}
      </select></div>
    {province&&<section className="energy-card">
      <h3>{report?.name??provinces.find(item=>item.key===province)?.name}</h3>
      <p className="energy-badge"><i style={{background:localStatus?.color}}/>{localStatus?.[language]}</p>
      {report?<><dl>
        <dt>{es?'Última afectación publicada':'Latest published outage'}</dt><dd>{show(report.latest_outage_mw)}{report.latest_outage_time&&<small>{report.latest_outage_time} · Cuba</small>}</dd>
        <dt>{es?'Última carga atendida':'Latest supplied load'}</dt><dd>{show(report.latest_served_mw)}{report.latest_served_time&&<small>{report.latest_served_time} · Cuba</small>}</dd>
        <dt>{es?'Circuitos afectados':'Affected circuits'}</dt><dd>{show(report.circuits_affected,'')}</dd>
        <dt>{es?'Máximo del día anterior':'Previous day maximum'}</dt><dd>{show(report.max_outage_mw)}</dd>
        {(report.service_hours_min!==null||report.service_hours_max!==null)&&<>
          <dt>{es?'Horas con servicio reportadas':'Reported hours with service'}</dt>
          <dd>{show(report.service_hours_min,'h')} – {show(report.service_hours_max,'h')}</dd></>}
      </dl><p className="muted">{report.source}</p>
      {report.source_posts.slice(0,4).map((url,index)=><a className="source-chip" href={url} key={url} target="_blank" rel="noreferrer">{es?'Aviso':'Notice'} {index+1} ↗</a>)}</>
        :<p className="muted">{es?'No hay un parte provincial para esa fecha en esta fuente.':'This source has no provincial report for that date.'}</p>}
    </section>}
    <section className="energy-card">
      <h3>{es?'Sistema Eléctrico Nacional':'National power grid'}</h3>
      {national?<><p className="muted">{es?'Medición publicada':'Published measurement'} · {national.morning_time??'—'} · Cuba</p>
      <dl><dt>{es?'Disponibilidad':'Available supply'}</dt><dd>{show(national.morning_available_mw)}</dd>
      <dt>{es?'Demanda':'Demand'}</dt><dd>{show(national.morning_demand_mw)}</dd>
      <dt>{es?'Afectación':'Outage load'}</dt><dd>{show(national.morning_outage_mw)}</dd></dl>
      <p className="muted">{es?'Pronóstico para la hora pico':'Peak-hour forecast'}</p>
      <dl><dt>{es?'Disponibilidad prevista':'Forecast supply'}</dt><dd>{show(national.peak_available_mw)}</dd>
      <dt>{es?'Demanda prevista':'Forecast demand'}</dt><dd>{show(national.peak_demand_mw)}</dd>
      <dt>{es?'Afectación prevista':'Forecast outage load'}</dt><dd>{show(national.forecast_peak_mw)}</dd>
      <dt>{es?'Máxima afectación del día anterior':'Previous day peak outage'}</dt><dd>{show(national.max_outage_yesterday_mw)}</dd></dl>
      {national.source_url&&<a href={national.source_url} target="_blank" rel="noreferrer">{es?'Parte original de la UNE':'Original UNE report'} ↗</a>}</>
      :<p className="muted">{es?'Sin parte nacional para esta fecha.':'No national report for this date.'}</p>}
    </section>
    <details className="energy-card"><summary>{es?'Últimos partes del SEN':'Recent grid reports'}</summary>
      <div className="compare-table"><table><thead><tr><th>{es?'Fecha':'Date'}</th><th>{es?'Afectación de mañana':'Morning outage'}</th><th>{es?'Pronóstico pico':'Peak forecast'}</th></tr></thead>
      <tbody>{data.national.slice(-14).reverse().map(item=><tr key={item.date}><th><button onClick={()=>onDate(item.date)}>{item.date}</button></th><td>{show(item.morning_outage_mw)}</td><td>{show(item.forecast_peak_mw)}</td></tr>)}</tbody></table></div>
    </details>
    <p className="muted">{es?'Edición provincial':'Provincial edition'} · {when(data.regionalUpdated)} · Cuba</p>
    <p className="muted">{es?'Edición nacional':'National edition'} · {when(data.nationalUpdated)} · Cuba</p>
    <p className="muted">{es?'El Alambique, a partir de UNE y empresas eléctricas provinciales. Las cifras provinciales corresponden a horas y métodos distintos.':'El Alambique, based on UNE and provincial electricity companies. Provincial figures use different times and methods.'}</p>
    <a href={data.source} target="_blank" rel="noreferrer">{es?'Datos y metodología':'Data and methodology'} · {data.license} ↗</a>
  </div>;
}

const rightsSources=[
  {name:'ONU · Examen Periódico Universal',en:'UN · Universal Periodic Review',edition:'2023–2024',kind:'ONU',
    note:'Recomendaciones del cuarto ciclo y respuesta del Estado, con seguimiento del Alto Comisionado.',
    noteEn:'Fourth-cycle recommendations, the state response and follow-up from the High Commissioner.',
    url:'https://www.ohchr.org/sites/default/files/documents/hrbodies/upr/sessions/session44/upr-hc-letter-cuba-eng.pdf'},
  {name:'CIDH · Informe anual, capítulo Cuba',en:'IACHR · Annual report, Cuba chapter',edition:'2025',kind:'CIDH',
    note:'Documenta preocupaciones sobre expresión, reunión, asociación, integridad personal y acceso a derechos económicos y sociales.',
    noteEn:'Documents concerns about expression, assembly, association, personal integrity, and economic and social rights.',
    url:'https://scm.oas.org/pdfs/2026/CIDH/IA2025_4B_CUB_ES.pdf'},
  {name:'ONU · Comité para la Eliminación de la Discriminación Racial',en:'UN · Committee on the Elimination of Racial Discrimination',edition:'2026',kind:'ONU',
    note:'Observaciones y recomendaciones sobre la aplicación de la Convención en Cuba.',
    noteEn:'Observations and recommendations on Cuba’s implementation of the Convention.',
    url:'https://docstore.ohchr.org/SelfServices/FilesHandler.ashx?enc=Hz7frPuKjRTEa0oFPNARye9tEC69GGEg5B6hPBq5kSDdF1TCBo6PJiBQjDiwmPHZWAXyjKUrKUh5PFrWAqs2yIT3aOqvVa5949%2Boq34FwxA%3D'},
  {name:'Freedom House · Derechos políticos y libertades civiles',en:'Freedom House · Political rights and civil liberties',edition:'2026',kind:'Índice',
    note:'9 de 100 en Freedom in the World, una valoración nacional según la metodología de la organización.',
    noteEn:'9 out of 100 in Freedom in the World, a national assessment using the organization’s methodology.',
    url:'https://freedomhouse.org/country/cuba/freedom-world/2026'},
  {name:'RSF · Libertad de prensa',en:'RSF · Press freedom',edition:'2026',kind:'Índice',
    note:'Puesto 160 de 180 en el Índice Mundial de Libertad de Prensa.',
    noteEn:'Ranked 160 of 180 in the World Press Freedom Index.',
    url:'https://rsf.org/en/country/cuba'},
];

export function HumanRights({language}:{language:'es'|'en'}){
  const es=language==='es';
  return <div className="rights-panel">
    <p className="muted">{es?'Informes, recomendaciones e índices para Cuba. Los índices tienen escalas y metodologías distintas.':'Reports, recommendations and indices for Cuba. The indices use different scales and methods.'}</p>
    {rightsSources.map(item=><article key={item.url} className="energy-card">
      <p className="eyebrow">{item.kind==='Índice'&&!es?'Index':item.kind} · {item.edition}</p>
      <h3>{es?item.name:item.en}</h3><p className="muted">{es?item.note:item.noteEn}</p>
      <a href={item.url} target="_blank" rel="noreferrer">{es?'Leer la fuente':'Read the source'} ↗</a>
    </article>)}
    <p className="muted">{es?'Esta sección presenta información agregada. No recopila nombres de víctimas, denuncias ni ubicaciones personales.':'This section presents aggregate information. It does not collect victims’ names, complaints or personal locations.'}</p>
  </div>;
}
