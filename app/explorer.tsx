'use client';

import {useEffect,useMemo,useState} from 'react';
import MapView from './map';
import {LivePower,powerMarkers,type PowerSnapshot} from './power-live';
import {Electricity,HumanRights,energyColor,type EnergyData} from './observatories';
import {AirportDirectory,WhoIsWho,airportCategories} from './directories';
import {areaKm2,displayName,searchFeatures,normalize,themes,placeKinds,type Place,type PlaceKind,type PlaceCollection,type ProvincialPopulation,type Airport,type Airports,type Theme,type Boundaries,type Boundary,type Indicator,type Level,type Sources} from './data';

type Dataset={provinces:Boundaries;municipalities:Boundaries;indicators:Indicator[];sources:Sources;airports:Airports|null};

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
  const [light,setLight]=useState(true);
  const [mapStyle,setMapStyle]=useState<'positron'|'liberty'|'regional'>('positron');
  const [areas,setAreas]=useState(false);
  const [populationVisible,setPopulationVisible]=useState(true);
  const [population,setPopulation]=useState<ProvincialPopulation|null>(null);
  const [populationYear,setPopulationYear]=useState(2024);
  const [places,setPlaces]=useState<PlaceCollection|null>(null);
  const [placeLayers,setPlaceLayers]=useState<PlaceKind[]>([]);
  const [placeLoading,setPlaceLoading]=useState(false);
  const [placeError,setPlaceError]=useState(false);
  const [place,setPlace]=useState<Place|null>(null);
  const [compare,setCompare]=useState<string[]>([]);
  const [comparisonOpen,setComparisonOpen]=useState(false);
  const [showInsights,setShowInsights]=useState(false);
  const [levels,setLevels]=useState<Record<Level,boolean>>({ADM1:true,ADM2:false});
  const [selected,setSelected]=useState<Boundary|null>(null);
  const [reset,setReset]=useState(0);
  const [query,setQuery]=useState('');
  const [searchOpen,setSearchOpen]=useState(false);
  const [panel,setPanel]=useState<'sources'|'favorites'|null>(null);
  const [favorites,setFavorites]=useState<string[]>([]);
  const [energyOpen,setEnergyOpen]=useState(false);
  const [directory,setDirectory]=useState<'airports'|'offices'|null>(null);
  const [militaryLayer,setMilitaryLayer]=useState(false);
  const [airportProvince,setAirportProvince]=useState('');
  const [rightsOpen,setRightsOpen]=useState(false);
  const [energy,setEnergy]=useState<EnergyData|null>(null);
  const [power,setPower]=useState<PowerSnapshot|null>(null);
  const [powerFailed,setPowerFailed]=useState(false);
  const [powerNow,setPowerNow]=useState(0);
  const [energyDate,setEnergyDate]=useState('');
  const [energyError,setEnergyError]=useState(false);
  const [energyRetry,setEnergyRetry]=useState(0);
  const [theme,setTheme]=useState<Theme>('people');
  const [airportLayer,setAirportLayer]=useState(false);
  const [airport,setAirport]=useState<Airport|null>(null);
  const [indicatorId,setIndicatorId]=useState('SP.POP.TOTL');
  const [year,setYear]=useState('');
  const [notice,setNotice]=useState('');
  const [toolsOpen,setToolsOpen]=useState(true);
  const t=label[language];

  useEffect(()=>{
    const controller=new AbortController();
    Promise.all([
      getData<Boundaries>('adm1.geojson',controller.signal),
      getData<Boundaries>('adm2.geojson',controller.signal),
      getData<Indicator[]>('indicators.json?edition=themes-v2',controller.signal),
      getData<Sources>('sources.json?edition=themes-v2',controller.signal),
      getData<Airports>('airports.json?edition=directory-v1',controller.signal).catch(()=>null),
      getData<ProvincialPopulation>('population-provinces.json',controller.signal).catch(()=>null),
    ]).then(([provinces,municipalities,indicators,sources,airports,provincialPopulation])=>{
      setPopulation(provincialPopulation);
      setData({provinces,municipalities,indicators,sources,airports});
      const view=new URLSearchParams(location.search);
      if(view.get('directorio')==='aeropuertos')setDirectory('airports');
      if(view.get('directorio')==='cargos')setDirectory('offices');
      const energyView=view.get('electricidad');
      if(energyView&&/^\d{4}-\d{2}-\d{2}$/.test(energyView)){
        setEnergyOpen(true);setEnergyDate(energyView);setShowInsights(true);
      }
      const feature=[...provinces.features,...municipalities.features].find(item=>item.id===view.get('territorio'));
      if(feature) {
        setSelected(feature);
        setShowInsights(true);
        if(feature.properties.level==='ADM2') setLevels({ADM1:true,ADM2:true});
      }
      const indicator=indicators.find(item=>item.id===view.get('indicador'));
      if(indicator){setIndicatorId(indicator.id);setTheme(indicator.category);setShowInsights(true);}
      const arrival=airports?.airports.find(item=>item.id===view.get('aeropuerto'));
      if(arrival){setAirport(arrival);setAirportLayer(true);setShowInsights(true);}
      const populationDate=Number(view.get('poblacion'));
      if(provincialPopulation?.years.includes(populationDate))setPopulationYear(populationDate);
      const date=view.get('anio');
      if(date&&/^\d{4}$/.test(date)) setYear(date);
    }).catch(()=>{if(!controller.signal.aborted)setLoadError(true);});
    return ()=>controller.abort();
  },[attempt]);

  useEffect(()=>{
    try {
      const saved=JSON.parse(localStorage.getItem('cubaos-favorites')||'[]');
      if(Array.isArray(saved)) setFavorites(saved.filter(id=>typeof id==='string'));
      setLight(localStorage.getItem('cubaos-theme')!=='dark');
      if(localStorage.getItem('cubaos-language')==='en') setLanguage('en');
    } catch {}
  },[]);

  useEffect(()=>{document.documentElement.lang=language;},[language]);
  useEffect(()=>{if(window.matchMedia('(max-width: 760px)').matches)setToolsOpen(false);},[]);

  useEffect(()=>{
    if(!energyOpen)return;
    const controller=new AbortController();
    async function refresh(){
      try {
        const response=await fetch('/data/energy.json',{signal:controller.signal,cache:'no-cache'});
        if(!response.ok)throw new Error();
        setEnergy(await response.json());setEnergyError(false);
      } catch {
        if(!controller.signal.aborted)setEnergyError(true);
      }
    }
    void refresh();
    const timer=setInterval(refresh,300_000);
    return ()=>{controller.abort();clearInterval(timer);};
  },[energyOpen,energyRetry]);

  useEffect(()=>{
    if(!energyOpen)return;
    const controller=new AbortController();
    async function refresh(){
      const now=Date.now();
      setPowerNow(now);
      try {
        const response=await fetch('/data/power-live.json?minute='+Math.floor(now/60_000),{signal:controller.signal,cache:'no-store'});
        if(!response.ok)throw new Error();
        const snapshot:PowerSnapshot=await response.json();
        if(!Array.isArray(snapshot.reports))throw new Error();
        if(!controller.signal.aborted){setPower(snapshot);setPowerFailed(false);}
      } catch {
        if(!controller.signal.aborted)setPowerFailed(true);
      }
    }
    void refresh();
    const timer=setInterval(refresh,60_000);
    return ()=>{controller.abort();clearInterval(timer);};
  },[energyOpen]);

  const recentPower=useMemo(()=>power?.reports.filter(row=>powerNow-Date.parse(row.at)<=power.windowHours*3_600_000)??[],[power,powerNow]);
  const bulbs=useMemo(()=>energyOpen&&data?powerMarkers(data.municipalities.features,recentPower):[],[energyOpen,data,recentPower]);
  const features=useMemo(()=>data?[...data.provinces.features,...data.municipalities.features]:[],[data]);
  const results=useMemo(()=>searchFeatures(features,query),[features,query]);
  const themed=data?.indicators.filter(item=>item.category===theme)??[];
  const series=data?.indicators.find(item=>item.id===indicatorId);
  const observation=series?.observations.find(row=>row.year===Number(year))
    ?? (!year ? series?.observations.at(-1) : undefined);
  const points=series?chartPoints(series.observations):[];
  const displayedPoint=observation&&series?points[series.observations.indexOf(observation)]:null;
  const provinceKey=(name:string)=>normalize(name).replace(/[^a-z0-9]+/g,'-');
  const energyProvinces=data?.provinces.features.map(feature=>({
    feature,name:displayName(feature),key:provinceKey(displayName(feature)),
  }))??[];
  const electricityDate=energyDate||[...Object.keys(energy?.provinces??{}),...(energy?.national.map(item=>item.date)??[])].sort().at(-1)||'';
  const electricityRows=energy?.provinces[electricityDate];
  const electricityColors=energyOpen&&energy?Object.fromEntries(energyProvinces.map(item=>[
    item.feature.id,energyColor(electricityRows?.[item.key]),
  ])):null;
  const militaryCounts=useMemo(()=>{
    const counts:Record<string,number>={};
    for(const item of data?.airports?.airports??[]) {
      if(item.category==='military'&&item.province)counts[item.province]=(counts[item.province]??0)+1;
    }
    return counts;
  },[data]);
  const selectedProvince=selected?.properties.level==='ADM1'?displayName(selected):null;
  const populationIndex=population?.years.indexOf(populationYear)??-1;
  const provincePopulation=selectedProvince?population?.territories[selectedProvince]?.[populationIndex]:undefined;
  const searchTerm=normalize(query);
  const placeMatches=searchTerm.length>=3?(places?.features.filter(item=>placeLayers.includes(item.properties.kind)
    &&normalize(item.properties.name).includes(searchTerm)).slice(0,4)??[]):[];
  const indicatorMatches=searchTerm.length>=3?(data?.indicators.filter(item=>
    normalize(language==='es'?item.label:item.labelEn).includes(searchTerm)).slice(0,4)??[]):[];
  const isSaved=selected&&favorites.includes(selected.id);

  function pick(feature:Boundary) {
    setSelected(feature);
    setAirport(null);setPlace(null);
    setShowInsights(true);
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
    if(airport) url.searchParams.set('aeropuerto',airport.id);
    if(energyOpen&&electricityDate) url.searchParams.set('electricidad',electricityDate);
    if(populationVisible) url.searchParams.set('poblacion',String(populationYear));
    if(year) url.searchParams.set('anio',year);
    url.searchParams.set('indicador',indicatorId);
    try {await navigator.clipboard.writeText(url.toString());setNotice(t.copy);}
    catch {setNotice(t.copyError);}
  }

  function resetMap() {setEnergyOpen(false);setSelected(null);setAirport(null);setPlace(null);setShowInsights(false);setReset(current=>current+1);}

  function openPower(open=true) {
    setEnergyOpen(open);setRightsOpen(false);setDirectory(null);setShowInsights(open);
    if(open){
      setAirport(null);setPlace(null);setEnergyDate('');
      setLevels(current=>({...current,ADM1:true}));
    }
  }

  function chooseTheme(next:Theme) {
    const nextIndicator=data?.indicators.find(item=>item.category===next);
    if(!nextIndicator)return;
    setEnergyOpen(false);setTheme(next);setIndicatorId(nextIndicator.id);setYear('');setShowInsights(true);
    if(next==='transport'){
      setAirportLayer(true);
      if(theme!=='transport'){setSelected(null);setReset(current=>current+1);}
    } else setAirport(null);
  }

  function chooseAirport(next:Airport) {
    chooseTheme('transport');
    setDirectory(null);setSelected(null);setPlace(null);setAirport(next);setShowInsights(true);
  }

  async function loadPlaces() {
    if(places||placeLoading)return;
    setPlaceLoading(true);setPlaceError(false);
    try {
      const compressed=typeof DecompressionStream==='function';
      const response=await fetch('/data/places.geojson'+(compressed?'.gz':''),{signal:AbortSignal.timeout(25_000)});
      if(!response.ok||!response.body)throw new Error();
      const data=compressed?new Response(response.body.pipeThrough(new DecompressionStream('gzip'))):response;
      setPlaces(await data.json());
    } catch {setPlaceError(true);}
    finally {setPlaceLoading(false);}
  }

  function togglePlace(kind:PlaceKind) {
    setPlaceLayers(current=>current.includes(kind)?current.filter(key=>key!==kind):[...current,kind]);
    if(!placeLayers.includes(kind))void loadPlaces();
  }

  function choosePlace(next:Place) {
    setEnergyOpen(false);setPlace(next);setAirport(null);setSelected(null);setQuery('');setSearchOpen(false);setShowInsights(true);
  }

  function openDirectory(next:'airports'|'offices',province='') {
    setAirportProvince(province);setDirectory(next);setRightsOpen(false);setPanel(null);
  }

  function pickIndicator(item:Indicator) {
    chooseTheme(item.category);setIndicatorId(item.id);setQuery('');setSearchOpen(false);
  }

  function toggleCompare(name:string) {
    setCompare(current=>current.includes(name)?current.filter(value=>value!==name):current.length<4?[...current,name]:current);
    setComparisonOpen(true);
  }

  function exportPopulation() {
    if(!population)return;
    const rows=compare.length?compare:Object.keys(population.territories);
    const csv=['territorio,'+population.years.join(','),...rows.map(name=>name+','+population.territories[name].join(','))].join('\n');
    const url=URL.createObjectURL(new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8'}));
    const link=document.createElement('a');
    link.href=url;link.download='cubaos-poblacion-efectiva-onei.csv';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  return <div className={light?'shell light':'shell'}>
    <header className="topbar">
      <a href="/" className="brand" aria-label="CubaOS">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/cubaos.svg" width="38" height="38" alt=""/>
        <span>Cuba<span>OS</span><small>{t.subtitle}</small></span>
      </a>
      <form className="search" onSubmit={event=>{event.preventDefault();if(results[0])pick(results[0]);else if(placeMatches[0])choosePlace(placeMatches[0]);else if(indicatorMatches[0])pickIndicator(indicatorMatches[0]);}}
        onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setSearchOpen(false);}}>
        <label htmlFor="geo-search" className="sr-only">{t.search}</label>
        <span aria-hidden="true" className="search-icon">⌕</span>
        <input id="geo-search" placeholder={t.search} value={query}
          onFocus={()=>setSearchOpen(true)} onChange={event=>{setQuery(event.target.value);setSearchOpen(true);}}
          onKeyDown={event=>{if(event.key==='Escape')setSearchOpen(false);}} autoComplete="off"/>
        {query.trim()&&searchOpen&&<div className="search-results">
          {results.map(feature=><button type="button" key={feature.id} onClick={()=>pick(feature)}>
            <span>{displayName(feature)}</span><small>{feature.properties.level==='ADM1'?t.provinces:t.municipalities}</small>
          </button>)}
          {placeMatches.map(item=><button type="button" key={item.id} onClick={()=>choosePlace(item)}>
            <span>{item.properties.name}</span><small>{placeKinds[item.properties.kind][language]}</small>
          </button>)}
          {indicatorMatches.map(item=><button type="button" key={item.id} onClick={()=>pickIndicator(item)}>
            <span>{language==='es'?item.label:item.labelEn}</span><small>{t.indicator}</small>
          </button>)}
          {!results.length&&!placeMatches.length&&!indicatorMatches.length&&<p>{t.noMatches}</p>}
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
    <nav className="observatory-nav" aria-label={language==='es'?'Observatorios':'Observatories'}>
      <button className={energyOpen?'active':''} aria-pressed={energyOpen} onClick={()=>openPower(!energyOpen||!showInsights)}>ϟ {language==='es'?'Observatorio eléctrico':'Electricity observatory'}</button>
      <button className={rightsOpen?'active':''} aria-pressed={rightsOpen} onClick={()=>{setDirectory(null);setRightsOpen(!rightsOpen);}}>◎ {language==='es'?'Derechos humanos':'Human rights'}</button>
      <button aria-pressed={directory==='airports'} onClick={()=>directory==='airports'?setDirectory(null):openDirectory('airports')}>✈ {language==='es'?'Aeropuertos':'Airports'}</button>
      <button aria-pressed={directory==='offices'} onClick={()=>directory==='offices'?setDirectory(null):openDirectory('offices')}>◇ {language==='es'?'Quién es quién':'Who is who'}</button>
    </nav>
    <div className="stat-strip" aria-label={language==='es'?'Indicadores nacionales':'National indicators'}>
      {themed.slice(0,3).map(item=>{
        const latest=item.observations.at(-1);
        return <button key={item.id} onClick={()=>{setEnergyOpen(false);setIndicatorId(item.id);setYear('');setShowInsights(true);}}>
          <span>{language==='es'?item.label:item.labelEn}</span>
          <strong>{latest&&new Intl.NumberFormat(language,{maximumFractionDigits:2}).format(latest.value)} {(language==='es'?item.unit:item.unitEn).startsWith('%')?'%':''}</strong>
          <small>{latest?.year} · WDI</small>
        </button>;
      })}
    </div>
    <p className={notice?'notice':'sr-only'} role="status" onClick={()=>setNotice('')}>{notice}</p>
    <main className="workspace">
      <nav className="section-nav" aria-label={language==='es'?'Explorar CubaOS':'Explore CubaOS'}>
        <p>{language==='es'?'EXPLORAR':'EXPLORE'}</p>
        <button onClick={resetMap}>◉ {t.map}</button>
        <button onClick={()=>{setToolsOpen(!toolsOpen);}} aria-expanded={toolsOpen}>▱ {t.layers}</button>
        <button onClick={()=>setComparisonOpen(!comparisonOpen)} aria-expanded={comparisonOpen}>⇄ {language==='es'?'Comparar':'Compare'}</button>
        <p>{language==='es'?'DATOS':'DATA'}</p>
        {(Object.keys(themes) as Theme[]).map(key=><button key={key} className={(energyOpen?key==='energy':key===theme)?'theme-active':''}
          aria-pressed={energyOpen?key==='energy':theme===key} onClick={()=>key==='energy'?openPower():chooseTheme(key)}><span aria-hidden="true">{themes[key].icon}</span> {themes[key][language]}</button>)}
        <button onClick={()=>setPanel('sources')}>◎ {t.sources}</button>
      </nav>
      <button className="mobile-tools" onClick={()=>setToolsOpen(!toolsOpen)} aria-expanded={toolsOpen}>{t.menu}</button>
      <aside className={toolsOpen?'rail':'rail tools-closed'}>
        <div className="eyebrow"><i/>{t.map}</div>
        <h1>{t.layers}</h1>
        <p className="muted">{t.select}</p>
        <h2 className="group-title">{t.admin}</h2>
        {(['ADM1','ADM2'] as const).map(level=><label className="layer" key={level}>
          <span className={'layer-key '+level.toLowerCase()}/>
          <span>{level==='ADM1'?t.provinces:t.municipalities}<small>{level}</small></span>
          <input type="checkbox" checked={levels[level]} onChange={event=>setLevels({...levels,[level]:event.target.checked})}/>
        </label>)}
        <h2 className="group-title">{language==='es'?'Transporte':'Transport'}</h2>
        <label className="layer"><span className="layer-key airport-key"/><span>{language==='es'?'Aeropuertos civiles':'Civil airports'}<small>{data?.airports?.airports.filter(item=>item.coordinates).length??'—'} · OurAirports</small></span>
          <input type="checkbox" checked={airportLayer} disabled={!data?.airports} onChange={event=>setAirportLayer(event.target.checked)}/></label>
        <label className="layer"><span className="layer-key military-key"/><span>{language==='es'?'Aviación militar por provincia':'Military aviation by province'}<small>{language==='es'?'Referencias documentadas':'Documented references'}</small></span>
          <input type="checkbox" checked={militaryLayer} disabled={!data?.airports} onChange={event=>setMilitaryLayer(event.target.checked)}/></label>
        <button className="secondary" onClick={()=>openDirectory('airports')}>{language==='es'?'Catálogo de aeropuertos':'Airport directory'}</button>
        <h2 className="group-title">{language==='es'?'Visualización':'Visualization'}</h2>
        <div className="field"><label htmlFor="map-style">{language==='es'?'Mapa base':'Basemap'}</label>
          <select id="map-style" value={mapStyle} onChange={event=>setMapStyle(event.target.value as typeof mapStyle)}>
            <option value="positron">{language==='es'?'Claro':'Light'}</option>
            <option value="liberty">{language==='es'?'Calles':'Streets'}</option>
            <option value="regional">{language==='es'?'Caribe local':'Local Caribbean'}</option>
          </select></div>
        <label className="layer"><span className="layer-key area-key"/><span>{language==='es'?'Superficie':'Area'}<small>km²</small></span><input type="checkbox" checked={areas} onChange={event=>{setAreas(event.target.checked);if(event.target.checked)setPopulationVisible(false);}}/></label>
        {population&&<><label className="layer"><span className="layer-key area-key"/><span>{language==='es'?'Población efectiva':'Effective population'}<small>ONEI · {populationYear}</small></span>
          <input type="checkbox" checked={populationVisible} onChange={event=>{setPopulationVisible(event.target.checked);if(event.target.checked)setAreas(false);}}/></label>
          {populationVisible&&<div className="field"><label htmlFor="prov-year">{language==='es'?'Año del mapa':'Map year'}</label>
          <select id="prov-year" value={populationYear} onChange={event=>setPopulationYear(Number(event.target.value))}>
            {population.years.map(value=><option key={value}>{value}</option>)}
          </select></div>}</>}
        <h2 className="group-title">{language==='es'?'Infraestructura y servicios':'Infrastructure and services'}</h2>
        {(Object.keys(placeKinds) as PlaceKind[]).filter(kind=>!places||places.metadata.counts[kind]).map(kind=>
          <label className="layer" key={kind}><span className="layer-key" style={{background:placeKinds[kind].color,borderColor:placeKinds[kind].color}}/>
            <span>{placeKinds[kind][language]}<small>{places?.metadata.counts[kind]??'OSM'}</small></span>
            <input type="checkbox" checked={placeLayers.includes(kind)} onChange={()=>togglePlace(kind)}/></label>)}
        {placeLoading&&<p className="muted" role="status">{t.load}</p>}
        {placeError&&<button onClick={loadPlaces}>{t.retry}</button>}
        <button className="secondary" onClick={()=>setComparisonOpen(true)}>{language==='es'?'Comparar provincias':'Compare provinces'}</button>
        <button className="secondary" onClick={resetMap}>⟲ {t.reset}</button>
        <div className="source-note"><span className="eyebrow">{t.boundary}</span><p>{t.note}</p></div>
      </aside>
      {data?<MapView key={mapStyle} mapStyle={mapStyle} provinces={data.provinces} municipalities={data.municipalities} levels={levels} selected={selected} reset={reset} onSelect={pick} language={language} light={light} areas={areas} airports={airportLayer&&!energyOpen?data.airports?.airports:undefined} airport={airport} onAirport={chooseAirport} population={population} populationYear={populationYear} populationVisible={populationVisible&&!!population} place={place} places={places} placeLayers={energyOpen?[]:placeLayers} onPlace={choosePlace} electricityColors={electricityColors} electricityDate={electricityDate} powerMarkers={bulbs} militaryCounts={militaryLayer&&!energyOpen?militaryCounts:null} onMilitary={province=>openDirectory('airports',province)}/>
        :<section className="map-zone map-placeholder">{loadError?<div><p>{t.fail}</p><button onClick={()=>{setLoadError(false);setAttempt(attempt+1);}}>{t.retry}</button></div>:t.load}</section>}
      {energyOpen&&showInsights&&<aside className="insights energy-insights" aria-label={language==='es'?'Observatorio eléctrico':'Electricity observatory'}>
        <button className="insights-close" onClick={()=>setShowInsights(false)} aria-label={t.close}>×</button>
        <p className="eyebrow"><i/>{language==='es'?'PARTES ELÉCTRICOS':'POWER REPORTS'}</p>
        <h2>{language==='es'?'Dónde se reportan cortes':'Where outages are reported'}</h2>
        <LivePower snapshot={power} reports={recentPower} territory={selected} language={language}
          failed={powerFailed||(!!power&&powerNow-Date.parse(power.checked)>15*60_000)}
          onClear={()=>{setSelected(null);setReset(current=>current+1);}}/>
        <Electricity data={energy} date={electricityDate} onDate={setEnergyDate} province={selectedProvince?provinceKey(selectedProvince):''}
          provinces={energyProvinces} onProvince={key=>{const match=energyProvinces.find(item=>item.key===key);if(match)pick(match.feature);else setSelected(null);}}
          language={language} failed={energyError} onRetry={()=>setEnergyRetry(current=>current+1)}/>
        <button type="button" className="secondary" onClick={()=>chooseTheme('energy')}>{language==='es'?'Indicadores históricos de energía':'Historical energy indicators'}</button>
      </aside>}
      <aside className={showInsights&&!energyOpen?'insights':'insights insights-closed'}>
        <button className="insights-close" onClick={()=>setShowInsights(false)} aria-label={t.close}>×</button>
        <p className="eyebrow"><i/>{place?placeKinds[place.properties.kind][language]:airport?airportCategories[airport.category][language]:selected?t.territory:t.overview}</p>
        <h2>{place?place.properties.name:airport?airport.name:selected?displayName(selected):t.national}</h2>
        {place&&<p className="muted"><a href={'https://www.openstreetmap.org/'+place.id}>OpenStreetMap ↗</a> · {places?.metadata.snapshot}</p>}
        {airport&&<p className="muted">{[airport.iata,airport.town,airport.province].filter(Boolean).join(' · ')} · <a href={airport.source}>{t.sources} ↗</a></p>}
        {selected&&<div className="territory-actions"><button onClick={save}>{isSaved?'★':'☆'} {isSaved?t.remove:t.save}</button><button onClick={resetMap}>{t.reset}</button></div>}
        {selected&&<p className="muted">{new Intl.NumberFormat(language,{maximumFractionDigits:0}).format(areaKm2(selected))} km² · {language==='es'?'superficie aproximada':'approximate area'}</p>}
        {provincePopulation!==undefined&&selectedProvince&&<div className="metric provincial-metric"><p className="eyebrow">{language==='es'?'Población efectiva':'Effective population'} · {populationYear}</p><strong>{new Intl.NumberFormat(language).format(provincePopulation)}</strong><a href={population?.url}>ONEI ↗</a>
          <div><button onClick={()=>toggleCompare(selectedProvince)} disabled={compare.length>=4&&!compare.includes(selectedProvince)}>{compare.includes(selectedProvince)?(language==='es'?'Quitar de comparación':'Remove from comparison'):(language==='es'?'Comparar provincia':'Compare province')}</button></div></div>}
        {selected&&provincePopulation===undefined&&<p className="muted">{t.noLocal}</p>}
        <div className="divider"/>
        <h3>{language==='es'?'Indicadores de toda Cuba':'Indicators for all of Cuba'}</h3>
        {selected&&<p className="muted">{language==='es'?'Los datos de abajo corresponden al país completo.':'The data below covers the entire country.'}</p>}
        {theme==='energy'&&<p className="muted">{language==='es'?'Series históricas nacionales. La cobertura eléctrica no mide apagones ni disponibilidad en tiempo real.':'National historical series. Electricity access does not measure outages or real-time availability.'}</p>}
        {series&&<section className="indicator">
          <div className="field"><label htmlFor="theme">{language==='es'?'Tema':'Topic'}</label>
          <select id="theme" value={theme} onChange={event=>chooseTheme(event.target.value as Theme)}>
            {(Object.keys(themes) as Theme[]).map(key=><option value={key} key={key}>{themes[key][language]}</option>)}
          </select></div>
          <div className="field"><label htmlFor="indicator">{t.indicator}</label>
          <select id="indicator" value={indicatorId} onChange={event=>{setIndicatorId(event.target.value);setYear('');}}>
            {themed.map(item=><option value={item.id} key={item.id}>{language==='es'?item.label:item.labelEn}</option>)}
          </select></div>
          <div className="field"><label htmlFor="year">{t.year}</label>
          <select id="year" value={year} onChange={event=>setYear(event.target.value)}>
            <option value="">{t.all}</option>
            {year&&!series.observations.some(row=>row.year===Number(year))&&<option value={year}>{year}</option>}
            {[...series.observations].reverse().map(row=><option key={row.year}>{row.year}</option>)}
          </select></div>
          <div className="metric">
            <p className="eyebrow">{language==='es'?'Toda Cuba':'All of Cuba'}{observation?' · '+observation.year:''}</p>
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
        {theme==='transport'&&data?.airports&&<details className="airport-list"><summary>{language==='es'?'Aeropuertos en el mapa':'Airports on the map'}</summary>
          {data.airports.airports.filter(item=>item.category==='scheduled').map(item=><button key={item.id} onClick={()=>chooseAirport(item)}>{item.iata} · {item.name}</button>)}
          <button onClick={()=>openDirectory('airports')}>{language==='es'?'Ver catálogo completo':'View full directory'}</button>
          <p className="muted">{language==='es'?'Edición consultada':'Snapshot retrieved'} · {data.airports.retrieved}</p>
        </details>}
      </aside>
      {comparisonOpen&&population&&<section className="comparison drawer" aria-label={language==='es'?'Comparar provincias':'Compare provinces'}>
        <div className="drawer-title"><h2>{language==='es'?'Comparar provincias':'Compare provinces'}</h2><button onClick={()=>setComparisonOpen(false)}>{t.close}</button></div>
        <p>{language==='es'?'Población efectiva de la ONEI. Elige hasta cuatro territorios.':'ONEI effective population. Select up to four territories.'}</p>
        <select aria-label={language==='es'?'Añadir provincia':'Add province'} value="" onChange={event=>{if(event.target.value)toggleCompare(event.target.value);}} disabled={compare.length>=4}>
          <option value="">{language==='es'?'Añadir provincia':'Add province'}</option>
          {Object.keys(population.territories).filter(name=>!compare.includes(name)).map(name=><option key={name}>{name}</option>)}
        </select>
        <div className="compare-table"><table><thead><tr><th>{language==='es'?'Territorio':'Territory'}</th>{population.years.map(value=><th key={value}>{value}</th>)}</tr></thead>
        <tbody>{compare.map(name=><tr key={name}><th><button onClick={()=>toggleCompare(name)} aria-label={(language==='es'?'Quitar ':'Remove ')+name}>×</button> {name}</th>
          {population.territories[name].map((value,index)=><td key={index}>{new Intl.NumberFormat(language).format(value)}</td>)}</tr>)}</tbody></table></div>
        <button onClick={exportPopulation}>{language==='es'?'Descargar CSV':'Download CSV'}</button> · <a href={population.url}>ONEI ↗</a>
      </section>}
      <button className="mobile-data" onClick={()=>setShowInsights(!showInsights)} aria-expanded={showInsights}>{language==='es'?'Temas y datos':'Topics and data'}</button>
    </main>
    <footer className="footer"><span>© OpenStreetMap contributors · geoBoundaries · ODbL 1.0</span><span>{data&&`${t.received} · ${data.sources.retrieved}`}</span></footer>
    {directory&&<section className="drawer civic-drawer" aria-label={directory==='airports'?(language==='es'?'Catálogo de aeropuertos':'Airport directory'):(language==='es'?'Quién es quién':'Who is who')}>
      <div className="drawer-title"><h2>{directory==='airports'?(language==='es'?'Catálogo de aeropuertos':'Airport directory'):(language==='es'?'Quién es quién':'Who is who')}</h2><button onClick={()=>setDirectory(null)}>{t.close}</button></div>
      {directory==='offices'?<WhoIsWho language={language}/>:data?.airports
        ?<AirportDirectory key={airportProvince} data={data.airports} language={language} onSelect={chooseAirport} initialProvince={airportProvince}/>
        :<p>{language==='es'?'Catálogo no disponible.':'Directory unavailable.'}</p>}
    </section>}
    {rightsOpen&&<section className="drawer rights-drawer" aria-label={language==='es'?'Derechos humanos':'Human rights'}>
      <div className="drawer-title"><h2>{language==='es'?'Derechos humanos':'Human rights'}</h2><button onClick={()=>setRightsOpen(false)}>{t.close}</button></div>
      <HumanRights language={language}/>
    </section>}
    {panel&&<section className="drawer" aria-label={panel==='sources'?t.catalog:t.favorite} onKeyDown={event=>{if(event.key==='Escape')setPanel(null);}}>
      <div className="drawer-title"><h2>{panel==='sources'?t.catalog:t.favorite}</h2><button onClick={()=>setPanel(null)}>{t.close}</button></div>
      {panel==='sources'?<>
        {data?.sources.boundaries.map(item=><article key={item.id}>
          <h3>{item.id==='ADM1'?t.provinces:t.municipalities} · {item.year}</h3>
          <p>{item.provider} · <a href={item.licenseUrl}>{item.license}</a></p>
          <a href={item.url}>geoBoundaries ↗</a> · <a href={'/data/'+item.id.toLowerCase()+'.geojson'} download>{t.download}</a>
        </article>)}
        {population&&<article><h3>ONEI</h3><p>{population.source}</p><a href={population.url}>{t.sources} ↗</a></article>}
        {places&&<article><h3>OpenStreetMap / Geofabrik</h3><p>{places.metadata.license} · {places.metadata.snapshot}</p><a href={places.metadata.source}>{t.sources} ↗</a></article>}
        {data?.airports&&<article><h3>OurAirports</h3><p>{data.airports.license} · {data.airports.retrieved}</p><a href={data.airports.source}>{t.sources} ↗</a></article>}
        {data?.indicators.map(item=><article key={item.id}><h3>{language==='es'?item.label:item.labelEn}</h3><p>World Bank WDI · {item.license} · {item.updated}</p><a href={item.url}>{t.sources} ↗</a></article>)}
      </>:favorites.length?features.filter(feature=>favorites.includes(feature.id)).map(feature=><button className="favorite" key={feature.id} onClick={()=>pick(feature)}>{displayName(feature)}</button>):<p>{t.noFavorites}</p>}
    </section>}
  </div>;
}
