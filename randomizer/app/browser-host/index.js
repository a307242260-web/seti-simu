(function (root, factory) {
  "use strict";

  const api = factory(
    root.SetiBrowserProjectionAdapter,
    root.SetiBrowserViewStateStore,
    root.SetiBrowserInputAdapter,
    root.SetiBrowserActionBar,
    root.SetiBrowserDecisionUi,
    root.SetiBrowserCardDecisionUi,
    root.SetiBrowserIndustryAlienDecisionUi,
    root.SetiBrowserResidentProjection,
    root.SetiBrowserResidentRenderer,
  );
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiBrowserHost = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (
  projectionAdapter,
  viewStateStore,
  inputAdapter,
  actionBar,
  decisionUi,
  cardDecisionUi,
  industryAlienDecisionUi,
  residentProjection,
  residentRenderer,
) {
  "use strict";

  if (!projectionAdapter || !viewStateStore || !inputAdapter || !actionBar || !decisionUi || !industryAlienDecisionUi || !residentProjection || !residentRenderer) {
    throw new Error("SetiBrowserHost 缺少 projection/view-state/input/action-bar/decision-ui/resident renderer module");
  }
  return Object.freeze({
    SCHEMA_VERSION: "seti-browser-host-v1",
    projectionAdapter,
    viewStateStore,
    inputAdapter,
    actionBar,
    decisionUi,
    cardDecisionUi,
    industryAlienDecisionUi,
    residentProjection,
    residentRenderer,
  });
});
