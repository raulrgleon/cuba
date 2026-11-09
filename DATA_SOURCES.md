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

## Aeropuertos y aeródromos

[OurAirports Open Data](https://github.com/davidmegginson/ourairports-data), Unlicense. Se publican los registros cubanos de la edición, descontando duplicados explícitos. El servicio programado refleja el campo del catálogo, sin confirmar horarios actuales. Los aeródromos civiles identificables tienen marcadores cuando la fuente aporta coordenadas. Las referencias militares se muestran por provincia, con el estado operativo sin verificar, y algunas se contrastan con [Cuba: A Country Study](https://tile.loc.gov/storage-services/master/frd/frdcstdy/cu/cubacountrystudy00huds/cubacountrystudy00huds.pdf). Los registros cerrados conservan su clasificación documental. Reproducible con `python3 scripts/ingest_airports.py`.

## Población efectiva provincial

ONEI, *Anuario Demográfico de Cuba 2024*, cuadro 1.2, p. 15. [Copia del informe](https://rotativo.com.mx/files/88746/00-anuario-demografico-2024.pdf#page=15). Se transcribieron cifras individuales de 2021–2024 y se vincularon por nombre a las unidades ADM1. Son población efectiva según la nota del cuadro. El agregado provincial de 2024 coincide con el total impreso. Se conservan las cifras publicadas de los años anteriores, cuya suma territorial difiere del total impreso por hasta seis personas. La metodología y el período difieren de la serie nacional del Banco Mundial. La app permite consultar ambas por separado.

## Infraestructura civil y servicios públicos cartografiados

[Geofabrik, extracto de Cuba](https://download.geofabrik.de/central-america/cuba.html), © colaboradores de OpenStreetMap, ODbL 1.0. Edición `cuba-261108.osm.pbf` del 8 de noviembre de 2026. Se seleccionaron elementos nombrados o referenciados por etiquetas públicas. Se excluyeron elementos etiquetados como privados, militares, abandonados o fuera de uso. Los polígonos de servicios se representan mediante un punto aproximado y las líneas son segmentos cartografiados. La cobertura es comunitaria y variable. Los puntos no acreditan horarios, disponibilidad de servicios ni estado operativo. Descarga de la edición derivada en `/data/places.geojson` bajo ODbL 1.0. Reproducible con `python3 -m pip install osmium==4.3.1` y `python3 scripts/ingest_osm.py ruta/al/extracto`.

## Observatorio eléctrico

[El Alambique](https://elalambique.net/datos/), CC BY 4.0, a partir de los partes de la UNE y las publicaciones de las empresas eléctricas provinciales. Se importan 90 partes nacionales y 45 días de partes provinciales. Las mediciones de la mañana, las previsiones de hora pico y el máximo del día anterior se presentan por separado. El color provincial representa lo reportado para la fecha seleccionada, según los campos publicados. Ni una cifra agregada ni la ausencia de avisos confirma si un domicilio tiene suministro. Los MW provinciales no se suman ni comparan entre provincias. El sistema consulta la fuente cada 30 minutos; mantiene la edición anterior si falla la descarga o llega una edición más antigua.

## Derechos humanos

La sección cita los informes de [ONU](https://www.ohchr.org/en/hr-bodies/upr/cu-index) y [CIDH](https://oas.org/en/iachr/reports/ia.asp?Year=2025), y cifras atribuidas a las ediciones 2026 de [Freedom House](https://freedomhouse.org/country/cuba/freedom-world/2026) y [RSF](https://rsf.org/en/country/cuba). Son fuentes e índices distintos. CubaOS no los combina en una puntuación propia ni publica registros personales.


## Quién es quién

Selección editorial de cargos públicos nacionales, con enlaces a publicaciones que documentan cada cargo y la fecha de la publicación. Incluye Presidencia, Asamblea Nacional, Consejo de Ministros y ministerios. Los nombres y cargos se usan con fines informativos. Las fichas no contienen datos personales de contacto.
