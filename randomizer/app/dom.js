(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppDom = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function collectElements(documentRef) {
    return {
      appWrap: documentRef.querySelector(".app-wrap"),
      startScreen: documentRef.getElementById("start-screen"),
      startScreenStartButton: documentRef.getElementById("start-screen-start-button"),
      startAiDifficulty: documentRef.getElementById("start-ai-difficulty"),
      startPlayerCount: documentRef.getElementById("start-player-count"),
      boardShell: documentRef.getElementById("board-shell"),
      playerCommand: documentRef.getElementById("player-command"),
      playerStats: documentRef.getElementById("player-stats"),
      opponentStatGrid: documentRef.getElementById("opponent-stat-grid"),
      playerHandPanel: documentRef.getElementById("player-hand-panel"),
      playerHandFan: documentRef.getElementById("player-hand-fan"),
      reservedCardPanel: documentRef.getElementById("reserved-card-panel"),
      reservedCardFan: documentRef.getElementById("reserved-card-fan"),
      initialSelectionArea: documentRef.getElementById("initial-selection-area"),
      actionBarMain: documentRef.getElementById("action-bar-main"),
      actionLaunchButton: documentRef.getElementById("action-launch-button"),
      actionOrbitButton: documentRef.getElementById("action-orbit-button"),
      actionLandButton: documentRef.getElementById("action-land-button"),
      actionScanButton: documentRef.getElementById("action-scan-button"),
      actionAnalyzeButton: documentRef.getElementById("action-analyze-button"),
      actionPlayCardButton: documentRef.getElementById("action-play-card-button"),
      actionResearchTechButton: documentRef.getElementById("action-research-tech-button"),
      actionQuickButton: documentRef.getElementById("action-quick-button"),
      actionPassButton: documentRef.getElementById("action-pass-button"),
      actionConfirmButton: documentRef.getElementById("action-confirm-button"),
      actionUndoButton: documentRef.getElementById("action-undo-button"),
      quickActionsPanel: documentRef.getElementById("quick-actions-panel"),
      quickActionsTrades: documentRef.getElementById("quick-actions-trades"),
      alienPanels: documentRef.querySelectorAll(".alien-panel"),
      alienTraceLayers: documentRef.querySelectorAll(".alien-trace-layer"),
      alienJiuzheTraceLayers: documentRef.querySelectorAll(".alien-jiuzhe-trace-layer"),
      alienJiuzheThresholds: documentRef.querySelectorAll(".alien-jiuzhe-thresholds"),
      alienYichangdianCardAreas: documentRef.querySelectorAll(".alien-yichangdian-card-area"),
      alienFangzhouCardAreas: documentRef.querySelectorAll(".alien-fangzhou-card-area"),
      alienBanrenmaCardAreas: documentRef.querySelectorAll(".alien-banrenma-card-area"),
      alienChongCardAreas: documentRef.querySelectorAll(".alien-chong-card-area"),
      alienAmibaCardAreas: documentRef.querySelectorAll(".alien-amiba-card-area"),
      alienAomomoCardAreas: documentRef.querySelectorAll(".alien-aomomo-card-area"),
      alienRunezuCardAreas: documentRef.querySelectorAll(".alien-runezu-card-area"),
      alienBanrenmaScoremarks: documentRef.querySelectorAll(".alien-banrenma-scoremarks"),
      finalScoreGrid: documentRef.getElementById("final-score-grid"),
      finalScoreTileWraps: documentRef.querySelectorAll(".final-score-tile-wrap"),
      finalScoreTiles: documentRef.querySelectorAll(".final-score-tile"),
      wheelWrap: documentRef.getElementById("wheel-wrap"),
      tokenLayer: documentRef.getElementById("token-layer"),
      planetsReference: documentRef.getElementById("planets-reference"),
      planetsReferenceImage: documentRef.querySelector(".planets-reference img"),
      planetsTokenLayer: documentRef.getElementById("planets-token-layer"),
      wheels: {
        1: documentRef.getElementById("wheel-1"),
        2: documentRef.getElementById("wheel-2"),
        3: documentRef.getElementById("wheel-3"),
        4: documentRef.getElementById("wheel-4"),
      },
      sectorWraps: {
        1: documentRef.getElementById("sector-wrap-1"),
        2: documentRef.getElementById("sector-wrap-2"),
        3: documentRef.getElementById("sector-wrap-3"),
        4: documentRef.getElementById("sector-wrap-4"),
      },
      playerBoardTechLayer: documentRef.getElementById("player-board-tech-layer"),
      playerBoardDataLayer: documentRef.getElementById("player-board-data-layer"),
      techTiles: [...documentRef.querySelectorAll(".tech-tile[data-tech-id]")],
      techBonuses: [...documentRef.querySelectorAll(".tech-bonus[data-tech-bonus-for]")],
      roundStatusToken: documentRef.getElementById("round-status-token"),
      roundStatusRound: documentRef.getElementById("round-status-round"),
      roundStatusTurn: documentRef.getElementById("round-status-turn"),
      publicCardPanel: documentRef.getElementById("public-card-panel"),
      publicCardRow: documentRef.getElementById("public-card-row"),
      playerHandPanelTitle: documentRef.getElementById("player-hand-panel-title"),
      playerHandPanelHandCount: documentRef.getElementById("player-hand-panel-hand-count"),
      playerHandPanelTitleHint: documentRef.getElementById("player-hand-panel-title-hint"),
    };
  }

  return {
    collectElements,
  };
});
