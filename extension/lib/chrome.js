export async function getActiveNotebookTab() {
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

export async function sendMessageWithRetry(tabId, message) {
  try {
    return await sendMessage(tabId, message);
  } catch (error) {
    if (error.message && error.message.includes("Receiving end does not exist")) {
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

export function downloadFile(options) {
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
