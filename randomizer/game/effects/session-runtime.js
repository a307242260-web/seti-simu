(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiEffectSession = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const SCHEMA_VERSION = "seti-effect-session-v1";
  const INTERNAL_RESUME_EFFECT = "@@seti/resume-interrupted-decision";
  const TERMINAL_PHASES = new Set(["completed", "aborted", "irreversible_locked"]);
  const SPAWN_PRIORITY = Object.freeze({ direct: 0, trigger: 1, deferred: 2 });

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function stableSerialize(value) {
    if (value == null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
    return `{${Object.keys(value).sort().map((key) => (
      `${JSON.stringify(key)}:${stableSerialize(value[key])}`
    )).join(",")}}`;
  }

  function fail(code, message, details = {}) {
    return { ok: false, code, message, ...details };
  }

  function normalizeResultArray(result, key, effect) {
    if (result[key] == null) return [];
    if (!Array.isArray(result[key])) {
      throw new TypeError(`${effect.type} result.${key} 必须是数组`);
    }
    return clone(result[key]);
  }

  function assertFunction(value, name) {
    if (typeof value !== "function") throw new TypeError(`${name} 必须是函数`);
  }

  function normalizeEffect(rawEffect, session, group, index) {
    if (!rawEffect || typeof rawEffect !== "object") throw new TypeError("Effect 必须是对象");
    if (!rawEffect.type) throw new TypeError("Effect 缺少 type");
    const kind = rawEffect.kind || "effect";
    if (kind !== "effect" && kind !== "decision") {
      throw new TypeError(`未知 Effect kind: ${kind}`);
    }
    session.nextEffectSequence += 1;
    return Object.freeze({
      schemaVersion: SCHEMA_VERSION,
      effectId: rawEffect.effectId || `${session.sessionId}:effect:${session.nextEffectSequence}`,
      groupId: group.groupId,
      groupKind: group.kind,
      type: rawEffect.type,
      kind,
      ownerId: rawEffect.ownerId || group.ownerId || null,
      decisionKind: rawEffect.decisionKind || null,
      allowQuickActions: Boolean(rawEffect.allowQuickActions),
      payload: clone(rawEffect.payload || {}),
      source: clone(rawEffect.source || null),
      groupIndex: index,
    });
  }

  function normalizeGroup(rawGroup, session, defaultKind = "action") {
    if (!rawGroup || typeof rawGroup !== "object") throw new TypeError("Effect Group 必须是对象");
    if (!Array.isArray(rawGroup.effects)) throw new TypeError("Effect Group.effects 必须是数组");
    session.nextGroupSequence += 1;
    const group = {
      schemaVersion: SCHEMA_VERSION,
      groupId: rawGroup.groupId || `${session.sessionId}:group:${session.nextGroupSequence}`,
      kind: rawGroup.kind || defaultKind,
      ownerId: rawGroup.ownerId || null,
      action: clone(rawGroup.action || null),
    };
    return Object.freeze({
      ...group,
      effects: Object.freeze(rawGroup.effects.map((effect, index) => (
        normalizeEffect(effect, session, group, index)
      ))),
    });
  }

  function normalizeSpawnedEffects(spawnedEffects, session, parentEffect) {
    const normalized = (Array.isArray(spawnedEffects) ? spawnedEffects : []).map((entry, index) => {
      const rawEffect = entry?.effect || entry;
      const priority = entry?.priority || "direct";
      if (!(priority in SPAWN_PRIORITY)) throw new TypeError(`未知 spawned Effect priority: ${priority}`);
      const group = normalizeGroup({
        kind: "spawned",
        ownerId: rawEffect?.ownerId || parentEffect.ownerId,
        effects: [{
          ...rawEffect,
          source: {
            parentEffectId: parentEffect.effectId,
            priority,
            ...(rawEffect?.source || {}),
          },
        }],
      }, session, "spawned");
      return { priority, index, effect: group.effects[0] };
    });
    normalized.sort((left, right) => (
      SPAWN_PRIORITY[left.priority] - SPAWN_PRIORITY[right.priority]
      || left.index - right.index
    ));
    return normalized.map((entry) => entry.effect);
  }

  function createRuntime(options = {}) {
    const cloneState = options.cloneState || clone;
    const getStateVersion = options.getStateVersion || ((state) => state?.version ?? null);
    const validateState = options.validateState || (() => ({ ok: true }));
    const projectState = options.projectState || ((state) => cloneState(state));
    const readCommittedState = options.readCommittedState || null;
    const maxDrainSteps = Math.max(1, Number(options.maxDrainSteps) || 1000);
    const executors = new Map();
    let nextSessionSequence = 0;

    assertFunction(cloneState, "cloneState");
    assertFunction(getStateVersion, "getStateVersion");
    assertFunction(validateState, "validateState");
    assertFunction(projectState, "projectState");
    if (readCommittedState != null) assertFunction(readCommittedState, "readCommittedState");

    function registerExecutor(type, executor) {
      if (!type) throw new TypeError("executor type 不能为空");
      if (executors.has(type)) throw new Error(`重复注册 Effect executor: ${type}`);
      if (typeof executor === "function") {
        executors.set(type, Object.freeze({ execute: executor }));
        return executor;
      }
      if (!executor || typeof executor !== "object") throw new TypeError("Effect executor 必须是函数或对象");
      if (typeof executor.execute !== "function" && typeof executor.getLegalChoices !== "function") {
        throw new TypeError(`${type} executor 缺少 execute() 或 getLegalChoices()`);
      }
      executors.set(type, Object.freeze({ ...executor }));
      return executor;
    }

    function createSession(committedState, meta = {}) {
      nextSessionSequence += 1;
      const sessionId = meta.sessionId || `effect-session-${nextSessionSequence}`;
      const baseState = cloneState(committedState);
      return {
        schemaVersion: SCHEMA_VERSION,
        sessionId,
        phase: "session_open",
        baseVersion: getStateVersion(committedState),
        baseState,
        workingState: cloneState(baseState),
        committedState: null,
        queue: [],
        journal: {
          actions: [],
          decisions: [],
          events: [],
          rng: [],
          history: [],
          logs: [],
        },
        failure: null,
        irreversibleBarrier: null,
        revision: 0,
        nextEffectSequence: 0,
        nextGroupSequence: 0,
        interruptContext: null,
      };
    }

    function isActive(session) {
      return session && !TERMINAL_PHASES.has(session.phase);
    }

    function currentEffect(session) {
      return session?.queue?.[0] || null;
    }

    function getDecisionSnapshot(session, effect = currentEffect(session)) {
      if (!effect || effect.kind !== "decision") return null;
      const executor = executors.get(effect.type);
      if (!executor || typeof executor.getLegalChoices !== "function") {
        return fail("EFFECT_DECISION_EXECUTOR_MISSING", `DecisionEffect ${effect.type} 缺少合法项枚举器`, {
          effectId: effect.effectId,
          type: effect.type,
        });
      }
      let choices;
      try {
        choices = executor.getLegalChoices(cloneState(session.workingState), effect) || [];
      } catch (error) {
        return fail("EFFECT_DECISION_ENUMERATION_FAILED", error?.message || `${effect.type} 合法项枚举失败`, {
          effectId: effect.effectId,
          type: effect.type,
        });
      }
      if (!Array.isArray(choices)) {
        return fail("EFFECT_DECISION_CHOICES_INVALID", `${effect.type} 未返回合法项数组`, {
          effectId: effect.effectId,
        });
      }
      return {
        ok: true,
        decisionId: effect.effectId,
        decisionVersion: session.revision,
        ownerId: effect.ownerId,
        decisionKind: effect.decisionKind || effect.type,
        allowQuickActions: effect.allowQuickActions,
        choices: clone(choices),
      };
    }

    function inspect(session) {
      if (!session) return fail("EFFECT_SESSION_REQUIRED", "缺少 Effect Session");
      const effect = currentEffect(session);
      const decision = session.phase === "awaiting_input" ? getDecisionSnapshot(session, effect) : null;
      return {
        ok: !session.failure,
        schemaVersion: SCHEMA_VERSION,
        sessionId: session.sessionId,
        phase: session.phase,
        baseVersion: session.baseVersion,
        revision: session.revision,
        queueLength: session.queue.length,
        currentEffect: effect ? clone(effect) : null,
        decision,
        irreversibleBarrier: clone(session.irreversibleBarrier),
        failure: clone(session.failure),
      };
    }

    function observe(session, viewer = null) {
      if (!session) return fail("EFFECT_SESSION_REQUIRED", "缺少 Effect Session");
      const state = session.phase === "completed" ? session.committedState : session.workingState;
      return {
        schemaVersion: SCHEMA_VERSION,
        sessionId: session.sessionId,
        phase: session.phase,
        revision: session.revision,
        state: projectState(cloneState(state), viewer, inspect(session)),
        decision: session.phase === "awaiting_input" ? getDecisionSnapshot(session) : null,
      };
    }

    function abort(session, failure) {
      session.failure = clone(failure);
      if (session.irreversibleBarrier) {
        session.phase = "irreversible_locked";
        return fail("EFFECT_SESSION_IRREVERSIBLE_LOCKED", "session 已越过不可撤销屏障，拒绝回滚", {
          failure: clone(failure),
          irreversibleBarrier: clone(session.irreversibleBarrier),
          session,
        });
      }
      session.workingState = cloneState(session.baseState);
      session.queue = [];
      session.phase = "aborted";
      return fail(failure.code || "EFFECT_SESSION_ABORTED", failure.message || "Effect Session 已回滚", {
        failure: clone(failure),
        session,
      });
    }

    function commit(session) {
      if (session.queue.length > 0) {
        return fail("EFFECT_SESSION_NOT_DRAINED", "Effect Queue 未清空，不能提交");
      }
      session.phase = "committing";
      const authorityState = readCommittedState ? readCommittedState() : session.baseState;
      const currentVersion = getStateVersion(authorityState);
      if (currentVersion !== session.baseVersion) {
        return abort(session, {
          code: "EFFECT_SESSION_VERSION_CONFLICT",
          message: "committedState 版本已变化，拒绝覆盖",
          baseVersion: session.baseVersion,
          currentVersion,
        });
      }
      const validation = validateState(cloneState(session.workingState), session);
      if (validation?.ok === false) {
        return abort(session, {
          code: validation.code || "EFFECT_SESSION_INVARIANT_FAILED",
          message: validation.message || "session 提交前不变量失败",
          validation: clone(validation),
        });
      }
      session.committedState = cloneState(session.workingState);
      session.phase = "completed";
      return { ok: true, session, committedState: cloneState(session.committedState) };
    }

    function dispatchAction(committedState, action, createEffectGroup, meta = {}) {
      assertFunction(createEffectGroup, "createEffectGroup");
      const session = createSession(committedState, meta);
      let rawGroup;
      try {
        rawGroup = createEffectGroup(cloneState(session.workingState), clone(action));
      } catch (error) {
        return abort(session, {
          code: "EFFECT_ACTION_REJECTED",
          message: error?.message || "Action 未能生成 Effect Group",
        });
      }
      if (rawGroup?.ok === false) return abort(session, rawGroup);
      let group;
      try {
        group = normalizeGroup({ ...rawGroup, action }, session, "action");
      } catch (error) {
        return abort(session, {
          code: "EFFECT_GROUP_INVALID",
          message: error?.message || "Action 生成了无效 Effect Group",
        });
      }
      session.queue.push(...group.effects);
      session.journal.actions.push({ action: clone(action), groupId: group.groupId });
      session.phase = "action_accepted";
      if (session.queue.length === 0) return commit(session);
      return { ok: true, session, group };
    }

    function applyResult(session, effect, result) {
      if (!result || result.ok !== true || !("nextState" in result)) {
        return abort(session, {
          code: result?.code || "EFFECT_EXECUTION_FAILED",
          message: result?.message || `${effect.type} 未返回 { ok: true, nextState }`,
          effectId: effect.effectId,
          type: effect.type,
        });
      }
      let spawnedEffects;
      let events;
      let rng;
      let history;
      try {
        spawnedEffects = normalizeSpawnedEffects(result.spawnedEffects, session, effect);
        events = normalizeResultArray(result, "events", effect);
        rng = normalizeResultArray(result, "rng", effect);
        history = normalizeResultArray(result, "history", effect);
      } catch (error) {
        return abort(session, {
          code: "EFFECT_RESULT_INVALID",
          message: error?.message || "Effect result 无效",
          effectId: effect.effectId,
        });
      }
      session.workingState = cloneState(result.nextState);
      session.revision += 1;
      session.queue.shift();
      if (spawnedEffects.length) session.queue.unshift(...spawnedEffects);
      session.journal.events.push(...events);
      session.journal.rng.push(...rng);
      session.journal.history.push(...history);
      if (result.log != null) session.journal.logs.push(clone(result.log));
      if (result.irreversible) {
        session.irreversibleBarrier = {
          effectId: effect.effectId,
          revision: session.revision,
          code: result.irreversible.code || "irreversible",
          reason: result.irreversible.reason || "效果已向外暴露隐藏信息",
        };
      }
      return { ok: true, session, effect, result };
    }

    function resumeInterruptedDecision(session, marker) {
      session.queue.shift();
      session.revision += 1;
      const effect = currentEffect(session);
      if (!effect || effect.effectId !== marker.payload.decisionId) {
        return abort(session, {
          code: "EFFECT_INTERRUPT_RESUME_MISMATCH",
          message: "快速行动结束后找不到原 Effect",
          expectedDecisionId: marker.payload.decisionId,
          actualEffectId: effect?.effectId || null,
        });
      }
      const interruptedKind = session.interruptContext?.kind || null;
      session.interruptContext = null;
      if (interruptedKind === "decision") {
        session.phase = "awaiting_input";
        const snapshot = getDecisionSnapshot(session, effect);
        if (snapshot?.ok === false) return abort(session, snapshot);
        return { ok: true, session, decision: snapshot, resumed: true };
      }
      session.phase = "draining";
      return { ok: true, session, resumed: true };
    }

    function advance(session) {
      if (!isActive(session)) return fail("EFFECT_SESSION_NOT_ACTIVE", "Effect Session 不在可推进状态", { session });
      const effect = currentEffect(session);
      if (!effect) return commit(session);
      if (effect.type === INTERNAL_RESUME_EFFECT) return resumeInterruptedDecision(session, effect);
      if (effect.kind === "decision") {
        session.phase = "awaiting_input";
        const snapshot = getDecisionSnapshot(session, effect);
        if (snapshot?.ok === false) return abort(session, snapshot);
        return { ok: true, session, decision: snapshot };
      }
      const executor = executors.get(effect.type);
      if (!executor || typeof executor.execute !== "function") {
        return abort(session, {
          code: "EFFECT_EXECUTOR_NOT_REGISTERED",
          message: `未注册 Effect executor: ${effect.type}`,
          effectId: effect.effectId,
          type: effect.type,
        });
      }
      session.phase = session.interruptContext ? "interrupting" : "effect_running";
      let result;
      try {
        result = executor.execute(cloneState(session.workingState), effect);
      } catch (error) {
        return abort(session, {
          code: "EFFECT_EXECUTOR_THROWN",
          message: error?.message || `${effect.type} executor 抛出异常`,
          effectId: effect.effectId,
          type: effect.type,
        });
      }
      const applied = applyResult(session, effect, result);
      if (!applied.ok) return applied;
      if (session.queue.length === 0) return commit(session);
      session.phase = session.interruptContext ? "interrupting" : "draining";
      return applied;
    }

    function drain(session, options = {}) {
      const limit = Math.max(1, Number(options.maxSteps) || maxDrainSteps);
      let steps = 0;
      while (isActive(session) && session.phase !== "awaiting_input") {
        if (steps >= limit) {
          return abort(session, {
            code: "EFFECT_DRAIN_LIMIT_EXCEEDED",
            message: `Effect drain 超过 ${limit} 步`,
            maxSteps: limit,
          });
        }
        const result = advance(session);
        if (!result.ok) return result;
        steps += 1;
      }
      return { ok: true, session, steps, inspection: inspect(session) };
    }

    function resolveDecision(session, submission) {
      if (!isActive(session) || session.phase !== "awaiting_input") {
        return fail("EFFECT_DECISION_NOT_AWAITING", "当前没有等待输入的 DecisionEffect");
      }
      const effect = currentEffect(session);
      const snapshot = getDecisionSnapshot(session, effect);
      if (snapshot?.ok === false) return abort(session, snapshot);
      if (submission?.decisionId !== snapshot.decisionId || submission?.decisionVersion !== snapshot.decisionVersion) {
        return fail("EFFECT_DECISION_STALE", "Decision 已过期", { decision: snapshot });
      }
      const executor = executors.get(effect.type);
      if (typeof executor?.resolveDecision !== "function") {
        return abort(session, {
          code: "EFFECT_DECISION_RESOLVER_MISSING",
          message: `DecisionEffect ${effect.type} 缺少 resolveDecision()`,
        });
      }
      const serializedChoice = stableSerialize(submission.choice);
      const legalChoice = snapshot.choices.find((choice) => stableSerialize(choice) === serializedChoice);
      if (!legalChoice) {
        return fail("EFFECT_DECISION_NOT_LEGAL", "提交项不在最新 legal choices 中", { decision: snapshot });
      }
      let result;
      try {
        result = executor.resolveDecision(cloneState(session.workingState), effect, clone(legalChoice));
      } catch (error) {
        return abort(session, {
          code: "EFFECT_DECISION_RESOLVER_THROWN",
          message: error?.message || `${effect.type} decision resolver 抛出异常`,
        });
      }
      session.journal.decisions.push({
        decisionId: snapshot.decisionId,
        decisionVersion: snapshot.decisionVersion,
        ownerId: snapshot.ownerId,
        choice: clone(legalChoice),
      });
      const applied = applyResult(session, effect, result);
      if (!applied.ok) return applied;
      if (session.queue.length === 0) return commit(session);
      session.phase = "draining";
      return applied;
    }

    function dispatchQuickAction(session, action, createEffectGroup, options = {}) {
      if (!isActive(session)) return fail("EFFECT_SESSION_NOT_ACTIVE", "Effect Session 不在可中断状态");
      if (session.interruptContext) {
        return fail("EFFECT_INTERRUPT_NESTED_UNSUPPORTED", "当前已有快速行动中断，拒绝嵌套中断");
      }
      const decision = session.phase === "awaiting_input" ? getDecisionSnapshot(session) : null;
      if (decision?.ok === false) return decision;
      const boundaryAllowed = ["action_accepted", "draining"].includes(session.phase)
        && options.allowAtBoundary === true;
      const decisionAllowed = decision?.ok === true && decision.allowQuickActions;
      if (!boundaryAllowed && !decisionAllowed) {
        return fail("EFFECT_INTERRUPT_NOT_ALLOWED", "当前 Effect 边界不允许快速行动");
      }
      assertFunction(createEffectGroup, "createEffectGroup");
      let rawGroup;
      try {
        rawGroup = createEffectGroup(cloneState(session.workingState), clone(action));
      } catch (error) {
        return fail("EFFECT_QUICK_ACTION_REJECTED", error?.message || "Quick Action 未能生成 Effect Group");
      }
      if (rawGroup?.ok === false) return rawGroup;
      let group;
      let markerGroup;
      const interruptedEffect = currentEffect(session);
      try {
        group = normalizeGroup({ ...rawGroup, action, kind: "quick" }, session, "quick");
        markerGroup = normalizeGroup({
          kind: "internal",
          effects: [{
            type: INTERNAL_RESUME_EFFECT,
            payload: { decisionId: interruptedEffect.effectId },
          }],
        }, session, "internal");
      } catch (error) {
        return fail("EFFECT_QUICK_GROUP_INVALID", error?.message || "Quick Action 生成了无效 Effect Group");
      }
      session.queue.unshift(...group.effects, markerGroup.effects[0]);
      session.interruptContext = {
        effectId: interruptedEffect.effectId,
        kind: interruptedEffect.kind,
        decisionVersion: decision?.decisionVersion ?? null,
        quickGroupId: group.groupId,
      };
      session.journal.actions.push({ action: clone(action), groupId: group.groupId, quick: true });
      session.phase = "interrupting";
      return { ok: true, session, group };
    }

    return Object.freeze({
      registerExecutor,
      dispatchAction,
      dispatchQuickAction,
      resolveDecision,
      advance,
      drain,
      inspect,
      observe,
      abort: (session, reason = {}) => abort(session, {
        code: reason.code || "EFFECT_SESSION_ABORTED_BY_HOST",
        message: reason.message || "宿主中止 Effect Session",
      }),
    });
  }

  return Object.freeze({
    SCHEMA_VERSION,
    SPAWN_PRIORITY,
    createRuntime,
  });
});
