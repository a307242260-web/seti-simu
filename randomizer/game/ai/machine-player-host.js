(function (root, factory) {
  "use strict";

  let policyPort = root.SetiPolicyPort;
  if (!policyPort && typeof require === "function") {
    policyPort = require("./policy-port");
  }
  const api = factory(policyPort);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SetiMachinePlayerHost = api;
})(typeof globalThis !== "undefined" ? globalThis : window, function (policyPort) {
  "use strict";

  const SCHEMA_VERSION = "seti-machine-player-host-v1";
  const SNAPSHOT_SCHEMA_VERSION = "seti-machine-player-host-snapshot-v1";
  const ALLOWED_INITIALIZATION_PHASES = new Set(["new_game", "load"]);

  function clone(value) {
    return value == null ? value : structuredClone(value);
  }

  function freeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    for (const child of Object.values(value)) freeze(child);
    return Object.freeze(value);
  }

  function fail(code, message, details = {}) {
    return freeze({ ok: false, code, message, ...clone(details) });
  }

  function requireIdentityPart(value, field, nullable = false) {
    if (nullable && value == null) return null;
    if (typeof value !== "string" || !value.trim()) {
      const error = new TypeError(`${field} 必须是非空稳定 identity`);
      error.code = "MACHINE_POLICY_IDENTITY_INVALID";
      throw error;
    }
    return value;
  }

  function stableSerialize(value) {
    if (value == null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  }

  function normalizeIdentity(input = {}, fallbackProvenance = null) {
    const provenance = fallbackProvenance || {};
    const policyType = input.policyType ?? input.type ?? provenance.type;
    const policyVersion = input.policyVersion ?? input.version ?? provenance.version;
    const modelChecksum = input.modelChecksum ?? provenance.modelChecksum ?? null;
    const config = clone(input.config ?? provenance.config ?? {});
    const seed = input.seed ?? provenance.seed ?? null;
    return freeze({
      policyType: requireIdentityPart(policyType, "policyType"),
      policyVersion: requireIdentityPart(policyVersion, "policyVersion"),
      modelChecksum: requireIdentityPart(modelChecksum, "modelChecksum", true),
      config,
      configChecksum: input.configChecksum ?? provenance.configChecksum ?? stableSerialize(config),
      seed: seed == null ? null : String(seed),
    });
  }

  function samePolicyIdentity(left, right) {
    return left?.policyType === right?.policyType
      && left?.policyVersion === right?.policyVersion
      && left?.modelChecksum === right?.modelChecksum;
  }

  function decisionKey(generation, seatId, input) {
    return `${generation}:${seatId}:${input.stateVersion}:${input.decisionVersion}:${input.authorityKey || "default"}`;
  }

  function createMachinePlayerHost(options = {}) {
    const adapter = options.adapter;
    if (!adapter || typeof adapter.readDecisionInput !== "function"
      || typeof adapter.validateFresh !== "function" || typeof adapter.submit !== "function") {
      throw new TypeError("Machine Player Host 需要 readDecisionInput/validateFresh/submit adapter");
    }
    const now = typeof options.now === "function" ? options.now : Date.now;
    const defaultDeadlineMs = Math.max(1, Number(options.defaultDeadlineMs || 30000));
    const seats = new Map();
    const activeRequests = new Map();
    const activeByDecision = new Map();
    const submittedDecisions = new Set();
    const diagnostics = [];
    let generation = 0;
    let requestOrdinal = 0;
    let paused = null;

    function record(type, details = {}) {
      const diagnostic = freeze({
        type,
        generation,
        ordinal: diagnostics.length,
        ...clone(details),
      });
      diagnostics.push(diagnostic);
      if (typeof options.onDiagnostic === "function") options.onDiagnostic(diagnostic);
      return diagnostic;
    }

    function pause(result, details = {}) {
      if (!paused) {
        paused = freeze({
          code: result?.code || "MACHINE_POLICY_FAILED",
          message: result?.message || "机器玩家请求失败",
          ...clone(details),
        });
        record("host_paused", paused);
        if (typeof options.onPause === "function") options.onPause(paused);
      }
      return result;
    }

    function inspectCandidate(candidate, seatId) {
      const policy = candidate?.policy;
      const decide = typeof policy === "function" ? policy : policy?.decide;
      if (typeof decide !== "function") {
        const error = new TypeError(`席位 ${seatId} Policy 不可调用`);
        error.code = "MACHINE_POLICY_INITIALIZATION_FAILED";
        throw error;
      }
      const provenance = typeof policy?.getProvenance === "function" ? policy.getProvenance() : null;
      const identity = normalizeIdentity(candidate?.identity || {}, provenance);
      if (identity.policyType === "learned" && identity.modelChecksum == null) {
        const error = new TypeError(`席位 ${seatId} Learned Policy 缺少 modelChecksum`);
        error.code = "MACHINE_POLICY_CHECKSUM_INCOMPATIBLE";
        throw error;
      }
      if (candidate?.requiredContextSchemaVersion
        && candidate.requiredContextSchemaVersion !== policyPort.CONTEXT_SCHEMA_VERSION) {
        const error = new TypeError(`席位 ${seatId} Policy context schema 不兼容`);
        error.code = "MACHINE_POLICY_SCHEMA_INCOMPATIBLE";
        throw error;
      }
      const requiredCapabilities = candidate?.requiredCapabilities || [];
      const capabilities = new Set(candidate?.capabilities || provenance?.capabilities || []);
      const missing = requiredCapabilities.filter((capability) => !capabilities.has(capability));
      if (missing.length) {
        const error = new TypeError(`席位 ${seatId} Policy capability 缺失: ${missing.join(", ")}`);
        error.code = "MACHINE_POLICY_CAPABILITY_INCOMPATIBLE";
        throw error;
      }
      if (provenance && !samePolicyIdentity(identity, normalizeIdentity({
        policyType: provenance.type,
        policyVersion: provenance.version,
        modelChecksum: provenance.modelChecksum ?? null,
        config: identity.config,
        seed: identity.seed,
      }))) {
        const error = new TypeError(`席位 ${seatId} Policy provenance 与声明 identity 不一致`);
        error.code = "MACHINE_POLICY_CHECKSUM_INCOMPATIBLE";
        throw error;
      }
      return { policy, identity };
    }

    function activateSeat(spec, phase) {
      const seatId = requireIdentityPart(spec?.seatId, "seatId");
      const candidates = [spec.primary || spec, ...(spec.fallbacks || [])];
      const declarations = candidates.map((candidate) => ({
        identity: clone(candidate.identity || null),
        requiredContextSchemaVersion: candidate.requiredContextSchemaVersion || null,
        requiredCapabilities: clone(candidate.requiredCapabilities || []),
        capabilities: clone(candidate.capabilities || []),
      }));
      let lastError = null;
      for (let index = 0; index < candidates.length; index += 1) {
        try {
          const active = inspectCandidate(candidates[index], seatId);
          const seat = freeze({
            seatId,
            policy: active.policy,
            identity: active.identity,
            activePolicyIndex: index,
            declarations,
          });
          if (index > 0) {
            record("seat_policy_switched", {
              phase,
              seatId,
              from: clone(candidates[0]?.identity || null),
              to: clone(active.identity),
              reason: lastError?.message || "primary Policy 初始化失败",
            });
          } else {
            record("seat_policy_initialized", { phase, seatId, identity: clone(active.identity) });
          }
          return seat;
        } catch (error) {
          lastError = error;
          record("seat_policy_initialization_failed", {
            phase,
            seatId,
            policyIndex: index,
            code: error?.code || "MACHINE_POLICY_INITIALIZATION_FAILED",
            message: error?.message || String(error),
          });
        }
      }
      const error = new Error(lastError?.message || `席位 ${seatId} 没有可用的声明 Policy`);
      error.code = lastError?.code || "MACHINE_POLICY_INITIALIZATION_FAILED";
      throw error;
    }

    function invalidateRequests(reason) {
      generation += 1;
      for (const active of activeRequests.values()) active.session?.invalidate(reason);
      activeRequests.clear();
      activeByDecision.clear();
    }

    function initializeSeats(specs = [], initOptions = {}) {
      const phase = initOptions.phase || "new_game";
      if (!ALLOWED_INITIALIZATION_PHASES.has(phase)) {
        throw new TypeError("Machine Player Host 只允许在 new_game/load 阶段初始化席位");
      }
      const nextSeats = new Map();
      for (const spec of specs) {
        const seat = activateSeat(spec, phase);
        if (nextSeats.has(seat.seatId)) throw new TypeError(`重复机器席位: ${seat.seatId}`);
        nextSeats.set(seat.seatId, seat);
      }
      invalidateRequests(`机器席位在 ${phase} 阶段重新初始化`);
      seats.clear();
      for (const [seatId, seat] of nextSeats) seats.set(seatId, seat);
      submittedDecisions.clear();
      paused = null;
      return inspect();
    }

    function validateDecisionIdentity(seat, decision) {
      const actual = {
        policyType: decision?.policy?.type,
        policyVersion: decision?.policy?.version,
        modelChecksum: decision?.policy?.modelChecksum ?? null,
      };
      if (!samePolicyIdentity(seat.identity, actual)) {
        return fail("MACHINE_POLICY_IDENTITY_DRIFT", "Policy 响应 identity 与固定席位不一致", {
          expectedIdentity: clone(seat.identity),
          actualIdentity: actual,
        });
      }
      return freeze({ ok: true });
    }

    function requestDecision(seatId, requestOptions = {}) {
      if (paused) return Promise.resolve(fail("MACHINE_PLAYER_HOST_PAUSED", "Machine Player Host 已暂停", { reason: paused }));
      const seat = seats.get(seatId);
      if (!seat) return Promise.resolve(fail("MACHINE_PLAYER_SEAT_UNKNOWN", `未注册机器席位: ${seatId}`));
      let input;
      try {
        input = adapter.readDecisionInput(seatId);
      } catch (error) {
        return Promise.resolve(pause(fail(
          error?.code || "MACHINE_POLICY_CONTEXT_FAILED",
          error?.message || "读取机器玩家决策输入失败",
        ), { seatId }));
      }
      if (!input || input.ok === false) {
        const result = input?.ok === false ? input : fail("MACHINE_POLICY_CONTEXT_FAILED", "决策输入为空");
        return Promise.resolve(pause(result, { seatId }));
      }
      if (input.seatId !== seatId) {
        return Promise.resolve(pause(fail("MACHINE_POLICY_OWNER_MISMATCH", "决策输入 owner 与固定席位不一致", {
          expectedSeatId: seatId,
          actualSeatId: input.seatId,
        }), { seatId }));
      }
      const key = decisionKey(generation, seatId, input);
      if (submittedDecisions.has(key)) {
        return Promise.resolve(fail("MACHINE_POLICY_DUPLICATE_SUBMISSION", "同一 decision version 已成功提交", { seatId }));
      }
      if (activeByDecision.has(key)) return activeByDecision.get(key);

      const ownGeneration = generation;
      const ordinal = requestOrdinal;
      requestOrdinal += 1;
      let context;
      try {
        context = policyPort.createDecisionContext({
          requestId: `${options.requestPrefix || "machine-policy"}:${ownGeneration}:${seatId}:${input.stateVersion}:${input.decisionVersion}:${ordinal}`,
          seatId,
          stateVersion: input.stateVersion,
          decisionVersion: input.decisionVersion,
          observation: input.observation,
          legalActions: input.legalActions,
          actionOutcomes: input.actionOutcomes || [],
          deterministicContext: {
            ...(input.deterministicContext || {}),
            machineHostSchemaVersion: SCHEMA_VERSION,
            generation: ownGeneration,
            requestOrdinal: ordinal,
            policyIdentity: clone(seat.identity),
          },
        });
      } catch (error) {
        return Promise.resolve(pause(fail(
          error?.code || "MACHINE_POLICY_CONTEXT_FAILED",
          error?.message || "创建 DecisionContext 失败",
        ), { seatId }));
      }
      const deadlineAt = requestOptions.deadlineAt == null
        ? now() + Math.max(1, Number(requestOptions.deadlineMs || defaultDeadlineMs))
        : Number(requestOptions.deadlineAt);
      const active = { session: null, key, seatId, generation: ownGeneration, context };
      activeRequests.set(context.requestId, active);

      const promise = policyPort.runPolicy(seat.policy, context, {
        deadlineAt,
        signal: requestOptions.signal,
        now,
        setTimer: options.setTimer,
        clearTimer: options.clearTimer,
        onSession(session) { active.session = session; },
        registry: {
          validate(_runtimeContext, action) {
            if (ownGeneration !== generation) {
              return fail("MACHINE_POLICY_REQUEST_INVALIDATED", "Policy request 属于旧恢复代次");
            }
            return adapter.validateFresh(input, action, { seatId, generation: ownGeneration, context });
          },
        },
        getRuntimeContext: () => ({ seatId, generation: ownGeneration }),
      }).then((validated) => {
        activeRequests.delete(context.requestId);
        activeByDecision.delete(key);
        if (!validated?.ok) {
          if (ownGeneration !== generation
            && ["POLICY_REQUEST_INVALIDATED", "MACHINE_POLICY_REQUEST_INVALIDATED"].includes(validated.code)) {
            return fail("MACHINE_POLICY_REQUEST_INVALIDATED", "Policy response 属于旧恢复代次", {
              seatId,
              requestId: context.requestId,
            });
          }
          return pause(validated, {
            seatId,
            requestId: context.requestId,
            stateVersion: input.stateVersion,
            decisionVersion: input.decisionVersion,
          });
        }
        const identityValidation = validateDecisionIdentity(seat, validated.decision);
        if (!identityValidation.ok) return pause(identityValidation, { seatId, requestId: context.requestId });
        if (ownGeneration !== generation) {
          return pause(fail("MACHINE_POLICY_REQUEST_INVALIDATED", "Policy response 属于旧恢复代次"), {
            seatId,
            requestId: context.requestId,
          });
        }
        const fresh = adapter.validateFresh(input, validated.action, {
          seatId,
          generation: ownGeneration,
          context,
        });
        if (!fresh?.ok) return pause(fresh, { seatId, requestId: context.requestId });
        let submission;
        try {
          submission = adapter.submit(fresh.action || validated.action, input, {
            seatId,
            context,
            policyDecision: validated.decision,
            fresh,
          });
        } catch (error) {
          submission = fail(error?.code || "MACHINE_POLICY_SUBMISSION_FAILED", error?.message || "机器玩家提交失败");
        }
        if (!submission || submission.ok === false) {
          const result = submission?.ok === false
            ? submission
            : fail("MACHINE_POLICY_SUBMISSION_FAILED", "机器玩家提交未返回成功结果");
          return pause(result, { seatId, requestId: context.requestId });
        }
        submittedDecisions.add(key);
        const result = freeze({
          ok: true,
          seatId,
          requestId: context.requestId,
          actionId: validated.action.actionId,
          policyIdentity: clone(seat.identity),
          policyDecision: clone(validated.decision),
          submission: clone(submission),
        });
        record("decision_submitted", {
          seatId,
          requestId: context.requestId,
          actionId: validated.action.actionId,
          stateVersion: input.stateVersion,
          decisionVersion: input.decisionVersion,
          policyIdentity: clone(seat.identity),
        });
        return result;
      });
      activeByDecision.set(key, promise);
      return promise;
    }

    function requestDecisionSync(seatId, requestOptions = {}) {
      if (paused) return fail("MACHINE_PLAYER_HOST_PAUSED", "Machine Player Host 已暂停", { reason: paused });
      const seat = seats.get(seatId);
      if (!seat) return fail("MACHINE_PLAYER_SEAT_UNKNOWN", `未注册机器席位: ${seatId}`);
      let input;
      try {
        input = adapter.readDecisionInput(seatId);
      } catch (error) {
        return pause(fail(error?.code || "MACHINE_POLICY_CONTEXT_FAILED", error?.message || "读取机器玩家决策输入失败"), { seatId });
      }
      if (!input || input.ok === false) {
        return pause(input?.ok === false ? input : fail("MACHINE_POLICY_CONTEXT_FAILED", "决策输入为空"), { seatId });
      }
      if (input.seatId !== seatId) {
        return pause(fail("MACHINE_POLICY_OWNER_MISMATCH", "决策输入 owner 与固定席位不一致"), { seatId });
      }
      const key = decisionKey(generation, seatId, input);
      if (submittedDecisions.has(key)) {
        return fail("MACHINE_POLICY_DUPLICATE_SUBMISSION", "同一 decision version 已成功提交", { seatId });
      }
      const ownGeneration = generation;
      const ordinal = requestOrdinal;
      requestOrdinal += 1;
      let context;
      try {
        context = policyPort.createDecisionContext({
          requestId: `${options.requestPrefix || "machine-policy"}:${ownGeneration}:${seatId}:${input.stateVersion}:${input.decisionVersion}:${ordinal}`,
          seatId,
          stateVersion: input.stateVersion,
          decisionVersion: input.decisionVersion,
          observation: input.observation,
          legalActions: input.legalActions,
          actionOutcomes: input.actionOutcomes || [],
          deterministicContext: {
            ...(input.deterministicContext || {}),
            machineHostSchemaVersion: SCHEMA_VERSION,
            generation: ownGeneration,
            requestOrdinal: ordinal,
            policyIdentity: clone(seat.identity),
          },
        });
      } catch (error) {
        return pause(fail(error?.code || "MACHINE_POLICY_CONTEXT_FAILED", error?.message || "创建 DecisionContext 失败"), { seatId });
      }
      const deadlineAt = requestOptions.deadlineAt == null
        ? now() + Math.max(1, Number(requestOptions.deadlineMs || defaultDeadlineMs))
        : Number(requestOptions.deadlineAt);
      if (!Number.isFinite(deadlineAt) || deadlineAt <= now()) {
        return pause(fail("POLICY_TIMEOUT", "Policy request 超时"), { seatId, requestId: context.requestId });
      }
      let decision;
      try {
        const decide = typeof seat.policy === "function" ? seat.policy : seat.policy.decide;
        decision = decide.call(seat.policy, context, {
          requestId: context.requestId,
          deadlineAt,
          signal: requestOptions.signal || null,
        });
        if (decision && typeof decision.then === "function") {
          return pause(fail("MACHINE_POLICY_ASYNC_REQUIRED", "同步 Host adapter 不接受异步 Policy"), {
            seatId,
            requestId: context.requestId,
          });
        }
      } catch (error) {
        return pause(fail("POLICY_FAILURE", error?.message || String(error)), { seatId, requestId: context.requestId });
      }
      if (requestOptions.signal?.aborted) {
        return pause(fail("POLICY_CANCELLED", "Policy request 被 AbortSignal 取消"), { seatId, requestId: context.requestId });
      }
      if (deadlineAt <= now()) {
        return pause(fail("POLICY_TIMEOUT", "Policy request 超时"), { seatId, requestId: context.requestId });
      }
      const validated = policyPort.validatePolicyDecision(context, decision, {
        registry: {
          validate(_runtimeContext, action) {
            if (ownGeneration !== generation) {
              return fail("MACHINE_POLICY_REQUEST_INVALIDATED", "Policy request 属于旧恢复代次");
            }
            return adapter.validateFresh(input, action, { seatId, generation: ownGeneration, context });
          },
        },
        runtimeContext: { seatId, generation: ownGeneration },
      });
      if (!validated?.ok) return pause(validated, { seatId, requestId: context.requestId });
      const identityValidation = validateDecisionIdentity(seat, validated.decision);
      if (!identityValidation.ok) return pause(identityValidation, { seatId, requestId: context.requestId });
      const fresh = adapter.validateFresh(input, validated.action, { seatId, generation: ownGeneration, context });
      if (!fresh?.ok) return pause(fresh, { seatId, requestId: context.requestId });
      let submission;
      try {
        submission = adapter.submit(fresh.action || validated.action, input, {
          seatId,
          context,
          policyDecision: validated.decision,
          fresh,
        });
      } catch (error) {
        submission = fail(error?.code || "MACHINE_POLICY_SUBMISSION_FAILED", error?.message || "机器玩家提交失败");
      }
      if (!submission || submission.ok === false) {
        return pause(submission?.ok === false
          ? submission
          : fail("MACHINE_POLICY_SUBMISSION_FAILED", "机器玩家提交未返回成功结果"), {
          seatId,
          requestId: context.requestId,
        });
      }
      submittedDecisions.add(key);
      const result = freeze({
        ok: true,
        seatId,
        requestId: context.requestId,
        actionId: validated.action.actionId,
        action: clone(validated.action),
        policyIdentity: clone(seat.identity),
        policyDecision: clone(validated.decision),
        submission: clone(submission),
      });
      record("decision_submitted", {
        seatId,
        requestId: context.requestId,
        actionId: validated.action.actionId,
        stateVersion: input.stateVersion,
        decisionVersion: input.decisionVersion,
        policyIdentity: clone(seat.identity),
      });
      return result;
    }

    function cancelSeat(seatId, reason = "机器玩家请求被取消") {
      const active = [...activeRequests.values()].find((request) => request.seatId === seatId);
      if (!active) return fail("MACHINE_POLICY_REQUEST_NOT_ACTIVE", `席位 ${seatId} 没有在途请求`);
      const result = active.session?.cancel(reason) || fail("MACHINE_POLICY_CANCELLED", reason);
      return pause(result, { seatId, requestId: active.context.requestId });
    }

    function createSnapshot() {
      return freeze({
        schemaVersion: SNAPSHOT_SCHEMA_VERSION,
        requestOrdinal,
        seats: [...seats.values()].map((seat) => ({
          seatId: seat.seatId,
          identity: clone(seat.identity),
          activePolicyIndex: seat.activePolicyIndex,
          declarations: clone(seat.declarations),
        })),
        diagnostics: clone(diagnostics),
      });
    }

    function restore(snapshot, restoreOptions = {}) {
      if (snapshot?.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) {
        throw new TypeError(`不支持的 Machine Player Host snapshot: ${snapshot?.schemaVersion || "missing"}`);
      }
      if (typeof restoreOptions.resolvePolicy !== "function") {
        throw new TypeError("恢复 Machine Player Host 需要 resolvePolicy(identity, seatId)");
      }
      const specs = snapshot.seats.map((saved) => {
        const ordered = [saved.identity, ...(saved.declarations || [])
          .map((declaration) => declaration.identity)
          .filter(Boolean)
          .filter((identity) => !samePolicyIdentity(identity, saved.identity))];
        return {
          seatId: saved.seatId,
          primary: {
            identity: ordered[0],
            policy: restoreOptions.resolvePolicy(ordered[0], saved.seatId),
          },
          fallbacks: ordered.slice(1).map((identity) => ({
            identity,
            policy: restoreOptions.resolvePolicy(identity, saved.seatId),
          })),
        };
      });
      const result = initializeSeats(specs, { phase: "load" });
      requestOrdinal = Math.max(requestOrdinal, Number(snapshot.requestOrdinal || 0));
      return result;
    }

    function inspect() {
      return freeze({
        schemaVersion: SCHEMA_VERSION,
        generation,
        requestOrdinal,
        paused: clone(paused),
        seats: [...seats.values()].map((seat) => ({
          seatId: seat.seatId,
          identity: clone(seat.identity),
          activePolicyIndex: seat.activePolicyIndex,
        })),
        activeRequests: [...activeRequests.values()].map((active) => active.context.requestId),
        submittedDecisionCount: submittedDecisions.size,
        diagnostics: clone(diagnostics),
      });
    }

    return Object.freeze({
      initializeSeats,
      requestDecision,
      requestDecisionSync,
      cancelSeat,
      createSnapshot,
      restore,
      inspect,
      invalidate(reason = "Machine Player Host generation 已失效") {
        invalidateRequests(reason);
        return generation;
      },
    });
  }

  return Object.freeze({
    SCHEMA_VERSION,
    SNAPSHOT_SCHEMA_VERSION,
    createMachinePlayerHost,
    normalizeIdentity,
    samePolicyIdentity,
  });
});
