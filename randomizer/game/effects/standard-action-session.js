(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (typeof module === "undefined") root.SetiStandardActionSession = api;})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const EFFECT_TYPE = "standard_action_session_execute";
  const DECISION_EFFECT_TYPE = "standard_action_session_decision";

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

    runtime.registerExecutor(EFFECT_TYPE, (canonicalState, effect) => {
      const result = executeRegisteredAction(canonicalState, effect.payload.action);
      if (!result?.ok) return result;
      const openedDecisionEffect = result.decisionEffect || null;
      return {
        ok: true,
        nextState: result.nextState,
        spawnedEffects: openedDecisionEffect
          ? [{ priority: "direct", effect: openedDecisionEffect }]
          : [],
        events: clone(result.events || []),
        history: clone(result.journalHistory || result.history || []),
        log: clone(result.log ?? (result.message ? { type: "standardAction", message: result.message } : null)),
        irreversible: clone(result.irreversible || null),
      };
    });

    runtime.registerExecutor(DECISION_EFFECT_TYPE, {
      getLegalChoices(_workingRoot, effect) {
        return clone(effect.payload?.choices || []);
      },
      resolveDecision(canonicalState, effect, choice, compositionWorkingContext) {
        const result = executeRegisteredAction(canonicalState, choice, {
          standardActionAuthority: {
            actorId: effect.ownerId,
            stateVersion: choice.stateVersion,
            decisionVersion: choice.decisionVersion,
          },
          standardActionDecisionContext: clone(effect.payload?.decisionContext || null),
        }, compositionWorkingContext);
        if (!result?.ok) return result;
        return {
          ok: true,
          nextState: result.nextState,
          spawnedEffects: result.decisionEffect
            ? [{ priority: "direct", effect: clone(result.decisionEffect) }]
            : [],
          events: clone(result.events || [{
            type: "standard_action_decision_executed",
            family: choice?.family || null,
            actionId: choice?.actionId || null,
          }]),
          history: clone(result.journalHistory || result.history || []),
          log: clone(result.log || null),
          irreversible: clone(result.irreversible || null),
        };
      },
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

  return Object.freeze({
    EFFECT_TYPE,
    DECISION_EFFECT_TYPE,
    createStandardActionDomain,
  });
});
