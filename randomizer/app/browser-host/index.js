(function (root, factory) {
  "use strict";

  const api = factory(
    root.SetiBrowserProjectionAdapter,
    root.SetiBrowserViewStateStore,
    root.SetiBrowserInputAdapter,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiBrowserHost = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (
  projectionAdapter,
  viewStateStore,
  inputAdapter,
) {
  "use strict";

  if (!projectionAdapter || !viewStateStore || !inputAdapter) {
    throw new Error("SetiBrowserHost 缺少 projection/view-state/input reference module");
  }
  return Object.freeze({
    SCHEMA_VERSION: "seti-browser-host-v1",
    projectionAdapter,
    viewStateStore,
    inputAdapter,
  });
});
