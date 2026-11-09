# Arquitectura de CubaOS

Next.js y TypeScript generan una edición estática. MapLibre carga los polígonos WGS84 locales y añade el mapa base de OpenFreeMap cuando está disponible. El navegador realiza búsqueda por nombre y conserva tema, idioma y favoritos en su almacenamiento local. La vista compartible conserva el territorio, indicador y año.

El importador de Python consulta un conjunto cerrado de fuentes. Verifica geometrías y observaciones, aplica restricciones de una migración SQLite en memoria y publica GeoJSON y JSON con un manifiesto de hashes. Git conserva el historial de ediciones. Los límites y los indicadores permanecen como datasets independientes con licencias propias.

## ADR 001 · Edición estática versionada

El MVP opera con datasets públicos descargables y una experiencia de lectura. El despliegue estático permite publicar una edición completa y revertirla sin un servidor de base de datos. Los próximos módulos con escrituras, historial transaccional o consultas espaciales de escala mayor tendrán una decisión separada sobre PostgreSQL y PostGIS.
