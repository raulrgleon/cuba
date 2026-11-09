'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {Map as MapLibre, StyleSpecification} from 'maplibre-gl';
import {areaColor,areaPalette,bounds,populationColor,placeKinds,displayName,extent,type Airport,type Place,type PlaceKind,type PlaceCollection,type ProvincialPopulation,type Boundaries,type Boundary,type Level} from './data';

type Props = {
  mapStyle:'positron'|'liberty'|'regional';
  provinces:Boundaries; municipalities:Boundaries; levels:Record<Level,boolean>;
  selected:Boundary|null; onSelect:(feature:Boundary)=>void; reset:number;
  language:'es'|'en'; light:boolean; areas:boolean;
  population:ProvincialPopulation|null; populationYear:number; populationVisible:boolean;
  place:Place|null; places:PlaceCollection|null; placeLayers:PlaceKind[]; onPlace:(place:Place)=>void;
  airports?:Airport[]; airport:Airport|null; onAirport:(airport:Airport)=>void;
};

function boundaryPath(feature:Boundary) {
  const polygons=feature.geometry.type==='Polygon'?[feature.geometry.coordinates]:feature.geometry.coordinates;
  return polygons.flatMap(polygon=>polygon.map(ring=>ring.map(([x,y],index)=>
    `${index?'L':'M'}${(x*100).toFixed(2)} ${(-y*100).toFixed(2)}`).join('')+'Z')).join('');
}

function SimpleMap({provinces,municipalities,levels,selected,onSelect,areas,population,populationYear,populationVisible}:Props) {
  const paths=useMemo(()=>[...provinces.features,...municipalities.features].map(feature=>({
    feature,path:boundaryPath(feature),
  })),[provinces,municipalities]);
  const [[west,south],[east,north]]=selected?extent(selected):bounds;
  const pad=Math.max((east-west)*.08,(north-south)*.08,.03);
  return <svg className="map-overview" viewBox={`${(west-pad)*100} ${-(north+pad)*100} ${(east-west+2*pad)*100} ${(north-south+2*pad)*100}`} aria-label="Cuba">
    {paths.filter(({feature})=>levels[feature.properties.level]).map(({feature,path})=>
      <path key={feature.id} d={path} className={`boundary ${feature.properties.level}${feature.id===selected?.id?' selected':''}`}
        style={feature.properties.level==='ADM1'&&(areas||populationVisible)?{fill:populationVisible&&population
          ? populationColor(population.territories[displayName(feature)]?.[population.years.indexOf(populationYear)]??0)
          : areaColor(feature)}:undefined} vectorEffect="non-scaling-stroke" fillRule="evenodd" onClick={()=>onSelect(feature)}>
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
  const [measuring,setMeasuring]=useState(false);
  const [measurePoints,setMeasurePoints]=useState<[number,number][]>([]);
  const measureMode=useRef(false);
  const [coords,setCoords]=useState('22.00° N · 79.50° W');
  const {provinces,municipalities,levels,selected,reset,language,light,areas,airports,airport,population,populationYear,populationVisible,place,places,placeLayers}=props;

  useEffect(()=>{
    let disposed=false;
    const style=latest.current.mapStyle;
    const base=style==='regional'?Promise.resolve(null):fetch('https://tiles.openfreemap.org/styles/'+style,{signal:AbortSignal.timeout(3200)})
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
          if(measureMode.current){
            setMeasurePoints(points=>[...points,[event.lngLat.lng,event.lngLat.lat]]);
            return;
          }
          const active=latest.current;
          const placeHit=instance.getLayer('place-points')
            ? instance.queryRenderedFeatures(event.point,{layers:['place-points','place-lines']})[0] : undefined;
          if(placeHit){
            const place=active.places?.features.find(item=>item.id===placeHit.id);
            if(place){active.onPlace(place);return;}
          }
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
    if(populationVisible&&population){
      const yearIndex=population.years.indexOf(populationYear);
      const expression=['match',['id'],
        ...provinces.features.flatMap(feature=>{
          const value=population.territories[displayName(feature)]?.[yearIndex];
          return [feature.id,typeof value==='number'?populationColor(value):'#a6adb2'];
        }),'#a6adb2'] as import('maplibre-gl').ExpressionSpecification;
      instance.setPaintProperty('province-fill','fill-color',expression);
    } else {
      instance.setPaintProperty('province-fill','fill-color',areas?['get','areaColor']:'#86add1');
    }
  },[ready,levels,light,areas,population,populationVisible,populationYear,provinces]);

  useEffect(()=>{
    const instance=map.current;
    if(!ready||!instance) return;
    instance.setFilter('selection-province',['==',['id'],selected?.properties.level==='ADM1'?selected.id:'']);
    instance.setFilter('selection-municipality',['==',['id'],selected?.properties.level==='ADM2'?selected.id:'']);
    const wide=window.innerWidth>760;
    const padding=wide?{top:54,bottom:62,left:225,right:selected?310:76}:46;
    instance.fitBounds(selected?extent(selected):bounds,{padding,duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:450,maxZoom:11});
  },[ready,selected,reset]);

  useEffect(()=>{
    const instance=map.current;
    if(!ready||!instance||!places) return;
    if(!instance.getSource('public-places')){
      instance.addSource('public-places',{type:'geojson',data:places});
      const colors:import('maplibre-gl').ExpressionSpecification=['match',['get','kind'],
        'road',placeKinds.road.color,
        ...Object.entries(placeKinds).filter(([key])=>key!=='road').flatMap(([key,item])=>[key,item.color]),'#397b6b'];
      instance.addLayer({id:'place-lines',type:'line',source:'public-places',filter:['==',['geometry-type'],'LineString'],
        paint:{'line-color':colors,'line-width':['interpolate',['linear'],['zoom'],4,1,10,2.4]}});
      instance.addLayer({id:'place-points',type:'circle',source:'public-places',filter:['==',['geometry-type'],'Point'],
        paint:{'circle-color':colors,'circle-radius':['interpolate',['linear'],['zoom'],4,2,9,5],
          'circle-stroke-color':'#fff','circle-stroke-width':.8}});
    }
    const kinds=['in',['get','kind'],['literal',placeLayers]] as import('maplibre-gl').ExpressionSpecification;
    instance.setFilter('place-lines',['all',['==',['geometry-type'],'LineString'],kinds]);
    instance.setFilter('place-points',['all',['==',['geometry-type'],'Point'],kinds]);
  },[ready,places,placeLayers]);

  useEffect(()=>{
    if(!ready||!place||!map.current) return;
    const geometry=place.geometry;
    const point=geometry.type==='Point'?geometry.coordinates:geometry.coordinates[Math.floor(geometry.coordinates.length/2)];
    if(point)map.current.easeTo({center:[point[0],point[1]],zoom:Math.max(8,map.current.getZoom()),
      offset:window.innerWidth>760?[-75,0]:[0,-45],
      duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:380});
  },[ready,place]);

  useEffect(()=>{
    const instance=map.current;
    if(!ready||!instance||!airports?.length) return;
    let disposed=false;
    const markers:{remove:()=>unknown}[]=[];
    import('maplibre-gl').then(({Marker})=>{
      if(disposed) return;
      for(const item of airports) {
        const element=document.createElement('button');
        element.type='button';
        element.className='airport-marker';
        element.textContent='✈';
        element.title=item.iata+' · '+item.name;
        element.setAttribute('aria-label',element.title);
        element.onclick=event=>{event.stopPropagation();latest.current.onAirport(item);};
        markers.push(new Marker({element}).setLngLat(item.coordinates).addTo(instance));
      }
    });
    return ()=>{disposed=true;markers.forEach(marker=>marker.remove());};
  },[ready,airports]);

  useEffect(()=>{
    if(!ready||!airport||!map.current) return;
    map.current.easeTo({center:airport.coordinates,zoom:8,
      offset:window.innerWidth>760?[-90,0]:[0,-60],
      duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:420});
  },[ready,airport]);

  useEffect(()=>{
    const instance=map.current;
    if(!ready||!instance) return;
    const features:import('geojson').Feature[]=[];
    if(measurePoints.length>1)features.push({type:'Feature',geometry:{type:'LineString',coordinates:measurePoints},properties:{}});
    for(const point of measurePoints)features.push({type:'Feature',geometry:{type:'Point',coordinates:point},properties:{}});
    const data:import('geojson').FeatureCollection={type:'FeatureCollection',features};
    const source=instance.getSource<import('maplibre-gl').GeoJSONSource>('measurement');
    if(source){source.setData(data);return;}
    instance.addSource('measurement',{type:'geojson',data});
    instance.addLayer({id:'measurement-line',type:'line',source:'measurement',filter:['==',['geometry-type'],'LineString'],
      paint:{'line-color':'#ff9426','line-width':3}});
    instance.addLayer({id:'measurement-points',type:'circle',source:'measurement',filter:['==',['geometry-type'],'Point'],
      paint:{'circle-radius':4,'circle-color':'#ff9426','circle-stroke-width':1,'circle-stroke-color':'#fff'}});
  },[ready,measurePoints]);

  const length=measurePoints.reduce((sum,point,index)=>{
    if(!index)return sum;
    const [x,y]=measurePoints[index-1],r=Math.PI/180;
    const h=Math.sin((point[1]-y)*r/2)**2+Math.cos(y*r)*Math.cos(point[1]*r)*Math.sin((point[0]-x)*r/2)**2;
    return sum+2*6371*Math.asin(Math.sqrt(Math.min(1,h)));
  },0);

  return <section className="map-zone" aria-label={language==='es'?'Mapa interactivo de Cuba':'Interactive map of Cuba'}>
    {!ready&&<SimpleMap {...props}/>}
    <div ref={host} className={ready?"map-canvas":"map-canvas preparing"}/>
    <div className="map-caption"><span className="map-dot"/> {language==='es'?'ARCHIPIÉLAGO CUBANO':'CUBAN ARCHIPELAGO'}</div>
    {error&&!ready&&<span className="map-fallback-note">{language==='es'?'Mapa vectorial básico':'Basic vector map'}</span>}
    {ready&&<div className="measure-tools">
      <button aria-pressed={measuring} onClick={()=>{measureMode.current=!measuring;setMeasuring(!measuring);}}>
        {language==='es'?'Medir distancia':'Measure distance'}
      </button>
      {(measuring||measurePoints.length>0)&&<span aria-live="polite">{measurePoints.length<2
        ? (language==='es'?'Marca dos puntos':'Mark two points')
        : new Intl.NumberFormat(language,{maximumFractionDigits:2}).format(length)+' km'}</span>}
      {measurePoints.length>0&&<button onClick={()=>setMeasurePoints([])}>{language==='es'?'Limpiar':'Clear'}</button>}
    </div>}
    <span className="map-coordinates">{coords}</span>
    {(areas||populationVisible)&&levels.ADM1&&<div className="map-legend">
      <strong>{populationVisible?(language==='es'?'Población efectiva':'Effective population')+' · '+populationYear
        :(language==='es'?'Superficie aproximada':'Approximate area')+' · km²'}</strong>
      <div className="legend-colors">{areaPalette.map(color=><i key={color} style={{background:color}}/>)}</div>
      <div className="legend-values"><span>{populationVisible?'<400 000':'<1 000'}</span><span>{populationVisible?'≥1 000 000':'≥9 000'}</span></div>
    </div>}
    {!basemap&&ready&&<div className="base-credits"><a href="https://www.naturalearthdata.com/">Natural Earth</a></div>}
    {basemap&&ready&&<div className="base-credits"><a href="https://openfreemap.org/">OpenFreeMap</a> · © <a href="https://openmaptiles.org/">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a></div>}
  </section>;
}
