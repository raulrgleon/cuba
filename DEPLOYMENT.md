# Despliegue

## Coolify

Crea una aplicación nueva desde este repositorio usando **Dockerfile**, puerto interno **8873** y hostname **cuba.dnet.llc**. Si la app se incorpora al proxy de Coolify, la ruta de Cloudflare Tunnel debe apuntar al proxy y conservar el hostname que identifica la app. Comprueba antes si hay una ruta directa en uso para evitar dos destinos activos. Las comprobaciones son `/`, `/data/sources.json` y una selección de territorio desde el navegador.

## DNET

El servicio aislado usa `python3 scripts/serve.py --directory out` en loopback. Cada versión se puede conservar en un directorio aparte para revertir. La ruta directa del túnel es `http://127.0.0.1:8873`. Los cambios de Cloudflare deben conservar las demás reglas y añadir la ruta nueva antes de la regla final. Verifica DNS, HTTPS y la salud de una ruta existente.
