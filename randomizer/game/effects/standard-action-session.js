(function (root, factory) {
  "use strict";

  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiStandardActionSession = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const EFFECT_TYPE = "standard_action_session_execute";
  const CONTINUE_EFFECT_TYPE = "standard_action_session_continue";
  const DECISION_EFFECT_TYPE = "standard_action_session_decision";

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function createStandardActionDomain(options = {}) {
    const runtime = options.runtime;
    const executeRegisteredAction = options.executeRegisteredAction;
    const actionFamilies = Object.freeze([...(options.actionFamilies || [])]);
    const continuation = options.continuation || null;
    const commitWorkingState = options.commitWorkingState;
    const takeOpenedDecisionEffect = options.takeOpenedDecisionEffect;
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
      const openedDecisionEffect = result.decisionEffect || takeOpenedDecisionEffect?.() || null;
      const spawnedEffects = openedDecisionEffect
        ? [{ priority: "direct", effect: openedDecisionEffect }]
        : continuation
          ? [{ priority: "direct", effect: { type: CONTINUE_EFFECT_TYPE } }]
          : [];
      return {
        ok: true,
        nextState: result.nextState,
        spawnedEffects,
        events: clone(result.events || []),
        history: clone(result.history || []),
        log: clone(result.log ?? (result.message ? { type: "standardAction", message: result.message } : null)),
        irreversible: clone(result.irreversible || null),
      };
    });

    if (continuation) {
      if (typeof continuation.inspect !== "function"
        || typeof continuation.executeDeterministic !== "function"
        || typeof commitWorkingState !== "function") {
        throw new TypeError("standard action continuation 缺少 inspect/executeDeterministic/commitWorkingState");
      }

      runtime.registerExecutor(CONTINUE_EFFECT_TYPE, (workingRoot, _effect, compositionWorkingRoot) => {
        if (!compositionWorkingRoot) {
          return {
            ok: false,
            code: "STANDARD_ACTION_WORKING_ROOT_MISSING",
            message: "Standard Action continuation 缺少 Composition working root",
          };
        }
        const boundary = continuation.inspect(compositionWorkingRoot);
        if (boundary?.ok === false) return boundary.error || boundary;
        const choices = (boundary?.choices || boundary?.candidates || [])
          .filter((choice) => choice?.available !== false);
        if (boundary?.decisionType === "conditional_choice" && choices.length) {
          return {
            ok: true,
            nextState: structuredClone(workingRoot),
            spawnedEffects: [{
              priority: "direct",
              effect: {
                type: DECISION_EFFECT_TYPE,
                kind: "decision",
                ownerId: boundary.ownerId || boundary.actorPlayer?.id || null,
                decisionKind: boundary.family || choices[0]?.family || "conditional_choice",
                payload: {
                  choices: clone(choices),
                  ...(boundary.cardSelection ? { cardSelection: clone(boundary.cardSelection) } : {}),
                },
              },
            }],
          };
        }
        if (boundary?.boundary === "turn_action" || boundary?.boundary === "terminal") {
          return { ok: true, nextState: structuredClone(workingRoot) };
        }
        const result = continuation.executeDeterministic(compositionWorkingRoot, boundary);
        if (!result || result.ok === false) return result || {
          ok: false,
          code: "STANDARD_ACTION_CONTINUATION_STALLED",
          message: "Standard Action continuation 未返回推进结果",
        };
        const openedDecisionEffect = takeOpenedDecisionEffect?.() || null;
        return {
          ok: true,
          nextState: commitWorkingState(workingRoot, result),
          spawnedEffects: openedDecisionEffect
            ? [{ priority: "direct", effect: openedDecisionEffect }]
            : result.progressed === false
              ? []
              : [{ priority: "direct", effect: { type: CONTINUE_EFFECT_TYPE } }],
          events: clone(result.events || []),
        };
      });

      runtime.registerExecutor(DECISION_EFFECT_TYPE, {
        getLegalChoices(_workingRoot, effect) {
          return clone(effect.payload?.choices || []);
        },
        resolveDecision(workingRoot, _effect, choice, compositionWorkingRoot) {
          if (typeof continuation.resolveDecision === "function") {
            if (!compositionWorkingRoot) {
              return {
                ok: false,
                code: "STANDARD_ACTION_WORKING_ROOT_MISSING",
                message: "Standard Action Decision resolve 缺少 Composition working root",
              };
            }
            const resolved = continuation.resolveDecision(compositionWorkingRoot, clone(choice));
            if (!resolved?.ok) return resolved || {
              ok: false,
              code: "STANDARD_ACTION_DECISION_RESOLVE_FAILED",
              message: "Standard Action Decision resolve 未返回成功结果",
            };
            const openedDecisionEffect = takeOpenedDecisionEffect?.() || null;
            return {
              ok: true,
              nextState: commitWorkingState(workingRoot, resolved),
              spawnedEffects: openedDecisionEffect
                ? [{ priority: "direct", effect: openedDecisionEffect }]
                : [{ priority: "direct", effect: { type: CONTINUE_EFFECT_TYPE } }],
              events: clone(resolved.events || [{
                type: "standard_action_decision_executed",
                family: choice?.family || choice?.standardAction?.family || null,
                actionId: choice?.standardAction?.actionId || choice?.actionId || null,
              }]),
            };
          }
          const descriptor = choice?.standardAction || choice;
          const result = executeRegisteredAction(workingRoot, descriptor);
          if (!result?.ok) return result;
          return {
            ok: true,
            nextState: result.nextState,
            spawnedEffects: [{ priority: "direct", effect: { type: CONTINUE_EFFECT_TYPE } }],
            events: [{
              type: "standard_action_decision_executed",
              family: descriptor?.family || null,
              actionId: descriptor?.actionId || null,
            }],
          };
        },
      });
    }

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

    function createDrainEffectGroup() {
      if (!continuation) {
        return {
          ok: false,
          code: "STANDARD_ACTION_CONTINUATION_UNAVAILABLE",
          message: "Standard Action domain 未配置 deterministic continuation",
        };
      }
      return {
        kind: "internal",
        effects: [{ type: CONTINUE_EFFECT_TYPE }],
      };
    }

    return Object.freeze({ actionFamilies, createEffectGroup, createDrainEffectGroup });
  }

  return Object.freeze({
    EFFECT_TYPE,
    CONTINUE_EFFECT_TYPE,
    DECISION_EFFECT_TYPE,
    createStandardActionDomain,
  });
});
