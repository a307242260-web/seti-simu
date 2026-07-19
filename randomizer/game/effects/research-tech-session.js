(function (root, factory) {
  "use strict";

  let effectSession = root.SetiEffectSession;
  if (!effectSession && typeof require === "function") {
    effectSession = require("./session-runtime");
  }

  const api = factory(effectSession);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiResearchTechSession = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (effectSession) {
  "use strict";

  if (!effectSession?.createRuntime) {
    throw new Error("SetiEffectSession is required before SetiResearchTechSession");
  }

  const ACTION_FAMILY = "research_tech";
  const EFFECT_TYPES = Object.freeze({
    ROTATE: "research_tech_session_rotate",
    CHOOSE: "research_tech_session_choose",
    PLACE: "research_tech_session_place",
    IMMEDIATE_REWARD: "research_tech_session_immediate_reward",
  });

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function requireFunction(options, key) {
    if (typeof options[key] !== "function") {
      throw new TypeError(`research tech session adapter 缺少 ${key}()`);
    }
    return options[key];
  }

  function normalizeDomainResult(result, fallbackMessage) {
    if (!result || result.ok !== true || !("nextState" in result)) {
      return {
        ok: false,
        code: result?.code || "RESEARCH_TECH_EFFECT_FAILED",
        message: result?.message || fallbackMessage,
      };
    }
    const {
      nextState,
      events,
      spawnedEffects,
      rng,
      history,
      log,
      irreversible,
      ...domainResult
    } = result;
    return {
      ok: true,
      nextState: clone(nextState),
      events: clone(events || []),
      spawnedEffects: clone(spawnedEffects || []),
      rng: clone(rng || []),
      history: clone(history || []),
      log: clone(log ?? null),
      irreversible: clone(irreversible || null),
      domainResult: clone(domainResult),
    };
  }

  function normalizeRewardEffects(rawEffects, ownerId, placementResult) {
    if (rawEffects == null) return [];
    if (!Array.isArray(rawEffects)) {
      throw new TypeError("buildImmediateRewards() 必须返回 Effect 数组");
    }
    return rawEffects.map((rawEffect, index) => ({
      priority: "direct",
      effect: {
        type: EFFECT_TYPES.IMMEDIATE_REWARD,
        ownerId: rawEffect?.ownerId || ownerId || null,
        payload: {
          rewardIndex: index,
          placement: clone(placementResult),
          reward: clone(rawEffect?.payload ?? rawEffect ?? {}),
        },
        source: clone(rawEffect?.source || null),
      },
    }));
  }

  function createResearchTechRuntime(options = {}) {
    const rotate = requireFunction(options, "rotate");
    const listChoices = requireFunction(options, "listChoices");
    const place = requireFunction(options, "place");
    const applyImmediateReward = requireFunction(options, "applyImmediateReward");
    const buildImmediateRewards = options.buildImmediateRewards || (() => []);

    const runtime = effectSession.createRuntime({
      cloneState: options.cloneState,
      getStateVersion: options.getStateVersion,
      validateState: options.validateState,
      projectState: options.projectState,
      readCommittedState: options.readCommittedState,
      maxDrainSteps: options.maxDrainSteps,
    });

    runtime.registerExecutor(EFFECT_TYPES.ROTATE, (state, effect) => (
      normalizeDomainResult(rotate(state, effect), "研究科技旋转失败")
    ));

    runtime.registerExecutor(EFFECT_TYPES.CHOOSE, {
      getLegalChoices(state, effect) {
        const choices = listChoices(state, effect);
        if (!Array.isArray(choices)) {
          throw new TypeError("listChoices() 必须返回数组");
        }
        return clone(choices);
      },
      resolveDecision(state, effect, choice) {
        return {
          ok: true,
          nextState: state,
          events: [{
            type: "researchTechChoice",
            playerId: effect.ownerId,
            choice: clone(choice),
          }],
          spawnedEffects: [{
            priority: "direct",
            effect: {
              type: EFFECT_TYPES.PLACE,
              ownerId: effect.ownerId,
              payload: {
                action: clone(effect.payload.action || null),
                choice: clone(choice),
              },
            },
          }],
          log: { type: "researchTechChoice", choice: clone(choice) },
        };
      },
    });

    runtime.registerExecutor(EFFECT_TYPES.PLACE, (state, effect) => {
      const normalized = normalizeDomainResult(
        place(state, clone(effect.payload.choice), effect),
        "研究科技放置失败",
      );
      if (!normalized.ok) return normalized;
      let immediateRewards;
      try {
        immediateRewards = buildImmediateRewards(
          clone(normalized.nextState),
          clone(normalized.domainResult),
          effect,
        );
      } catch (error) {
        return {
          ok: false,
          code: "RESEARCH_TECH_REWARD_BUILD_FAILED",
          message: error?.message || "研究科技即时奖励生成失败",
        };
      }
      normalized.spawnedEffects.push(...normalizeRewardEffects(
        immediateRewards,
        effect.ownerId,
        normalized.domainResult,
      ));
      delete normalized.domainResult;
      return normalized;
    });

    runtime.registerExecutor(EFFECT_TYPES.IMMEDIATE_REWARD, (state, effect) => (
      normalizeDomainResult(
        applyImmediateReward(state, clone(effect.payload.reward), effect),
        "研究科技即时奖励失败",
      )
    ));

    function createEffectGroup(_workingState, action) {
      if (action?.family !== ACTION_FAMILY) {
        return {
          ok: false,
          code: "RESEARCH_TECH_ACTION_FAMILY_INVALID",
          message: `研究科技 session 不接受 action family: ${action?.family || "<missing>"}`,
        };
      }
      const ownerId = action.actorId || null;
      return {
        kind: "action",
        ownerId,
        effects: [
          {
            type: EFFECT_TYPES.ROTATE,
            ownerId,
            payload: { action: clone(action) },
          },
          {
            type: EFFECT_TYPES.CHOOSE,
            kind: "decision",
            decisionKind: "research_tech_choice",
            ownerId,
            allowQuickActions: false,
            payload: { action: clone(action) },
          },
        ],
      };
    }

    function dispatch(committedState, action, meta = {}) {
      return runtime.dispatchAction(committedState, action, createEffectGroup, meta);
    }

    return Object.freeze({
      runtime,
      dispatch,
      createEffectGroup,
      inspect: runtime.inspect,
      observe: runtime.observe,
      advance: runtime.advance,
      drain: runtime.drain,
      resolveDecision: runtime.resolveDecision,
      abort: runtime.abort,
    });
  }

  return Object.freeze({
    ACTION_FAMILY,
    EFFECT_TYPES,
    createResearchTechRuntime,
  });
});
