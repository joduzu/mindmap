# Mindmap Extractor

Extensión de Chrome para capturar los nodos de mapas mentales generados por NotebookLM y exportarlos como archivos [FreeMind](https://freemind.sourceforge.net/) (`.mm`).

## Características

- Detecta automáticamente la jerarquía padre-hijo del mapa mental visible en NotebookLM.
- Muestra una vista previa estructurada directamente en el popup de la extensión.
- Permite exportar el resultado a un archivo `.mm` compatible con FreeMind, Freeplane y otras aplicaciones de mapas mentales.

## Instalación (modo desarrollador)

1. Clona este repositorio o descarga su contenido.
2. Abre Google Chrome y navega a `chrome://extensions`.
3. Activa el **Modo desarrollador** en la esquina superior derecha.
4. Pulsa en **Cargar descomprimida** y selecciona la carpeta `extension/` dentro de este proyecto.

## Uso

1. Abre un mapa mental dentro de NotebookLM (`https://notebooklm.google.com/`).
2. Haz clic en el icono de la extensión **Mindmap Extractor**.
3. Pulsa **Detectar mapa mental**. Si todo va bien, verás un resumen del número de nodos y una vista previa jerárquica.
4. Opcionalmente, ajusta el nombre del archivo de salida.
5. Pulsa **Exportar a Freemind** para descargar el archivo `.mm`.

## Notas técnicas

- La extensión se apoya en los atributos de accesibilidad (`role="tree"` y `role="treeitem"`) que NotebookLM expone para reconstruir la jerarquía del mapa.
- Si NotebookLM cambia su estructura interna, podría ser necesario actualizar el script de extracción (`extension/content-script.js`).
- El archivo exportado sigue la especificación de FreeMind 1.0.1 y puede abrirse en Freeplane, XMind (importación) y otras herramientas compatibles.
- Si el popup muestra el mensaje "No se pudo conectar con el mapa mental", recarga la pestaña de NotebookLM y vuelve a ejecutar la detección para forzar la reinyección del script de contenido.
