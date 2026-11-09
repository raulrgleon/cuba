# API de la edición pública

Recursos de solo lectura, con HTTP GET y HEAD.

| Recurso | Formato | Cobertura |
| --- | --- | --- |
| `/data/adm1.geojson` | GeoJSON | Primer nivel administrativo |
| `/data/adm2.geojson` | GeoJSON | Segundo nivel administrativo |
| `/data/indicators.json` | JSON | Series WDI nacionales |
| `/data/sources.json` | JSON | Procedencia, fecha de consulta y hashes |

El cliente aplica selección de año y búsqueda sobre la edición descargada. Los endpoints dinámicos y su contrato OpenAPI están previstos en la hoja de ruta.
