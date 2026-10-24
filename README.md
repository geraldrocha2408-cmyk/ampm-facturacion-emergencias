# AMPM · Facturación de emergencia

**[Abrir la aplicación web sin cuenta de ChatGPT](https://ampm-facturacion-emergencias.carlosramirez2025.chatgpt.site)**

Este repositorio contiene la aplicación descargable y los reportes de precios de MicroStrategy. No incluye contraseñas, costos, márgenes ni ventas de las tiendas.

## Para compartir con las tiendas

- Comparta el enlace web de arriba. No pide usuario ni contraseña de ChatGPT.
- Para trabajar con un archivo, descargue **Facturacion-AMPM.html** usando el botón de descarga de GitHub, guárdelo en el equipo y ábralo con el navegador.
- El catálogo actual para importar está en **reportes/Precios-Productos-Actual.csv**. En el HTML, vaya a Catálogo y precios → Importar Excel o CSV. Verifique la tienda y PriceC en USD antes de aplicar.
- Use siempre el mismo navegador. Guarde respaldos JSON al cerrar la jornada; las ventas no se comparten entre computadoras y no se envían a GitHub ni a MSTG.

## Descargas de MicroStrategy

El flujo **Descargar precios MSTG** se programa para los lunes y viernes a las **9:00 a. m., hora de Managua**. GitHub Actions puede iniciar una ejecución con demora. También puede ejecutarse manualmente desde Actions → Descargar precios MSTG → Run workflow.

Cada ejecución descarga el informe SAL «Precios Productos» mediante el conector del sitio, valida todas las filas y guarda el reporte CSV fechado, el catálogo JSON vigente y una copia del HTML con esos precios. Se usan exclusivamente código, descripción, categoría y PriceC. La fecha y el resultado se guardan en **datos/ultima-descarga.json**.

Si MSTG falla o devuelve datos incompletos, el flujo falla y conserva el último catálogo publicado. Las credenciales de MSTG permanecen en el servidor del sitio. La automatización no necesita contraseñas de ChatGPT ni de MSTG en GitHub.

GitHub puede desactivar los flujos programados de repositorios públicos tras 60 días sin actividad. Las descargas correctas generan actividad; si las ejecuciones dejan de producirla durante ese periodo, revise Actions y reactive el flujo. El horario define el inicio solicitado, no una hora garantizada de finalización.

## Uso sin Internet

En la versión web, abra primero con conexión y espere «Lista para uso sin Internet». La versión HTML descargada funciona sin instalación. La consulta de precios requiere conexión. No use incógnito y no borre datos del navegador antes de respaldar.

Los comprobantes son de contingencia y quedan pendientes del registro definitivo en el sistema de caja. Se cobra exactamente PriceC sin agregar impuestos ni descuentos en esta herramienta.

## Código

Interfaz en `app/`, marca AMPM y tipografía en `assets/`. Para regenerar el HTML, ejecute `node scripts/build.mjs`. Para descargar y validar el reporte, ejecute `node scripts/descargar-mstg.mjs`. Requiere Node.js 22 o posterior. No activar GitHub Pages para este repositorio; la aplicación operativa está en el enlace superior.
