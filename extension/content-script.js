(function () {
  const EXTENSION_VERSION = "6.2";
  console.log(
    `🗺️ NotebookLM Mindmap Extractor v${EXTENSION_VERSION} - Complete Parent-Child Logic loaded`
  );

  let globalDebugData = null;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const action = (message && (message.type || message.action)) || null;
    if (!action) {
      return false;
    }

    const timeout = setTimeout(() => {
      console.error("⏰ Operation timed out after 25 seconds");
      sendResponse({
        success: false,
        error:
          "Operation timed out. Try refreshing the page and ensure the mindmap is fully loaded.",
      });
    }, 25000);

    const runAction = () => {
      if (action === "DETECT_MINDMAP" || action === "detectMindmap") {
        console.log("🔍 Starting complete parent-child detection...");
        return extractMindmapWithCompleteLogic().then((result) => {
          globalDebugData = result.debugData;
          return {
            success: true,
            nodes: result.tree,
            meta: result.meta,
          };
        });
      }

      if (action === "DEBUG_EXTRACT" || action === "debugExtract") {
        console.log("🛠️ Starting complete debug extraction...");
        return Promise.resolve(performCompleteDebugExtraction()).then(
          (debugData) => ({ success: true, debugData })
        );
      }

      if (action === "EXTRACT_WITH_ROOT" || action === "extractWithRoot") {
        console.log(
          "✅ Extracting with complete parent-child logic:",
          message.rootNodeId
        );
        return Promise.resolve(
          extractWithCompleteHierarchy(message.rootNodeId)
        ).then((hierarchy) => {
          const tree = transformHierarchyNodesToTree(hierarchy.nodes);
          return {
            success: true,
            nodes: tree,
            meta: {
              nodeCount: hierarchy.nodes.length,
              rootCount: tree.length,
            },
          };
        });
      }

      return Promise.reject(new Error(`Unknown action: ${action}`));
    };

    runAction()
      .then((response) => {
        clearTimeout(timeout);
        sendResponse(response);
      })
      .catch((error) => {
        clearTimeout(timeout);
        console.error("Mindmap Extractor error:", error);
        sendResponse({
          success: false,
          error: error && error.message ? error.message : String(error),
        });
      });

    return true;
  });

  async function extractMindmapWithCompleteLogic() {
    console.log("🔍 Starting extraction with COMPLETE parent-child logic...");

    try {
      await ensureMindmapFullyExpanded();
    } catch (expandError) {
      console.warn("Auto-expand routine failed:", expandError);
    }

    const svgElements = document.querySelectorAll("svg");
    if (svgElements.length === 0) {
      throw new Error(
        "No SVG elements found. Make sure the mindmap is fully loaded and visible."
      );
    }

    console.log(`Found ${svgElements.length} SVG elements`);

    const allNodes = extractAllUniqueNodes(svgElements);
    if (allNodes.length === 0) {
      throw new Error("No unique nodes found with complete detection");
    }

    console.log(`✅ Extracted ${allNodes.length} unique nodes`);

    const nodesByLevel = groupNodesByXCoordinateLevel(allNodes);
    console.log(
      `📊 Grouped nodes into ${Object.keys(nodesByLevel).length} X-coordinate levels`
    );

    const connections = extractConnectionsWithDirectionAnalysis(
      svgElements,
      allNodes
    );
    console.log(
      `🔗 Found ${connections.length} connections with direction analysis`
    );

    const parentChildMap = buildParentChildMapWithLevelValidation(
      connections,
      nodesByLevel,
      allNodes
    );

    const hierarchy = buildCompleteHierarchyWithDeduplication(
      allNodes,
      parentChildMap,
      nodesByLevel
    );

    const tree = transformHierarchyNodesToTree(hierarchy.nodes);
    const meta = {
      nodeCount: hierarchy.nodes.length,
      rootCount: tree.length,
    };

    const debugData = {
      allNodes,
      connections,
      nodesByLevel,
      hierarchyNodes: hierarchy.nodes,
      rootNode: hierarchy.rootNode,
    };

    return { tree, meta, debugData };
  }

  async function ensureMindmapFullyExpanded() {
    const MAX_PASSES = 6;
    const PASS_DELAY_MS = 350;
    let totalTriggered = 0;

    for (let pass = 0; pass < MAX_PASSES; pass += 1) {
      const toggles = findCollapsedMindmapToggles();
      if (!toggles.length) {
        if (pass === 0) {
          console.log("🔓 No collapsed mindmap toggles detected before extraction.");
        } else {
          console.log(
            `🔓 All mindmap toggles expanded after ${pass} pass${pass === 1 ? "" : "es"}.`
          );
        }
        break;
      }

      let triggeredThisPass = 0;
      toggles.forEach((toggle) => {
        if (triggerExpandableToggle(toggle)) {
          triggeredThisPass += 1;
        }
      });

      totalTriggered += triggeredThisPass;
      console.log(
        `📤 Auto-expand pass ${pass + 1}: attempted ${toggles.length}, triggered ${triggeredThisPass}.`
      );

      if (triggeredThisPass === 0) {
        console.warn("⚠️ Auto-expand pass produced no clicks; stopping early.");
        break;
      }

      await waitFor(PASS_DELAY_MS);
    }

    return totalTriggered;
  }

  function findCollapsedMindmapToggles() {
    const toggles = new Set();
    const collapsedSelectors = [
      '[aria-expanded="false"]',
      '[data-expanded="false"]',
      '[data-collapsed="true"]',
    ];

    collapsedSelectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        const target = resolveToggleTarget(element);
        if (target && isElementVisible(target)) {
          toggles.add(target);
        }
      });
    });

    const keywordPatterns = [
      /expand/i,
      /expandir/i,
      /contraer/i,
      /mostrar/i,
      /mostrar más/i,
      /desplegar/i,
      /abrir/i,
      /open/i,
      /unfold/i,
      /ver más/i,
      /ver mas/i,
      /show/i,
    ];

    const interactiveCandidates = document.querySelectorAll(
      'button, [role="button"], [aria-label], [title]'
    );

    interactiveCandidates.forEach((element) => {
      if (!isElementVisible(element)) {
        return;
      }

      if (!isElementInteractive(element)) {
        return;
      }

      if (element.getAttribute("aria-expanded") === "true") {
        return;
      }

      const labelText = getElementLabelText(element);
      if (!labelText) {
        return;
      }

      if (!keywordPatterns.some((pattern) => pattern.test(labelText))) {
        return;
      }

      toggles.add(element);
    });

    return Array.from(toggles);
  }

  function resolveToggleTarget(element) {
    if (!element || !(element instanceof Element)) {
      return null;
    }

    if (isElementInteractive(element)) {
      return element;
    }

    const childButton = element.querySelector('button, [role="button"], [tabindex]');
    if (childButton && isElementInteractive(childButton)) {
      return childButton;
    }

    const parentButton = element.closest('button, [role="button"], [tabindex]');
    if (parentButton && isElementInteractive(parentButton)) {
      return parentButton;
    }

    return null;
  }

  function triggerExpandableToggle(element) {
    const target = resolveToggleTarget(element);
    if (!target) {
      return false;
    }

    let triggered = false;

    try {
      if (typeof target.click === "function") {
        target.click();
        triggered = true;
      }
    } catch (error) {
      console.warn("Error using .click() on toggle:", error);
    }

    if (!triggered) {
      try {
        const clickEvent = new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        target.dispatchEvent(clickEvent);
        triggered = true;
      } catch (eventError) {
        console.warn("Error dispatching click event on toggle:", eventError);
      }
    }

    return triggered;
  }

  function isElementInteractive(element) {
    if (!element || !(element instanceof Element)) {
      return false;
    }

    const tagName = element.tagName ? element.tagName.toLowerCase() : "";
    if (tagName === "button" || tagName === "summary") {
      return true;
    }

    const role = element.getAttribute("role");
    if (role && ["button", "switch", "treeitem", "menuitem"].includes(role.toLowerCase())) {
      return true;
    }

    const tabIndex = element.getAttribute("tabindex");
    if (tabIndex !== null) {
      const tabIndexNumber = Number(tabIndex);
      if (!Number.isNaN(tabIndexNumber) && tabIndexNumber >= 0) {
        return true;
      }
    }

    if (typeof element.onclick === "function") {
      return true;
    }

    return false;
  }

  function isElementVisible(element) {
    if (!element || !(element instanceof Element)) {
      return false;
    }

    const style = window.getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none" || style.opacity === "0") {
      return false;
    }

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function getElementLabelText(element) {
    if (!element || !(element instanceof Element)) {
      return "";
    }

    const textSources = [];

    const ariaLabel = element.getAttribute("aria-label");
    if (ariaLabel) {
      textSources.push(ariaLabel);
    }

    const title = element.getAttribute("title");
    if (title) {
      textSources.push(title);
    }

    if (element.dataset) {
      const tooltip = element.dataset.tooltip || element.dataset.tip;
      if (tooltip) {
        textSources.push(tooltip);
      }
    }

    const textContent = element.textContent;
    if (textContent) {
      textSources.push(textContent);
    }

    return textSources
      .map((value) => (value || "").trim().toLowerCase())
      .filter((value) => value.length)
      .join(" ");
  }

  function waitFor(durationMs) {
    return new Promise((resolve) => {
      setTimeout(resolve, durationMs);
    });
  }

  function extractAllUniqueNodes(svgElements) {
    const allNodes = [];
    const nodeTextSet = new Set();
    const nodePositionMap = new Map();
    let nodeId = 0;

    svgElements.forEach((svg, svgIndex) => {
      console.log(`🔍 Processing SVG ${svgIndex + 1} for unique nodes...`);

      const nodeSelectors = [
        "g.node",
        "g[class*='node']",
        "g[transform] text",
        "text.node-name",
      ];

      const foundElements = new Set();

      nodeSelectors.forEach((selector) => {
        try {
          const elements = svg.querySelectorAll(selector);
          elements.forEach((element) => foundElements.add(element));
        } catch (error) {
          console.warn(`Error with selector ${selector}:`, error);
        }
      });

      foundElements.forEach((element, index) => {
        try {
          const nodeData = extractCompleteNodeData(element, nodeId, index);
          if (nodeData && isUniqueNode(nodeData, nodeTextSet, nodePositionMap)) {
            allNodes.push(nodeData);
            nodeTextSet.add(nodeData.text.toLowerCase().trim());
            nodePositionMap.set(
              `${Math.round(nodeData.position.x)}_${Math.round(
                nodeData.position.y
              )}`,
              nodeData.id
            );
            nodeId++;
            console.log(`✅ Added unique node: "${nodeData.text}"`);
          }
        } catch (error) {
          console.warn(`Error processing element ${index}:`, error);
        }
      });
    });

    return allNodes;
  }

  function extractCompleteNodeData(element, nodeId, index) {
    let text = "";
    let parentGroup = null;
    let actualElement = element;

    if (element.tagName?.toLowerCase() === "text") {
      text = element.textContent?.trim();
      parentGroup = element.closest("g.node") || element.parentElement;
      actualElement = parentGroup || element;
    } else if (element.tagName?.toLowerCase() === "g") {
      const textElement =
        element.querySelector("text.node-name") || element.querySelector("text");
      if (textElement) {
        text = textElement.textContent?.trim();
        parentGroup = element;
      }
    }

    if (!text || text.length < 1 || !isValidMindmapContent(text)) {
      return null;
    }

    const position = getAccurateElementPosition(actualElement);
    const bounds = calculatePreciseElementBounds(actualElement, position);
    const connectionPoints = calculateCompleteConnectionPoints(bounds);

    return {
      id: `node_${nodeId}`,
      text,
      position,
      bounds,
      connectionPoints,
      element: actualElement,
      parentGroup,
      originalIndex: index,
      elementType: "Complete SVG Node",
    };
  }

  function getAccurateElementPosition(element) {
    let x = 0;
    let y = 0;

    const transform = element.getAttribute("transform");
    if (transform) {
      const match = transform.match(
        /translate\(\s*([-\d\.]+)\s*,\s*([-\d\.]+)\s*\)/
      );
      if (match) {
        x = parseFloat(match[1]) || 0;
        y = parseFloat(match[2]) || 0;
        console.log(
          `📍 Accurate position: (${x}, ${y}) for "${element.textContent?.substring(
            0,
            20
          )}..."`
        );
        return { x, y };
      }
    }

    x = parseFloat(element.getAttribute("x") || "0");
    y = parseFloat(element.getAttribute("y") || "0");

    if (x === 0 && y === 0) {
      try {
        const rect = element.getBoundingClientRect();
        const svgRect = element.closest("svg")?.getBoundingClientRect();
        if (rect && svgRect) {
          x = rect.left - svgRect.left;
          y = rect.top - svgRect.top;
        }
      } catch (error) {
        console.warn("Could not get element position:", error);
      }
    }

    return { x, y };
  }

  function calculatePreciseElementBounds(element, position) {
    let bounds = null;

    try {
      const rectElement = element.querySelector("rect");
      if (rectElement) {
        const x = parseFloat(rectElement.getAttribute("x") || "0") + position.x;
        const y = parseFloat(rectElement.getAttribute("y") || "0") + position.y;
        const width = parseFloat(rectElement.getAttribute("width") || "0");
        const height = parseFloat(rectElement.getAttribute("height") || "0");

        bounds = {
          left: x,
          top: y,
          right: x + width,
          bottom: y + height,
          width,
          height,
          centerX: x + width / 2,
          centerY: y + height / 2,
        };
      }
    } catch (error) {
      console.warn("Error getting rect bounds:", error);
    }

    if (!bounds) {
      try {
        if (element.getBBox && typeof element.getBBox === "function") {
          const bbox = element.getBBox();
          bounds = {
            left: bbox.x + position.x,
            top: bbox.y + position.y,
            right: bbox.x + bbox.width + position.x,
            bottom: bbox.y + bbox.height + position.y,
            width: bbox.width,
            height: bbox.height,
            centerX: bbox.x + bbox.width / 2 + position.x,
            centerY: bbox.y + bbox.height / 2 + position.y,
          };
        }
      } catch (error) {
        console.warn("Error with getBBox:", error);
      }
    }

    if (!bounds) {
      bounds = {
        left: position.x - 18,
        top: position.y - 15,
        right: position.x + 18,
        bottom: position.y + 15,
        width: 36,
        height: 30,
        centerX: position.x,
        centerY: position.y,
      };
    }

    return bounds;
  }

  function calculateCompleteConnectionPoints(bounds) {
    if (!bounds) return [];

    return [
      { x: bounds.left, y: bounds.centerY, side: "left" },
      { x: bounds.right, y: bounds.centerY, side: "right" },
      { x: bounds.centerX, y: bounds.top, side: "top" },
      { x: bounds.centerX, y: bounds.bottom, side: "bottom" },
      { x: bounds.centerX, y: bounds.centerY, side: "center" },
    ];
  }

  function isUniqueNode(nodeData, nodeTextSet, nodePositionMap) {
    const textKey = nodeData.text.toLowerCase().trim();
    const positionKey = `${Math.round(nodeData.position.x)}_${Math.round(
      nodeData.position.y
    )}`;

    if (nodeTextSet.has(textKey)) {
      return false;
    }

    const tolerance = 10;
    for (const [existingPosKey] of nodePositionMap) {
      const [existingX, existingY] = existingPosKey.split("_").map(Number);
      const currentX = Math.round(nodeData.position.x);
      const currentY = Math.round(nodeData.position.y);

      const distance = Math.sqrt(
        (currentX - existingX) ** 2 + (currentY - existingY) ** 2
      );

      if (distance <= tolerance) {
        console.log(
          `🔄 Position duplicate detected: distance ${distance} <= ${tolerance}`
        );
        return false;
      }
    }

    return true;
  }

  function groupNodesByXCoordinateLevel(nodes) {
    console.log(
      "📊 COMPLETE LOGIC: Grouping nodes by X-coordinate LEVELS (same X = same hierarchy level)..."
    );

    const nodesByLevel = {};
    const tolerance = 5;

    nodes.forEach((node) => {
      const x = Math.round(node.position.x / tolerance) * tolerance;
      if (!nodesByLevel[x]) {
        nodesByLevel[x] = [];
      }
      nodesByLevel[x].push(node);
    });

    const sortedXLevels = Object.keys(nodesByLevel)
      .map((x) => parseFloat(x))
      .sort((a, b) => a - b);

    console.log("🎯 COMPLETE X-coordinate hierarchy levels:");
    sortedXLevels.forEach((x, levelIndex) => {
      const count = nodesByLevel[x].length;
      console.log(
        `  Level ${levelIndex}: X=${x}, Nodes=${count} (same hierarchy depth, different parents possible)`
      );
      nodesByLevel[x].forEach((node) => {
        console.log(`    - "${node.text.substring(0, 30)}..."`);
      });
    });

    return nodesByLevel;
  }

  function extractConnectionsWithDirectionAnalysis(svgElements, nodes) {
    console.log(
      "🔗 COMPLETE LOGIC: Extracting connections with direction analysis..."
    );

    const connections = [];

    svgElements.forEach((svg) => {
      const connectionElements = [
        ...Array.from(svg.querySelectorAll("path.link")),
        ...Array.from(svg.querySelectorAll("path")),
        ...Array.from(svg.querySelectorAll("line")),
        ...Array.from(svg.querySelectorAll("polyline")),
      ];

      console.log(
        `Found ${connectionElements.length} potential connection elements`
      );

      connectionElements.forEach((connElement) => {
        try {
          const connectionData = analyzeConnectionWithCompleteLogic(
            connElement,
            nodes
          );
          if (connectionData) {
            connections.push(connectionData);
          }
        } catch (error) {
          console.warn("Error analyzing connection element:", error);
        }
      });
    });

    console.log(
      `✅ Analyzed ${connections.length} valid connections with complete logic`
    );
    return connections;
  }

  function analyzeConnectionWithCompleteLogic(connElement, nodes) {
    const tagName = connElement.tagName.toLowerCase();
    let startPoint = null;
    let endPoint = null;

    if (tagName === "path") {
      const pathPoints = parseCompletePathData(connElement.getAttribute("d"));
      if (pathPoints.length >= 2) {
        startPoint = pathPoints[0];
        endPoint = pathPoints[pathPoints.length - 1];
      }
    } else if (tagName === "line") {
      startPoint = {
        x: parseFloat(connElement.getAttribute("x1") || "0"),
        y: parseFloat(connElement.getAttribute("y1") || "0"),
      };
      endPoint = {
        x: parseFloat(connElement.getAttribute("x2") || "0"),
        y: parseFloat(connElement.getAttribute("y2") || "0"),
      };
    } else if (tagName === "polyline") {
      const points = parsePointsAttribute(connElement.getAttribute("points"));
      if (points.length >= 2) {
        startPoint = points[0];
        endPoint = points[points.length - 1];
      }
    }

    if (!startPoint || !endPoint) {
      return null;
    }

    const parentNode = findNodeByRightCenterConnection(startPoint, nodes);
    const childNode = findNodeByLeftCenterConnection(endPoint, nodes);

    if (parentNode && childNode && parentNode.id !== childNode.id) {
      if (childNode.position.x > parentNode.position.x) {
        console.log(
          `🔗 COMPLETE Connection: "${parentNode.text.substring(
            0,
            20
          )}..." → "${childNode.text.substring(0, 20)}..."`
        );

        return {
          parentNode,
          childNode,
          startPoint,
          endPoint,
          element: connElement,
          type: tagName,
          direction: "parent-to-child",
        };
      }
      console.warn(
        `⚠️ Invalid connection: child X(${childNode.position.x}) not > parent X(${parentNode.position.x})`
      );
    }

    return null;
  }

  function findNodeByRightCenterConnection(startPoint, nodes, tolerance = 25) {
    return nodes.find((node) => {
      if (!node.connectionPoints) return false;

      const rightCenter = node.connectionPoints.find((cp) => cp.side === "right");
      if (rightCenter) {
        const distance = Math.sqrt(
          (startPoint.x - rightCenter.x) ** 2 +
            (startPoint.y - rightCenter.y) ** 2
        );
        if (distance <= tolerance) {
          console.log(
            `🎯 COMPLETE: Found parent node "${node.text.substring(
              0,
              20
            )}..." at right center`
          );
          return true;
        }
      }
      return false;
    });
  }

  function findNodeByLeftCenterConnection(endPoint, nodes, tolerance = 25) {
    return nodes.find((node) => {
      if (!node.connectionPoints) return false;

      const leftCenter = node.connectionPoints.find((cp) => cp.side === "left");
      if (leftCenter) {
        const distance = Math.sqrt(
          (endPoint.x - leftCenter.x) ** 2 + (endPoint.y - leftCenter.y) ** 2
        );
        if (distance <= tolerance) {
          console.log(
            `🎯 COMPLETE: Found child node "${node.text.substring(
              0,
              20
            )}..." at left center`
          );
          return true;
        }
      }
      return false;
    });
  }

  function parseCompletePathData(pathData) {
    if (!pathData) return [];

    const points = [];
    const commands =
      pathData.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) || [];

    let currentX = 0;
    let currentY = 0;

    commands.forEach((command) => {
      const type = command[0];
      const coords = command
        .slice(1)
        .trim()
        .split(/[\s,]+/)
        .map(parseFloat)
        .filter((n) => !isNaN(n));

      switch (type.toUpperCase()) {
        case "M":
          if (coords.length >= 2) {
            currentX = type === "M" ? coords[0] : currentX + coords[0];
            currentY = type === "M" ? coords[1] : currentY + coords[1];
            points.push({ x: currentX, y: currentY });
          }
          break;
        case "L":
          if (coords.length >= 2) {
            currentX = type === "L" ? coords[0] : currentX + coords[0];
            currentY = type === "L" ? coords[1] : currentY + coords[1];
            points.push({ x: currentX, y: currentY });
          }
          break;
        case "C":
          if (coords.length >= 6) {
            currentX = type === "C" ? coords[4] : currentX + coords[4];
            currentY = type === "C" ? coords[5] : currentY + coords[5];
            points.push({ x: currentX, y: currentY });
          }
          break;
        case "H":
          if (coords.length >= 1) {
            currentX = type === "H" ? coords[0] : currentX + coords[0];
            points.push({ x: currentX, y: currentY });
          }
          break;
        case "V":
          if (coords.length >= 1) {
            currentY = type === "V" ? coords[0] : currentY + coords[0];
            points.push({ x: currentX, y: currentY });
          }
          break;
        default:
          break;
      }
    });

    return points;
  }

  function parsePointsAttribute(pointsAttr) {
    if (!pointsAttr) return [];

    const coords = pointsAttr
      .trim()
      .split(/[\s,]+/)
      .map(parseFloat)
      .filter((n) => !isNaN(n));
    const points = [];

    for (let i = 0; i < coords.length; i += 2) {
      if (i + 1 < coords.length) {
        points.push({ x: coords[i], y: coords[i + 1] });
      }
    }

    return points;
  }

  function buildParentChildMapWithLevelValidation(
    connections,
    nodesByLevel,
    allNodes
  ) {
    console.log(
      "🔗 COMPLETE LOGIC: Building parent-child map with level validation..."
    );

    const parentChildMap = {};
    const childToParentMap = new Map();
    const xLevels = Object.keys(nodesByLevel)
      .map((x) => parseFloat(x))
      .sort((a, b) => a - b);

    console.log(`Available X-levels: ${xLevels.join(", ")}`);

    connections.forEach((conn) => {
      if (conn.direction === "parent-to-child") {
        const parentX = conn.parentNode.position.x;
        const childX = conn.childNode.position.x;

        const parentLevelIndex = xLevels.findIndex(
          (x) => Math.abs(x - parentX) <= 5
        );
        const childLevelIndex = xLevels.findIndex(
          (x) => Math.abs(x - childX) <= 5
        );

        if (childLevelIndex === parentLevelIndex + 1) {
          const parentId = conn.parentNode.id;
          const childId = conn.childNode.id;

          if (childToParentMap.has(childId)) {
            const existingParentId = childToParentMap.get(childId);
            const existingParent = allNodes.find((n) => n.id === existingParentId);

            if (
              shouldReplaceParentWithCompleteLogic(
                existingParent,
                conn.parentNode,
                conn.childNode
              )
            ) {
              console.log(
                `🔄 COMPLETE: Replacing parent for "${conn.childNode.text}": "${existingParent.text}" → "${conn.parentNode.text}"`
              );

              if (parentChildMap[existingParentId]) {
                parentChildMap[existingParentId] = parentChildMap[
                  existingParentId
                ].filter((id) => id !== childId);
              }

              if (!parentChildMap[parentId]) {
                parentChildMap[parentId] = [];
              }
              parentChildMap[parentId].push(childId);
              childToParentMap.set(childId, parentId);
            } else {
              console.log(
                `🚫 COMPLETE: Keeping existing parent for "${conn.childNode.text}": "${existingParent.text}"`
              );
            }
          } else {
            if (!parentChildMap[parentId]) {
              parentChildMap[parentId] = [];
            }
            parentChildMap[parentId].push(childId);
            childToParentMap.set(childId, parentId);

            console.log(
              `✅ COMPLETE: Level ${parentLevelIndex} → Level ${childLevelIndex}: "${conn.parentNode.text}" → "${conn.childNode.text}"`
            );
          }
        } else {
          console.warn(
            `⚠️ COMPLETE: Invalid level connection: Level ${parentLevelIndex} → Level ${childLevelIndex}`
          );
        }
      }
    });

    console.log(
      `🔗 COMPLETE Parent-child relationships: ${
        Object.keys(parentChildMap).length
      } parents`
    );
    Object.entries(parentChildMap).forEach(([parentId, childIds]) => {
      const parentNode = allNodes.find((n) => n.id === parentId);
      const parentText = parentNode?.text || parentId;
      console.log(
        `  "${parentText.substring(0, 20)}..." → ${childIds.length} children`
      );
    });

    return parentChildMap;
  }

  function shouldReplaceParentWithCompleteLogic(
    existingParent,
    newParent,
    childNode
  ) {
    const existingXDiff = Math.abs(
      childNode.position.x - existingParent.position.x
    );
    const newXDiff = Math.abs(childNode.position.x - newParent.position.x);

    if (Math.abs(existingXDiff - newXDiff) > 50) {
      return newXDiff < existingXDiff;
    }

    const existingYDiff = Math.abs(
      childNode.position.y - existingParent.position.y
    );
    const newYDiff = Math.abs(childNode.position.y - newParent.position.y);

    if (Math.abs(existingYDiff - newYDiff) > 30) {
      return newYDiff < existingYDiff;
    }

    return false;
  }

  function buildCompleteHierarchyWithDeduplication(
    allNodes,
    parentChildMap,
    nodesByLevel
  ) {
    console.log(
      "🏗️ COMPLETE LOGIC: Building hierarchy with deduplication and level validation..."
    );

    if (allNodes.length === 0) {
      throw new Error("No nodes available for complete hierarchy building");
    }

    const rootNode = findRootNodeByXLevel(nodesByLevel);
    console.log(`🎯 COMPLETE root node identified: "${rootNode.text}"`);

    const hierarchy = buildHierarchyBFSWithCompleteLogic(
      allNodes,
      rootNode,
      parentChildMap,
      nodesByLevel
    );

    console.log(
      `✅ Built COMPLETE hierarchy with ${hierarchy.nodes.length} unique nodes`
    );

    validateCompleteHierarchy(hierarchy.nodes);

    return hierarchy;
  }

  function findRootNodeByXLevel(nodesByLevel) {
    const xLevels = Object.keys(nodesByLevel)
      .map((x) => parseFloat(x))
      .sort((a, b) => a - b);
    const rootX = xLevels[0];
    const rootCandidates = nodesByLevel[rootX];

    console.log(
      `🎯 COMPLETE Root X-coordinate: ${rootX}, Candidates: ${rootCandidates.length}`
    );

    if (rootCandidates.length === 1) {
      return rootCandidates[0];
    }

    const centerY =
      rootCandidates.reduce((sum, node) => sum + node.position.y, 0) /
      rootCandidates.length;

    return rootCandidates.reduce((closest, node) => {
      const distFromCenter = Math.abs(node.position.y - centerY);
      const closestDist = Math.abs(closest.position.y - centerY);
      return distFromCenter < closestDist ? node : closest;
    });
  }

  function buildHierarchyBFSWithCompleteLogic(
    allNodes,
    rootNode,
    parentChildMap,
    nodesByLevel
  ) {
    console.log(
      "🌳 COMPLETE LOGIC: Building hierarchy using BFS with strict deduplication..."
    );

    const hierarchyNodes = [];
    const processedNodes = new Set();
    const nodeIdToHierarchyIndex = new Map();
    const queue = [{ nodeId: rootNode.id, level: 0, parentId: null }];
    const xLevels = Object.keys(nodesByLevel)
      .map((x) => parseFloat(x))
      .sort((a, b) => a - b);

    hierarchyNodes.push({
      id: rootNode.id,
      text: rootNode.text,
      parentId: null,
      level: 0,
      originalIndex: rootNode.originalIndex,
    });
    processedNodes.add(rootNode.id);
    nodeIdToHierarchyIndex.set(rootNode.id, 0);

    while (queue.length > 0) {
      const { nodeId, level } = queue.shift();
      const childIds = parentChildMap[nodeId] || [];

      console.log(
        `🔍 COMPLETE: Processing node "${allNodes
          .find((n) => n.id === nodeId)
          ?.text?.substring(0, 20)}..." with ${childIds.length} children`
      );

      childIds.forEach((childId) => {
        if (!processedNodes.has(childId)) {
          const childNode = allNodes.find((n) => n.id === childId);
          if (childNode) {
            const parentNode = allNodes.find((n) => n.id === nodeId);
            const parentLevelIndex = xLevels.findIndex(
              (x) => Math.abs(x - parentNode.position.x) <= 5
            );
            const childLevelIndex = xLevels.findIndex(
              (x) => Math.abs(x - childNode.position.x) <= 5
            );

            if (childLevelIndex === parentLevelIndex + 1) {
              const existingHierarchyIndex = nodeIdToHierarchyIndex.get(childId);
              if (existingHierarchyIndex !== undefined) {
                console.warn(
                  `⚠️ COMPLETE: Attempted to add duplicate node: "${childNode.text}" already exists at index ${existingHierarchyIndex}`
                );
                return;
              }

              const hierarchyIndex = hierarchyNodes.length;
              hierarchyNodes.push({
                id: childId,
                text: childNode.text,
                parentId: nodeId,
                level: level + 1,
                originalIndex: childNode.originalIndex,
              });

              processedNodes.add(childId);
              nodeIdToHierarchyIndex.set(childId, hierarchyIndex);
              queue.push({ nodeId: childId, level: level + 1, parentId: nodeId });

              console.log(
                `  ✅ COMPLETE: Added child: "${childNode.text.substring(
                  0,
                  20
                )}..." at level ${level + 1}`
              );
            } else {
              console.warn(
                `  ❌ COMPLETE: Skipped invalid child: level mismatch ${parentLevelIndex} → ${childLevelIndex}`
              );
            }
          }
        } else {
          console.log(
            `  🔄 COMPLETE: Skipped already processed child: "${
              allNodes.find((n) => n.id === childId)?.text
            }"`
          );
        }
      });
    }

    allNodes.forEach((node) => {
      if (!processedNodes.has(node.id)) {
        const appropriateParent = findParentByXLevelComplete(
          node,
          hierarchyNodes,
          allNodes,
          xLevels
        );

        if (appropriateParent) {
          hierarchyNodes.push({
            id: node.id,
            text: node.text,
            parentId: appropriateParent.id,
            level: appropriateParent.level + 1,
            originalIndex: node.originalIndex,
          });
          processedNodes.add(node.id);

          console.log(
            `🔗 COMPLETE: Attached orphan "${node.text.substring(
              0,
              20
            )}..." to "${appropriateParent.text.substring(0, 20)}..."`
          );
        }
      }
    });

    return {
      nodes: hierarchyNodes,
      rootNode: hierarchyNodes[0],
    };
  }

  function findParentByXLevelComplete(
    orphanNode,
    hierarchyNodes,
    allNodes,
    xLevels
  ) {
    const orphanLevelIndex = xLevels.findIndex(
      (x) => Math.abs(x - orphanNode.position.x) <= 5
    );

    if (orphanLevelIndex <= 0) {
      return hierarchyNodes[0];
    }

    const parentLevelX = xLevels[orphanLevelIndex - 1];
    const potentialParents = hierarchyNodes.filter((hierNode) => {
      const originalNode = allNodes.find((n) => n.id === hierNode.id);
      return (
        originalNode && Math.abs(originalNode.position.x - parentLevelX) <= 5
      );
    });

    if (potentialParents.length === 0) {
      return hierarchyNodes[0];
    }

    return potentialParents.reduce((closest, parent) => {
      const parentNode = allNodes.find((n) => n.id === parent.id);
      const closestNode = allNodes.find((n) => n.id === closest.id);

      if (!parentNode || !closestNode) return closest;

      const parentDist = Math.abs(orphanNode.position.y - parentNode.position.y);
      const closestDist = Math.abs(
        orphanNode.position.y - closestNode.position.y
      );

      return parentDist < closestDist ? parent : closest;
    });
  }

  function validateCompleteHierarchy(hierarchyNodes) {
    console.log("✅ COMPLETE: Validating hierarchy structure...");

    const seenIds = new Set();
    const seenTexts = new Set();
    const duplicates = [];
    const levels = {};

    hierarchyNodes.forEach((node, index) => {
      if (seenIds.has(node.id)) {
        duplicates.push({ type: "ID", value: node.id, index });
      } else {
        seenIds.add(node.id);
      }

      const normalizedText = node.text.toLowerCase().trim();
      if (seenTexts.has(normalizedText)) {
        duplicates.push({ type: "TEXT", value: normalizedText, index });
      } else {
        seenTexts.add(normalizedText);
      }

      levels[node.level] = (levels[node.level] || 0) + 1;
    });

    if (duplicates.length > 0) {
      console.error("❌ COMPLETE: Duplicates found in hierarchy:", duplicates);
      throw new Error(
        `COMPLETE hierarchy validation failed: ${duplicates.length} duplicates found`
      );
    }

    console.log("✅ COMPLETE: Hierarchy validation passed - no duplicates found");
    console.log("📊 COMPLETE: Level distribution:", levels);
  }

  function performCompleteDebugExtraction() {
    console.log("🛠️ Starting COMPLETE debug extraction...");

    const completeHtml = extractCompleteHTML();
    const allNodes = extractAllUniqueNodes(document.querySelectorAll("svg"));

    let connections = [];
    let nodesByLevel = {};
    let detectedRoot = null;
    let parentChildMap = {};

    try {
      if (allNodes.length > 0) {
        nodesByLevel = groupNodesByXCoordinateLevel(allNodes);
        connections = extractConnectionsWithDirectionAnalysis(
          document.querySelectorAll("svg"),
          allNodes
        );

        if (Object.keys(nodesByLevel).length > 0) {
          detectedRoot = findRootNodeByXLevel(nodesByLevel);

          if (connections.length > 0) {
            parentChildMap = buildParentChildMapWithLevelValidation(
              connections,
              nodesByLevel,
              allNodes
            );
          }

          allNodes.forEach((node) => {
            node.isDetectedRoot = node.id === detectedRoot?.id;
          });
        }
      }
    } catch (error) {
      console.log("COMPLETE debug analysis failed:", error.message);
    }

    globalDebugData = {
      allNodes,
      connections,
      nodesByLevel,
      detectedRoot,
      parentChildMap,
      completeHtml,
    };

    console.log("🛠️ COMPLETE debug analysis complete:", {
      nodes: allNodes.length,
      connections: connections.length,
      xLevels: Object.keys(nodesByLevel).length,
      parentChildRelations: Object.keys(parentChildMap).length,
      root: detectedRoot?.text || "None",
    });

    return globalDebugData;
  }

  function extractWithCompleteHierarchy(selectedRootId) {
    console.log(
      "✅ Extracting with COMPLETE hierarchy logic using selected root:",
      selectedRootId
    );

    if (!globalDebugData || !globalDebugData.allNodes) {
      throw new Error("Debug data not available. Run Debug Mode first.");
    }

    const selectedRoot = globalDebugData.allNodes.find(
      (node) => node.id === selectedRootId
    );
    if (!selectedRoot) {
      throw new Error("Selected root node not found.");
    }

    console.log(`🎯 COMPLETE: Selected root: "${selectedRoot.text}"`);

    const nodesByLevel = groupNodesByXCoordinateLevel(globalDebugData.allNodes);

    let hierarchy;

    if (globalDebugData.connections && globalDebugData.connections.length > 0) {
      const parentChildMap = buildParentChildMapWithLevelValidation(
        globalDebugData.connections,
        nodesByLevel,
        globalDebugData.allNodes
      );
      hierarchy = buildHierarchyBFSWithCompleteLogic(
        globalDebugData.allNodes,
        selectedRoot,
        parentChildMap,
        nodesByLevel
      );
    } else {
      hierarchy = buildXLevelHierarchyComplete(
        globalDebugData.allNodes,
        selectedRoot,
        nodesByLevel
      );
    }

    validateCompleteHierarchy(hierarchy.nodes);

    console.log(
      "✅ COMPLETE: Extracted with complete parent-child mapping:",
      hierarchy.nodes.length,
      "unique nodes"
    );

    return hierarchy;
  }

  function buildXLevelHierarchyComplete(allNodes, rootNode, nodesByLevel) {
    console.log("🏗️ COMPLETE: Building hierarchy based on X-level logic...");

    const hierarchyNodes = [];
    const processedNodes = new Set();
    const xLevels = Object.keys(nodesByLevel)
      .map((x) => parseFloat(x))
      .sort((a, b) => a - b);

    console.log(`📊 COMPLETE X-level hierarchy: ${xLevels.join(", ")}`);

    hierarchyNodes.push({
      id: rootNode.id,
      text: rootNode.text,
      parentId: null,
      level: 0,
      originalIndex: rootNode.originalIndex,
    });
    processedNodes.add(rootNode.id);

    for (let levelIndex = 1; levelIndex < xLevels.length; levelIndex++) {
      const currentX = xLevels[levelIndex];
      const previousX = xLevels[levelIndex - 1];

      const currentLevelNodes = nodesByLevel[currentX] || [];
      const previousLevelNodes = nodesByLevel[previousX] || [];

      console.log(
        `📍 COMPLETE Level ${levelIndex}: X=${currentX}, Nodes=${currentLevelNodes.length}`
      );

      currentLevelNodes.forEach((node) => {
        if (!processedNodes.has(node.id)) {
          const closestParent = findClosestParentByYComplete(
            node,
            previousLevelNodes
          );
          const parentInHierarchy = hierarchyNodes.find(
            (h) => h.id === closestParent.id
          );

          if (parentInHierarchy) {
            hierarchyNodes.push({
              id: node.id,
              text: node.text,
              parentId: closestParent.id,
              level: parentInHierarchy.level + 1,
              originalIndex: node.originalIndex,
            });
            processedNodes.add(node.id);

            console.log(
              `  ✅ COMPLETE: "${node.text.substring(0, 20)}..." → parent: "${closestParent.text.substring(0, 20)}..."`
            );
          }
        }
      });
    }

    return {
      nodes: hierarchyNodes,
      rootNode: hierarchyNodes[0],
    };
  }

  function findClosestParentByYComplete(childNode, parentCandidates) {
    return parentCandidates.reduce((closest, candidate) => {
      const childY = childNode.position.y;
      const candidateY = candidate.position.y;
      const closestY = closest.position.y;

      const candidateDist = Math.abs(childY - candidateY);
      const closestDist = Math.abs(childY - closestY);

      return candidateDist < closestDist ? candidate : closest;
    });
  }

  function transformHierarchyNodesToTree(hierarchyNodes) {
    const nodesById = new Map();
    hierarchyNodes.forEach((node) => {
      nodesById.set(node.id, {
        id: node.id,
        title: node.text,
        level: node.level,
        children: [],
      });
    });

    const roots = [];
    hierarchyNodes.forEach((node) => {
      const current = nodesById.get(node.id);
      if (node.parentId && nodesById.has(node.parentId)) {
        nodesById.get(node.parentId).children.push(current);
      } else {
        roots.push(current);
      }
    });

    return roots;
  }

  function isValidMindmapContent(text) {
    if (!text || text.length < 2) return false;

    const noisePatterns = [
      /^(lock|settings|sources|chat|studio|arrow_back)$/i,
      /^(collapse|expand|add|remove|thumb_up|thumb_down)$/i,
      /^(copy|good response|bad response|light mode|dark mode)$/i,
      /^(google apps|google account|gmail)$/i,
      /^\d+$/,
      /^[^\w\s]*$/,
      /@\w+\.com$/i,
      /^https?:\/\//i,
      /^\s*$/,
    ];

    return !noisePatterns.some((pattern) => pattern.test(text.trim()));
  }

  function extractCompleteHTML() {
    try {
      return document.documentElement.outerHTML;
    } catch (error) {
      return document.body?.outerHTML || "Unable to extract HTML";
    }
  }
})();
