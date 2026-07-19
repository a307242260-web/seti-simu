(function (root, factory) {
  "use strict";

  const api = factory(
    root.SetiBrowserProjectionAdapter,
    root.SetiBrowserViewStateStore,
    root.SetiBrowserInputAdapter,
    root.SetiBrowserDecisionUi,
    root.SetiBrowserResidentProjection,
    root.SetiBrowserResidentRenderer,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiBrowserHost = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (
  projectionAdapter,
  viewStateStore,
  inputAdapter,
  decisionUi,
  residentProjection,
  residentRenderer,
) {
  "use strict";

  if (!projectionAdapter || !viewStateStore || !inputAdapter || !decisionUi || !residentProjection || !residentRenderer) {
    throw new Error("SetiBrowserHost 缺少 projection/view-state/input/decision-ui/resident renderer module");
  }
  return Object.freeze({
    SCHEMA_VERSION: "seti-browser-host-v1",
    projectionAdapter,
    viewStateStore,
    inputAdapter,
    decisionUi,
    residentProjection,
    residentRenderer,
  });
});
