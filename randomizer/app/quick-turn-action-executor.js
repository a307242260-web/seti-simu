(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiQuickTurnActionExecutor = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const ACTION_FAMILIES = Object.freeze([]);

  function fail(code, message, details = {}) {
    return { ok: false, code, message, ...details };
  }

  function createQuickTurnActionExecutor() {
    return Object.freeze({
      actionFamilies: ACTION_FAMILIES,
      execute(_workingRoot, descriptor) {
        return fail(
          "QUICK_TURN_MIGRATED",
          `${descriptor?.family || "quick/turn"} 已迁入 Production Composition`,
        );
      },
    });
  }

  return Object.freeze({ ACTION_FAMILIES, createQuickTurnActionExecutor });
});
