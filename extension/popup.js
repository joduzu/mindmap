const detectButton = document.getElementById("detect");
const exportButton = document.getElementById("export");
const statusEl = document.getElementById("status");
const previewEl = document.getElementById("preview");
const filenameInput = document.getElementById("filename");

let detectedMindmap = null;

async function getActiveNotebookTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab || !tab.id) {
    throw new Error("No se encontró una pestaña activa");
  }
  if (!tab.url || !tab.url.startsWith("https://notebooklm.google.com/")) {
    throw new Error("La pestaña activa no pertenece a NotebookLM");
  }
  return tab;
}

function sendMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(response);
    });
  });
}

async function ensureContentScript(tabId) {
  if (!chrome.scripting || !chrome.scripting.executeScript) {
    throw new Error(
      "Tu versión de Chrome no soporta la API necesaria para inyectar el script."
    );
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      files: ["content-script.js"],
    });
  } catch (error) {
    throw new Error(
      error && error.message
        ? `No se pudo inyectar el script en la pestaña activa: ${error.message}`
        : "No se pudo inyectar el script en la pestaña activa."
    );
  }
}

async function sendMessageWithRetry(tabId, message) {
  try {
    return await sendMessage(tabId, message);
  } catch (error) {
    if (
      error.message &&
      error.message.includes("Receiving end does not exist")
    ) {
      await ensureContentScript(tabId);
      try {
        return await sendMessage(tabId, message);
      } catch (retryError) {
        if (
          retryError.message &&
          retryError.message.includes("Receiving end does not exist")
        ) {
          throw new Error(
            "No se pudo conectar con el mapa mental. Recarga la pestaña de NotebookLM e inténtalo nuevamente."
          );
        }
        throw retryError;
      }
    }
    throw error;
  }
}

function downloadFile(options) {
  return new Promise((resolve, reject) => {
    chrome.downloads.download(options, (downloadId) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      resolve(downloadId);
    });
  });
}

function setStatus(message, type = "") {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`.trim();
}

function slugify(input) {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "mindmap";
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

function escapeXml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function nodeToFreemind(node, level = 1) {
  const indent = "  ".repeat(level);
  if (!node.children.length) {
    return `${indent}<node TEXT="${escapeXml(node.title)}"/>\n`;
  }
  let xml = `${indent}<node TEXT="${escapeXml(node.title)}">\n`;
  node.children.forEach((child) => {
    xml += nodeToFreemind(child, level + 1);
  });
  xml += `${indent}</node>\n`;
  return xml;
}

function buildFreemindDocument(nodes) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += "<map version=\"1.0.1\">\n";

  if (nodes.length === 1) {
    xml += nodeToFreemind(nodes[0], 1);
  } else {
    xml += '  <node TEXT="Mindmap">\n';
    nodes.forEach((node) => {
      xml += nodeToFreemind(node, 2);
    });
    xml += "  </node>\n";
  }

  xml += "</map>\n";
  return xml;
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
  const blob = new Blob([xml], { type: "application/xml" });
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
