(function (root, factory) {
  "use strict";

  let launch = root.SetiActionLaunch;
  let orbit = root.SetiActionOrbit;
  let land = root.SetiActionLand;
  let researchTech = root.SetiActionResearchTech;
  let standardAction = root.SetiStandardAction;

  if ((!launch || !orbit || !land || !researchTech || !standardAction) && typeof require === "function") {
    launch = launch || require("./launch");
    orbit = orbit || require("./orbit");
    land = land || require("./land");
    researchTech = researchTech || require("./research-tech");
    standardAction = standardAction || require("./standard-action");
  }

  const api = factory(launch, orbit, land, researchTech, standardAction);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiActions = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (launch, orbit, land, researchTech, standardAction) {
  "use strict";

  const ACTIONS = Object.freeze({
    launch,
    orbit,
    land,
    researchTech,
  });

  const ACTION_ORDER = Object.freeze(["launch", "orbit", "land", "researchTech"]);

  function getDefaultAuthority(context) {
    const explicit = context.standardActionAuthority || null;
    return {
      actorId: explicit?.actorId || context.playerState?.currentPlayerId || null,
      stateVersion: explicit?.stateVersion ?? context.stateVersion ?? 0,
      decisionVersion: explicit?.decisionVersion ?? context.decisionVersion ?? 0,
    };
  }

  function createStandardRegistry(options = {}) {
    return standardAction.createReferenceRegistry(ACTIONS, {
      getAuthority: options.getAuthority || getDefaultAuthority,
      stage2Actions: options.stage2Actions || null,
      stage4Actions: options.stage4Actions || null,
    });
  }

  function createStandardAdapter(options = {}) {
    return standardAction.createRegistryAdapter(createStandardRegistry(options));
  }

  function getAction(actionId) {
    return ACTIONS[actionId] || null;
  }

  function listActions() {
    return ACTION_ORDER.map((actionId) => ACTIONS[actionId]);
  }

  function canExecute(actionId, context) {
    const action = getAction(actionId);
    if (!action) return { ok: false, message: `未知行动: ${actionId}` };
    return action.canExecute(context);
  }

  function execute(actionId, context, options) {
    const action = getAction(actionId);
    if (!action) return { ok: false, actionId, message: `未知行动: ${actionId}` };
    if (actionId === "researchTech") return action.execute(context, options);
    const family = actionId;
    const selector = actionId === "land"
      ? {
        ...(options?.rocketId == null && options?.target?.rocketId == null
          ? {}
          : { rocketId: Number(options?.rocketId ?? options?.target?.rocketId) }),
        ...(options?.target?.type ? { type: options.target.type } : {}),
        ...(options?.target?.satelliteId ? { satelliteId: options.target.satelliteId } : {}),
      }
      : (options?.rocketId == null ? {} : { rocketId: Number(options.rocketId) });
    const adapter = createStandardAdapter();
    const resolved = adapter.resolveIntent(context, family, selector);
    if (resolved.code === "STANDARD_ACTION_NOT_LEGAL" && Object.keys(selector).length === 0) {
      return action.execute(context, options);
    }
    return resolved.ok ? adapter.execute(context, resolved.action) : resolved;
  }

  function getOrbitOptions(context) {
    return typeof orbit.getOrbitOptions === "function"
      ? orbit.getOrbitOptions(context)
      : orbit.canExecute(context);
  }

  function getLandOptions(context) {
    return land.getLandOptions(context);
  }

  return Object.freeze({
    ACTIONS,
    ACTION_ORDER,
    standardAction,
    getAction,
    listActions,
    canExecute,
    execute,
    getOrbitOptions,
    getLandOptions,
    createStandardRegistry,
    createStandardAdapter,
  });
});
