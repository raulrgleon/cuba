# Seguridad y privacidad

La publicación es de solo lectura. El servidor no acepta archivos, credenciales ni escrituras de usuarios. Los favoritos, idioma y tema se guardan en el navegador. Las peticiones HTTP generan registros operativos. La aplicación no integra analítica de usuarios ni IA.

El proceso de publicación escucha en loopback en DNET y Cloudflare Tunnel proporciona el acceso HTTPS. El contenedor corre sin privilegios. Mantén los secretos de Cloudflare y Coolify en el gestor de credenciales del operador. Reporta problemas de seguridad por un canal privado al responsable del repositorio.

El navegador solicita el mapa base a OpenFreeMap. Ese proveedor recibe los datos técnicos necesarios para entregar teselas.
