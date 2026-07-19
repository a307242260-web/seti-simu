(function (root, factory) {
  "use strict";

  let policyPort = root.SetiPolicyPort;
  let standardAction = root.SetiStandardAction;
  if ((!policyPort || !standardAction) && typeof require === "function") {
    policyPort = policyPort || require("../../game/ai/policy-port");
    standardAction = standardAction || require("../../game/actions/standard-action");
  }
  const api = factory(policyPort, standardAction);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiBrowserPolicyInputAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (policyPort, standardAction) {
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

    let requestOrdinal = 0;
    let generation = 0;
    let running = false;
    let lastResult = null;

    function readNormalizedBoundary() {
      try {
        return normalizeBoundary(readBoundary());
      } catch (error) {
        return fail("POLICY_INPUT_BOUNDARY_READ_FAILED", error?.message || "读取 Policy boundary 失败");
      }
    }

    function createContext(boundary) {
      return policyPort.createDecisionContext({
        requestId: `browser-policy:${boundary.actorId}:${boundary.stateVersion}:${boundary.decisionVersion}:${requestOrdinal}`,
        seatId: boundary.actorId,
        stateVersion: boundary.stateVersion,
        decisionVersion: boundary.decisionVersion,
        observation: readObservation(boundary.actorId),
        legalActions: boundary.legalActions,
        deterministicContext: {
          inputSchemaVersion: SCHEMA_VERSION,
          boundaryKind: boundary.kind,
          decisionId: boundary.decisionId,
          requestOrdinal,
        },
      });
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

    async function runOnce(runOptions = {}) {
      if (running) return fail("POLICY_INPUT_REQUEST_ACTIVE", "已有 Policy request 正在执行");
      const boundary = readNormalizedBoundary();
      if (!boundary.ok) return boundary;
      if (boundary.kind === "terminal") return freeze({ ok: true, done: true, terminal: boundary.terminal });

      running = true;
      const ownGeneration = generation;
      let context;
      try {
        context = createContext(boundary);
      } catch (error) {
        running = false;
        return fail(error?.code || "POLICY_INPUT_CONTEXT_FAILED", error?.message || "创建 DecisionContext 失败");
      }
      requestOrdinal += 1;
      try {
        const validated = await policyPort.runPolicy(policy, context, {
          deadlineAt: runOptions.deadlineAt,
          signal: runOptions.signal,
          registry: {
            validate(_runtimeContext, action) {
              if (ownGeneration !== generation) {
                return fail("POLICY_INPUT_INVALIDATED", "Policy input generation 已失效");
              }
              return validateFreshBoundary(boundary, action);
            },
          },
          getRuntimeContext: () => ({ generation: ownGeneration }),
        });
        if (!validated?.ok) {
          lastResult = validated;
          return validated;
        }
        const fresh = validateFreshBoundary(boundary, validated.action);
        if (!fresh.ok) {
          lastResult = fresh;
          return fresh;
        }
        const submission = boundary.kind === "decision"
          ? inputAdapter.submitDecision({
            decisionId: fresh.boundary.decisionId,
            decisionVersion: fresh.boundary.decisionVersion,
            choice: clone(fresh.action),
          })
          : inputAdapter.dispatchAction(clone(fresh.action));
        lastResult = freeze({
          ok: submission?.ok !== false,
          kind: boundary.kind,
          actionId: identity(fresh.action),
          policyDecision: clone(validated.decision),
          submission: clone(submission),
        });
        return lastResult;
      } catch (error) {
        lastResult = fail(error?.code || "POLICY_INPUT_FAILED", error?.message || "Policy input 执行失败");
        return lastResult;
      } finally {
        running = false;
      }
    }

    function invalidate() {
      generation += 1;
      return generation;
    }

    function inspect() {
      return freeze({ schemaVersion: SCHEMA_VERSION, requestOrdinal, generation, running, lastResult: clone(lastResult) });
    }

    return Object.freeze({ runOnce, invalidate, inspect });
  }

  return Object.freeze({ SCHEMA_VERSION, normalizeBoundary, createPolicyInputAdapter });
});
