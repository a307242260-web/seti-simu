(function (root, factory) {
  "use strict";

  let catalog = root.SetiTechCatalog;
  let boardState = root.SetiTechBoardState;
  let playerTech = root.SetiPlayerTech;
  let placement = root.SetiTechPlacement;
  let bonuses = root.SetiTechBonuses;
  let resolver = root.SetiTechResolver;

  if (typeof require === "function") {
    catalog = catalog || require("./catalog");
    boardState = boardState || require("./board-state");
    playerTech = playerTech || require("./player-tech");
    placement = placement || require("./placement");
    bonuses = bonuses || require("./bonuses");
    resolver = resolver || require("./resolver");
  }

  const api = factory(catalog, boardState, playerTech, placement, bonuses, resolver);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiTech = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (
  catalog,
  boardState,
  playerTech,
  placement,
  bonuses,
  resolver,
) {
  "use strict";

  function createUiState(source = {}) {
    return {
      cheatModeEnabled: Boolean(source.cheatModeEnabled ?? source.takeTechDebugEnabled),
      techSelectionActive: false,
      allowedTechTypes: Array.isArray(source.allowedTechTypes) ? [...source.allowedTechTypes] : null,
      pendingTileId: null,
      selectedTileId: source.selectedTileId || null,
      selectedBlueSlot: source.selectedBlueSlot || null,
      statusNote: "",
    };
  }

  function createState(random = Math.random) {
    const board = boardState.createBoardState();
    boardState.setupBoardBonuses(board, random);
    return {
      board,
      ui: createUiState(),
    };
  }

  function setupBoardBonuses(gameState, random) {
    boardState.setupBoardBonuses(gameState.board, random);
    return gameState;
  }

  function setCheatModeEnabled(gameState, enabled) {
    gameState.ui.cheatModeEnabled = enabled;
    return enabled;
  }

  function setTechSelectionActive(gameState, active) {
    gameState.ui.techSelectionActive = active;
    if (!active) {
      gameState.ui.pendingTileId = null;
      gameState.ui.selectedTileId = null;
      gameState.ui.selectedBlueSlot = null;
      gameState.ui.allowedTechTypes = null;
    }
    return active;
  }

  function cancelPendingTake(gameState) {
    gameState.ui.pendingTileId = null;
    gameState.ui.selectedTileId = null;
    gameState.ui.selectedBlueSlot = null;
    gameState.ui.allowedTechTypes = null;
    return { ok: true };
  }

  function requestTakeTech(context, gameState, tileId, options = {}) {
    const skipCost = Boolean(gameState.ui.cheatModeEnabled || options.skipCost);
    const skipRotation = Boolean(options.skipRotation);

    return resolver.executeTakeTech(context, {
      tileId,
      blueSlot: options.blueSlot,
      skipCost,
      skipRotation,
    });
  }

  function confirmBlueSlotChoice(context, gameState, tileId, blueSlot) {
    if (gameState.ui.pendingTileId !== tileId) {
      return { ok: false, message: "当前没有待放置的蓝色科技" };
    }
    return requestTakeTech(context, gameState, tileId, { blueSlot });
  }

  function getSnapshot(gameState) {
    return {
      board: boardState.getSnapshot(gameState.board),
      ui: structuredClone(gameState.ui),
    };
  }

  return Object.freeze({
    ...catalog,
    PLAYER_BOARD_LAYOUT: placement.PLAYER_BOARD_LAYOUT,
    createState,
    createUiState,
    setupBoardBonuses,
    setCheatModeEnabled,
    setTechSelectionActive,
    cancelPendingTake,
    requestTakeTech,
    confirmBlueSlotChoice,
    getAvailableBlueSlots: resolver.getAvailableBlueSlots,
    getPlacementLayout: placement.getPlacementLayout,
    listTakeableTiles: resolver.listTakeableTiles,
    listAvailableTypes: resolver.listAvailableTypes,
    getSnapshot,
    isInSupply: boardState.isInSupply,
    isSlotAvailable: boardState.isSlotAvailable,
    getStack: boardState.getStack,
    getRemainingForSlot: boardState.getRemainingForSlot,
    getRemainingForType: boardState.getRemainingForType,
    boardState,
    playerTech,
    resolver,
    bonuses,
  });
});
