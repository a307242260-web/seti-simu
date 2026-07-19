(function (root, factory) {
  "use strict";

  let effectSession = root.SetiEffectSession;
  let standardAction = root.SetiStandardAction;
  if (typeof require === "function") {
    effectSession = effectSession || require("./session-runtime");
    standardAction = standardAction || require("../actions/standard-action");
  }

  const api = factory(effectSession, standardAction);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiScanCardSession = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (effectSession, standardAction) {
  "use strict";

  if (!effectSession?.createRuntime) {
    throw new Error("SetiEffectSession is required before SetiScanCardSession");
  }
  if (!standardAction?.CONDITIONAL_FAMILIES) {
    throw new Error("SetiStandardAction is required before SetiScanCardSession");
  }

  const ACTION_FAMILIES = Object.freeze(["scan", "play_card"]);
  const PENDING_FAMILY = Object.freeze({
    scan_target: "choose_target",
    scan_sector: "choose_target",
    play_card_payment: "choose_payment",
    card_trigger_choice: null,
  });
  const EFFECT_TYPES = Object.freeze({
    CONDITIONAL: "scan_card_session_conditional",
    SCAN: "scan_card_session_scan",
    SETTLE_SCAN: "scan_card_session_settle_scan",
    PARTICIPANT_REWARD: "scan_card_session_participant_reward",
    DEFERRED_DRAW: "scan_card_session_deferred_draw",
    PLAY_CARD: "scan_card_session_play_card",
    CARD_EFFECT: "scan_card_session_card_effect",
    COLLECT_CARD_TRIGGERS: "scan_card_session_collect_card_triggers",
    TRIGGER: "scan_card_session_trigger",
    COMPLETE: "scan_card_session_complete",
  });

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function fail(code, message, details = {}) {
    return { ok: false, code, message, ...details };
  }

  function requireFunction(options, key) {
    if (typeof options[key] !== "function") {
      throw new TypeError(`scan/card session adapter 缺少 ${key}()`);
    }
    return options[key];
  }

  function normalizeDomainResult(result, fallbackMessage) {
    if (!result || result.ok !== true || !("nextState" in result)) {
      return fail(
        result?.code || "SCAN_CARD_EFFECT_FAILED",
        result?.message || fallbackMessage,
      );
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

  function normalizePending(rawPending, ownerId) {
    if (!rawPending || typeof rawPending !== "object" || !rawPending.type) {
      return fail("NESTED_FLOW_PENDING_REQUIRED", "嵌套流程缺少 pending type");
    }
    if (!(rawPending.type in PENDING_FAMILY)) {
      return fail(
        "NESTED_FLOW_PENDING_TYPE_UNKNOWN",
        `未迁移 pending type: ${rawPending.type}`,
        { pendingType: rawPending.type },
      );
    }
    const expectedFamily = PENDING_FAMILY[rawPending.type];
    const family = rawPending.family || expectedFamily;
    if (!standardAction.CONDITIONAL_FAMILIES.includes(family)) {
      return fail(
        "NESTED_FLOW_CONDITIONAL_FAMILY_UNKNOWN",
        `未知 conditional family: ${family || "<missing>"}`,
        { pendingType: rawPending.type, family: family || null },
      );
    }
    if (expectedFamily && family !== expectedFamily) {
      return fail(
        "NESTED_FLOW_PENDING_FAMILY_MISMATCH",
        `${rawPending.type} 必须映射为 ${expectedFamily}`,
        { pendingType: rawPending.type, family },
      );
    }
    return {
      ok: true,
      pending: {
        ...clone(rawPending),
        family,
        ownerId: rawPending.ownerId || ownerId || null,
      },
    };
  }

  function createConditionalEffect(rawPending, ownerId) {
    const normalized = normalizePending(rawPending, ownerId);
    if (!normalized.ok) return normalized;
    const { pending } = normalized;
    return {
      ok: true,
      effect: {
        type: EFFECT_TYPES.CONDITIONAL,
        kind: "decision",
        decisionKind: pending.family,
        ownerId: pending.ownerId,
        allowQuickActions: false,
        payload: { pending },
      },
    };
  }

  function validateConditionalChoices(choices, pending) {
    if (!Array.isArray(choices)) {
      throw new TypeError(`enumerateConditional(${pending.family}) 必须返回数组`);
    }
    for (const choice of choices) {
      if (
        choice?.schemaVersion !== standardAction.SCHEMA_VERSION
        || !choice.actionId
        || choice.family !== pending.family
        || choice.actorId !== pending.ownerId
      ) {
        throw new TypeError(`${pending.family} 必须返回带 SETI-60 identity 的 Standard Action`);
      }
    }
    return clone(choices);
  }

  function createScanCardRuntime(options = {}) {
    const enumerateConditional = requireFunction(options, "enumerateConditional");
    const executeConditional = requireFunction(options, "executeConditional");
    const runScan = requireFunction(options, "runScan");
    const buildScanSectorPending = requireFunction(options, "buildScanSectorPending");
    const settleScan = requireFunction(options, "settleScan");
    const buildScanFollowups = requireFunction(options, "buildScanFollowups");
    const applyParticipantReward = requireFunction(options, "applyParticipantReward");
    const drawDeferredCard = requireFunction(options, "drawDeferredCard");
    const playCard = requireFunction(options, "playCard");
    const buildCardEffects = requireFunction(options, "buildCardEffects");
    const applyCardEffect = requireFunction(options, "applyCardEffect");
    const buildCardTriggers = requireFunction(options, "buildCardTriggers");
    const applyTrigger = requireFunction(options, "applyTrigger");
    const buildTriggerDecision = options.buildTriggerDecision || (() => null);

    const runtime = effectSession.createRuntime({
      cloneState: options.cloneState,
      getStateVersion: options.getStateVersion,
      validateState: options.validateState,
      projectState: options.projectState,
      readCommittedState: options.readCommittedState,
      maxDrainSteps: options.maxDrainSteps,
    });

    function normalizeSpawned(effect, priority = "direct") {
      return { priority, effect };
    }

    function appendConditional(normalized, rawPending, ownerId, priority = "direct") {
      const decision = createConditionalEffect(rawPending, ownerId);
      if (!decision.ok) return decision;
      normalized.spawnedEffects.push(normalizeSpawned(decision.effect, priority));
      return normalized;
    }

    runtime.registerExecutor(EFFECT_TYPES.CONDITIONAL, {
      getLegalChoices(state, effect) {
        const pending = effect.payload.pending;
        return validateConditionalChoices(
          enumerateConditional(state, clone(pending), effect),
          pending,
        );
      },
      resolveDecision(state, effect, choice) {
        const pending = effect.payload.pending;
        const normalized = normalizeDomainResult(
          executeConditional(state, clone(choice), clone(pending), effect),
          `${pending.family} 执行失败`,
        );
        if (!normalized.ok) return normalized;
        let nextEffect = null;
        if (pending.type === "scan_target") {
          nextEffect = {
            type: EFFECT_TYPES.SCAN,
            ownerId: effect.ownerId,
            payload: { action: clone(effect.payload.pending.action), targetAction: clone(choice) },
          };
        } else if (pending.type === "scan_sector") {
          nextEffect = {
            type: EFFECT_TYPES.SETTLE_SCAN,
            ownerId: effect.ownerId,
            payload: { scan: clone(pending.scan), sectorAction: clone(choice) },
          };
        } else if (pending.type === "play_card_payment") {
          nextEffect = {
            type: EFFECT_TYPES.PLAY_CARD,
            ownerId: effect.ownerId,
            payload: { action: clone(pending.action), paymentAction: clone(choice) },
          };
        }
        if (nextEffect) normalized.spawnedEffects.push(normalizeSpawned(nextEffect));
        delete normalized.domainResult;
        return normalized;
      },
    });

    runtime.registerExecutor(EFFECT_TYPES.SCAN, (state, effect) => {
      const normalized = normalizeDomainResult(
        runScan(state, clone(effect.payload), effect),
        "扫描目标执行失败",
      );
      if (!normalized.ok) return normalized;
      let rawPending;
      try {
        rawPending = buildScanSectorPending(
          clone(normalized.nextState),
          clone(normalized.domainResult),
          effect,
        );
      } catch (error) {
        return fail("SCAN_SECTOR_PENDING_BUILD_FAILED", error?.message || "扫描扇区 pending 生成失败");
      }
      delete normalized.domainResult;
      return appendConditional(normalized, rawPending, effect.ownerId);
    });

    runtime.registerExecutor(EFFECT_TYPES.SETTLE_SCAN, (state, effect) => {
      const normalized = normalizeDomainResult(
        settleScan(state, clone(effect.payload), effect),
        "扫描扇区结算失败",
      );
      if (!normalized.ok) return normalized;
      let followups;
      try {
        followups = buildScanFollowups(
          clone(normalized.nextState),
          clone(normalized.domainResult),
          effect,
        );
      } catch (error) {
        return fail("SCAN_FOLLOWUP_BUILD_FAILED", error?.message || "扫描后续生成失败");
      }
      if (!Array.isArray(followups)) {
        return fail("SCAN_FOLLOWUP_INVALID", "buildScanFollowups() 必须返回数组");
      }
      const followupTypes = {
        participant_reward: EFFECT_TYPES.PARTICIPANT_REWARD,
        trigger: EFFECT_TYPES.TRIGGER,
        deferred_draw: EFFECT_TYPES.DEFERRED_DRAW,
      };
      const expectedPriority = {
        participant_reward: "direct",
        trigger: "trigger",
        deferred_draw: "deferred",
      };
      for (const followup of followups) {
        const type = followupTypes[followup?.kind];
        if (!type || followup.priority !== expectedPriority[followup.kind]) {
          return fail(
            "SCAN_FOLLOWUP_TYPE_UNKNOWN",
            `未知扫描后续: ${followup?.priority || "<missing>"}/${followup?.kind || "<missing>"}`,
          );
        }
        normalized.spawnedEffects.push(normalizeSpawned({
          type,
          ownerId: followup.ownerId || effect.ownerId,
          payload: clone(followup.payload || {}),
        }, followup.priority));
      }
      delete normalized.domainResult;
      return normalized;
    });

    runtime.registerExecutor(EFFECT_TYPES.PARTICIPANT_REWARD, (state, effect) => (
      normalizeDomainResult(
        applyParticipantReward(state, clone(effect.payload), effect),
        "扫描参与奖励执行失败",
      )
    ));

    runtime.registerExecutor(EFFECT_TYPES.DEFERRED_DRAW, (state, effect) => (
      normalizeDomainResult(
        drawDeferredCard(state, clone(effect.payload), effect),
        "扫描延迟补牌失败",
      )
    ));

    runtime.registerExecutor(EFFECT_TYPES.PLAY_CARD, (state, effect) => {
      const normalized = normalizeDomainResult(
        playCard(state, clone(effect.payload), effect),
        "打牌支付后落牌失败",
      );
      if (!normalized.ok) return normalized;
      let cardEffects;
      try {
        cardEffects = buildCardEffects(
          clone(normalized.nextState),
          clone(normalized.domainResult),
          effect,
        );
      } catch (error) {
        return fail("CARD_EFFECT_BUILD_FAILED", error?.message || "卡牌顺序效果生成失败");
      }
      if (!Array.isArray(cardEffects)) {
        return fail("CARD_EFFECTS_INVALID", "buildCardEffects() 必须返回数组");
      }
      cardEffects.forEach((cardEffect, index) => {
        normalized.spawnedEffects.push(normalizeSpawned({
          type: EFFECT_TYPES.CARD_EFFECT,
          ownerId: cardEffect?.ownerId || effect.ownerId,
          payload: { index, cardEffect: clone(cardEffect) },
        }));
      });
      normalized.spawnedEffects.push(normalizeSpawned({
        type: EFFECT_TYPES.COLLECT_CARD_TRIGGERS,
        ownerId: effect.ownerId,
        payload: { action: clone(effect.payload.action) },
      }));
      delete normalized.domainResult;
      return normalized;
    });

    runtime.registerExecutor(EFFECT_TYPES.CARD_EFFECT, (state, effect) => (
      normalizeDomainResult(
        applyCardEffect(state, clone(effect.payload.cardEffect), effect),
        "卡牌顺序效果执行失败",
      )
    ));

    runtime.registerExecutor(EFFECT_TYPES.COLLECT_CARD_TRIGGERS, (state, effect) => {
      let triggers;
      try {
        triggers = buildCardTriggers(state, clone(effect.payload), effect);
      } catch (error) {
        return fail("CARD_TRIGGER_BUILD_FAILED", error?.message || "卡牌 trigger 生成失败");
      }
      if (!Array.isArray(triggers)) {
        return fail("CARD_TRIGGERS_INVALID", "buildCardTriggers() 必须返回数组");
      }
      return {
        ok: true,
        nextState: state,
        spawnedEffects: triggers.map((trigger) => normalizeSpawned({
          type: EFFECT_TYPES.TRIGGER,
          ownerId: trigger?.ownerId || effect.ownerId,
          payload: clone(trigger || {}),
        }, "trigger")),
      };
    });

    runtime.registerExecutor(EFFECT_TYPES.TRIGGER, (state, effect) => {
      const normalized = normalizeDomainResult(
        applyTrigger(state, clone(effect.payload), effect),
        "任务/被动 trigger 执行失败",
      );
      if (!normalized.ok) return normalized;
      let rawPending;
      try {
        rawPending = buildTriggerDecision(
          clone(normalized.nextState),
          clone(normalized.domainResult),
          effect,
        );
      } catch (error) {
        return fail("CARD_TRIGGER_DECISION_BUILD_FAILED", error?.message || "trigger 决策生成失败");
      }
      delete normalized.domainResult;
      return rawPending == null
        ? normalized
        : appendConditional(normalized, rawPending, effect.ownerId);
    });

    runtime.registerExecutor(EFFECT_TYPES.COMPLETE, (state, effect) => ({
      ok: true,
      nextState: state,
      events: [{ type: "effectSessionFlowCompleted", family: effect.payload.family }],
      log: { type: "flowCompleted", family: effect.payload.family },
    }));

    function createEffectGroup(_workingState, action) {
      if (!ACTION_FAMILIES.includes(action?.family)) {
        return fail(
          "NESTED_FLOW_ACTION_FAMILY_INVALID",
          `scan/card session 不接受 action family: ${action?.family || "<missing>"}`,
        );
      }
      const ownerId = action.actorId || null;
      const pending = action.family === "scan"
        ? { type: "scan_target", family: "choose_target", ownerId, action: clone(action) }
        : { type: "play_card_payment", family: "choose_payment", ownerId, action: clone(action) };
      const decision = createConditionalEffect(pending, ownerId);
      if (!decision.ok) return decision;
      return {
        kind: "action",
        ownerId,
        effects: [
          decision.effect,
          {
            type: EFFECT_TYPES.COMPLETE,
            ownerId,
            payload: { family: action.family },
          },
        ],
      };
    }

    function dispatch(committedState, action, meta = {}) {
      return runtime.dispatchAction(committedState, action, createEffectGroup, meta);
    }

    function replayJournal(committedState, journal, meta = {}) {
      const action = journal?.actions?.[0]?.action;
      if (!action) return fail("NESTED_FLOW_REPLAY_ACTION_REQUIRED", "replay journal 缺少 action");
      const dispatched = dispatch(committedState, clone(action), meta);
      if (!dispatched.ok) return dispatched;
      const decisions = Array.isArray(journal.decisions) ? journal.decisions : [];
      let decisionIndex = 0;
      let guard = 0;
      while (!["completed", "aborted", "irreversible_locked"].includes(dispatched.session.phase)) {
        if (guard >= (options.maxReplaySteps || 1000)) {
          return runtime.abort(dispatched.session, {
            code: "NESTED_FLOW_REPLAY_LIMIT_EXCEEDED",
            message: "replay 超过步数上限",
          });
        }
        const drained = runtime.drain(dispatched.session);
        if (!drained.ok) return drained;
        if (dispatched.session.phase === "awaiting_input") {
          const recorded = decisions[decisionIndex];
          const snapshot = runtime.inspect(dispatched.session).decision;
          if (!recorded || recorded.ownerId !== snapshot.ownerId) {
            return fail("NESTED_FLOW_REPLAY_DECISION_MISMATCH", "replay decision 数量或 owner 不匹配", {
              decisionIndex,
              decision: snapshot,
            });
          }
          const resolved = runtime.resolveDecision(dispatched.session, {
            decisionId: snapshot.decisionId,
            decisionVersion: snapshot.decisionVersion,
            choice: clone(recorded.choice),
          });
          if (!resolved.ok) return resolved;
          decisionIndex += 1;
        }
        guard += 1;
      }
      if (decisionIndex !== decisions.length) {
        return fail("NESTED_FLOW_REPLAY_DECISION_REMAINDER", "replay journal 含多余 decision", {
          consumed: decisionIndex,
          total: decisions.length,
        });
      }
      return { ok: true, session: dispatched.session };
    }

    return Object.freeze({
      runtime,
      dispatch,
      replayJournal,
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
    ACTION_FAMILIES,
    PENDING_FAMILY,
    EFFECT_TYPES,
    createScanCardRuntime,
  });
});
