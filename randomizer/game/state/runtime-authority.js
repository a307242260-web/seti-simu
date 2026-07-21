(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiRuntimeAuthority = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  function create(highCouplingState, initialState) {
    if (typeof highCouplingState?.createHighCouplingStateStore !== "function") {
      throw new TypeError("RuntimeAuthority 缺少 HighCouplingState store factory");
    }
    return highCouplingState.createHighCouplingStateStore(initialState);
  }

  return Object.freeze({ create });
});
