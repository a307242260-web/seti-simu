(function (root, factory) {
  "use strict";

  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  root.SetiPolicyPort = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const CONTEXT_SCHEMA_VERSION = "seti-policy-context-v1";
  const DECISION_SCHEMA_VERSION = "seti-policy-decision-v1";
  const STANDARD_ACTION_SCHEMA_VERSION = "seti-standard-action-v1";
  const DIAGNOSTIC_KEYS = Object.freeze(new Set([
    "confidence", "latencyMs", "reasonCode", "traceId",
  ]));
  const DECISION_KEYS = Object.freeze(new Set([
    "schemaVersion", "requestId", "seatId", "stateVersion", "decisionVersion", "actionId", "policy", "diagnostics",
  ]));
  const POLICY_METADATA_KEYS = Object.freeze(new Set(["type", "version", "modelChecksum"]));
  const FORBIDDEN_KEYS = Object.freeze(new Set([
    "opponenthand", "opponenthands", "opponentreservedcards", "deckorder", "drawpile",
    "futuredraws", "futurerng", "rngstate", "unrevealedcards", "recoverysnapshot",
    "heuristicscore", "policyscore", "candidatescore", "actiongraph", "plannershadow",
    "battleanalytics", "dom", "document", "window", "resolver", "executor", "continuation",
    "callback", "pendingmutablereference",
  ]));

  class PolicyContractError extends TypeError {
    constructor(code, message, details = {}) {
      super(message);
      this.name = "PolicyContractError";
      this.code = code;
      Object.assign(this, details);
    }
  }

  function fail(code, message, details = {}) {
    return Object.freeze({ ok: false, code, message, ...details });
  }

  function normalizeKey(key) {
    return String(key).replace(/[^a-z0-9]/gi, "").toLowerCase();
  }

  function copySerializable(value, path = "$", ancestors = new Set()) {
    if (value == null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        throw new PolicyContractError("POLICY_NOT_SERIALIZABLE", `${path} 必须是有限数值`);
      }
      return value;
    }
    if (typeof value !== "object") {
      throw new PolicyContractError("POLICY_NOT_SERIALIZABLE", `${path} 含不可序列化值`);
    }
    if (ancestors.has(value)) {
      throw new PolicyContractError("POLICY_NOT_SERIALIZABLE", `${path} 含循环引用`);
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null && !Array.isArray(value)) {
      throw new PolicyContractError("POLICY_NOT_SERIALIZABLE", `${path} 必须是 plain object 或 array`);
    }

    const nextAncestors = new Set(ancestors);
    nextAncestors.add(value);
    if (Array.isArray(value)) {
      return value.map((item, index) => copySerializable(item, `${path}[${index}]`, nextAncestors));
    }

    const result = {};
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") {
        throw new PolicyContractError("POLICY_NOT_SERIALIZABLE", `${path} 含 symbol key`);
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable) continue;
      if (!Object.hasOwn(descriptor, "value")) {
        throw new PolicyContractError("POLICY_NOT_SERIALIZABLE", `${path}.${key} 不得使用 accessor`);
      }
      if (FORBIDDEN_KEYS.has(normalizeKey(key))) {
        throw new PolicyContractError("POLICY_FORBIDDEN_FIELD", `${path}.${key} 不得进入 Policy context`, {
          path: `${path}.${key}`,
        });
      }
      result[key] = copySerializable(descriptor.value, `${path}.${key}`, nextAncestors);
    }
    return result;
  }

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) deepFreeze(child);
    return Object.freeze(value);
  }

  function requireStableIdentity(value, field) {
    if (typeof value !== "string" || !value.trim()) {
      throw new PolicyContractError("POLICY_INVALID_IDENTITY", `${field} 必须是非空稳定 identity`);
    }
    return value;
  }

  function requireVersion(value, field) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new PolicyContractError("POLICY_INVALID_VERSION", `${field} 必须是非负安全整数`);
    }
    return value;
  }

  function copyLegalAction(action, authority, index) {
    const path = `$.legalActions[${index}]`;
    if (!action || typeof action !== "object") {
      throw new PolicyContractError("POLICY_INVALID_LEGAL_ACTION", `${path} 必须是 descriptor`);
    }
    if (action.schemaVersion !== STANDARD_ACTION_SCHEMA_VERSION) {
      throw new PolicyContractError("POLICY_ACTION_SCHEMA_MISMATCH", `${path} Standard Action schema 不匹配`);
    }
    if (action.actorId !== authority.seatId) {
      throw new PolicyContractError("POLICY_ACTION_ACTOR_MISMATCH", `${path} actor 与 policy seat 不匹配`);
    }
    if (action.stateVersion !== authority.stateVersion || action.decisionVersion !== authority.decisionVersion) {
      throw new PolicyContractError("POLICY_ACTION_STALE", `${path} 版本与 context 不匹配`);
    }
    return copySerializable({
      schemaVersion: action.schemaVersion,
      family: requireStableIdentity(action.family, `${path}.family`),
      phase: requireStableIdentity(action.phase, `${path}.phase`),
      actionId: requireStableIdentity(action.actionId, `${path}.actionId`),
      actorId: action.actorId,
      stateVersion: action.stateVersion,
      decisionVersion: action.decisionVersion,
      target: action.target == null ? null : action.target,
      payload: action.payload == null ? {} : action.payload,
      summary: action.summary == null ? action.family : String(action.summary),
    }, path);
  }

  function createDecisionContext(input = {}) {
    const authority = {
      requestId: requireStableIdentity(input.requestId, "requestId"),
      seatId: requireStableIdentity(input.seatId, "seatId"),
      stateVersion: requireVersion(input.stateVersion, "stateVersion"),
      decisionVersion: requireVersion(input.decisionVersion, "decisionVersion"),
    };
    const legalActions = (input.legalActions || []).map((action, index) => (
      copyLegalAction(action, authority, index)
    ));
    const actionIds = new Set();
    for (const action of legalActions) {
      if (actionIds.has(action.actionId)) {
        throw new PolicyContractError("POLICY_DUPLICATE_LEGAL_ACTION", `重复 legal action: ${action.actionId}`);
      }
      actionIds.add(action.actionId);
    }
    return deepFreeze({
      schemaVersion: CONTEXT_SCHEMA_VERSION,
      ...authority,
      observation: copySerializable(input.observation || {}, "$.observation"),
      legalActions,
      deterministicContext: copySerializable(input.deterministicContext || {}, "$.deterministicContext"),
    });
  }

  function normalizeDiagnostics(input = {}) {
    const diagnostics = copySerializable(input, "$.diagnostics");
    for (const key of Object.keys(diagnostics)) {
      if (!DIAGNOSTIC_KEYS.has(key)) {
        throw new PolicyContractError("POLICY_DIAGNOSTICS_INVALID", `不允许的 diagnostics 字段: ${key}`);
      }
    }
    if (diagnostics.confidence != null && (
      typeof diagnostics.confidence !== "number"
      || diagnostics.confidence < 0
      || diagnostics.confidence > 1
    )) {
      throw new PolicyContractError("POLICY_DIAGNOSTICS_INVALID", "confidence 必须在 [0, 1]");
    }
    if (diagnostics.latencyMs != null && (
      typeof diagnostics.latencyMs !== "number" || diagnostics.latencyMs < 0
    )) {
      throw new PolicyContractError("POLICY_DIAGNOSTICS_INVALID", "latencyMs 必须是非负数");
    }
    for (const key of ["reasonCode", "traceId"]) {
      if (diagnostics[key] != null && (
        typeof diagnostics[key] !== "string" || diagnostics[key].length > 160
      )) {
        throw new PolicyContractError("POLICY_DIAGNOSTICS_INVALID", `${key} 必须是 160 字符内字符串`);
      }
    }
    return diagnostics;
  }

  function createPolicyDecision(context, input = {}) {
    if (context?.schemaVersion !== CONTEXT_SCHEMA_VERSION) {
      throw new PolicyContractError("POLICY_CONTEXT_SCHEMA_MISMATCH", "DecisionContext schema 不匹配");
    }
    const policyType = requireStableIdentity(input.policyType, "policyType");
    const policyVersion = requireStableIdentity(input.policyVersion, "policyVersion");
    const modelChecksum = input.modelChecksum == null ? null : requireStableIdentity(input.modelChecksum, "modelChecksum");
    if (policyType === "learned" && modelChecksum == null) {
      throw new PolicyContractError("POLICY_METADATA_INVALID", "Learned Policy 必须提供 modelChecksum");
    }
    return deepFreeze({
      schemaVersion: DECISION_SCHEMA_VERSION,
      requestId: context.requestId,
      seatId: context.seatId,
      stateVersion: context.stateVersion,
      decisionVersion: context.decisionVersion,
      actionId: requireStableIdentity(input.actionId, "actionId"),
      policy: {
        type: policyType,
        version: policyVersion,
        modelChecksum,
      },
      diagnostics: normalizeDiagnostics(input.diagnostics || {}),
    });
  }

  function validatePolicyDecision(context, decision, options = {}) {
    if (context?.schemaVersion !== CONTEXT_SCHEMA_VERSION) {
      return fail("POLICY_CONTEXT_SCHEMA_MISMATCH", "DecisionContext schema 不匹配");
    }
    if (decision?.schemaVersion !== DECISION_SCHEMA_VERSION) {
      return fail("POLICY_DECISION_SCHEMA_MISMATCH", "PolicyDecision schema 不匹配");
    }
    if (decision.requestId !== context.requestId) {
      return fail("POLICY_REQUEST_MISMATCH", "PolicyDecision 不属于当前请求");
    }
    if (decision.seatId !== context.seatId) {
      return fail("POLICY_SEAT_MISMATCH", "PolicyDecision seat 不匹配");
    }
    if (decision.stateVersion !== context.stateVersion || decision.decisionVersion !== context.decisionVersion) {
      return fail("POLICY_STALE", "PolicyDecision 已过期");
    }
    if (Object.keys(decision).some((key) => !DECISION_KEYS.has(key))) {
      return fail("POLICY_DECISION_FIELD_FORBIDDEN", "PolicyDecision 含 effect、状态补丁或其他未声明字段");
    }
    if (!decision.policy || Object.keys(decision.policy).some((key) => !POLICY_METADATA_KEYS.has(key))) {
      return fail("POLICY_METADATA_INVALID", "PolicyDecision policy metadata 不完整或含未声明字段");
    }
    try {
      requireStableIdentity(decision.policy.type, "policy.type");
      requireStableIdentity(decision.policy.version, "policy.version");
      if (decision.policy.type === "learned") requireStableIdentity(decision.policy.modelChecksum, "policy.modelChecksum");
      else if (decision.policy.modelChecksum != null) requireStableIdentity(decision.policy.modelChecksum, "policy.modelChecksum");
      normalizeDiagnostics(decision.diagnostics || {});
    } catch (error) {
      return fail(
        error.code === "POLICY_DIAGNOSTICS_INVALID" ? error.code : "POLICY_METADATA_INVALID",
        error.message,
      );
    }
    const action = context.legalActions.find((candidate) => candidate.actionId === decision.actionId);
    if (!action) return fail("POLICY_ACTION_NOT_LEGAL", "PolicyDecision 未选择 legal descriptor");
    if (!options.registry?.validate || !options.runtimeContext) {
      return fail("POLICY_VALIDATOR_NOT_CONFIGURED", "Host 必须提供 registry.validate 与 runtimeContext");
    }
    const runtimeValidation = options.registry.validate(options.runtimeContext, action);
    if (!runtimeValidation?.ok) return runtimeValidation;
    return Object.freeze({ ok: true, action, decision, runtimeValidation });
  }

  function createPolicyRequestSession(options = {}) {
    const context = options.context;
    if (context?.schemaVersion !== CONTEXT_SCHEMA_VERSION) {
      throw new PolicyContractError("POLICY_CONTEXT_SCHEMA_MISMATCH", "Policy request 需要 DecisionContext");
    }
    if (typeof options.validateDecision !== "function") {
      throw new TypeError("Policy request 需要 validateDecision(decision, runtimeContext)");
    }
    let status = "pending";
    let settledResult = null;

    function settle(nextStatus, result) {
      if (status !== "pending") {
        return fail(
          status === "responded" ? "POLICY_DUPLICATE_RESPONSE" : "POLICY_LATE_RESPONSE",
          status === "responded" ? "Policy request 已响应" : `Policy request 已 ${status}`,
          { status },
        );
      }
      status = nextStatus;
      settledResult = result;
      if (typeof options.onSettle === "function") options.onSettle(result, status);
      return result;
    }

    return Object.freeze({
      accept(decision, runtimeContext) {
        return settle("responded", options.validateDecision(decision, runtimeContext));
      },
      cancel(reason = "Policy request 已取消") {
        return settle("cancelled", fail("POLICY_CANCELLED", reason));
      },
      expire() {
        return settle("timed_out", fail("POLICY_TIMEOUT", "Policy request 超时"));
      },
      invalidate(reason = "权威版本或恢复代次已变化") {
        return settle("invalidated", fail("POLICY_REQUEST_INVALIDATED", reason));
      },
      reject(error) {
        return settle("failed", fail("POLICY_FAILURE", error?.message || String(error || "Policy 调用失败")));
      },
      snapshot() {
        return Object.freeze({ requestId: context.requestId, status, result: settledResult });
      },
    });
  }

  function runPolicy(policy, context, options = {}) {
    const decide = typeof policy === "function" ? policy : policy?.decide;
    if (typeof decide !== "function") {
      return Promise.resolve(fail("POLICY_NOT_CALLABLE", "Policy 必须是函数或实现 decide(context, request)"));
    }
    const now = typeof options.now === "function" ? options.now : Date.now;
    const setTimer = options.setTimer || setTimeout;
    const clearTimer = options.clearTimer || clearTimeout;
    const deadlineAt = options.deadlineAt == null ? null : Number(options.deadlineAt);

    return new Promise((resolve) => {
      let timer = null;
      let abortHandler = null;
      const session = createPolicyRequestSession({
        context,
        validateDecision(decision, runtimeContext) {
          return validatePolicyDecision(context, decision, {
            registry: options.registry,
            runtimeContext: runtimeContext || options.getRuntimeContext?.(),
          });
        },
        onSettle(result) {
          if (timer != null) clearTimer(timer);
          if (abortHandler && options.signal) options.signal.removeEventListener("abort", abortHandler);
          resolve(result);
        },
      });
      if (typeof options.onSession === "function") options.onSession(session);

      if (options.signal?.aborted) {
        session.cancel("Policy request 在调用前已取消");
        return;
      }
      if (options.signal) {
        abortHandler = () => session.cancel("Policy request 被 AbortSignal 取消");
        options.signal.addEventListener("abort", abortHandler, { once: true });
      }
      if (deadlineAt != null) {
        if (!Number.isFinite(deadlineAt)) {
          session.reject(new TypeError("deadlineAt 必须是有限 epoch milliseconds"));
          return;
        }
        const remaining = deadlineAt - now();
        if (remaining <= 0) {
          session.expire();
          return;
        }
        timer = setTimer(() => session.expire(), remaining);
      }

      try {
        Promise.resolve(decide.call(policy, context, {
          requestId: context.requestId,
          deadlineAt,
          signal: options.signal || null,
        })).then(
          (decision) => session.accept(decision, options.getRuntimeContext?.()),
          (error) => session.reject(error),
        );
      } catch (error) {
        session.reject(error);
      }
    });
  }

  return Object.freeze({
    CONTEXT_SCHEMA_VERSION,
    DECISION_SCHEMA_VERSION,
    STANDARD_ACTION_SCHEMA_VERSION,
    PolicyContractError,
    createDecisionContext,
    createPolicyDecision,
    validatePolicyDecision,
    createPolicyRequestSession,
    runPolicy,
  });
});
