(function (root, factory) {
  "use strict";

  let placement = root.SetiIndustryPlacement;
  let state = root.SetiIndustryState;
  let catalog = root.SetiIndustryCatalog;
  let passives = root.SetiIndustryPassives;
  let abilities = root.SetiIndustryAbilities;
  let strategyPassive = root.SetiIndustryStrategyPassive;
  let heliosPassive = root.SetiIndustryHeliosPassive;

  if (typeof require === "function") {
    placement = placement || require("./placement");
    state = state || require("./state");
    catalog = catalog || require("./catalog");
    passives = passives || require("./passives");
    abilities = abilities || require("./abilities");
    strategyPassive = strategyPassive || require("./strategy-passive");
    heliosPassive = heliosPassive || require("./helios-passive");
  }

  const api = factory(placement, state, catalog, passives, abilities, strategyPassive, heliosPassive);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (typeof module === "undefined") root.SetiIndustry = api;})(typeof globalThis !== "undefined" ? globalThis : window, function (
  placement,
  state,
  catalog,
  passives,
  abilities,
  strategyPassive,
  heliosPassive,
) {
  "use strict";

  return Object.freeze({
    ...placement,
    ...state,
    ...catalog,
    ...passives,
    ...abilities,
    ...strategyPassive,
    ...heliosPassive,
  });
});
