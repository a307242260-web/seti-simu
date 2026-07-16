(function (root, factory) {
  "use strict";

  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppRefresh = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function requireFunction(name, fn) {
    if (typeof fn !== "function") {
      throw new Error(`createRefreshHelpers requires function: ${name}`);
    }
    return fn;
  }

  function createRefreshHelpers(context = {}) {
    const renderPlayerStats = requireFunction("renderPlayerStats", context.renderPlayerStats);
    const renderAlienPanels = requireFunction("renderAlienPanels", context.renderAlienPanels);
    const renderRockets = requireFunction("renderRockets", context.renderRockets);
    const renderActionEffectBar = requireFunction("renderActionEffectBar", context.renderActionEffectBar);
    const updateQuickPanel = requireFunction("updateQuickPanel", context.updateQuickPanel);
    const updateActionButtons = requireFunction("updateActionButtons", context.updateActionButtons);
    const renderStateReadout = requireFunction("renderStateReadout", context.renderStateReadout);
    const renderTechBoard = requireFunction("renderTechBoard", context.renderTechBoard);
    const renderSectorNebulaDataBoard = requireFunction("renderSectorNebulaDataBoard", context.renderSectorNebulaDataBoard);
    const renderFinalScoreBoard = requireFunction("renderFinalScoreBoard", context.renderFinalScoreBoard);

    const renderRunezuBoardSymbols = typeof context.renderRunezuBoardSymbols === "function"
      ? context.renderRunezuBoardSymbols
      : null;

    function refreshPlayerPanels() {
      renderAlienPanels();
      renderRockets();
      renderPlayerStats();
    }

    function refreshActionState(options = {}) {
      if (options.includeQuickPanel !== false) updateQuickPanel();
      if (options.includeEffectBar !== false) renderActionEffectBar();
      if (options.includeActionButtons !== false) updateActionButtons();
      if (options.includeStateReadout !== false) renderStateReadout();
    }

    function refreshBoardState(options = {}) {
      if (options.includeSectorNebula !== false) renderSectorNebulaDataBoard();
      if (options.includeRunezuSymbols && renderRunezuBoardSymbols) renderRunezuBoardSymbols();
      if (options.includeTech !== false) renderTechBoard();
      if (options.includeFinalScore !== false) renderFinalScoreBoard();
      if (options.includeStateReadout) renderStateReadout();
    }

    function refreshAfterPendingChange(options = {}) {
      refreshActionState({
        includeQuickPanel: options.includeQuickPanel,
        includeEffectBar: options.includeEffectBar,
        includeActionButtons: options.includeActionButtons,
        includeStateReadout: options.includeStateReadout,
      });
    }

    return {
      refreshPlayerPanels,
      refreshActionState,
      refreshBoardState,
      refreshAfterPendingChange,
    };
  }

  return {
    createRefreshHelpers,
  };
});
