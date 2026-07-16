(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppViewAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const NOOP = () => {};
  const EMPTY_COLLECTION_KEYS = Object.freeze([
    "alienPanels",
    "alienTraceLayers",
    "alienJiuzheTraceLayers",
    "alienJiuzheThresholds",
    "alienYichangdianCardAreas",
    "alienFangzhouCardAreas",
    "alienBanrenmaCardAreas",
    "alienBanrenmaScoremarks",
    "alienChongCardAreas",
    "alienAmibaCardAreas",
    "alienAomomoCardAreas",
    "alienRunezuCardAreas",
    "finalScoreTiles",
    "finalScoreTileWraps",
    "techTiles",
  ]);
  const RENDER_METHODS = Object.freeze([
    "setTokenAssetSizes",
    "renderRocketElement",
    "renderChongFossilOwnerTokenForRocket",
    "renderChongFossilOwnerTokens",
    "renderRockets",
    "renderPiratesRaidPlanetMarkers",
    "renderYichangdianAnomalyMarkers",
    "renderChongPlanetFossilMarkers",
    "renderRunezuBoardSymbols",
    "renderOpponentStats",
    "renderPlayerHand",
    "renderReservedCards",
    "renderPublicCards",
    "renderInitialSelectionArea",
    "renderPlayerDataBoard",
    "renderPlayerStats",
    "renderSectorNebulaDataBoard",
    "renderWheels",
    "renderSectors",
    "renderStateReadout",
    "renderRotateStateToken",
  ]);

  function createNoopElements() {
    return Object.fromEntries(EMPTY_COLLECTION_KEYS.map((key) => [key, []]));
  }

  function createNoopMethods(names) {
    return Object.fromEntries(names.map((name) => [name, NOOP]));
  }

  function createNoopViewAdapter() {
    return {
      kind: "noop",
      els: createNoopElements(),
      scheduleFrame() { return null; },
      getComputedStyle() { return { getPropertyValue: () => "" }; },
      hoverRuntime: {
        attach(anchor) { return anchor; },
        show: NOOP,
        hide: NOOP,
        position: NOOP,
        ensure() { return null; },
      },
      actionLogViewRuntime: {
        renderActionLog: NOOP,
        setReportTab: NOOP,
        isDebugToolsEnabled() { return false; },
        isStateLogEnabled() { return false; },
      },
      renderRuntime: createNoopMethods(RENDER_METHODS),
    };
  }

  return {
    createNoopViewAdapter,
  };
});
