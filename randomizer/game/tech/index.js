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

  if (typeof module === "undefined") root.SetiTech = api;})(typeof globalThis !== "undefined" ? globalThis : window, function (
  catalog,
  boardState,
  playerTech,
  placement,
  bonuses,
  resolver,
) {
  "use strict";

  function createState(random = Math.random) {
    const board = boardState.createBoardState();
    boardState.setupBoardBonuses(board, random);
    return board;
  }

  function setupBoardBonuses(board, random) {
    boardState.setupBoardBonuses(board, random);
    return board;
  }

  function getSnapshot(board) {
    return boardState.getSnapshot(board);
  }

  return Object.freeze({
    ...catalog,
    PLAYER_BOARD_LAYOUT: placement.PLAYER_BOARD_LAYOUT,
    createState,
    setupBoardBonuses,
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
