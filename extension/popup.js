import {
  getActiveNotebookTab,
  sendMessageWithRetry,
  downloadFile,
} from "./lib/chrome.js";
import { slugify, buildFreemindDocument } from "./lib/freemind.js";

const detectButton = document.getElementById("detect");
const exportButton = document.getElementById("export");
const statusEl = document.getElementById("status");
const previewEl = document.getElementById("preview");
const filenameInput = document.getElementById("filename");

let detectedMindmap = null;

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`.trim();
}

function renderPreview(nodes) {
  previewEl.innerHTML = "";
  if (!nodes || !nodes.length) {
    previewEl.textContent = "Aún no se ha detectado ningún mapa mental.";
    return;
  }

  const list = document.createElement("ul");

  function appendNode(node, parentList) {
    const li = document.createElement("li");
    li.textContent = node.title;
    if (node.children.length) {
      const childList = document.createElement("ul");
      node.children.forEach((child) => appendNode(child, childList));
      li.appendChild(childList);
    }
    parentList.appendChild(li);
  }

  nodes.forEach((node) => appendNode(node, list));
  previewEl.appendChild(list);
}

async function detectMindmap() {
  setStatus("Buscando mapa mental...", "");
  exportButton.disabled = true;
  detectedMindmap = null;

  try {
    const tab = await getActiveNotebookTab();
    const response = await sendMessageWithRetry(tab.id, {
      type: "DETECT_MINDMAP",
    });

    if (!response || !response.success) {
      throw new Error(response?.error || "No se pudo detectar el mapa mental");
    }

    detectedMindmap = response;
    const nodeLabel =
      response.nodes.length === 1
        ? `Se detectó un mapa con ${response.meta.nodeCount} nodos.`
        : `Se detectaron ${response.nodes.length} raíces y ${response.meta.nodeCount} nodos.`;

    setStatus(nodeLabel, "success");
    renderPreview(response.nodes);
    exportButton.disabled = false;

    if (!filenameInput.value) {
      const rootTitle = response.nodes[0]?.title || "mindmap";
      filenameInput.value = slugify(rootTitle);
    }
  } catch (error) {
    console.error(error);
    setStatus(error.message || String(error), "error");
    renderPreview([]);
  }
}

async function exportMindmap() {
  if (!detectedMindmap || !detectedMindmap.nodes?.length) {
    setStatus("Primero detecta un mapa mental.", "error");
    return;
  }

  const name = filenameInput.value.trim() || "mindmap";
  const xml = buildFreemindDocument(detectedMindmap.nodes);
  const blob = new Blob([xml], { type: "application/x-freemind" });
  const url = URL.createObjectURL(blob);

  try {
    const timestamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
    const filename = `${slugify(name)}-${timestamp}.mm`;
    await downloadFile({ url, filename, saveAs: true });
    setStatus("Archivo Freemind exportado correctamente.", "success");
  } catch (error) {
    console.error(error);
    setStatus(error.message || String(error), "error");
  } finally {
    URL.revokeObjectURL(url);
  }
}

if (detectButton) {
  detectButton.addEventListener("click", () => {
    detectButton.disabled = true;
    setTimeout(() => {
      detectButton.disabled = false;
    }, 600);
    detectMindmap();
  });
}

if (exportButton) {
  exportButton.addEventListener("click", () => {
    exportMindmap();
  });
}

renderPreview([]);
