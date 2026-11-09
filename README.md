# CubaOS

Explorador de Cuba con mapa vectorial, provincias, municipios y series nacionales de población. Disponible en https://cuba.dnet.llc.

## Ejecutar

Requisitos de desarrollo: Node.js 24, npm y Python 3.11 o posterior.

```sh
npm ci
npm run dev
npm test
npm run build
python3 scripts/serve.py
```

El servidor de desarrollo usa el puerto 3000. La compilación genera `out/`. El servidor de producción local escucha en `127.0.0.1:8873`. Alternativamente, `docker compose up --build` genera y sirve la misma edición. Las variables opcionales de puerto y enlace figuran en `.env.example`.

## Datos y mantenimiento

El mapa usa una edición de límites administrativos de geoBoundaries. Las series nacionales proceden del Banco Mundial. Los datos municipales y provinciales se limitan a geometrías. Actualiza las fuentes con `python3 scripts/ingest.py`, inspecciona el diff y ejecuta las pruebas antes de publicar. Cada edición contiene procedencia, años y hashes. Consulta [DATA_SOURCES.md](DATA_SOURCES.md) y [API.md](API.md).

## Despliegue

En DNET, el servicio de usuario `cubaos.service` sirve una compilación independiente en el puerto local 8873. Cloudflare Tunnel DNET-HOME publica solo el hostname de CubaOS. Para Coolify, sigue [DEPLOYMENT.md](DEPLOYMENT.md). No hay credenciales de aplicación ni dependencias de un servicio de IA.

El diseño de la aplicación se describe en [ARCHITECTURE.md](ARCHITECTURE.md) y el alcance futuro en [ROADMAP.md](ROADMAP.md).
