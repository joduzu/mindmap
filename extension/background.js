import {
  getActiveNotebookTab,
  sendMessageWithRetry,
  downloadFile,
} from "./lib/chrome.js";
import { slugify, buildFreemindDocument } from "./lib/freemind.js";

async function runMindmapExtraction() {
  try {
    const tab = await getActiveNotebookTab();
    const response = await sendMessageWithRetry(tab.id, {
      type: "DETECT_MINDMAP",
    });

    if (!response || !response.success || !response.nodes?.length) {
      throw new Error(response?.error || "No se detectaron nodos del mapa mental");
    }

    const xml = buildFreemindDocument(response.nodes);
    const blob = new Blob([xml], { type: "application/x-freemind" });
    const url = URL.createObjectURL(blob);

    try {
      const rootTitle = response.nodes[0]?.title || "mindmap";
      const timestamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
      const filename = `${slugify(rootTitle)}-${timestamp}.mm`;
      await downloadFile({ url, filename, saveAs: true });
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.error("Mindmap extraction shortcut failed:", error);
  }
}

chrome.commands.onCommand.addListener((command) => {
  if (command === "extract-mindmap") {
    runMindmapExtraction();
  }
});
