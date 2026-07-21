(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiStandardActionSession = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const EFFECT_TYPE = "standard_action_session_execute";

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function createStandardActionDomain(options = {}) {
    const runtime = options.runtime;
    const executeRegisteredAction = options.executeRegisteredAction;
    const actionFamilies = Object.freeze([...(options.actionFamilies || [])]);
    if (typeof runtime?.registerExecutor !== "function") {
      throw new TypeError("standard action domain 缺少 composition Effect runtime");
    }
    if (typeof executeRegisteredAction !== "function") {
      throw new TypeError("standard action domain 缺少 composition registry execute capability");
    }
    if (!actionFamilies.length) {
      throw new TypeError("standard action domain 必须声明 actionFamilies");
    }

    runtime.registerExecutor(EFFECT_TYPE, (workingRoot, effect) => {
      const result = executeRegisteredAction(workingRoot, effect.payload.action);
      if (!result?.ok) return result;
      return {
        ok: true,
        nextState: result.nextState,
        events: clone(result.events || []),
        history: clone(result.history || []),
        log: clone(result.log ?? (result.message ? { type: "standardAction", message: result.message } : null)),
        irreversible: clone(result.irreversible || null),
      };
    });

    function createEffectGroup(_workingRoot, action) {
      if (!actionFamilies.includes(action?.family)) {
        return {
          ok: false,
          code: "STANDARD_ACTION_EFFECT_FAMILY_INVALID",
          message: `standard action domain 不接受 family: ${action?.family || "<missing>"}`,
        };
      }
      return {
        kind: "action",
        ownerId: action.actorId || null,
        effects: [{
          type: EFFECT_TYPE,
          ownerId: action.actorId || null,
          payload: { action: clone(action) },
        }],
      };
    }

    return Object.freeze({ actionFamilies, createEffectGroup });
  }

  return Object.freeze({ EFFECT_TYPE, createStandardActionDomain });
});
