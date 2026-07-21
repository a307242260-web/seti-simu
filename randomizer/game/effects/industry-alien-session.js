(function (root, factory) {
  "use strict";

  let effectSession = root.SetiEffectSession;
  let standardAction = root.SetiStandardAction;
  if (typeof require === "function") {
    effectSession = effectSession || require("./session-runtime");
    standardAction = standardAction || require("../actions/standard-action");
  }

  const api = factory(effectSession, standardAction);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiIndustryAlienSession = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (effectSession, standardAction) {
  "use strict";

  if (!effectSession?.createRuntime) throw new Error("SetiEffectSession is required before SetiIndustryAlienSession");
  if (!standardAction?.CONDITIONAL_FAMILIES) throw new Error("SetiStandardAction is required before SetiIndustryAlienSession");

  const DOMAIN_SCHEMA_VERSION = "seti-industry-alien-decision-v1";
  const DECISION_KINDS = Object.freeze({
    INDUSTRY_PICKER: "industry_picker",
    ALIEN_TRACE_PLACEMENT: "alien_trace_placement",
    ALIEN_OPPORTUNITY: "alien_opportunity",
    ALIEN_CARD_GAIN: "alien_card_gain",
    ALIEN_TASK: "alien_task",
    ALIEN_SPECIES_BRANCH: "alien_species_branch",
  });
  const PRESENTATION_BY_KIND = Object.freeze({
    [DECISION_KINDS.INDUSTRY_PICKER]: "industry",
    [DECISION_KINDS.ALIEN_TRACE_PLACEMENT]: "alien-trace",
    [DECISION_KINDS.ALIEN_OPPORTUNITY]: "alien-opportunity",
    [DECISION_KINDS.ALIEN_CARD_GAIN]: "alien-card",
    [DECISION_KINDS.ALIEN_TASK]: "alien-task",
    [DECISION_KINDS.ALIEN_SPECIES_BRANCH]: "alien-branch",
  });
  const FAMILY_BY_KIND = Object.freeze({
    [DECISION_KINDS.INDUSTRY_PICKER]: "choose_target",
    [DECISION_KINDS.ALIEN_TRACE_PLACEMENT]: "choose_target",
    [DECISION_KINDS.ALIEN_OPPORTUNITY]: "choose_reward",
    [DECISION_KINDS.ALIEN_CARD_GAIN]: "choose_card",
    [DECISION_KINDS.ALIEN_TASK]: "choose_reward",
    [DECISION_KINDS.ALIEN_SPECIES_BRANCH]: "choose_branch",
  });
  const SPECIES_IDS = Object.freeze([
    "jiuzhe", "yichangdian", "banrenma", "fangzhou", "chong", "amiba", "aomomo", "runezu",
  ]);
  const EFFECT_TYPES = Object.freeze({
    DECISION: "industry_alien_session_decision",
    DOMAIN: "industry_alien_session_effect",
  });
  const ALLOWED_PRIORITIES = new Set(["direct", "trigger", "deferred"]);
  const PRIORITY_ORDER = Object.freeze({ direct: 0, trigger: 1, deferred: 2 });

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function fail(code, message, details = {}) {
    return { ok: false, code, message, ...clone(details) };
  }

  function requireFunction(options, key) {
    if (typeof options[key] !== "function") throw new TypeError(`industry/alien session adapter 缺少 ${key}()`);
    return options[key];
  }

  function normalizeDomainResult(result, fallbackMessage) {
    if (!result || result.ok !== true || !("nextState" in result)) {
      return fail(result?.code || "INDUSTRY_ALIEN_EFFECT_FAILED", result?.message || fallbackMessage);
    }
    const { nextState, events, rng, history, log, irreversible, followups, ...domainResult } = result;
    return {
      ok: true,
      nextState: clone(nextState),
      events: clone(events || []),
      rng: clone(rng || []),
      history: clone(history || []),
      log: clone(log ?? null),
      irreversible: clone(irreversible || null),
      followups: clone(followups || []),
      domainResult: clone(domainResult),
    };
  }

  function assertDecisionKind(kind) {
    if (!(kind in FAMILY_BY_KIND)) {
      throw new TypeError(`未迁移 industry/alien decision kind: ${kind || "<missing>"}`);
    }
    return kind;
  }

  function normalizePending(rawPending, fallbackOwnerId = null) {
    if (!rawPending || typeof rawPending !== "object") {
      return fail("INDUSTRY_ALIEN_PENDING_REQUIRED", "公司/外星人 Decision 缺少 pending schema");
    }
    let kind;
    try {
      kind = assertDecisionKind(rawPending.decisionKind);
    } catch (error) {
      return fail("INDUSTRY_ALIEN_DECISION_KIND_UNKNOWN", error.message, {
        decisionKind: rawPending.decisionKind || null,
        ownerId: rawPending.ownerId || fallbackOwnerId || null,
      });
    }
    const family = rawPending.family || FAMILY_BY_KIND[kind];
    if (family !== FAMILY_BY_KIND[kind] || !standardAction.CONDITIONAL_FAMILIES.includes(family)) {
      return fail("INDUSTRY_ALIEN_DECISION_FAMILY_MISMATCH", `${kind} 必须映射为 ${FAMILY_BY_KIND[kind]}`, {
        decisionKind: kind,
        family,
      });
    }
    const ownerId = rawPending.ownerId || fallbackOwnerId || null;
    if (!ownerId) return fail("INDUSTRY_ALIEN_DECISION_OWNER_REQUIRED", `${kind} 缺少 ownerId`);
    const speciesId = rawPending.speciesId || null;
    if (speciesId != null && !SPECIES_IDS.includes(speciesId)) {
      return fail("INDUSTRY_ALIEN_SPECIES_UNKNOWN", `未知外星人物种: ${speciesId}`, { speciesId, ownerId });
    }
    return {
      ok: true,
      pending: {
        ...clone(rawPending),
        schemaVersion: DOMAIN_SCHEMA_VERSION,
        decisionKind: kind,
        presentationHint: PRESENTATION_BY_KIND[kind],
        family,
        ownerId,
        speciesId,
      },
    };
  }

  function decisionEffect(rawPending, ownerId) {
    const normalized = normalizePending(rawPending, ownerId);
    if (!normalized.ok) return normalized;
    return {
      ok: true,
      effect: {
        type: EFFECT_TYPES.DECISION,
        kind: "decision",
        decisionKind: normalized.pending.decisionKind,
        ownerId: normalized.pending.ownerId,
        allowQuickActions: Boolean(normalized.pending.allowQuickActions),
        payload: { pending: normalized.pending },
      },
    };
  }

  function normalizeFollowups(rawFollowups, fallbackOwnerId = null) {
    if (!Array.isArray(rawFollowups)) {
      return fail("INDUSTRY_ALIEN_FOLLOWUPS_INVALID", "公司/外星人 followups 必须是数组");
    }
    const spawnedEffects = [];
    for (const raw of rawFollowups) {
      const priority = raw?.priority || "direct";
      if (!ALLOWED_PRIORITIES.has(priority)) {
        return fail("INDUSTRY_ALIEN_FOLLOWUP_PRIORITY_UNKNOWN", `未知 followup priority: ${priority}`);
      }
      if (raw?.kind === "decision") {
        const built = decisionEffect(raw.pending, raw.ownerId || fallbackOwnerId);
        if (!built.ok) return built;
        spawnedEffects.push({ priority, effect: built.effect });
      } else if (raw?.kind === "effect") {
        if (!raw.effectType) {
          return fail("INDUSTRY_ALIEN_FOLLOWUP_EFFECT_TYPE_REQUIRED", "领域 followup effect 缺少 effectType");
        }
        spawnedEffects.push({
          priority,
          effect: {
            type: EFFECT_TYPES.DOMAIN,
            ownerId: raw.ownerId || fallbackOwnerId,
            payload: {
              effectType: raw.effectType,
              speciesId: raw.speciesId || null,
              companyId: raw.companyId || null,
              data: clone(raw.payload || {}),
            },
          },
        });
      } else {
        return fail("INDUSTRY_ALIEN_FOLLOWUP_KIND_UNKNOWN", `未知 followup kind: ${raw?.kind || "<missing>"}`);
      }
    }
    return { ok: true, spawnedEffects };
  }

  function validateChoices(choices, pending) {
    if (!Array.isArray(choices)) throw new TypeError(`enumerateDecision(${pending.decisionKind}) 必须返回数组`);
    for (const choice of choices) {
      if (
        choice?.schemaVersion !== standardAction.SCHEMA_VERSION
        || !choice.actionId
        || choice.family !== pending.family
        || choice.actorId !== pending.ownerId
        || choice.payload?.domainDecisionKind !== pending.decisionKind
        || (pending.speciesId != null && choice.payload?.speciesId !== pending.speciesId)
      ) {
        throw new TypeError(`${pending.decisionKind} choice 缺少 Standard Action identity 或领域 owner/family 不匹配`);
      }
    }
    return clone(choices);
  }

  function createIndustryAlienRuntime(options = {}) {
    if (options.stateStore && typeof options.actionRegistry?.validate !== "function") {
      throw new TypeError("industry/alien production session 缺少 Standard Action registry");
    }
    const enumerateDecision = requireFunction(options, "enumerateDecision");
    const executeDecision = requireFunction(options, "executeDecision");
    const executeEffect = requireFunction(options, "executeEffect");
    const buildActionFlow = requireFunction(options, "buildActionFlow");
    const runtime = options.runtime || effectSession.createRuntime({
      cloneState: options.cloneState,
      getStateVersion: options.getStateVersion,
      validateState: options.validateState,
      projectState: options.projectState,
      readCommittedState: options.readCommittedState,
      stateStore: options.stateStore,
      maxDrainSteps: options.maxDrainSteps,
    });

    runtime.registerExecutor(EFFECT_TYPES.DECISION, {
      getLegalChoices(state, effect) {
        const pending = effect.payload.pending;
        return validateChoices(enumerateDecision(clone(state), clone(pending), effect), pending);
      },
      resolveDecision(state, effect, choice) {
        const pending = effect.payload.pending;
        const result = normalizeDomainResult(
          executeDecision(clone(state), clone(choice), clone(pending), effect),
          `${pending.decisionKind} 执行失败`,
        );
        if (!result.ok) return result;
        const normalized = normalizeFollowups(result.followups, pending.ownerId);
        if (!normalized.ok) return normalized;
        delete result.followups;
        delete result.domainResult;
        result.spawnedEffects = normalized.spawnedEffects;
        return result;
      },
    });

    runtime.registerExecutor(EFFECT_TYPES.DOMAIN, (state, effect) => {
      const result = normalizeDomainResult(
        executeEffect(clone(state), clone(effect.payload), effect),
        `${effect.payload.effectType} 执行失败`,
      );
      if (!result.ok) return result;
      const normalized = normalizeFollowups(result.followups, effect.ownerId);
      if (!normalized.ok) return normalized;
      delete result.followups;
      delete result.domainResult;
      result.spawnedEffects = normalized.spawnedEffects;
      return result;
    });

    function buildGroup(state, action) {
      let flow;
      try {
        flow = buildActionFlow(clone(state), clone(action));
      } catch (error) {
        return fail("INDUSTRY_ALIEN_FLOW_BUILD_FAILED", error?.message || "领域 Effect Group 生成失败");
      }
      if (flow?.ok === false) return clone(flow);
      const normalized = normalizeFollowups(flow?.followups || [], action?.actorId || null);
      if (!normalized.ok) return normalized;
      const ordered = normalized.spawnedEffects
        .map((entry, index) => ({ ...entry, index }))
        .sort((left, right) => PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority] || left.index - right.index);
      return {
        kind: "industry_alien",
        ownerId: action?.actorId || null,
        effects: ordered.map((entry) => ({
          ...entry.effect,
          source: { priority: entry.priority, domain: "industry-alien" },
        })),
      };
    }

    function dispatch(state, action, meta = {}) {
      if (options.stateStore) {
        return runtime.dispatchStandardAction(action, options.actionRegistry, buildGroup, meta);
      }
      return runtime.dispatchAction(clone(state), clone(action), buildGroup, clone(meta));
    }

    return Object.freeze({
      actionFamilies: Object.freeze([...(options.actionFamilies || [])]),
      createEffectGroup: buildGroup,
      dispatch,
      inspect: runtime.inspect,
      observe: runtime.observe,
      advance: runtime.advance,
      drain: runtime.drain,
      resolveDecision: runtime.resolveDecision,
      abort: runtime.abort,
      undoLastEffect: runtime.undoLastEffect,
      createCheckpoint: runtime.createCheckpoint,
      restoreCheckpoint: runtime.restoreCheckpoint,
      runtime,
    });
  }

  return Object.freeze({
    DOMAIN_SCHEMA_VERSION,
    DECISION_KINDS,
    PRESENTATION_BY_KIND,
    FAMILY_BY_KIND,
    SPECIES_IDS,
    EFFECT_TYPES,
    normalizePending,
    normalizeFollowups,
    createIndustryAlienRuntime,
  });
});
