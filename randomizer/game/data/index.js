(function (root, factory) {
  "use strict";

  let placement = root.SetiDataPlacement;
  let state = root.SetiDataState;
  let nebulaPlacement = root.SetiNebulaDataPlacement;
  let nebulaState = root.SetiNebulaDataState;

  if (typeof require === "function") {
    placement = placement || require("./placement");
    state = state || require("./state");
    nebulaPlacement = nebulaPlacement || require("./nebula-placement");
    nebulaState = nebulaState || require("./nebula-state");
  }

  const api = factory(placement, state, nebulaPlacement, nebulaState);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiData = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (
  placement,
  state,
  nebulaPlacement,
  nebulaState,
) {
  "use strict";

  return Object.freeze({
    DATA_POOL_SLOTS: placement.DATA_POOL_SLOTS,
    COMPUTER_DATA_SLOTS: placement.COMPUTER_DATA_SLOTS,
    BLUE_BONUS_DATA_SLOTS: placement.BLUE_BONUS_DATA_SLOTS,
    PLACEMENT_KIND_COMPUTER: state.PLACEMENT_KIND_COMPUTER,
    PLACEMENT_KIND_BLUE_BONUS: state.PLACEMENT_KIND_BLUE_BONUS,
    DATA_TOKEN_SRC: state.DATA_TOKEN_SRC,
    createDefaultDataState: state.createDefaultDataState,
    getNextDataTokenSequence: state.getNextDataTokenSequence,
    restoreNextDataTokenSequence: state.restoreNextDataTokenSequence,
    normalizeDataState: state.normalizeDataState,
    ensurePlayerDataState: state.ensurePlayerDataState,
    listPoolTokens: state.listPoolTokens,
    listPlacedTokens: state.listPlacedTokens,
    listComputerPlacedTokens: state.listComputerPlacedTokens,
    listBlueBonusPlacedTokens: state.listBlueBonusPlacedTokens,
    listDataTokens: state.listDataTokens,
    listEligibleBlueBonusSlots: state.listEligibleBlueBonusSlots,
    hasBlueTechInBoardSlot: state.hasBlueTechInBoardSlot,
    hasBlueBonusPlaceOptions: state.hasBlueBonusPlaceOptions,
    gainData: state.gainData,
    ANALYZE_ENERGY_COST: state.ANALYZE_ENERGY_COST,
    isAnalyzeReady: state.isAnalyzeReady,
    canPlaceAnyData: state.canPlaceAnyData,
    listPlaceDataChoices: state.listPlaceDataChoices,
    canAnalyzeData: state.canAnalyzeData,
    analyzeData: state.analyzeData,
    analyzeDataWithoutEnergy: state.analyzeDataWithoutEnergy,
    canPlaceDataToComputer: state.canPlaceDataToComputer,
    canPlaceDataToBlueBonus: state.canPlaceDataToBlueBonus,
    placeDataToComputer: state.placeDataToComputer,
    DATA_TOKEN_DISPLAY_SCALE: placement.DATA_TOKEN_DISPLAY_SCALE,
    getDataPoolSlotLayout: placement.getDataPoolSlotLayout,
    getComputerDataSlotLayout: placement.getComputerDataSlotLayout,
    getComputerSlotBonus: placement.getComputerSlotBonus,
    getBlueBonusDataSlotLayout: placement.getBlueBonusDataSlotLayout,
    getRequiredComputerSlotForBlueBonus: placement.getRequiredComputerSlotForBlueBonus,
    getComputerSlotForBlueBoardSlot: placement.getComputerSlotForBlueBoardSlot,
    getBlueBoardSlotForComputerSlot: placement.getBlueBoardSlotForComputerSlot,
    getBlueTileDataBonus: placement.getBlueTileDataBonus,
    getBlueColumnScoreBonus: placement.getBlueColumnScoreBonus,
    getBlueTechTileInBoardSlot: state.getBlueTechTileInBoardSlot,
    getComputerSlotBlueColumnBonus: state.getComputerSlotBlueColumnBonus,
    getBlueBonusPlacementReward: state.getBlueBonusPlacementReward,
    NEBULA_DATA_CAPACITY: nebulaPlacement.NEBULA_DATA_CAPACITY,
    NEBULA_LABELS: nebulaPlacement.NEBULA_LABELS,
    NEBULA_IDS: nebulaPlacement.NEBULA_IDS,
    BOARD_SLOT_ROTATION: nebulaPlacement.BOARD_SLOT_ROTATION,
    getNebulaPanelRegion: nebulaPlacement.getNebulaPanelRegion,
    getBoardSlotRotation: nebulaPlacement.getBoardSlotRotation,
    sectorImageToNebulaLocal: nebulaPlacement.sectorImageToNebulaLocal,
    nebulaLocalToSectorImage: nebulaPlacement.nebulaLocalToSectorImage,
    getNebulaLabel: nebulaPlacement.getNebulaLabel,
    getNebulaColor: nebulaPlacement.getNebulaColor,
    getNebulaCapacity: nebulaPlacement.getNebulaCapacity,
    getNebulaDataSlotLayout: nebulaPlacement.getNebulaDataSlotLayout,
    getSectorWinMarkerConfig: nebulaPlacement.getSectorWinMarkerConfig,
    getSectorWinMarkerLayout: nebulaPlacement.getSectorWinMarkerLayout,
    listSectorWinDebugSlots: nebulaPlacement.listSectorWinDebugSlots,
    listNebulaIdsForSector: nebulaPlacement.listNebulaIdsForSector,
    createDefaultNebulaDataState: nebulaState.createDefaultNebulaDataState,
    getDeterministicSequences: nebulaState.getDeterministicSequences,
    restoreDeterministicSequences: nebulaState.restoreDeterministicSequences,
    createDefaultSectorSettlementState: nebulaState.createDefaultSectorSettlementState,
    normalizeNebulaDataState: nebulaState.normalizeNebulaDataState,
    listNebulaTokens: nebulaState.listNebulaTokens,
    listAllNebulaTokens: nebulaState.listAllNebulaTokens,
    fillNebulaData: nebulaState.fillNebulaData,
    fillAllNebulaData: nebulaState.fillAllNebulaData,
    clearNebulaData: nebulaState.clearNebulaData,
    updateNebulaTokenPosition: nebulaState.updateNebulaTokenPosition,
    addSectorExtraMark: nebulaState.addSectorExtraMark,
    removeSectorExtraMark: nebulaState.removeSectorExtraMark,
    listSectorExtraMarks: nebulaState.listSectorExtraMarks,
    isSectorReadyToSettle: nebulaState.isSectorReadyToSettle,
    getSectorTokenStats: nebulaState.getSectorTokenStats,
    getSectorRanking: nebulaState.getSectorRanking,
    orderSectorIdsByPlayerWinPriority: nebulaState.orderSectorIdsByPlayerWinPriority,
    getSettlementWinMarkerSlot: nebulaState.getSettlementWinMarkerSlot,
    listSectorWinRecords: nebulaState.listSectorWinRecords,
    settleSector: nebulaState.settleSector,
    settleCompletedSectors: nebulaState.settleCompletedSectors,
    SECTOR_WIN_REWARDS: nebulaState.SECTOR_WIN_REWARDS,
    getSectorWinnerRewardKey: nebulaState.getSectorWinnerRewardKey,
    buildSectorRewardDescriptors: nebulaState.buildSectorRewardDescriptors,
    getSectorSettlementReadoutLines: nebulaState.getSectorSettlementReadoutLines,
    NEBULA_SECOND_SLOT_INDEX: nebulaState.NEBULA_SECOND_SLOT_INDEX,
    NEBULA_SECOND_SLOT_SCORE: nebulaState.NEBULA_SECOND_SLOT_SCORE,
    getNebulaSecondSlotScoreReward: nebulaState.getNebulaSecondSlotScoreReward,
    AOMOMO_NEBULA_ID: nebulaState.AOMOMO_NEBULA_ID,
    getNebulaSlotScoreReward: nebulaState.getNebulaSlotScoreReward,
    getNebulaReplacementStats: nebulaState.getNebulaReplacementStats,
    getNextReplaceableNebulaToken: nebulaState.getNextReplaceableNebulaToken,
    revertNebulaTokenReplacement: nebulaState.revertNebulaTokenReplacement,
    replaceNextNebulaDataToken: nebulaState.replaceNextNebulaDataToken,
  });
});
