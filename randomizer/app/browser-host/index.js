(function (root, factory) {
  "use strict";

  const api = factory(
    root.SetiBrowserProjectionAdapter,
    root.SetiBrowserViewStateStore,
    root.SetiBrowserInputAdapter,
    root.SetiBrowserResidentProjection,
    root.SetiBrowserResidentRenderer,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiBrowserHost = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (
  projectionAdapter,
  viewStateStore,
  inputAdapter,
  residentProjection,
  residentRenderer,
) {
  "use strict";

  if (!projectionAdapter || !viewStateStore || !inputAdapter || !residentProjection || !residentRenderer) {
    throw new Error("SetiBrowserHost 缺少 projection/view-state/input/resident renderer module");
  }
  return Object.freeze({
    SCHEMA_VERSION: "seti-browser-host-v1",
    projectionAdapter,
    viewStateStore,
    inputAdapter,
    residentProjection,
    residentRenderer,
  });
});
