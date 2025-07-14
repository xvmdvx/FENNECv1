# Directorio core

Este directorio agrupa los componentes reutilizables de FENNEC (POO).

- **background_controller.js** – Controlador base del service worker, enruta mensajes y acciones.
- **background_email_search.js** – Service worker principal. Maneja pestañas, mensajes y reglas CORS para la integración con Mistral.
- **diagnose_floater.js** – Subclase de `Floater` que muestra el panel de diagnóstico.
- **floater.js** – Clase base para paneles flotantes.
- **launcher.js** – Clase base que define la estructura de los lanzadores por entorno.
- **messenger.js** – Utilidad para enviar y recibir mensajes de forma uniforme.
- **mistral_chat.js** – Widget de chat para interactuar con el modelo Mistral mediante Ollama.
- **pdf-lib.min.js** – Biblioteca de terceros usada para manipular PDFs.
- **sidebar.js** – Clase que construye y adjunta el contenedor del sidebar.
- **trial_floater.js** – Floater empleado para el resumen de Fraud Review.
- **update_floater.js** – Floater utilizado para actualizar información de la orden.
- **utils.js** – Funciones auxiliares comunes (copiar texto, abrir pestañas de búsqueda, etc.).
