(function (root, factory) {
  "use strict";

  let catalog = root.SetiAlienCatalog;
  let placement = root.SetiAlienPlacement;
  let state = root.SetiAlienState;
  let jiuzhe = root.SetiAlienJiuzhe;

  if (typeof require === "function") {
    catalog = catalog || require("./catalog");
    placement = placement || require("./placement");
    state = state || require("./state");
    jiuzhe = jiuzhe || require("./jiuzhe");
  }

  const api = factory(catalog, placement, state, jiuzhe);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAlienRender = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (catalog, placement, state, jiuzhe) {
  "use strict";

  const TRACE_KIND_FIRST = "first";
  const TRACE_KIND_EXTRA = "extra";
  const TRACE_KIND_JIUZHE = "jiuzhe";

  const tokenElements = new Map();
  const jiuzheSlotElements = new Map();
  const firstLayoutOverrides = new Map();
  const extraLayoutOverrides = new Map();
  const jiuzheLayoutOverrides = new Map();
  let dragState = null;
  let dragHandlers = {};
  let dragListenersBound = false;

  function roundPercent(value) {
    return Math.round(value * 100) / 100;
  }

  function getFirstOverrideKey(alienSlotId, traceType) {
    return `first:${alienSlotId}:${traceType}`;
  }

  function getExtraOverrideKey(alienSlotId, traceType) {
    return `extra:${alienSlotId}:${traceType}`;
  }

  function getJiuzheOverrideKey(alienSlotId, traceType, position) {
    return `jiuzhe:${alienSlotId}:${traceType}:${position}`;
  }

  function getEffectiveTraceMarkerLayout(alienSlotId, traceType) {
    const base = placement.getAlienTraceMarkerLayout(alienSlotId, traceType);
    if (!base) return null;

    const override = firstLayoutOverrides.get(getFirstOverrideKey(alienSlotId, traceType));
    return {
      ...base,
      percentX: override?.percentX ?? base.percentX,
      percentY: override?.percentY ?? base.percentY,
    };
  }

  function getEffectiveExtraTraceAnchorLayout(alienSlotId, traceType) {
    const base = placement.getAlienExtraTraceMarkerLayout(alienSlotId, traceType);
    if (!base) return null;

    const override = extraLayoutOverrides.get(getExtraOverrideKey(alienSlotId, traceType));
    return {
      ...base,
      percentX: override?.percentX ?? base.percentX,
      percentY: override?.percentY ?? base.percentY,
    };
  }

  function getEffectiveExtraTraceGridLayout(alienSlotId, traceType, extraIndex) {
    const anchorLayout = getEffectiveExtraTraceAnchorLayout(alienSlotId, traceType);
    if (!anchorLayout) return null;
    return placement.getExtraTraceGridCenter(anchorLayout, extraIndex);
  }

  function getEffectiveJiuzheTraceMarkerLayout(alienSlotId, traceType, position) {
    const base = placement.getJiuzheTraceMarkerLayout?.(alienSlotId, traceType, position);
    if (!base) return null;

    const override = jiuzheLayoutOverrides.get(getJiuzheOverrideKey(alienSlotId, traceType, position));
    return {
      ...base,
      percentX: override?.percentX ?? base.percentX,
      percentY: override?.percentY ?? base.percentY,
    };
  }

  function clientToAlienStatePercent(wrap, clientX, clientY) {
    const rect = wrap.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const width = wrap.offsetWidth || rect.width;
    const height = wrap.offsetHeight || rect.height;

    return {
      percentX: roundPercent((localX / width) * 100),
      percentY: roundPercent((localY / height) * 100),
    };
  }

  function applyTraceTokenStyle(element, layout, displayScale) {
    element.classList.add("alien-trace-token-positioned");
    element.style.position = "absolute";
    element.style.left = `${layout.percentX}%`;
    element.style.top = `${layout.percentY}%`;
    const scale = (layout.scalePercent / 100) * displayScale;
    element.style.setProperty("--alien-trace-scale", String(scale));
    element.style.transform = "translate(-50%, -50%) scale(var(--alien-trace-scale, 1))";
    element.style.transformOrigin = "center center";
    element.dataset.tracePercentX = String(layout.percentX);
    element.dataset.tracePercentY = String(layout.percentY);
  }

  function getTokenElementKey(traceKind, alienSlotId, traceType, extraIndex = 0) {
    if (traceKind === TRACE_KIND_EXTRA || traceKind === TRACE_KIND_JIUZHE) {
      return `${traceKind}:${alienSlotId}:${traceType}:${extraIndex}`;
    }
    return `${traceKind}:${alienSlotId}:${traceType}`;
  }

  function setDraggingElement(element, dragging) {
    if (!element) return;
    element.classList.toggle("is-dragging", dragging);
  }

  function handleTraceTokenPointerDown(event) {
    if (event.button !== 0) return;

    const element = event.target.closest(".alien-trace-token.alien-trace-token-positioned");
    if (!element) return;

    const layer = element.closest(".alien-trace-layer, .alien-jiuzhe-trace-layer");
    const wrap = layer?.closest(".alien-state-wrap, .alien-face-wrap");
    if (!layer || !wrap) return;

    event.preventDefault();
    dragState = {
      element,
      layer,
      wrap,
      alienSlotId: Number(element.dataset.alienSlot),
      traceType: element.dataset.traceType,
      traceKind: element.dataset.traceKind || TRACE_KIND_FIRST,
      extraIndex: Number(element.dataset.extraIndex || 0),
      jiuzhePosition: Number(element.dataset.jiuzhePosition || 0),
      pointerId: event.pointerId,
    };

    setDraggingElement(element, true);
    if (element.setPointerCapture) {
      element.setPointerCapture(event.pointerId);
    }
  }

  function handleTraceTokenPointerMove(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;

    const position = clientToAlienStatePercent(dragState.wrap, event.clientX, event.clientY);
    dragState.element.style.left = `${position.percentX}%`;
    dragState.element.style.top = `${position.percentY}%`;
    dragState.element.dataset.tracePercentX = String(position.percentX);
    dragState.element.dataset.tracePercentY = String(position.percentY);
  }

  function handleTraceTokenPointerUp(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;

    const { element, wrap, alienSlotId, traceType, traceKind } = dragState;
    const position = clientToAlienStatePercent(wrap, event.clientX, event.clientY);

    if (element.releasePointerCapture) {
      try {
        element.releasePointerCapture(event.pointerId);
      } catch {
        // ignore stale capture
      }
    }

    setDraggingElement(element, false);

    if (alienSlotId && traceType) {
      if (traceKind === TRACE_KIND_JIUZHE) {
        const positionIndex = Number(element.dataset.jiuzhePosition || 0);
        jiuzheLayoutOverrides.set(getJiuzheOverrideKey(alienSlotId, traceType, positionIndex), position);
      } else if (traceKind === TRACE_KIND_EXTRA) {
        const anchorLayout = getEffectiveExtraTraceAnchorLayout(alienSlotId, traceType);
        const extraIndex = Number(element.dataset.extraIndex || 0);
        const anchorPosition = anchorLayout
          ? placement.getExtraTraceAnchorFromGridCenter(position, extraIndex, anchorLayout)
          : position;
        extraLayoutOverrides.set(getExtraOverrideKey(alienSlotId, traceType), anchorPosition);
      } else {
        firstLayoutOverrides.set(getFirstOverrideKey(alienSlotId, traceType), position);
      }
    }

    const label = placement.getAlienSlotLabel(alienSlotId);
    const traceLabel = placement.getTraceTypeLabel(traceType);
    const kindLabel = traceKind === TRACE_KIND_JIUZHE
      ? `九折${Number(element.dataset.jiuzhePosition || 0)}号位`
      : traceKind === TRACE_KIND_EXTRA
        ? "非首标记网格锚点"
        : "首标记";
    const payload = {
      alienSlotId,
      traceType,
      traceKind,
      extraIndex: traceKind === TRACE_KIND_EXTRA ? Number(element.dataset.extraIndex || 0) : null,
      jiuzhePosition: traceKind === TRACE_KIND_JIUZHE ? Number(element.dataset.jiuzhePosition || 0) : null,
      percentX: position.percentX,
      percentY: position.percentY,
      message: traceKind === TRACE_KIND_EXTRA
        ? `${label} ${traceLabel} 非首标记 #${Number(element.dataset.extraIndex || 0) + 1} 拖动至 ${position.percentX}%,${position.percentY}%`
        : traceKind === TRACE_KIND_JIUZHE
          ? `${label} ${traceLabel} 九折${Number(element.dataset.jiuzhePosition || 0)}号位 拖动至 ${position.percentX}%,${position.percentY}%`
        : `${label} ${traceLabel} ${kindLabel} 拖动至 ${position.percentX}%,${position.percentY}%`,
    };

    dragState = null;

    if (dragHandlers.onPositionChange) {
      dragHandlers.onPositionChange(payload);
    }
  }

  function bindAlienTraceDragging(handlers = {}) {
    dragHandlers = handlers;
    if (dragListenersBound) return;

    document.addEventListener("pointerdown", handleTraceTokenPointerDown);
    window.addEventListener("pointermove", handleTraceTokenPointerMove);
    window.addEventListener("pointerup", handleTraceTokenPointerUp);
    window.addEventListener("pointercancel", handleTraceTokenPointerUp);
    dragListenersBound = true;
  }

  function resolvePlayerTokenAsset(playerColor, options = {}) {
    if (!playerColor || !options.getPlayerTokenAsset) {
      return options.tokenSrc || placement.ALIEN_TRACE_TOKEN_SRC;
    }
    return options.getPlayerTokenAsset(playerColor) || placement.ALIEN_TRACE_TOKEN_SRC;
  }

  function mountFirstTraceToken(alienSlotId, traceType, layer, alienSlot, options, activeKeys) {
    const traceSlot = alienSlot?.traces?.[traceType] || null;
    const key = getTokenElementKey(TRACE_KIND_FIRST, alienSlotId, traceType);

    if (!traceSlot?.firstPlaced) {
      const existing = tokenElements.get(key);
      if (existing) {
        existing.remove();
        tokenElements.delete(key);
      }
      return;
    }

    activeKeys.add(key);

    let element = tokenElements.get(key);
    if (!element) {
      element = document.createElement("img");
      element.className = "alien-trace-token alien-trace-token-positioned alien-trace-token-first is-first-trace-placed";
      element.draggable = false;
      tokenElements.set(key, element);
      layer.appendChild(element);
    }

    const layout = getEffectiveTraceMarkerLayout(alienSlotId, traceType);
    if (!layout) return;

    if (dragState?.element === element) return;

    applyTraceTokenStyle(element, layout, placement.ALIEN_TRACE_TOKEN_DISPLAY_SCALE);
    element.src = resolvePlayerTokenAsset(traceSlot.ownerPlayerColor, options);
    element.alt = `${placement.getAlienSlotLabel(alienSlotId)} ${placement.getTraceTypeLabel(traceType)} 首标记`;
    element.dataset.alienSlot = String(alienSlotId);
    element.dataset.traceType = traceType;
    element.dataset.traceKind = TRACE_KIND_FIRST;
    delete element.dataset.extraIndex;
    element.title = `${placement.getTraceTypeLabel(traceType)} 首标记 ${
      options.getPlayerLabel?.(traceSlot.ownerPlayerColor) || traceSlot.ownerPlayerColor || "未知"
    } @(${layout.percentX}%,${layout.percentY}%)`;
  }

  function mountExtraTraceToken(alienSlotId, traceType, extraIndex, layer, alienSlot, options, activeKeys) {
    const traceSlot = alienSlot?.traces?.[traceType];
    if (!traceSlot?.firstPlaced || extraIndex >= traceSlot.extraCount) {
      const key = getTokenElementKey(TRACE_KIND_EXTRA, alienSlotId, traceType, extraIndex);
      const existing = tokenElements.get(key);
      if (existing) {
        existing.remove();
        tokenElements.delete(key);
      }
      return;
    }

    const key = getTokenElementKey(TRACE_KIND_EXTRA, alienSlotId, traceType, extraIndex);
    activeKeys.add(key);

    let element = tokenElements.get(key);
    if (!element) {
      element = document.createElement("img");
      element.className = "alien-trace-token alien-trace-token-positioned alien-trace-token-extra";
      element.draggable = false;
      tokenElements.set(key, element);
      layer.appendChild(element);
    }

    const layout = getEffectiveExtraTraceGridLayout(alienSlotId, traceType, extraIndex);
    if (!layout) return;

    if (dragState?.element === element) return;

    const { row, col } = placement.getExtraTraceGridCellIndex(extraIndex);
    applyTraceTokenStyle(element, layout, placement.ALIEN_EXTRA_TRACE_TOKEN_DISPLAY_SCALE);
    element.src = resolvePlayerTokenAsset(traceSlot.ownerPlayerColor, options);
    element.alt = `${placement.getAlienSlotLabel(alienSlotId)} ${placement.getTraceTypeLabel(traceType)} 非首标记`;
    element.dataset.alienSlot = String(alienSlotId);
    element.dataset.traceType = traceType;
    element.dataset.traceKind = TRACE_KIND_EXTRA;
    element.dataset.extraIndex = String(extraIndex);
    element.title = `${placement.getTraceTypeLabel(traceType)} 非首标记 #${extraIndex + 1}`
      + ` 第${row + 1}行第${col + 1}列 @(${layout.percentX}%,${layout.percentY}%)`;
  }

  function renderAlienTraceMarkers(alienSlotId, layer, alienState, options = {}) {
    if (!layer) return;

    const alienSlot = state.getAlienSlot(alienState, alienSlotId);
    const activeKeys = new Set();

    for (const traceType of placement.TRACE_TYPES) {
      mountFirstTraceToken(alienSlotId, traceType, layer, alienSlot, options, activeKeys);

      const extraCount = alienSlot?.traces?.[traceType]?.extraCount || 0;
      for (let extraIndex = 0; extraIndex < extraCount; extraIndex += 1) {
        mountExtraTraceToken(alienSlotId, traceType, extraIndex, layer, alienSlot, options, activeKeys);
      }
    }

    for (const [key, element] of tokenElements.entries()) {
      const parts = key.split(":");
      const slotId = Number(parts[1]);
      if (slotId !== alienSlotId || activeKeys.has(key)) continue;
      element.remove();
      tokenElements.delete(key);
    }
  }

  function renderAllAlienTraceMarkers(getLayerForSlot, alienState, options = {}) {
    for (const alienSlotId of placement.ALIEN_SLOT_IDS) {
      const layer = getLayerForSlot(alienSlotId);
      if (layer) {
        renderAlienTraceMarkers(alienSlotId, layer, alienState, options);
      }
    }
  }

  function getJiuzheSlotElementKey(alienSlotId, traceType, position) {
    return `jiuzhe-slot:${alienSlotId}:${traceType}:${position}`;
  }

  function mountJiuzheTraceSlot(alienSlotId, traceType, position, layer, alienState, options, activeKeys) {
    const grid = jiuzhe?.getTraceGrid?.(alienState, alienSlotId);
    const entry = grid?.[traceType]?.[position] || null;
    const key = getJiuzheSlotElementKey(alienSlotId, traceType, position);
    const tokenKey = getTokenElementKey(TRACE_KIND_JIUZHE, alienSlotId, traceType, position);
    const layout = getEffectiveJiuzheTraceMarkerLayout(alienSlotId, traceType, position);
    if (!layout) return;

    const visible = Boolean(entry)
      || Boolean(options.showJiuzheSlots)
      || Boolean(jiuzhe?.isJiuzheRevealedSlot?.(alienState, alienSlotId));
    if (!visible) {
      const existingSlot = jiuzheSlotElements.get(key);
      const existingToken = tokenElements.get(tokenKey);
      if (existingSlot) {
        existingSlot.remove();
        jiuzheSlotElements.delete(key);
      }
      if (existingToken) {
        existingToken.remove();
        tokenElements.delete(tokenKey);
      }
      return;
    }

    if (entry) {
      activeKeys.add(tokenKey);
      const existingSlot = jiuzheSlotElements.get(key);
      if (existingSlot) {
        existingSlot.remove();
        jiuzheSlotElements.delete(key);
      }

      let element = tokenElements.get(tokenKey);
      if (!element) {
        element = document.createElement("img");
        element.className = "alien-trace-token alien-trace-token-positioned alien-trace-token-jiuzhe";
        element.draggable = false;
        tokenElements.set(tokenKey, element);
        layer.appendChild(element);
      }

      if (dragState?.element === element) return;

      applyTraceTokenStyle(element, layout, placement.JIUZHE_TRACE_TOKEN_DISPLAY_SCALE || 1);
      element.src = resolvePlayerTokenAsset(entry.playerColor, options);
      element.alt = `${jiuzhe.formatTraceLabel?.(traceType, position) || traceType}`;
      element.dataset.alienSlot = String(alienSlotId);
      element.dataset.traceType = traceType;
      element.dataset.traceKind = TRACE_KIND_JIUZHE;
      element.dataset.jiuzhePosition = String(position);
      delete element.dataset.extraIndex;
      element.title = `${placement.getAlienSlotLabel(alienSlotId)} ${jiuzhe.formatTraceLabel?.(traceType, position) || traceType}`
        + ` ${options.getPlayerLabel?.(entry.playerColor) || entry.playerColor || "未知"}`
        + ` @(${layout.percentX}%,${layout.percentY}%)`;
      return;
    }

    activeKeys.add(key);
    const existingToken = tokenElements.get(tokenKey);
    if (existingToken) {
      existingToken.remove();
      tokenElements.delete(tokenKey);
    }

    let slot = jiuzheSlotElements.get(key);
    if (!slot) {
      slot = document.createElement("button");
      slot.type = "button";
      slot.className = "alien-jiuzhe-slot alien-trace-token-positioned";
      jiuzheSlotElements.set(key, slot);
      layer.appendChild(slot);
    }

    applyTraceTokenStyle(slot, layout, placement.JIUZHE_TRACE_TOKEN_DISPLAY_SCALE || 1);
    slot.dataset.alienSlot = String(alienSlotId);
    slot.dataset.traceType = traceType;
    slot.dataset.jiuzhePosition = String(position);
    slot.dataset.jiuzheTraceSlot = "true";
    slot.classList.toggle("is-placeable", options.canPlaceJiuzheTrace?.(alienSlotId, traceType, position) !== false);
    slot.title = `${jiuzhe.formatTraceLabel?.(traceType, position) || traceType} @(${layout.percentX}%,${layout.percentY}%)`;
    slot.setAttribute("aria-label", `${placement.getAlienSlotLabel(alienSlotId)} ${slot.title}`);
  }

  function renderJiuzheTraceMarkers(alienSlotId, layer, alienState, options = {}) {
    if (!layer || !jiuzhe) return;
    const activeKeys = new Set();

    for (const traceType of jiuzhe.TRACE_TYPES) {
      for (const position of jiuzhe.TRACE_POSITIONS) {
        mountJiuzheTraceSlot(alienSlotId, traceType, position, layer, alienState, options, activeKeys);
      }
    }

    for (const [key, element] of tokenElements.entries()) {
      const parts = key.split(":");
      if (parts[0] !== TRACE_KIND_JIUZHE) continue;
      const slotId = Number(parts[1]);
      if (slotId !== alienSlotId || activeKeys.has(key)) continue;
      element.remove();
      tokenElements.delete(key);
    }
    for (const [key, element] of jiuzheSlotElements.entries()) {
      const parts = key.split(":");
      const slotId = Number(parts[1]);
      if (slotId !== alienSlotId || activeKeys.has(key)) continue;
      element.remove();
      jiuzheSlotElements.delete(key);
    }
  }

  function renderAllJiuzheTraceMarkers(getLayerForSlot, alienState, options = {}) {
    if (!jiuzhe) return;
    for (const alienSlotId of placement.ALIEN_SLOT_IDS) {
      const layer = getLayerForSlot(alienSlotId);
      if (layer) renderJiuzheTraceMarkers(alienSlotId, layer, alienState, options);
    }
  }

  function renderAlienBackImage(alienSlotId, backElement, alienState) {
    if (!backElement) return;

    const alienSlot = state.getAlienSlot(alienState, alienSlotId);
    const slotLabel = placement.getAlienSlotLabel(alienSlotId);

    if (alienSlot?.revealed && alienSlot.alienId) {
      const faceSrc = catalog.getAlienFaceSrc(alienSlot.alienId);
      const alienLabel = catalog.getAlienLabel(alienSlot.alienId);
      backElement.src = faceSrc;
      backElement.alt = `${slotLabel} ${alienLabel}`;
      backElement.classList.add("is-revealed");
      return;
    }

    backElement.src = catalog.ALIEN_BACK_SRC;
    backElement.alt = `${slotLabel} 牌背`;
    backElement.classList.remove("is-revealed");
  }

  function renderAllAlienBackImages(getBackImageForSlot, alienState) {
    for (const alienSlotId of placement.ALIEN_SLOT_IDS) {
      const backElement = getBackImageForSlot(alienSlotId);
      if (backElement) {
        renderAlienBackImage(alienSlotId, backElement, alienState);
      }
    }
  }

  function listTraceMarkerLayoutOverrides() {
    return [...firstLayoutOverrides.entries()]
      .map(([key, position]) => {
        const [, alienSlotId, traceType] = key.split(":");
        return {
          traceKind: TRACE_KIND_FIRST,
          alienSlotId: Number(alienSlotId),
          traceType,
          percentX: position.percentX,
          percentY: position.percentY,
        };
      })
      .sort((a, b) => {
        if (a.alienSlotId !== b.alienSlotId) return a.alienSlotId - b.alienSlotId;
        return placement.TRACE_TYPES.indexOf(a.traceType) - placement.TRACE_TYPES.indexOf(b.traceType);
      });
  }

  function listExtraTraceMarkerLayoutOverrides() {
    return [...extraLayoutOverrides.entries()]
      .map(([key, position]) => {
        const [, alienSlotId, traceType] = key.split(":");
        return {
          traceKind: TRACE_KIND_EXTRA,
          alienSlotId: Number(alienSlotId),
          traceType,
          percentX: position.percentX,
          percentY: position.percentY,
        };
      })
      .sort((a, b) => {
        if (a.alienSlotId !== b.alienSlotId) return a.alienSlotId - b.alienSlotId;
        return placement.TRACE_TYPES.indexOf(a.traceType) - placement.TRACE_TYPES.indexOf(b.traceType);
      });
  }

  function listJiuzheTraceMarkerLayoutOverrides() {
    return [...jiuzheLayoutOverrides.entries()]
      .map(([key, position]) => {
        const [, alienSlotId, traceType, tracePosition] = key.split(":");
        return {
          traceKind: TRACE_KIND_JIUZHE,
          alienSlotId: Number(alienSlotId),
          traceType,
          position: Number(tracePosition),
          percentX: position.percentX,
          percentY: position.percentY,
        };
      })
      .sort((a, b) => {
        if (a.alienSlotId !== b.alienSlotId) return a.alienSlotId - b.alienSlotId;
        const typeDiff = (jiuzhe?.TRACE_TYPES || placement.TRACE_TYPES).indexOf(a.traceType)
          - (jiuzhe?.TRACE_TYPES || placement.TRACE_TYPES).indexOf(b.traceType);
        if (typeDiff !== 0) return typeDiff;
        return a.position - b.position;
      });
  }

  function resetAlienTraceTokens() {
    for (const element of tokenElements.values()) {
      element.remove();
    }
    for (const element of jiuzheSlotElements.values()) {
      element.remove();
    }
    tokenElements.clear();
    jiuzheSlotElements.clear();
    firstLayoutOverrides.clear();
    extraLayoutOverrides.clear();
    jiuzheLayoutOverrides.clear();
    dragState = null;
  }

  return Object.freeze({
    bindAlienTraceDragging,
    clientToAlienStatePercent,
    getEffectiveTraceMarkerLayout,
    getEffectiveExtraTraceAnchorLayout,
    getEffectiveExtraTraceGridLayout,
    getEffectiveJiuzheTraceMarkerLayout,
    listTraceMarkerLayoutOverrides,
    listExtraTraceMarkerLayoutOverrides,
    listJiuzheTraceMarkerLayoutOverrides,
    renderAlienTraceMarkers,
    renderAllAlienTraceMarkers,
    renderJiuzheTraceMarkers,
    renderAllJiuzheTraceMarkers,
    renderAlienBackImage,
    renderAllAlienBackImages,
    resetAlienTraceTokens,
  });
});
