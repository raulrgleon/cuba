'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {Map as MapLibre} from 'maplibre-gl';
import {bounds,displayName,extent,type Boundaries,type Boundary,type Level} from './data';

type Props = {
  provinces:Boundaries; municipalities:Boundaries; levels:Record<Level,boolean>;
  selected:Boundary|null; onSelect:(feature:Boundary)=>void; reset:number;
  language:'es'|'en'; light:boolean;
};

function boundaryPath(feature:Boundary) {
  const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
  return polygons.flatMap(polygon=>polygon.map(ring=>ring.map(([x,y],index)=>
    `${index?'L':'M'}${(x*100).toFixed(2)} ${(-y*100).toFixed(2)}`).join('')+'Z')).join('');
}

function SimpleMap({provinces,municipalities,levels,selected,onSelect}:Props) {
  const paths=useMemo(()=>[...provinces.features,...municipalities.features].map(feature=>({
    feature,path:boundaryPath(feature),
  })),[provinces,municipalities]);
  const [[west,south],[east,north]]=selected?extent(selected):bounds;
  const pad=Math.max((east-west)*.08,(north-south)*.08,.03);
  return <svg className="map-overview" viewBox={`${(west-pad)*100} ${-(north+pad)*100} ${(east-west+2*pad)*100} ${(north-south+2*pad)*100}`} aria-label="Cuba">
    {paths.filter(({feature})=>levels[feature.properties.level]).map(({feature,path})=>
      <path key={feature.id} d={path} className={`boundary ${feature.properties.level}${feature.id===selected?.id?' selected':''}`}
        vectorEffect="non-scaling-stroke" fillRule="evenodd" onClick={()=>onSelect(feature)}>
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
  const [coords,setCoords]=useState('22.00° N · 79.50° W');
  const {provinces,municipalities,levels,selected,reset,language,light}=props;

  useEffect(()=>{
    let disposed=false;
    import('maplibre-gl').then(({Map,NavigationControl,ScaleControl,setWorkerUrl,setWorkerCount})=>{
      if(disposed||!host.current) return;
      const initial=latest.current;
      setWorkerUrl('/vendor/maplibre-worker.mjs');
      setWorkerCount(2);
      const instance=new Map({
        container:host.current,
        style:{version:8,sources:{
          ADM1:{type:'geojson',data:initial.provinces},
          ADM2:{type:'geojson',data:initial.municipalities},
        },layers:[
          {id:'sea',type:'background',paint:{'background-color':'#0b1b25'}},
          {id:'province-fill',type:'fill',source:'ADM1',paint:{'fill-color':'#397b6b','fill-opacity':.94}},
          {id:'province-edge',type:'line',source:'ADM1',paint:{'line-color':'#78c5aa','line-width':1.15}},
          {id:'municipality-fill',type:'fill',source:'ADM2',paint:{'fill-color':'#68ceaf','fill-opacity':.13}},
          {id:'municipality-edge',type:'line',source:'ADM2',paint:{'line-color':'#b0d9cb','line-opacity':.72,'line-width':.85}},
          {id:'selection-province',type:'line',source:'ADM1',filter:['==',['id'],''],paint:{'line-color':'#ffcd75','line-width':2.8}},
          {id:'selection-municipality',type:'line',source:'ADM2',filter:['==',['id'],''],paint:{'line-color':'#ffcd75','line-width':2.8}},
        ]},
        bounds,fitBoundsOptions:{padding:36},maxZoom:13,minZoom:3,
        attributionControl:false,dragRotate:false,touchPitch:false,
      });
      map.current=instance;
      instance.addControl(new NavigationControl({showCompass:false}),'top-right');
      instance.addControl(new ScaleControl({unit:'metric'}),'bottom-left');
      instance.on('load',()=>{
        setReady(true);
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
    instance.setPaintProperty('sea','background-color',light?'#d5e9eb':'#0b1b25');
  },[ready,levels,light]);

  useEffect(()=>{
    const instance=map.current;
    if(!ready||!instance) return;
    instance.setFilter('selection-province',['==',['id'],selected?.properties.level==='ADM1'?selected.id:'']);
    instance.setFilter('selection-municipality',['==',['id'],selected?.properties.level==='ADM2'?selected.id:'']);
    instance.fitBounds(selected?extent(selected):bounds,{padding:52,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:450,maxZoom:11});
  },[ready,selected,reset]);

  return <section className="map-zone" aria-label={language==='es'?'Mapa interactivo de Cuba':'Interactive map of Cuba'}>
    {!ready&&<SimpleMap {...props}/>}
    <div ref={host} className={ready?"map-canvas":"map-canvas preparing"}/>
    <div className="map-caption"><span className="map-dot"/> {language==='es'?'ARCHIPIÉLAGO CUBANO':'CUBAN ARCHIPELAGO'}</div>
    {error&&!ready&&<span className="map-fallback-note">{language==='es'?'Mapa vectorial básico':'Basic vector map'}</span>}
    <span className="map-coordinates">{coords}</span>
  </section>;
}
