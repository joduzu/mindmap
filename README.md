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
5. Pulsa **Exportar a Freemind** para descargar el archivo `.mm`. El fichero añade un comentario identificando al extractor y se entrega con el tipo MIME `application/x-freemind`, por lo que puede abrirse directamente en FreeMind, Freeplane u otras herramientas compatibles.
6. Como alternativa, utiliza el atajo `Ctrl` + `Shift` + `X` (`Command` + `Shift` + `X` en macOS) para lanzar la detección y exportación directamente desde la pestaña activa de NotebookLM.

## Notas técnicas

- La extensión analiza los nodos y conexiones del SVG que dibuja NotebookLM para reconstruir la jerarquía del mapa mental.
- Si NotebookLM cambia su estructura interna o el formato del SVG, podría ser necesario actualizar el script de extracción (`extension/content-script.js`).
- Antes de iniciar la reconstrucción, el script intenta expandir automáticamente cualquier nodo colapsado localizando los controles de "Expandir" en la interfaz; si la interfaz no responde, expande manualmente los nodos visibles antes de repetir la detección.
- El archivo exportado sigue la especificación de FreeMind 1.0.1, respeta los identificadores originales de NotebookLM, replica la estructura de referencia que acepta MindManager y puede abrirse en Freeplane, XMind (importación) y otras herramientas compatibles.
- Si el popup muestra el mensaje "No se pudo conectar con el mapa mental", recarga la pestaña de NotebookLM y vuelve a ejecutar la detección para forzar la reinyección del script de contenido.
