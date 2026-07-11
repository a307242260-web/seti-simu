(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiAppAlienTraceRewardFlow = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function resolveAllowedAlienSlotIds(allowedAlienSlotIds, fallback = null) {
    return Array.isArray(allowedAlienSlotIds)
      ? allowedAlienSlotIds.map(Number)
      : fallback;
  }

  function resolveAlienTraceRewardFlow(options = {}) {
    const context = {
      effect: options.effect || null,
      allowedTraceTypes: options.allowedTraceTypes || [],
      allowedAlienSlotIds: Object.prototype.hasOwnProperty.call(options, "allowedAlienSlotIds")
        ? options.allowedAlienSlotIds
        : null,
      targetPlayer: options.targetPlayer || null,
    };

    const fangzhouResult = typeof options.openFangzhouChoice === "function"
      ? options.openFangzhouChoice(context)
      : null;
    if (fangzhouResult) {
      return { route: "fangzhou", result: fangzhouResult };
    }

    const hasPanelTarget = typeof options.hasPanelPlacementTarget === "function"
      && options.hasPanelPlacementTarget(context);
    if (hasPanelTarget) {
      const result = typeof options.beginPanelPlacement === "function"
        ? options.beginPanelPlacement(context)
        : null;
      return { route: "panel", result };
    }

    const result = typeof options.finishNoTarget === "function"
      ? options.finishNoTarget(context)
      : null;
    return { route: "no-target", result };
  }

  return {
    resolveAllowedAlienSlotIds,
    resolveAlienTraceRewardFlow,
  };
});
