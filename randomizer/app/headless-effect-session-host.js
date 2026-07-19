"use strict";

const effectSession = require("../game/effects/session-runtime");

const SUBMIT_EFFECT = "headless_submit_standard_action";
const DRAIN_EFFECT = "headless_deterministic_drain";
const DECISION_EFFECT = "headless_standard_decision";
const TERMINAL_PHASES = new Set(["completed", "aborted", "irreversible_locked"]);

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function fail(code, message, details = {}) {
  return { ok: false, code, message, ...clone(details) };
}

function requireFunction(options, key) {
  if (typeof options?.[key] !== "function") {
    throw new TypeError(`Headless Effect Session host 缺少 ${key}()`);
  }
  return options[key];
}

function actionIdentity(action) {
  return action?.actionId ?? action?.choiceId ?? action?.id ?? action?.target?.choiceId ?? null;
}

function createHeadlessEffectSessionHost(options = {}) {
  const captureState = requireFunction(options, "captureState");
  const restoreState = requireFunction(options, "restoreState");
  const inspectBoundary = requireFunction(options, "inspectBoundary");
  const executeAction = requireFunction(options, "executeAction");
  const executeDecision = requireFunction(options, "executeDecision");
  const advanceDeterministic = requireFunction(options, "advanceDeterministic");
  const executeCurrentEffect = requireFunction(options, "executeCurrentEffect");
  const projectObservation = requireFunction(options, "projectObservation");
  const maxDrainSteps = Math.max(1, Number(options.maxDrainSteps || 2000));
  const synchronizeWorkingState = options.synchronizeWorkingState !== false;
  let stateVersion = 0;
  let activeSession = null;
  let completedJournals = [];

  function captureNextState(previousState) {
    stateVersion = Math.max(stateVersion, Number(previousState?.stateVersion || 0)) + 1;
    return {
      stateVersion,
      snapshot: clone(captureState()),
    };
  }

  function restoreWorkingState(workingState) {
    if (!synchronizeWorkingState) return;
    const restored = restoreState(clone(workingState?.snapshot));
    if (restored?.ok === false) {
      const error = new Error(restored.message || "Headless workingState 恢复失败");
      error.code = restored.code || "HEADLESS_WORKING_STATE_RESTORE_FAILED";
      throw error;
    }
  }

  function deterministicEffect() {
    return { type: DRAIN_EFFECT, kind: "effect", payload: {} };
  }

  function decisionEffect(boundary) {
    return {
      type: DECISION_EFFECT,
      kind: "decision",
      ownerId: boundary.actorPlayer?.id || boundary.ownerId || null,
      decisionKind: boundary.family || boundary.candidates?.[0]?.family || "conditional_choice",
      payload: {
        family: boundary.family || boundary.candidates?.[0]?.family || null,
      },
    };
  }

  function normalizeExecution(result, fallbackMessage) {
    if (result?.ok === false) {
      return fail(result.code || "HEADLESS_EFFECT_EXECUTION_FAILED", result.message || fallbackMessage, {
        cause: clone(result),
      });
    }
    return result ? { ...result, ok: true } : { ok: true };
  }

  const runtime = effectSession.createRuntime({
    maxDrainSteps,
    getStateVersion: (workingState) => workingState?.stateVersion ?? null,
    projectState(workingState, viewer) {
      restoreWorkingState(workingState);
      return projectObservation(clone(workingState), viewer);
    },
  });

  runtime.registerExecutor(SUBMIT_EFFECT, (workingState, effect) => {
    restoreWorkingState(workingState);
    const result = normalizeExecution(
      executeAction(clone(effect.payload.action)),
      "Standard Action 执行失败",
    );
    if (!result.ok) return result;
    return {
      ok: true,
      nextState: captureNextState(workingState),
      spawnedEffects: [{ priority: "direct", effect: deterministicEffect() }],
      events: [{
        type: "headless_standard_action_executed",
        family: effect.payload.action?.family || null,
        actionId: actionIdentity(effect.payload.action),
      }],
    };
  });

  runtime.registerExecutor(DRAIN_EFFECT, (workingState) => {
    restoreWorkingState(workingState);
    const boundary = inspectBoundary();
    if (boundary?.ok === false) return clone(boundary.error || boundary);
    const candidates = (boundary?.candidates || []).filter((candidate) => candidate?.available !== false);
    if (boundary?.decisionType === "conditional_choice" || candidates[0]?.standardAction?.phase === "conditional") {
      if (candidates.length > 1) {
        return {
          ok: true,
          nextState: clone(workingState),
          spawnedEffects: [{ priority: "direct", effect: decisionEffect({ ...boundary, candidates }) }],
        };
      }
      if (candidates.length === 1) {
        const result = normalizeExecution(executeDecision(clone(candidates[0])), "唯一 Decision 执行失败");
        if (!result.ok) return result;
        return {
          ok: true,
          nextState: captureNextState(workingState),
          spawnedEffects: [{ priority: "direct", effect: deterministicEffect() }],
          events: [{
            type: "headless_automatic_decision",
            family: candidates[0].family || null,
            ownerPlayerId: boundary.actorPlayer?.id || null,
            actionId: actionIdentity(candidates[0]),
          }],
        };
      }
    }
    if (boundary?.boundary === "turn_action" || boundary?.boundary === "terminal" || candidates.length) {
      return { ok: true, nextState: clone(workingState) };
    }
    const deterministic = normalizeExecution(advanceDeterministic(), "确定性状态推进失败");
    if (!deterministic.ok) return deterministic;
    if (deterministic.progressed) {
      return {
        ok: true,
        nextState: captureNextState(workingState),
        spawnedEffects: [{ priority: "direct", effect: deterministicEffect() }],
        events: [{ type: "headless_deterministic_advance" }],
      };
    }
    if (boundary?.actionEffectActive) {
      const effectResult = normalizeExecution(executeCurrentEffect(), "活动 Effect 执行失败");
      if (!effectResult.ok) return effectResult;
      return {
        ok: true,
        nextState: captureNextState(workingState),
        spawnedEffects: [{ priority: "direct", effect: deterministicEffect() }],
        events: [{
          type: "headless_deterministic_effect",
          effectType: boundary.currentEffect?.type || effectResult.type || null,
          effectId: boundary.currentEffect?.id || effectResult.effectId || null,
        }],
      };
    }
    return fail(
      "HEADLESS_UNSUPPORTED_PENDING",
      "存在未迁移的 headless pending，Effect Session 拒绝 resolver/recover/skip fallback",
      { boundary: clone(boundary) },
    );
  });

  runtime.registerExecutor(DECISION_EFFECT, {
    getLegalChoices(workingState, effect) {
      restoreWorkingState(workingState);
      const boundary = inspectBoundary();
      if (boundary?.ok === false) throw new Error(boundary.error?.message || "Decision 枚举失败");
      const candidates = (boundary?.candidates || []).filter((candidate) => candidate?.available !== false);
      if (candidates.length < 2) {
        throw new Error(`${effect.decisionKind} 已不再是多选 Decision`);
      }
      return candidates;
    },
    resolveDecision(workingState, _effect, choice) {
      restoreWorkingState(workingState);
      const result = normalizeExecution(executeDecision(clone(choice)), "Decision 执行失败");
      if (!result.ok) return result;
      return {
        ok: true,
        nextState: captureNextState(workingState),
        spawnedEffects: [{ priority: "direct", effect: deterministicEffect() }],
        events: [{
          type: "headless_standard_decision_executed",
          family: choice?.family || null,
          actionId: actionIdentity(choice),
        }],
      };
    },
  });

  function createInitialState() {
    stateVersion += 1;
    return { stateVersion, snapshot: clone(captureState()) };
  }

  function captureCurrentState() {
    return { stateVersion, snapshot: clone(captureState()) };
  }

  function settle(result) {
    if (!result?.ok) return result;
    const drained = runtime.drain(activeSession);
    if (!drained?.ok) return drained;
    if (activeSession.phase === "completed") {
      completedJournals.push(clone(activeSession.journal));
      activeSession = null;
    }
    return { ok: true, phase: activeSession?.phase || "completed", session: activeSession };
  }

  function submitAction(action) {
    if (activeSession) return fail("HEADLESS_EFFECT_SESSION_ACTIVE", "已有 Effect Session 等待 Decision");
    const dispatched = runtime.dispatchAction(
      createInitialState(),
      clone(action),
      () => ({ effects: [{ type: SUBMIT_EFFECT, payload: { action: clone(action) } }] }),
      { ownerId: action?.actorPlayerId || action?.actorId || null },
    );
    if (!dispatched?.ok) return dispatched;
    activeSession = dispatched.session;
    const settled = settle(dispatched);
    const journal = activeSession?.journal || completedJournals.at(-1) || null;
    return { ...settled, events: clone(journal?.events || []), journal: clone(journal) };
  }

  function beginDrain() {
    if (activeSession) return fail("HEADLESS_EFFECT_SESSION_ACTIVE", "已有 Effect Session 正在执行");
    const internalAction = { family: "environment_drain", phase: "internal", actorId: null };
    const dispatched = runtime.dispatchAction(
      createInitialState(),
      internalAction,
      () => ({ kind: "internal", effects: [deterministicEffect()] }),
    );
    if (!dispatched?.ok) return dispatched;
    activeSession = dispatched.session;
    activeSession.journal.actions = [];
    activeSession.journal.replay = [];
    const settled = settle(dispatched);
    const journal = activeSession?.journal || completedJournals.at(-1) || null;
    return { ...settled, events: clone(journal?.events || []), journal: clone(journal) };
  }

  function submitDecision(action) {
    if (!activeSession || activeSession.phase !== "awaiting_input") {
      return fail("HEADLESS_EFFECT_DECISION_REQUIRED", "当前没有等待输入的 Effect Session");
    }
    const decision = runtime.inspect(activeSession).decision;
    const choice = decision?.choices?.find((candidate) => (
      String(actionIdentity(candidate)) === String(actionIdentity(action))
    ));
    if (!choice) {
      return fail("HEADLESS_EFFECT_CHOICE_NOT_LEGAL", "Decision actionId 不在 workingState legal choices 中", {
        actionId: actionIdentity(action),
      });
    }
    const eventCursor = activeSession.journal.events.length;
    const settled = settle(runtime.resolveDecision(activeSession, {
      decisionId: decision.decisionId,
      decisionVersion: decision.decisionVersion,
      choice,
    }));
    const journal = activeSession?.journal || completedJournals.at(-1) || null;
    return {
      ...settled,
      events: clone((journal?.events || []).slice(eventCursor)),
      journal: clone(journal),
    };
  }

  function getBoundary() {
    if (!activeSession) return clone(inspectBoundary());
    const inspected = runtime.inspect(activeSession);
    if (inspected.phase !== "awaiting_input") {
      return fail("HEADLESS_EFFECT_SESSION_NOT_STABLE", `Effect Session 未停在 Decision：${inspected.phase}`);
    }
    return {
      ok: true,
      boundary: "conditional_choice",
      decisionType: "conditional_choice",
      actorPlayer: { id: inspected.decision.ownerId },
      candidates: clone(inspected.decision.choices),
      decision: clone(inspected.decision),
    };
  }

  function observe(viewer = null) {
    if (!activeSession) {
      const state = captureCurrentState();
      return projectObservation(clone(state), viewer);
    }
    return runtime.observe(activeSession, viewer).state;
  }

  function createCheckpoint() {
    if (!activeSession) return null;
    const checkpoint = runtime.createCheckpoint(activeSession);
    return checkpoint.ok ? checkpoint.checkpoint : checkpoint;
  }

  function restoreCheckpoint(checkpoint) {
    if (!checkpoint) {
      activeSession = null;
      return { ok: true, phase: "idle" };
    }
    const restored = runtime.restoreCheckpoint(clone(checkpoint));
    if (!restored?.ok) return restored;
    activeSession = restored.session;
    stateVersion = Math.max(stateVersion, Number(activeSession.workingState?.stateVersion || 0));
    restoreWorkingState(activeSession.workingState);
    return { ok: true, phase: activeSession.phase, session: activeSession };
  }

  function reset() {
    activeSession = null;
    completedJournals = [];
    stateVersion = 0;
  }

  return Object.freeze({
    submit(action) {
      return activeSession ? submitDecision(action) : submitAction(action);
    },
    beginDrain,
    submitAction,
    submitDecision,
    getBoundary,
    observe,
    inspect: () => activeSession ? runtime.inspect(activeSession) : { ok: true, phase: "idle" },
    getWorkingState: () => clone(activeSession?.workingState || captureCurrentState()),
    getJournal: () => clone(activeSession?.journal || completedJournals.at(-1) || null),
    getCompletedJournals: () => clone(completedJournals),
    getConfirmedReplay: (cursor = 0) => activeSession
      ? runtime.getConfirmedReplay(activeSession, cursor)
      : [],
    createCheckpoint,
    restoreCheckpoint,
    reset,
    runtime,
    isActive: () => Boolean(activeSession && !TERMINAL_PHASES.has(activeSession.phase)),
  });
}

module.exports = {
  DECISION_EFFECT,
  DRAIN_EFFECT,
  SUBMIT_EFFECT,
  createHeadlessEffectSessionHost,
};
