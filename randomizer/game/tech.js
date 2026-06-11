(function () {
  "use strict";

  const TECH_TILE_IDS = Object.freeze([
    "blue1", "blue2", "blue3", "blue4",
    "orange1", "orange2", "orange3", "orange4",
    "purple1", "purple2", "purple3", "purple4",
  ]);

  const BLUE_TECH_IDS = Object.freeze(["blue1", "blue2", "blue3", "blue4"]);
  const ORANGE_TECH_IDS = Object.freeze(["orange1", "orange2", "orange3", "orange4"]);
  const PURPLE_TECH_IDS = Object.freeze(["purple1", "purple2", "purple3", "purple4"]);

  const BONUS_TILE_IDS = Object.freeze(["bonus_1c", "bonus_1m", "bonus_1p", "bonus_3f"]);

  const BONUS_LABELS = Object.freeze({
    bonus_1c: "1 信用点",
    bonus_1m: "1 里程碑",
    bonus_1p: "1 推广",
    bonus_3f: "3 终局分",
  });

  const TECH_LOCATION = Object.freeze({
    SUPPLY: "supply",
    PLAYER_BOARD: "player_board",
  });

  const PLAYER_BOARD_LAYOUT = Object.freeze({
    blueSlots: Object.freeze({
      1: Object.freeze({ percentX: 34.69, percentY: 73.84, scalePercent: 36.14 }),
      2: Object.freeze({ percentX: 49.27, percentY: 73.56, scalePercent: 36.14 }),
      3: Object.freeze({ percentX: 63.85, percentY: 74.67, scalePercent: 36.14 }),
      4: Object.freeze({ percentX: 72.05, percentY: 74.39, scalePercent: 36.14 }),
    }),
    orange: Object.freeze({
      orange1: Object.freeze({ percentX: 11.91, percentY: 32.4, scalePercent: 36.14 }),
      orange2: Object.freeze({ percentX: 20.01, percentY: 32.68, scalePercent: 36.14 }),
      orange3: Object.freeze({ percentX: 34.49, percentY: 32.68, scalePercent: 36.14 }),
      orange4: Object.freeze({ percentX: 42.79, percentY: 32.68, scalePercent: 36.14 }),
    }),
    purple: Object.freeze({
      purple1: Object.freeze({ percentX: 61.47, percentY: 32.4, scalePercent: 36.14 }),
      purple2: Object.freeze({ percentX: 75.76, percentY: 32.12, scalePercent: 36.14 }),
      purple3: Object.freeze({ percentX: 83.96, percentY: 31.84, scalePercent: 36.14 }),
      purple4: Object.freeze({ percentX: 92.16, percentY: 32.4, scalePercent: 36.14 }),
    }),
  });

  function roundCoordinate(value) {
    return Math.round(Number(value) * 100) / 100;
  }

  function pickRandomBonusId() {
    return BONUS_TILE_IDS[Math.floor(Math.random() * BONUS_TILE_IDS.length)];
  }

  function createTileRecord(tileId, bonusId = null) {
    return {
      tileId,
      location: TECH_LOCATION.SUPPLY,
      blueSlot: null,
      bonusId: bonusId || pickRandomBonusId(),
    };
  }

  function createState() {
    const tiles = {};
    for (const tileId of TECH_TILE_IDS) {
      tiles[tileId] = createTileRecord(tileId);
    }

    return {
      takeTechDebugEnabled: false,
      tiles,
      pendingBlueTileId: null,
      statusNote: "",
    };
  }

  function randomizeSupplyBonuses(state) {
    for (const tileId of TECH_TILE_IDS) {
      const tile = getTileRecord(state, tileId);
      if (tile) {
        tile.bonusId = pickRandomBonusId();
      }
    }
    return state;
  }

  function isBlueTech(tileId) {
    return BLUE_TECH_IDS.includes(tileId);
  }

  function getTileRecord(state, tileId) {
    return state.tiles[tileId] || null;
  }

  function isTileInSupply(state, tileId) {
    const tile = getTileRecord(state, tileId);
    return tile?.location === TECH_LOCATION.SUPPLY;
  }

  function getOccupiedBlueSlots(state) {
    const occupied = new Map();
    for (const tileId of BLUE_TECH_IDS) {
      const tile = getTileRecord(state, tileId);
      if (tile?.location === TECH_LOCATION.PLAYER_BOARD && tile.blueSlot != null) {
        occupied.set(tile.blueSlot, tileId);
      }
    }
    return occupied;
  }

  function getAvailableBlueSlots(state) {
    const occupied = getOccupiedBlueSlots(state);
    return [1, 2, 3, 4].filter((slot) => !occupied.has(slot));
  }

  function getPlacementLayout(tileId, blueSlot = null) {
    if (isBlueTech(tileId)) {
      if (blueSlot == null) return null;
      return PLAYER_BOARD_LAYOUT.blueSlots[blueSlot] || null;
    }
    if (ORANGE_TECH_IDS.includes(tileId)) {
      return PLAYER_BOARD_LAYOUT.orange[tileId] || null;
    }
    if (PURPLE_TECH_IDS.includes(tileId)) {
      return PLAYER_BOARD_LAYOUT.purple[tileId] || null;
    }
    return null;
  }

  function placeTileOnPlayerBoard(state, tileId, blueSlot = null) {
    const tile = getTileRecord(state, tileId);
    if (!tile) {
      return { ok: false, message: `未知科技板块 ${tileId}` };
    }
    if (tile.location === TECH_LOCATION.PLAYER_BOARD) {
      return { ok: false, message: `${tileId} 已在玩家版图` };
    }

    if (isBlueTech(tileId)) {
      const slot = Number(blueSlot);
      if (![1, 2, 3, 4].includes(slot)) {
        return { ok: false, message: "请选择蓝色科技放置位置 1-4" };
      }
      if (!getAvailableBlueSlots(state).includes(slot)) {
        return { ok: false, message: `蓝色科技位置 ${slot} 已被占用` };
      }
      tile.blueSlot = slot;
    } else {
      tile.blueSlot = null;
    }

    const layout = getPlacementLayout(tileId, tile.blueSlot);
    if (!layout) {
      return { ok: false, message: `无法确定 ${tileId} 的放置坐标` };
    }

    tile.location = TECH_LOCATION.PLAYER_BOARD;
    state.pendingBlueTileId = null;
    const bonusLabel = BONUS_LABELS[tile.bonusId] || tile.bonusId || "";
    const bonusSuffix = bonusLabel ? `，奖励 ${bonusLabel}` : "";
    state.statusNote = isBlueTech(tileId)
      ? `拿取科技：${tileId} → 蓝色位置 ${tile.blueSlot}${bonusSuffix}`
      : `拿取科技：${tileId}${bonusSuffix}`;

    return {
      ok: true,
      message: state.statusNote,
      tile: structuredClone(tile),
      layout: structuredClone(layout),
    };
  }

  function requestTakeTech(state, tileId) {
    if (!state.takeTechDebugEnabled) {
      return { ok: false, message: "请先开启拿取科技调试" };
    }
    if (!isTileInSupply(state, tileId)) {
      return { ok: false, message: `${tileId} 不在待拿取区` };
    }

    if (isBlueTech(tileId)) {
      const availableSlots = getAvailableBlueSlots(state);
      if (!availableSlots.length) {
        return { ok: false, message: "蓝色科技位置已满" };
      }
      if (availableSlots.length === 1) {
        return placeTileOnPlayerBoard(state, tileId, availableSlots[0]);
      }
      state.pendingBlueTileId = tileId;
      return {
        ok: true,
        needsBlueSlotChoice: true,
        tileId,
        availableSlots,
        message: `请选择 ${tileId} 的蓝色放置位置`,
      };
    }

    return placeTileOnPlayerBoard(state, tileId);
  }

  function confirmBlueSlotChoice(state, tileId, blueSlot) {
    if (state.pendingBlueTileId !== tileId) {
      return { ok: false, message: "当前没有待放置的蓝色科技" };
    }
    return placeTileOnPlayerBoard(state, tileId, blueSlot);
  }

  function cancelBlueSlotChoice(state) {
    state.pendingBlueTileId = null;
    return { ok: true, message: "已取消蓝色科技放置" };
  }

  function setTakeTechDebugEnabled(state, enabled) {
    state.takeTechDebugEnabled = enabled;
    if (!enabled) {
      state.pendingBlueTileId = null;
    }
    return state.takeTechDebugEnabled;
  }

  function applyPlayerBoardTileStyle(element, layout) {
    element.classList.add("tech-tile-positioned");
    element.style.position = "absolute";
    element.style.left = `${layout.percentX}%`;
    element.style.top = `${layout.percentY}%`;
    element.style.setProperty("--tech-scale", String(layout.scalePercent / 100));
    element.style.transform = "translate(-50%, -50%) scale(var(--tech-scale, 1))";
    element.style.transformOrigin = "center center";
    element.dataset.techScale = String(layout.scalePercent);
  }

  function clearTileInlineStyles(element) {
    element.style.removeProperty("display");
    element.style.removeProperty("position");
    element.style.removeProperty("left");
    element.style.removeProperty("top");
    element.style.removeProperty("transform");
    element.style.removeProperty("z-index");
    element.style.removeProperty("--tech-scale");
    element.classList.remove("tech-tile-positioned", "is-takable", "is-pending-blue");
    element.removeAttribute("data-tech-scale");
    element.removeAttribute("title");
    element.hidden = false;
  }

  function getSupplySlotElement(context, tileId) {
    return context.supplySlots?.[tileId] || null;
  }

  function getSupplyStackElement(context, tileId) {
    const slot = getSupplySlotElement(context, tileId);
    return slot?.querySelector(".tech-slot-stack") || slot;
  }

  function getSupplyTileWrapElement(context, tileId) {
    const stack = getSupplyStackElement(context, tileId);
    return stack?.querySelector(".tech-tile-wrap") || stack;
  }

  function mountTileInSupplySlot(element, tileId, context) {
    const stack = getSupplyStackElement(context, tileId);
    if (!stack) return false;

    const wrap = getSupplyTileWrapElement(context, tileId);
    const mountTarget = wrap || stack;
    const bonusElement = stack.querySelector(".tech-bonus");

    if (element.parentElement !== mountTarget) {
      const overlay = mountTarget.querySelector?.(".tech-first-take-overlay");
      if (overlay) mountTarget.insertBefore(element, overlay);
      else if (mountTarget === stack && bonusElement) stack.insertBefore(element, bonusElement);
      else mountTarget.appendChild(element);
    }
    return true;
  }

  function renderSupplySlot(state, context, tileId) {
    const slot = getSupplySlotElement(context, tileId);
    const bonusElement = slot?.querySelector(".tech-bonus");
    const overlayElement = slot?.querySelector(".tech-first-take-overlay");
    if (!slot) return;

    const tile = getTileRecord(state, tileId);
    const inSupply = tile?.location === TECH_LOCATION.SUPPLY;

    slot.classList.toggle("is-taken", !inSupply);

    if (overlayElement) {
      overlayElement.hidden = !inSupply;
    }

    if (!bonusElement) return;

    if (inSupply && tile.bonusId) {
      bonusElement.src = `../assets/tech_tile/${tile.bonusId}.png`;
      bonusElement.alt = BONUS_LABELS[tile.bonusId] || tile.bonusId;
      bonusElement.hidden = false;
      bonusElement.title = BONUS_LABELS[tile.bonusId] || tile.bonusId;
      return;
    }

    bonusElement.hidden = true;
    bonusElement.removeAttribute("src");
    bonusElement.removeAttribute("alt");
    bonusElement.removeAttribute("title");
  }

  function renderAll(state, context, tileElements) {
    const { supplyStage, playerBoardTechLayer } = context;
    if (!supplyStage || !playerBoardTechLayer) return;

    supplyStage.classList.toggle("take-tech-debug-active", state.takeTechDebugEnabled);

    for (const element of tileElements) {
      const tileId = element.dataset.techId;
      const tile = getTileRecord(state, tileId);
      if (!tile) continue;

      clearTileInlineStyles(element);

      if (tile.location === TECH_LOCATION.SUPPLY) {
        mountTileInSupplySlot(element, tileId, context);
        if (state.takeTechDebugEnabled && isTileInSupply(state, tileId)) {
          element.classList.add("is-takable");
          element.title = `点击拿取 ${tileId}`;
          if (state.pendingBlueTileId === tileId) {
            element.classList.add("is-pending-blue");
          }
        }
        continue;
      }

      const layout = getPlacementLayout(tileId, tile.blueSlot);
      if (!layout) continue;

      if (element.parentElement !== playerBoardTechLayer) {
        playerBoardTechLayer.appendChild(element);
      }
      applyPlayerBoardTileStyle(element, layout);

      const slotLabel = isBlueTech(tileId) ? ` 槽位${tile.blueSlot}` : "";
      element.title = `${tileId} @玩家版图${slotLabel} 中心 ${layout.percentX}%,${layout.percentY}% 缩放 ${layout.scalePercent}%`;
    }

    for (const tileId of TECH_TILE_IDS) {
      renderSupplySlot(state, context, tileId);
    }
  }

  function bindSupplyTileClicks(state, context, tileElements, handlers = {}) {
    for (const element of tileElements) {
      element.draggable = false;
      element.addEventListener("click", () => {
        const tileId = element.dataset.techId;
        if (!tileId || !state.takeTechDebugEnabled) return;

        const result = requestTakeTech(state, tileId);
        if (result.needsBlueSlotChoice && handlers.onBlueSlotChoiceRequested) {
          handlers.onBlueSlotChoiceRequested(result);
        }
        if (result.ok && !result.needsBlueSlotChoice) {
          renderAll(state, context, tileElements);
        }
        if (handlers.onChange) handlers.onChange(result);
      });
    }
  }

  function formatPlacementLine(tileId, tile, layout) {
    const slotLabel = tile.blueSlot == null ? "" : ` 槽位${tile.blueSlot}`;
    return `${tileId} @玩家版图${slotLabel} 中心 ${layout.percentX}%,${layout.percentY}% 缩放 ${layout.scalePercent}%`;
  }

  function getReadoutLines(state) {
    const placedTiles = TECH_TILE_IDS
      .map((tileId) => {
        const tile = getTileRecord(state, tileId);
        if (tile?.location !== TECH_LOCATION.PLAYER_BOARD) return null;
        const layout = getPlacementLayout(tileId, tile.blueSlot);
        if (!layout) return null;
        return formatPlacementLine(tileId, tile, layout);
      })
      .filter(Boolean);

    const supplyTiles = TECH_TILE_IDS.filter((tileId) => isTileInSupply(state, tileId));

    if (!placedTiles.length && !supplyTiles.length && !state.takeTechDebugEnabled && !state.statusNote) {
      return [];
    }

    const lines = ["玩家科技板块（相对玩家版图百分比）"];
    if (placedTiles.length) {
      lines.push("[玩家版图]");
      lines.push(...placedTiles);
    } else {
      lines.push("[玩家版图]");
      lines.push("无");
    }
    if (supplyTiles.length) {
      lines.push("[待拿取科技信息]");
      lines.push(...supplyTiles.map((tileId) => {
        const tile = getTileRecord(state, tileId);
        const bonusLabel = BONUS_LABELS[tile?.bonusId] || tile?.bonusId || "无奖励";
        return `${tileId} 奖励 ${bonusLabel}`;
      }));
    }

    if (state.takeTechDebugEnabled) {
      const availableBlueSlots = getAvailableBlueSlots(state);
      lines.push(`可用蓝色位置 ${availableBlueSlots.length ? availableBlueSlots.join("、") : "无"}`);
    }

    if (state.statusNote) {
      lines.push(state.statusNote);
    }

    return lines;
  }

  function getSnapshot(state) {
    return {
      takeTechDebugEnabled: state.takeTechDebugEnabled,
      pendingBlueTileId: state.pendingBlueTileId,
      statusNote: state.statusNote,
      tiles: structuredClone(state.tiles),
      playerBoardLayout: structuredClone(PLAYER_BOARD_LAYOUT),
    };
  }

  const api = {
    TECH_TILE_IDS,
    BLUE_TECH_IDS,
    ORANGE_TECH_IDS,
    PURPLE_TECH_IDS,
    BONUS_TILE_IDS,
    BONUS_LABELS,
    TECH_LOCATION,
    PLAYER_BOARD_LAYOUT,
    createState,
    randomizeSupplyBonuses,
    setTakeTechDebugEnabled,
    requestTakeTech,
    confirmBlueSlotChoice,
    cancelBlueSlotChoice,
    getAvailableBlueSlots,
    getPlacementLayout,
    renderAll,
    bindSupplyTileClicks,
    getReadoutLines,
    getSnapshot,
    isTileInSupply,
    isBlueTech,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    window.SetiTech = api;
  }
})();
