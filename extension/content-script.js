(function () {
  function getNodeId(element, fallbackIndex) {
    const explicitId =
      element.getAttribute("data-node-id") ||
      element.getAttribute("id") ||
      element.getAttribute("aria-labelledby");
    if (explicitId) {
      return explicitId;
    }
    return `mindmap-node-${fallbackIndex}`;
  }

  function extractNodeLabel(element) {
    const ariaLabel = element.getAttribute("aria-label");
    if (ariaLabel && ariaLabel.trim()) {
      return ariaLabel.trim();
    }

    const labelCandidate = element.querySelector(
      "[data-node-label], [data-testid='mindmap-node-label'], [data-testid='node-title']"
    );
    if (labelCandidate && labelCandidate.textContent) {
      const label = labelCandidate.textContent.trim();
      if (label) {
        return label;
      }
    }

    const clone = element.cloneNode(true);
    clone.querySelectorAll("[role='group']").forEach((group) => group.remove());
    const treeItems = clone.querySelectorAll("[role='treeitem']");
    treeItems.forEach((treeItem, index) => {
      if (index !== 0) {
        treeItem.remove();
      }
    });

    const text = (clone.textContent || "").replace(/\s+/g, " ").trim();
    if (text) {
      return text;
    }

    return "Nodo sin título";
  }

  function parseMindmapTree() {
    const treeRoot = document.querySelector("[role='tree']");
    if (!treeRoot) {
      throw new Error("No se encontró un mapa mental en la página actual.");
    }

    const treeItems = Array.from(treeRoot.querySelectorAll("[role='treeitem']"));
    if (!treeItems.length) {
      throw new Error("No se encontraron nodos dentro del mapa mental.");
    }

    const nodes = [];
    const stack = [];

    treeItems.forEach((element, index) => {
      const levelAttr = element.getAttribute("aria-level");
      const level = levelAttr ? parseInt(levelAttr, 10) || 1 : 1;
      const label = extractNodeLabel(element);
      const node = {
        id: getNodeId(element, index),
        title: label,
        level,
        children: [],
      };

      while (stack.length && stack[stack.length - 1].level >= level) {
        stack.pop();
      }

      if (!stack.length) {
        nodes.push(node);
      } else {
        stack[stack.length - 1].children.push(node);
      }

      stack.push(node);
    });

    const meta = {
      nodeCount: nodes.reduce((count, node) => count + countNodes(node), 0),
      rootCount: nodes.length,
    };

    return { nodes, meta };
  }

  function countNodes(node) {
    return node.children.reduce((acc, child) => acc + countNodes(child), 1);
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== "DETECT_MINDMAP") {
      return false;
    }

    try {
      const result = parseMindmapTree();
      sendResponse({ success: true, ...result });
    } catch (error) {
      console.error("Mindmap Extractor error:", error);
      sendResponse({ success: false, error: error.message || String(error) });
    }

    return true;
  });
})();
