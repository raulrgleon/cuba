'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {Map as MapLibre, StyleSpecification} from 'maplibre-gl';
import {areaColor,areaPalette,bounds,displayName,extent,type Boundaries,type Boundary,type Level} from './data';

type Props = {
  provinces:Boundaries; municipalities:Boundaries; levels:Record<Level,boolean>;
  selected:Boundary|null; onSelect:(feature:Boundary)=>void; reset:number;
  language:'es'|'en'; light:boolean; areas:boolean;
};

function boundaryPath(feature:Boundary) {
  const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
  return polygons.flatMap(polygon=>polygon.map(ring=>ring.map(([x,y],index)=>
    `${index?'L':'M'}${(x*100).toFixed(2)} ${(-y*100).toFixed(2)}`).join('')+'Z')).join('');
}

function SimpleMap({provinces,municipalities,levels,selected,onSelect,areas}:Props) {
  const paths=useMemo(()=>[...provinces.features,...municipalities.features].map(feature=>({
    feature,path:boundaryPath(feature),
  })),[provinces,municipalities]);
  const [[west,south],[east,north]]=selected?extent(selected):bounds;
  const pad=Math.max((east-west)*.08,(north-south)*.08,.03);
  return <svg className="map-overview" viewBox={`${(west-pad)*100} ${-(north+pad)*100} ${(east-west+2*pad)*100} ${(north-south+2*pad)*100}`} aria-label="Cuba">
    {paths.filter(({feature})=>levels[feature.properties.level]).map(({feature,path})=>
      <path key={feature.id} d={path} className={`boundary ${feature.properties.level}${feature.id===selected?.id?' selected':''}`}
        style={feature.properties.level==='ADM1'&&areas?{fill:areaColor(feature)}:undefined} vectorEffect="non-scaling-stroke" fillRule="evenodd" onClick={()=>onSelect(feature)}>
        <title>{displayName(feature)}</title>
      </path>)}
  </svg>;
}

export default function MapView(props:Props) {
  const host=useRef<HTMLDivElement>(null);
  const map=useRef<MapLibre|null>(null);
  const latest=useRef(props);
  useEffect(()=>{latest.current=props;},[props]);
  const [ready,setReady]=useState(false);
  const [error,setError]=useState(false);
  const [basemap,setBasemap]=useState(false);
  const [coords,setCoords]=useState('22.00° N · 79.50° W');
  const {provinces,municipalities,levels,selected,reset,language,light,areas}=props;

  useEffect(()=>{
    let disposed=false;
    const base=fetch('https://tiles.openfreemap.org/styles/positron',{signal:AbortSignal.timeout(3200)})
      .then(response=>response.ok?response.json() as Promise<StyleSpecification>:null).catch(()=>null);
    Promise.all([import('maplibre-gl'),base]).then(([{Map,Marker,NavigationControl,ScaleControl,setWorkerUrl,setWorkerCount},background])=>{
      if(disposed||!host.current) return;
      const initial=latest.current;
      setWorkerUrl('/vendor/maplibre-worker.mjs');
      setWorkerCount(2);
      const palette:StyleSpecification['layers']=[
        {id:'province-fill',type:'fill',source:'ADM1',paint:{'fill-color':['get','areaColor'],'fill-opacity':.78}},
        {id:'province-edge',type:'line',source:'ADM1',paint:{'line-color':'#e2eff8','line-width':1.1}},
        {id:'municipality-fill',type:'fill',source:'ADM2',paint:{'fill-color':'#397ab1','fill-opacity':.18}},
        {id:'municipality-edge',type:'line',source:'ADM2',paint:{'line-color':'#315f8a','line-opacity':.62,'line-width':.8}},
        {id:'selection-province',type:'line',source:'ADM1',filter:['==',['id'],''],paint:{'line-color':'#254b72','line-width':3}},
        {id:'selection-municipality',type:'line',source:'ADM2',filter:['==',['id'],''],paint:{'line-color':'#254b72','line-width':3}},
      ];
      const provinceData={...initial.provinces,features:initial.provinces.features.map(feature=>({
        ...feature,properties:{...feature.properties,areaColor:areaColor(feature)},
      }))};
      const baselayers:StyleSpecification['layers']=background?.layers??[
        {id:'sea',type:'background',paint:{'background-color':'#d7e2e5'}},
        {id:'regional-land',type:'fill',source:'caribbean',paint:{'fill-color':'#f2f2eb'}},
        {id:'regional-outline',type:'line',source:'caribbean',paint:{'line-color':'#bec7ca','line-width':.7}},
      ];
      const labels=baselayers.findIndex(layer=>layer.type==='symbol');
      const split=labels<0?baselayers.length:labels;
      setBasemap(Boolean(background));
      const instance=new Map({
        container:host.current,
        style:{...background,version:8,sources:{...background?.sources,
          ...(!background?{caribbean:{type:'geojson' as const,data:'/data/caribbean.geojson'}}:{}),
          ADM1:{type:'geojson',data:provinceData},
          ADM2:{type:'geojson',data:initial.municipalities},
        },layers:[...baselayers.slice(0,split),...palette,...baselayers.slice(split)]},
        bounds,fitBoundsOptions:{padding:76},maxZoom:13,minZoom:3,
        attributionControl:false,dragRotate:false,touchPitch:false,
      });
      map.current=instance;
      instance.addControl(new NavigationControl({showCompass:false}),'bottom-right');
      instance.addControl(new ScaleControl({unit:'metric'}),'bottom-left');
      instance.once('style.load',()=>{
        setReady(true);
        const named=new Set(['La Habana','Pinar del Río','Matanzas','Villa Clara','Camagüey','Holguín','Santiago de Cuba','Isla de la Juventud']);
        for(const feature of initial.provinces.features) {
          const name=displayName(feature);
          if(!named.has(name)) continue;
          const [[west,south],[east,north]]=extent(feature);
          const element=document.createElement('span');
          element.className='province-label';
          element.textContent=name;
          new Marker({element}).setLngLat([(west+east)/2,(south+north)/2]).addTo(instance);
        }
        instance.on('click',event=>{
          const active=latest.current;
          const query=[...(active.levels.ADM2?['municipality-fill']:[]),...(active.levels.ADM1?['province-fill']:[])];
          if(!query.length) return;
          const hit=instance.queryRenderedFeatures(event.point,{layers:query})[0];
          if(!hit) return;
          const collection=hit.source==='ADM2'?active.municipalities:active.provinces;
          const feature=collection.features.find(item=>item.id===hit.id);
          if(feature) active.onSelect(feature);
        });
        instance.on('mousemove',event=>{
          const {lng,lat}=event.lngLat;
          setCoords(`${Math.abs(lat).toFixed(2)}° ${lat<0?'S':'N'} · ${Math.abs(lng).toFixed(2)}° ${lng<0?'W':'E'}`);
        });
      });
      instance.on('error',event=>{if(!instance.loaded()) setError(true); console.warn(event.error.message);});
    }).catch(()=>{if(!disposed) setError(true);});
    return ()=>{disposed=true;map.current?.remove();map.current=null;};
  },[]);

  useEffect(()=>{
    const instance=map.current;
    if(!ready||!instance) return;
    for(const [active,ids] of [
      [levels.ADM1,['province-fill','province-edge']],
      [levels.ADM2,['municipality-fill','municipality-edge']],
    ] as const) {
      for(const id of ids) instance.setLayoutProperty(id,'visibility',active?'visible':'none');
    }
    if(instance.getLayer('sea')){
      instance.setPaintProperty('sea','background-color',light?'#d7e2e5':'#142632');
      instance.setPaintProperty('regional-land','fill-color',light?'#f2f2eb':'#293b42');
    }
    instance.setPaintProperty('province-fill','fill-color',areas?['get','areaColor']:'#86add1');
  },[ready,levels,light,areas]);

  useEffect(()=>{
    const instance=map.current;
    if(!ready||!instance) return;
    instance.setFilter('selection-province',['==',['id'],selected?.properties.level==='ADM1'?selected.id:'']);
    instance.setFilter('selection-municipality',['==',['id'],selected?.properties.level==='ADM2'?selected.id:'']);
    const wide=window.innerWidth>760;
    const padding=wide?{top:54,bottom:62,left:225,right:selected?310:76}:46;
    instance.fitBounds(selected?extent(selected):bounds,{padding,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:450,maxZoom:11});
  },[ready,selected,reset]);

  return <section className="map-zone" aria-label={language==='es'?'Mapa interactivo de Cuba':'Interactive map of Cuba'}>
    {!ready&&<SimpleMap {...props}/>}
    <div ref={host} className={ready?"map-canvas":"map-canvas preparing"}/>
    <div className="map-caption"><span className="map-dot"/> {language==='es'?'ARCHIPIÉLAGO CUBANO':'CUBAN ARCHIPELAGO'}</div>
    {error&&!ready&&<span className="map-fallback-note">{language==='es'?'Mapa vectorial básico':'Basic vector map'}</span>}
    <span className="map-coordinates">{coords}</span>
    {areas&&levels.ADM1&&<div className="map-legend">
      <strong>{language==='es'?'Superficie aproximada':'Approximate area'} · km²</strong>
      <div className="legend-colors">{areaPalette.map(color=><i key={color} style={{background:color}}/>)}</div>
      <div className="legend-values"><span>&lt;1 000</span><span>≥9 000</span></div>
    </div>}
    {!basemap&&ready&&<div className="base-credits"><a href="https://www.naturalearthdata.com/">Natural Earth</a></div>}
    {basemap&&ready&&<div className="base-credits"><a href="https://openfreemap.org/">OpenFreeMap</a> · © <a href="https://openmaptiles.org/">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a></div>}
  </section>;
}
