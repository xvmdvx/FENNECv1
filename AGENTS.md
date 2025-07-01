# Guía del proyecto FENNEC

Este repositorio contiene la extensión de Chrome **FENNEC**, ubicada en el directorio `FENNEC/`. A continuación se describe la estructura general y la función de los archivos principales para que nuevos colaboradores comprendan la organización del código.

## Estructura general

- **FENNEC/** – Código fuente de la extensión.
- **SOSREF/** – Páginas HTML de referencia utilizadas para pruebas manuales del sitio de la secretaría de Texas.

Dentro de `FENNEC/` se encuentran los siguientes componentes clave:

### Manifest y configuración
- `manifest.json` define la configuración principal de la extensión y usa **Manifest V3**. El service worker es `core/background_email_search.js`.
- `package.json` declara dependencias mínimas (solo *puppeteer*) y un script `npm test` que imprime pasos de pruebas manuales.

### Script de fondo
- `core/background_email_search.js` actúa como service worker. Maneja mensajes para abrir o cerrar pestañas, consulta de órdenes e integración con un servidor local de **Ollama** para generar respuestas con Mistral. También aplica reglas de `declarativeNetRequest` para eliminar cabeceras (evitar CORS) al contactar el servidor local.

### Scripts de contenido
Los scripts se inyectan según la página detectada:
- `environments/gmail/gmail_launcher.js` – Gmail. Inserta la barra lateral (SB), ajusta la interfaz y escucha mensajes del background.
- `environments/db/db_launcher.js` – Panel de órdenes interno (DB). Construye el sidebar con información de la orden y botones de utilidad.
- `environments/adyen/adyen_launcher.js` – Páginas de pago de Adyen. Extrae información de transacciones cuando se abre con parámetros especiales.
- `environments/txsos/tx_sos_launcher.js` – Sitio de la Secretaría de Estado de Texas. Autocompleta formularios de login y pago.
- `environments/usps/usps_launcher.js` – Herramienta de USPS para verificar direcciones.

### Recursos y UI
- `styles/` contiene `sidebar.css`, `sidebar_light.css` y `sidebar_bento.css`, usados por el sidebar según la preferencia del usuario.
- `popup.html` y `popup.js` permiten activar/desactivar la extensión y elegir modos (light, bento, review, dev).
- `options.html` y `options.js` almacenan opciones persistentes como el ancho del sidebar.
- Los íconos se ubican en `fennec_icon.png` y `icons/`.
- El sidebar se genera dinámicamente en los scripts de contenido; no existe un HTML estático específico.

### Utilidades y otros archivos
- `core/utils.js` provee funciones comunes para copiar texto, abrir pestañas de búsqueda y manejar el árbol de órdenes (“Family Tree”).
- `core/mistral_chat.js` implementa una caja de chat para interactuar con Mistral mediante Ollama.
- `dictionary.txt` define abreviaturas y términos internos usados en el código y la documentación.
- `CHANGELOG.md` registra correcciones y nuevas funciones.
- `README.md` ofrece instrucciones generales de instalación y uso.
- `manual-test.js` imprime los pasos de prueba manual recomendados al ejecutar `npm test`.

Esta guía sirve como referencia rápida de la arquitectura para contribuir de forma efectiva al proyecto.
