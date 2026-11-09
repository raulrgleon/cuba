# Despliegue

## Coolify

Crea una aplicación nueva desde este repositorio usando **Dockerfile**, puerto interno **8873** y hostname **cuba.dnet.llc**. Si la app se incorpora al proxy de Coolify, la ruta de Cloudflare Tunnel debe apuntar al proxy y conservar el hostname que identifica la app. Comprueba antes si hay una ruta directa en uso para evitar dos destinos activos. Las comprobaciones son `/`, `/data/sources.json` y una selección de territorio desde el navegador.

## DNET

El servicio aislado usa `python3 scripts/serve.py --directory out` en loopback. Cada versión se puede conservar en un directorio aparte para revertir. La ruta directa del túnel es `http://127.0.0.1:8873`. Los cambios de Cloudflare deben conservar las demás reglas y añadir la ruta nueva antes de la regla final. Verifica DNS, HTTPS y la salud de una ruta existente.

## Actualización eléctrica

En DNET, copia `scripts/ingest_energy.py` al directorio de despliegue y las unidades `deploy/systemd/cubaos-energy.*` al directorio de unidades del usuario. Ejecuta `systemctl --user daemon-reload`, `systemctl --user start cubaos-energy.service` y `systemctl --user enable --now cubaos-energy.timer`. El importador solo publica al terminar correctamente y conserva el archivo anterior ante un error.

## Avisos por circuito

`scripts/ingest_power_live.py --output out/data/power-live.json` publica los avisos recientes con lugar, hora y enlace. En DNET instala el script y las unidades `deploy/systemd/cubaos-power.*` del usuario. Ejecuta `systemctl --user daemon-reload`, `systemctl --user start cubaos-power.service` y `systemctl --user enable --now cubaos-power.timer`. El temporizador consulta las fuentes cada tres minutos. Conserva `out/data/power-live.json` y `out/data/energy.json` al cambiar de versión.

El mapa agrupa los avisos de las últimas seis horas por provincia o municipio según el zoom. Un aviso de circuito identifica su último estado publicado. Las estadísticas provinciales, los horarios, los avisos sin municipio identificable y las discrepancias sin resolver quedan fuera de esa capa.

El mismo importador mantiene el catálogo persistente `circuitDirectory` en `power-live.json`. Consulta los catálogos provinciales de Cuba al Tanto cada seis horas y conserva los circuitos identificados cuando caducan sus avisos. El último aviso histórico se distingue del estado reciente. Conserva este archivo en cada despliegue para mantener el catálogo y los avisos anteriores.
