'use client';

import {useEffect,useMemo,useState} from 'react';
import MapView from './map';
import {displayName,searchFeatures,type Boundaries,type Boundary,type Indicator,type Level,type Sources} from './data';

type Dataset={provinces:Boundaries;municipalities:Boundaries;indicators:Indicator[];sources:Sources};

const label={
  es:{search:'Buscar provincia o municipio',map:'Explorador',sources:'Fuentes',favorite:'Favoritos',share:'Compartir vista',theme:'Cambiar tema',layers:'Capas del mapa',admin:'Divisiones administrativas',provinces:'Provincias',municipalities:'Municipios',overview:'Vista nacional',subtitle:'Observatorio geográfico',select:'Selecciona un territorio en el mapa o búscalo por nombre.',boundary:'Límites de referencia',note:'Las divisiones corresponden a la cartografía de 2017.',territory:'Territorio seleccionado',indicator:'Indicador',year:'Año de referencia',estimate:'Estimación nacional',trend:'Serie histórica',noLocal:'Aún no hay observaciones publicadas para este territorio. La serie de abajo corresponde a Cuba en conjunto.',reset:'Volver a Cuba',catalog:'Catálogo de fuentes',close:'Cerrar',load:'Cargando fuentes…',fail:'No se pudo cargar la edición de datos.',retry:'Reintentar',noMatches:'Sin coincidencias',noFavorites:'Guarda un territorio para encontrarlo aquí.',save:'Guardar territorio',remove:'Quitar de favoritos',copy:'Enlace copiado',copyError:'No se pudo copiar el enlace.',download:'Descargar GeoJSON',received:'Datos consultados',noData:'Sin dato en este año',historical:'Serie histórica nacional',national:'Cuba',sourceDate:'Actualización de la fuente',all:'Último dato disponible',menu:'Capas y herramientas'},
  en:{search:'Search province or municipality',map:'Explorer',sources:'Sources',favorite:'Favorites',share:'Share view',theme:'Change theme',layers:'Map layers',admin:'Administrative divisions',provinces:'Provinces',municipalities:'Municipalities',overview:'National view',subtitle:'Geographic observatory',select:'Select a territory on the map or search for its name.',boundary:'Reference boundaries',note:'The divisions are based on the 2017 boundary dataset.',territory:'Selected territory',indicator:'Indicator',year:'Reference year',estimate:'National estimate',trend:'Historical series',noLocal:'No observations are published for this territory yet. The series below covers Cuba as a whole.',reset:'Return to Cuba',catalog:'Source catalog',close:'Close',load:'Loading sources…',fail:'The data edition could not be loaded.',retry:'Retry',noMatches:'No matches',noFavorites:'Save a territory to find it here.',save:'Save territory',remove:'Remove favorite',copy:'Link copied',copyError:'Could not copy the link.',download:'Download GeoJSON',received:'Data retrieved',noData:'No observation for this year',historical:'National historical series',national:'Cuba',sourceDate:'Source updated',all:'Latest available',menu:'Layers and tools'},
};

const getData=async<T,>(name:string,signal:AbortSignal):Promise<T>=>{
  const response=await fetch('/data/'+name,{signal});
  if(!response.ok) throw new Error(name);
  return response.json();
};

function chartPoints(rows:Indicator['observations']) {
  const values=rows.map(row=>row.value);
  const min=Math.min(...values),max=Math.max(...values);
  const from=rows[0].year,to=rows[rows.length-1].year;
  return rows.map(row=>[10+260*(row.year-from)/(to-from||1),77-66*(row.value-min)/(max-min||1)]);
}

export default function Explorer() {
  const [data,setData]=useState<Dataset|null>(null);
  const [loadError,setLoadError]=useState(false);
  const [attempt,setAttempt]=useState(0);
  const [language,setLanguage]=useState<'es'|'en'>('es');
  const [light,setLight]=useState(false);
  const [levels,setLevels]=useState<Record<Level,boolean>>({ADM1:true,ADM2:false});
  const [selected,setSelected]=useState<Boundary|null>(null);
  const [reset,setReset]=useState(0);
  const [query,setQuery]=useState('');
  const [searchOpen,setSearchOpen]=useState(false);
  const [panel,setPanel]=useState<'sources'|'favorites'|null>(null);
  const [favorites,setFavorites]=useState<string[]>([]);
  const [indicatorId,setIndicatorId]=useState('SP.POP.TOTL');
  const [year,setYear]=useState('');
  const [notice,setNotice]=useState('');
  const [toolsOpen,setToolsOpen]=useState(false);
  const t=label[language];

  useEffect(()=>{
    const controller=new AbortController();
    Promise.all([
      getData<Boundaries>('adm1.geojson',controller.signal),
      getData<Boundaries>('adm2.geojson',controller.signal),
      getData<Indicator[]>('indicators.json',controller.signal),
      getData<Sources>('sources.json',controller.signal),
    ]).then(([provinces,municipalities,indicators,sources])=>{
      setData({provinces,municipalities,indicators,sources});
      const view=new URLSearchParams(location.search);
      const feature=[...provinces.features,...municipalities.features].find(item=>item.id===view.get('territorio'));
      if(feature) {
        setSelected(feature);
        if(feature.properties.level==='ADM2') setLevels({ADM1:true,ADM2:true});
      }
      if(indicators.some(item=>item.id===view.get('indicador'))) setIndicatorId(view.get('indicador')!);
      const date=view.get('anio');
      if(date&&/^\d{4}$/.test(date)) setYear(date);
    }).catch(()=>{if(!controller.signal.aborted)setLoadError(true);});
    return ()=>controller.abort();
  },[attempt]);

  useEffect(()=>{
    try {
      const saved=JSON.parse(localStorage.getItem('cubaos-favorites')||'[]');
      if(Array.isArray(saved)) setFavorites(saved.filter(id=>typeof id==='string'));
      setLight(localStorage.getItem('cubaos-theme')==='light');
      if(localStorage.getItem('cubaos-language')==='en') setLanguage('en');
    } catch {}
  },[]);

  useEffect(()=>{document.documentElement.lang=language;},[language]);

  const features=useMemo(()=>data?[...data.provinces.features,...data.municipalities.features]:[],[data]);
  const results=useMemo(()=>searchFeatures(features,query),[features,query]);
  const series=data?.indicators.find(item=>item.id===indicatorId);
  const observation=series?.observations.find(row=>row.year===Number(year))
    ?? (!year ? series?.observations.at(-1) : undefined);
  const points=series?chartPoints(series.observations):[];
  const displayedPoint=observation&&series?points[series.observations.indexOf(observation)]:null;
  const isSaved=selected&&favorites.includes(selected.id);

  function pick(feature:Boundary) {
    setSelected(feature);
    setLevels(current=>({...current,[feature.properties.level]:true}));
    setSearchOpen(false);
    setQuery('');
    setPanel(null);
  }

  function remember(key:string,value:string) {
    try {localStorage.setItem(key,value);} catch {}
  }

  function save() {
    if(!selected)return;
    const next=isSaved?favorites.filter(id=>id!==selected.id):[...favorites,selected.id];
    setFavorites(next);
    remember('cubaos-favorites',JSON.stringify(next));
  }

  async function share() {
    const url=new URL(location.pathname,location.origin);
    if(selected) url.searchParams.set('territorio',selected.id);
    if(year) url.searchParams.set('anio',year);
    url.searchParams.set('indicador',indicatorId);
    try {await navigator.clipboard.writeText(url.toString());setNotice(t.copy);}
    catch {setNotice(t.copyError);}
  }

  function resetMap() {setSelected(null);setReset(current=>current+1);}

  return <div className={light?'shell light':'shell'}>
    <header className="topbar">
      <a href="/" className="brand" aria-label="CubaOS">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/cubaos.svg" width="38" height="38" alt=""/>
        <span>Cuba<span>OS</span><small>{t.subtitle}</small></span>
      </a>
      <form className="search" onSubmit={event=>{event.preventDefault();if(results[0])pick(results[0]);}}
        onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setSearchOpen(false);}}>
        <label htmlFor="geo-search" className="sr-only">{t.search}</label>
        <span aria-hidden="true" className="search-icon">⌕</span>
        <input id="geo-search" placeholder={t.search} value={query}
          onFocus={()=>setSearchOpen(true)} onChange={event=>{setQuery(event.target.value);setSearchOpen(true);}}
          onKeyDown={event=>{if(event.key==='Escape')setSearchOpen(false);}} autoComplete="off"/>
        {query.trim()&&searchOpen&&<div className="search-results">
          {results.length?results.map(feature=><button type="button" key={feature.id} onClick={()=>pick(feature)}>
            <span>{displayName(feature)}</span><small>{feature.properties.level==='ADM1'?t.provinces:t.municipalities}</small>
          </button>):<p>{t.noMatches}</p>}
        </div>}
      </form>
      <nav className="top-actions" aria-label={t.menu}>
        <button onClick={()=>setPanel(panel==='sources'?null:'sources')}>{t.sources}</button>
        <button onClick={()=>setPanel(panel==='favorites'?null:'favorites')}>{t.favorite}</button>
        <button title={t.share} aria-label={t.share} onClick={share}>↗</button>
        <button title={t.theme} aria-label={t.theme} onClick={()=>{setLight(!light);remember('cubaos-theme',light?'dark':'light');}}>{light?'☾':'☀'}</button>
        <button aria-label={language==='es'?'Switch to English':'Cambiar a español'} onClick={()=>{const next=language==='es'?'en':'es';setLanguage(next);remember('cubaos-language',next);}}>{language==='es'?'EN':'ES'}</button>
      </nav>
    </header>
    <p className={notice?'notice':'sr-only'} role="status" onClick={()=>setNotice('')}>{notice}</p>
    <main className="workspace">
      <button className="mobile-tools" onClick={()=>setToolsOpen(!toolsOpen)} aria-expanded={toolsOpen}>{t.menu}</button>
      <aside className={toolsOpen?'rail tools-open':'rail'}>
        <div className="eyebrow"><i/>{t.map}</div>
        <h1>{t.layers}</h1>
        <p className="muted">{t.select}</p>
        <h2 className="group-title">{t.admin}</h2>
        {(['ADM1','ADM2'] as const).map(level=><label className="layer" key={level}>
          <span className={'layer-key '+level.toLowerCase()}/>
          <span>{level==='ADM1'?t.provinces:t.municipalities}<small>{level}</small></span>
          <input type="checkbox" checked={levels[level]} onChange={event=>setLevels({...levels,[level]:event.target.checked})}/>
        </label>)}
        <button className="secondary" onClick={resetMap}>⟲ {t.reset}</button>
        <div className="source-note"><span className="eyebrow">{t.boundary}</span><p>{t.note}</p></div>
      </aside>
      {data?<MapView provinces={data.provinces} municipalities={data.municipalities} levels={levels} selected={selected} reset={reset} onSelect={pick} language={language} light={light}/>
        :<section className="map-zone map-placeholder">{loadError?<div><p>{t.fail}</p><button onClick={()=>{setLoadError(false);setAttempt(attempt+1);}}>{t.retry}</button></div>:t.load}</section>}
      <aside className="insights">
        <p className="eyebrow"><i/>{selected?t.territory:t.overview}</p>
        <h2>{selected?displayName(selected):t.national}</h2>
        {selected&&<div className="territory-actions"><button onClick={save}>{isSaved?'★':'☆'} {isSaved?t.remove:t.save}</button><button onClick={resetMap}>{t.reset}</button></div>}
        {selected&&<p className="muted">{t.noLocal}</p>}
        <div className="divider"/>
        {series&&<section className="indicator">
          <div className="field"><label htmlFor="indicator">{t.indicator}</label>
          <select id="indicator" value={indicatorId} onChange={event=>{setIndicatorId(event.target.value);setYear('');}}>
            {data?.indicators.map(item=><option value={item.id} key={item.id}>{language==='es'?item.label:item.labelEn}</option>)}
          </select></div>
          <div className="field"><label htmlFor="year">{t.year}</label>
          <select id="year" value={year} onChange={event=>setYear(event.target.value)}>
            <option value="">{t.all}</option>
            {year&&!series.observations.some(row=>row.year===Number(year))&&<option value={year}>{year}</option>}
            {[...series.observations].reverse().map(row=><option key={row.year}>{row.year}</option>)}
          </select></div>
          <div className="metric">
            <p className="eyebrow">{t.estimate}{observation?' · '+observation.year:''}</p>
            <strong>{observation?new Intl.NumberFormat(language,{maximumFractionDigits:2}).format(observation.value):'—'}</strong>
            <span>{observation?(language==='es'?series.unit:series.unitEn):t.noData}</span>
          </div>
          <h3>{t.historical}</h3>
          <svg className="trend" viewBox="0 0 280 88" role="img" aria-label={`${t.trend} · ${language==='es'?series.label:series.labelEn}`}>
            <path d="M10 23H270M10 51H270M10 78H270" className="chart-grid"/>
            <polyline points={points.map(point=>point.join(',')).join(' ')} className="chart-line"/>
            {displayedPoint&&<circle cx={displayedPoint[0]} cy={displayedPoint[1]} r="4" className="chart-dot"/>}
          </svg>
          <div className="chart-years"><span>{series.observations[0].year}</span><span>{series.observations.at(-1)?.year}</span></div>
          <p className="attribution"><a href={series.url} target="_blank" rel="noreferrer">World Development Indicators ↗</a><br/>{t.sourceDate} · {series.updated}</p>
        </section>}
      </aside>
    </main>
    <footer className="footer"><span>© OpenStreetMap contributors · geoBoundaries · ODbL 1.0</span><span>{data&&`${t.received} · ${data.sources.retrieved}`}</span></footer>
    {panel&&<section className="drawer" aria-label={panel==='sources'?t.catalog:t.favorite} onKeyDown={event=>{if(event.key==='Escape')setPanel(null);}}>
      <div className="drawer-title"><h2>{panel==='sources'?t.catalog:t.favorite}</h2><button onClick={()=>setPanel(null)}>{t.close}</button></div>
      {panel==='sources'?<>
        {data?.sources.boundaries.map(item=><article key={item.id}>
          <h3>{item.id==='ADM1'?t.provinces:t.municipalities} · {item.year}</h3>
          <p>{item.provider} · <a href={item.licenseUrl}>{item.license}</a></p>
          <a href={item.url}>geoBoundaries ↗</a> · <a href={'/data/'+item.id.toLowerCase()+'.geojson'} download>{t.download}</a>
        </article>)}
        {data?.indicators.map(item=><article key={item.id}><h3>{language==='es'?item.label:item.labelEn}</h3><p>World Bank WDI · {item.license} · {item.updated}</p><a href={item.url}>{t.sources} ↗</a></article>)}
      </>:favorites.length?features.filter(feature=>favorites.includes(feature.id)).map(feature=><button className="favorite" key={feature.id} onClick={()=>pick(feature)}>{displayName(feature)}</button>):<p>{t.noFavorites}</p>}
    </section>}
  </div>;
}
