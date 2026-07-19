(function (root, factory) {
  "use strict";

  let policyPort = root.SetiPolicyPort;
  let standardAction = root.SetiStandardAction;
  let machinePlayerHost = root.SetiMachinePlayerHost;
  if ((!policyPort || !standardAction || !machinePlayerHost) && typeof require === "function") {
    policyPort = policyPort || require("../../game/ai/policy-port");
    standardAction = standardAction || require("../../game/actions/standard-action");
    machinePlayerHost = machinePlayerHost || require("../../game/ai/machine-player-host");
  }
  const api = factory(policyPort, standardAction, machinePlayerHost);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiBrowserPolicyInputAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (policyPort, standardAction, machinePlayerHost) {
  "use strict";

  const SCHEMA_VERSION = "seti-browser-policy-input-v1";
  const BOUNDARY_KINDS = new Set(["action", "decision", "terminal"]);
  const SUPPORTED_FAMILIES = new Set(standardAction.ALL_FAMILIES);

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function freeze(value) {
    if (value == null || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) freeze(child);
    return Object.freeze(value);
  }

  function fail(code, message, details = {}) {
    return freeze({ ok: false, code, message, ...clone(details) });
  }

  function identity(action) {
    return action?.actionId == null ? null : String(action.actionId);
  }

  function normalizeBoundary(rawBoundary) {
    const raw = clone(rawBoundary);
    if (!raw || typeof raw !== "object") {
      return fail("POLICY_INPUT_BOUNDARY_REQUIRED", "Policy 输入需要共享 session boundary");
    }
    if (!BOUNDARY_KINDS.has(raw.kind)) {
      return fail("POLICY_INPUT_BOUNDARY_UNSUPPORTED", `未知 Policy boundary: ${raw.kind || "<missing>"}`);
    }
    if (raw.kind === "terminal") {
      return freeze({ ok: true, kind: "terminal", terminal: clone(raw.terminal || {}) });
    }
    const legalActions = raw.legalActions;
    if (!Array.isArray(legalActions) || legalActions.length === 0) {
      return fail("POLICY_INPUT_LEGAL_SET_EMPTY", `${raw.kind} boundary 没有 legal Standard Action/Decision`);
    }
    const actorId = raw.actorId ?? legalActions[0]?.actorId;
    const stateVersion = raw.stateVersion ?? legalActions[0]?.stateVersion;
    const decisionVersion = raw.decisionVersion ?? legalActions[0]?.decisionVersion;
    if (typeof actorId !== "string" || !actorId) {
      return fail("POLICY_INPUT_OWNER_INVALID", "Policy boundary 缺少稳定 actorId");
    }
    if (!Number.isSafeInteger(stateVersion) || stateVersion < 0
      || !Number.isSafeInteger(decisionVersion) || decisionVersion < 0) {
      return fail("POLICY_INPUT_VERSION_INVALID", "Policy boundary 版本必须是非负安全整数");
    }
    const ids = new Set();
    for (const action of legalActions) {
      if (action?.schemaVersion !== policyPort.STANDARD_ACTION_SCHEMA_VERSION) {
        return fail("POLICY_INPUT_ACTION_SCHEMA_UNSUPPORTED", "Policy legal action schema 未支持", {
          actionId: identity(action),
        });
      }
      if (!SUPPORTED_FAMILIES.has(action.family)) {
        return fail("POLICY_INPUT_FAMILY_UNSUPPORTED", `Policy 不支持 action family: ${action.family || "<missing>"}`);
      }
      if (standardAction.PHASE_BY_FAMILY[action.family] !== action.phase) {
        return fail("POLICY_INPUT_PHASE_UNSUPPORTED", `Policy action family/phase 不匹配: ${action.family}/${action.phase || "<missing>"}`, {
          actionId: identity(action),
        });
      }
      if (action.actorId !== actorId || action.stateVersion !== stateVersion
        || action.decisionVersion !== decisionVersion) {
        return fail("POLICY_INPUT_AUTHORITY_MISMATCH", "legal action owner/version 与 boundary 不一致", {
          actionId: identity(action),
        });
      }
      if (!identity(action) || ids.has(identity(action))) {
        return fail("POLICY_INPUT_ACTION_ID_INVALID", "legal actionId 缺失或重复", {
          actionId: identity(action),
        });
      }
      if (raw.kind === "decision" && action.phase !== "conditional") {
        return fail("POLICY_INPUT_DECISION_PHASE_INVALID", "Decision boundary 只能包含 conditional Action", {
          actionId: identity(action),
        });
      }
      if (raw.kind === "action" && action.phase === "conditional") {
        return fail("POLICY_INPUT_ACTION_PHASE_INVALID", "顶层 Action boundary 不得混入 conditional Action", {
          actionId: identity(action),
        });
      }
      ids.add(identity(action));
    }
    if (raw.kind === "decision" && (typeof raw.decisionId !== "string" || !raw.decisionId)) {
      return fail("POLICY_INPUT_DECISION_ID_INVALID", "Decision boundary 缺少 decisionId");
    }
    return freeze({
      ok: true,
      kind: raw.kind,
      actorId,
      stateVersion,
      decisionVersion,
      decisionId: raw.kind === "decision" ? raw.decisionId : null,
      legalActions,
    });
  }

  function sameAuthority(left, right) {
    return left.kind === right.kind
      && left.actorId === right.actorId
      && left.stateVersion === right.stateVersion
      && left.decisionVersion === right.decisionVersion
      && left.decisionId === right.decisionId;
  }

  function createPolicyInputAdapter(options = {}) {
    const policy = options.policy;
    const readBoundary = options.readBoundary;
    const readObservation = options.readObservation;
    const inputAdapter = options.inputAdapter;
    if (typeof policy?.decide !== "function" && typeof policy !== "function") {
      throw new TypeError("PolicyInputAdapter 需要 Policy decide(context)");
    }
    if (typeof readBoundary !== "function") throw new TypeError("PolicyInputAdapter 需要 readBoundary()");
    if (typeof readObservation !== "function") throw new TypeError("PolicyInputAdapter 需要 readObservation()");
    if (!inputAdapter?.dispatchAction || !inputAdapter?.submitDecision) {
      throw new TypeError("PolicyInputAdapter 需要共享 Action/Decision input adapter");
    }

    let initializedSeatId = null;
    let lastResult = null;

    function readNormalizedBoundary() {
      try {
        return normalizeBoundary(readBoundary());
      } catch (error) {
        return fail("POLICY_INPUT_BOUNDARY_READ_FAILED", error?.message || "读取 Policy boundary 失败");
      }
    }

    function validateFreshBoundary(original, action) {
      const fresh = readNormalizedBoundary();
      if (!fresh.ok) return fresh;
      if (fresh.kind === "terminal" || !sameAuthority(original, fresh)) {
        return fail("POLICY_INPUT_STALE", "Policy 响应对应的 boundary 已变化");
      }
      const freshAction = fresh.legalActions.find((candidate) => identity(candidate) === identity(action));
      if (!freshAction) {
        return fail("POLICY_INPUT_ACTION_NOT_LEGAL", "Policy actionId 已不在当前 legal set", {
          actionId: identity(action),
        });
      }
      return freeze({ ok: true, action: freshAction, boundary: fresh });
    }

    const host = machinePlayerHost.createMachinePlayerHost({
      requestPrefix: "browser-policy",
      defaultDeadlineMs: options.defaultDeadlineMs,
      now: options.now,
      setTimer: options.setTimer,
      clearTimer: options.clearTimer,
      onPause: options.onPause,
      onDiagnostic: options.onDiagnostic,
      adapter: {
        readDecisionInput(seatId) {
          const boundary = readNormalizedBoundary();
          if (!boundary.ok) return boundary;
          if (boundary.kind === "terminal") {
            return fail("POLICY_INPUT_TERMINAL", "终局没有机器玩家决策输入");
          }
          return freeze({
            ok: true,
            seatId,
            stateVersion: boundary.stateVersion,
            decisionVersion: boundary.decisionVersion,
            authorityKey: `${boundary.kind}:${boundary.decisionId || ""}`,
            observation: readObservation(seatId),
            legalActions: boundary.legalActions,
            deterministicContext: {
              inputSchemaVersion: SCHEMA_VERSION,
              boundaryKind: boundary.kind,
              decisionId: boundary.decisionId,
            },
            boundary,
          });
        },
        validateFresh(input, action) {
          return validateFreshBoundary(input.boundary, action);
        },
        submit(action, input, submitContext) {
          const fresh = submitContext.fresh;
          return input.boundary.kind === "decision"
            ? inputAdapter.submitDecision({
              decisionId: fresh.boundary.decisionId,
              decisionVersion: fresh.boundary.decisionVersion,
              choice: clone(action),
            })
            : inputAdapter.dispatchAction(clone(action));
        },
      },
    });

    function initializeSeat(seatId) {
      if (initializedSeatId === seatId) return null;
      if (initializedSeatId != null) {
        return fail("POLICY_INPUT_SEAT_DRIFT", `PolicyInputAdapter 已固定席位 ${initializedSeatId}`);
      }
      const provenance = typeof policy?.getProvenance === "function" ? policy.getProvenance() : null;
      const declaredIdentity = options.policyIdentity || {
        policyType: provenance?.type || options.policyType,
        policyVersion: provenance?.version || options.policyVersion,
        modelChecksum: provenance?.modelChecksum ?? options.modelChecksum ?? null,
        config: provenance?.config || options.policyConfig || {},
        configChecksum: provenance?.configChecksum,
        seed: options.seed ?? provenance?.seed ?? null,
      };
      try {
        host.initializeSeats([{
          seatId,
          primary: { policy, identity: declaredIdentity },
          fallbacks: (options.policyFallbacks || []).map((fallback) => ({
            ...fallback,
            identity: fallback.identity || {
              policyType: fallback.policyType,
              policyVersion: fallback.policyVersion,
              modelChecksum: fallback.modelChecksum ?? null,
              config: fallback.config || {},
              seed: fallback.seed ?? options.seed ?? null,
            },
          })),
        }], { phase: options.initializationPhase || "new_game" });
        initializedSeatId = seatId;
        return null;
      } catch (error) {
        return fail(error?.code || "POLICY_INPUT_INITIALIZATION_FAILED", error?.message || "机器席位 Policy 初始化失败");
      }
    }

    async function runOnce(runOptions = {}) {
      const boundary = readNormalizedBoundary();
      if (!boundary.ok) return boundary;
      if (boundary.kind === "terminal") return freeze({ ok: true, done: true, terminal: boundary.terminal });
      const initializationFailure = initializeSeat(boundary.actorId);
      if (initializationFailure) return initializationFailure;
      lastResult = await host.requestDecision(boundary.actorId, runOptions);
      if (lastResult?.ok) {
        lastResult = freeze({
          ...clone(lastResult),
          kind: boundary.kind,
        });
      }
      return lastResult;
    }

    function invalidate(reason) {
      return host.invalidate(reason || "Policy input generation 已失效");
    }

    function inspect() {
      const snapshot = host.inspect();
      return freeze({
        schemaVersion: SCHEMA_VERSION,
        requestOrdinal: snapshot.requestOrdinal,
        generation: snapshot.generation,
        running: snapshot.activeRequests.length > 0,
        paused: clone(snapshot.paused),
        seats: clone(snapshot.seats),
        diagnostics: clone(snapshot.diagnostics),
        lastResult: clone(lastResult),
      });
    }

    return Object.freeze({ runOnce, invalidate, inspect });
  }

  return Object.freeze({ SCHEMA_VERSION, normalizeBoundary, createPolicyInputAdapter });
});
