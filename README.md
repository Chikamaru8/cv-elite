# CV Creator Elite

Subir esta carpeta completa a Cloudflare Pages (subida directa). `index.html` debe quedar en la raíz.

- index.html        -> estructura y librerías (CDN)
- css/styles.css    -> estilos y animaciones
- js/config.js      -> temas, fuentes, diseños, constantes
- js/data.js        -> CV de ejemplo y plantillas
- js/utils.js       -> utilidades, normalización, lectura de la IA, guardado en carpeta
- js/components.jsx -> iconos y componentes pequeños
- js/app.jsx        -> la aplicación (dashboard, editor, diseños, menús)
- js/main.jsx       -> arranque

Orden de carga: config -> data -> utils -> components -> app -> main (no cambiarlo).
Para probar en local no abrir con doble clic: usar `python -m http.server` en esta carpeta.
