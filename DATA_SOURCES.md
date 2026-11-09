# Fuentes y licencias

## Límites administrativos

- [geoBoundaries ADM1](https://www.geoboundaries.org/api/current/gbOpen/CUB/ADM1/) y [ADM2](https://www.geoboundaries.org/api/current/gbOpen/CUB/ADM2/). Origen declarado por el proveedor: OpenStreetMap y Wambacher. Año representado: 2017. Se usan las geometrías simplificadas del proveedor con coordenadas WGS84. Adecuadas para exploración, con precisión limitada por la generalización.
- [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/), © [colaboradores de OpenStreetMap](https://www.openstreetmap.org/copyright). Se normalizan los atributos al nombre, identificador y nivel. La edición derivada está disponible bajo ODbL como GeoJSON en `/data/adm1.geojson` y `/data/adm2.geojson`.
- Los 16 elementos ADM1 incluyen la unidad de primer nivel Isla de la Juventud. Los 168 elementos ADM2 corresponden a la clasificación de la fuente, sin inferir equivalencias históricas ni afiliaciones a partir de geometrías superpuestas.

## Indicadores nacionales

Banco Mundial, World Development Indicators, CC BY 4.0. La edición conserva el año de observación y la fecha de actualización de la fuente. Las series publicadas tienen cobertura nacional. Cada indicador conserva el enlace a su metodología original. Algunas observaciones son estimaciones según la metodología de su fuente.

- [Población total](https://data.worldbank.org/indicator/SP.POP.TOTL?locations=CU), personas.
- [Crecimiento de población](https://data.worldbank.org/indicator/SP.POP.GROW?locations=CU), porcentaje anual.
- [Población urbana](https://data.worldbank.org/indicator/SP.URB.TOTL.IN.ZS?locations=CU), porcentaje del total.

El manifiesto `public/data/sources.json` identifica la edición, los archivos exactos y sus hashes.

## Dependencias de interfaz

- [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js/blob/v6.17.0/LICENSE.txt), BSD-3-Clause.
- [Next.js](https://github.com/vercel/next.js/blob/canary/license.md) y [React](https://github.com/facebook/react/blob/main/LICENSE), MIT.
- Las versiones fijadas y las dependencias transitivas constan en `package-lock.json`.

## Mapa base y superficie

El mapa base claro es Positron de [OpenFreeMap](https://openfreemap.org/quick_start/), © OpenMapTiles y © colaboradores de OpenStreetMap. Si el proveedor no está disponible, se dibuja un contexto regional local de [Natural Earth](https://www.naturalearthdata.com/about/terms-of-use/), dominio público. Se puede reconstruir con `python3 scripts/ingest_context.py`. Las superficies en km² se calculan sobre los polígonos simplificados mediante una aproximación esférica. La leyenda muestra intervalos de superficie, no población ni cifras oficiales de extensión territorial.


La edición incluye también series de economía y turismo, electricidad, salud, educación, uso de Internet, telefonía, medioambiente y transporte aéreo. Las fechas de referencia pueden diferir por serie. Acceso a electricidad mide cobertura poblacional y no mide cortes, disponibilidad horaria ni déficit actual.

## Aeropuertos civiles

[OurAirports Open Data](https://github.com/davidmegginson/ourairports-data), Unlicense. Se seleccionan aeropuertos medianos y grandes con IATA y servicio programado marcado en la edición descargada. Los puntos son instalaciones civiles públicas. La capa no representa vuelos en vivo ni confirma horarios actuales. Reproducible con `python3 scripts/ingest_airports.py`.
