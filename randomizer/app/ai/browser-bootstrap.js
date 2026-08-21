(function (root, factory) {
  "use strict";
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    if (typeof module === "undefined") root.SetiAppAiBrowserBootstrap = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";
  const REQUIRED_CONTEXT_KEYS = Object.freeze([
    "ruleComposition",
    "machinePlayerCoordinatorModule",
    "heuristicDecisionFunctionModule",
    "inputAdapter",
    "isMachineSeat",
  ]);

  function fail(code, message, details = {}) {
    return Object.freeze({ ok: false, code, message, ...structuredClone(details) });
  }

  /**
   * Browser 机器席位端口：与 Simulation 共用同一协调器
   * （machine-player-coordinator.js）+ Heuristic 决策函数
   * （heuristic-decision-function.js），唯一差异是 recordStep 记账钩子——
   * sim 训练补记 replay/reward，browser 为空操作。
   *
   * 端口只保留 Browser 宿主所需的薄壳：
   * - currentSeatId / isMachineSeat 席位判定与 fail-closed 结果；
   * - 决策前稳定化（lifecycle.save，与旧 readBoundary 一致）；
   * - 同 decision version 去重（对应旧 Host submittedDecisions）；
   * - lifecycle 失效时 resetPlans（清计划 store，决策函数注册表保留）；
   * - 协调器抛错一律转成显式 fail 结果（非静默，app 会记录）。
   *
   * 内联反事实搜索拷贝已删除：读边界、计划复用、决策函数调用、execute 提交
   * 全部走协调器一份实现（观察 createDecisionObservation(projection.state)，
   * 与 Simulation 完全同源）。见 docs/ai-design.md §1。
   */
  function createBrowserMachinePlayerPort(options = {}) {
    const {
      ruleComposition,
      machinePlayerCoordinatorModule,
      heuristicDecisionFunctionModule,
      inputAdapter,
      isMachineSeat,
      machineConfig,
    } = options;
    if (!ruleComposition?.inspect || !ruleComposition?.inputPort?.enumerateActions
      || typeof ruleComposition?.projection !== "function"
      || !machinePlayerCoordinatorModule?.createMachinePlayerCoordinator
      || !heuristicDecisionFunctionModule?.createHeuristicDecisionFunction
      || !inputAdapter?.dispatchAction || !inputAdapter?.submitDecision
      || typeof isMachineSeat !== "function") {
      throw new TypeError("Browser Machine Player port 缺少 composition/coordinator/decision/input/seat ports");
    }
    const config = machineConfig || {};

    let generation = 0;
    let lastResult = null;
    let lastOutcomeSummary = null;
    let lastDiagnostics = null;
    let coordinator = null;
    let decisionFunction = null;
    let submittedCount = 0; // 成功提交计数（含方案/复用路径），供 inspect 与 smoke 断言
    let lastSubmittedKey = null; // 去重：seatId:stateVersion:decisionVersion:kind:decisionId

    function currentSeatId() {
      const inspection = ruleComposition.inspect();
      const source = ruleComposition.projectionSource?.read?.() || null;
      return (inspection.phase === "awaiting_input"
        ? inspection.session?.decision?.ownerId ?? source?.decision?.ownerId
        : null)
        ?? source?.state?.match?.currentPlayerId
        ?? null;
    }

    // 一份 Heuristic 决策函数（与 Simulation 同一份实现、同一 config 源）：
    // completeTargetCatalog / traceCounterfactualGoalClusters /
    // vStateValueEnabled 等开关与 sim 完全一致地透传（搜索机制统一，无分桶开关）。
    function ensureDecisionFunction() {
      if (!decisionFunction) {
        decisionFunction = heuristicDecisionFunctionModule.createHeuristicDecisionFunction({
          composition: ruleComposition,
          difficulty: config.difficulty,
          evaluationParameters: config.vStateValueEnabled === true
            ? { vStateValueEnabled: true }
            : undefined,
          config: {
            completeTargetCatalog: config.completeTargetCatalog === true,
            traceCounterfactualGoalClusters: config.traceCounterfactualGoalClusters === true,
          },
        });
      }
      return decisionFunction;
    }

    // 协调器 execute：与玩家共用正式 Action/Decision 输入端口（零转换）；
    // 失败直接抛错，由 runOnce 转成显式 fail 结果。
    function submitMachineAction(action) {
      const inspection = ruleComposition.inspect();
      const result = inspection.phase === "awaiting_input"
        ? inputAdapter.submitDecision({
          decisionId: inspection.session.decision.decisionId,
          decisionVersion: inspection.session.decision.decisionVersion,
          ownerId: inspection.session.decision.ownerId,
          choice: action,
        })
        : inputAdapter.dispatchAction(action);
      if (result?.ok === false) {
        const error = new Error(result.message || result.code || "规则提交失败");
        error.code = result.code || "MACHINE_PLAYER_EXECUTE_FAILED";
        throw error;
      }
      return { ok: true, actionId: action.actionId, submitResult: result };
    }

    function ensureCoordinator() {
      if (!coordinator) {
        coordinator = machinePlayerCoordinatorModule.createMachinePlayerCoordinator({
          composition: ruleComposition,
          execute: submitMachineAction,
          // Browser 不训练：recordStep 空操作（sim 训练补记 replay/reward）。
          recordStep: () => {},
          onDiagnostic: (type, details) => {
            if (type === "plan-reuse-hit" || type === "plan-reuse-miss") {
              lastDiagnostics = lastDiagnostics || { planContinuationHitCount: 0, planContinuationMissCount: 0 };
              if (type === "plan-reuse-hit") lastDiagnostics.planContinuationHitCount += 1;
              else lastDiagnostics.planContinuationMissCount += 1;
            }
          },
        });
      }
      return coordinator;
    }

    function buildOutcomeSummary(result) {
      const actions = result.decision?.actionOutcomes || [];
      return Object.freeze({
        seatId: result.seatId,
        actions: Object.freeze(actions.map((outcome) => ({
          actionId: outcome.actionId,
          family: outcome.family || null,
          outcome: {
            status: outcome.status || "missing",
            code: outcome.code || null,
            leaves: outcome.leaves?.length || 0,
          },
        }))),
        timing: ruleComposition.counterfactualPort?.getDiagnostics?.() || null,
      });
    }

    async function runOnce(runOptions = {}) {
      const seatId = currentSeatId();
      if (!seatId) {
        lastResult = fail("BROWSER_MACHINE_SEAT_MISSING", "当前 Rule Composition boundary 没有决策 owner");
        return lastResult;
      }
      if (!isMachineSeat(seatId)) {
        lastResult = fail("BROWSER_MACHINE_SEAT_NOT_CONTROLLED", `席位 ${seatId} 不是机器席位`, { seatId });
        return lastResult;
      }
      const ownGeneration = generation;
      try {
        // 稳定化：把进行中的 session 工作态提交后再读边界（与旧 readBoundary 一致）。
        const stabilized = ruleComposition.lifecycle?.save?.();
        if (stabilized?.ok === false) {
          const error = new Error(stabilized.message || "Rule Composition authority 稳定化失败");
          error.code = stabilized.code || "RULE_COMPOSITION_STABILIZE_FAILED";
          throw error;
        }
        const activeCoordinator = ensureCoordinator();
        const activeDecision = ensureDecisionFunction();
        const probeBoundary = activeCoordinator.readBoundary(seatId);
        if (!activeCoordinator.hasSeat(probeBoundary.seatId)) {
          activeCoordinator.registerSeat(probeBoundary.seatId, activeDecision.run);
        }
        // 去重键对齐旧 Host 语义（authorityKey = kind:decisionId）：setup 内
        // 同一席位连续多个 choice 的 stateVersion/decisionVersion 相同，必须靠
        // decisionId 区分，否则第二个 choice 会被误判为重复提交。
        const boundaryKind = probeBoundary.phase === "awaiting_input" ? "decision" : "action";
        const decisionId = probeBoundary.sessionDecision?.decisionId
          || probeBoundary.legalActions[0]?.decisionId
          || "";
        const dedupeKey = `${probeBoundary.seatId}:`
          + `${probeBoundary.legalActions[0]?.stateVersion}:`
          + `${probeBoundary.legalActions[0]?.decisionVersion}:`
          + `${boundaryKind}:${decisionId}`;
        if (lastSubmittedKey === dedupeKey) {
          lastResult = fail("MACHINE_POLICY_DUPLICATE_SUBMISSION", "同一 decision version 已成功提交", { seatId });
          return lastResult;
        }
        const result = activeCoordinator.runDecision(probeBoundary.seatId, {
          reuseEnabled: config.planContinuationReuse !== false,
        });
        lastSubmittedKey = dedupeKey;
        submittedCount += 1;
        lastOutcomeSummary = buildOutcomeSummary(result);
        const successResult = Object.freeze({
          ok: true,
          seatId: result.seatId,
          actionId: result.actionId,
          source: result.source,
          plan: result.plan || null,
          ...(result.decision
            ? {
              policyDecision: result.decision.decision,
              actionOutcomes: result.decision.actionOutcomes || [],
            }
            : {
              policyDecision: {
                schemaVersion: "seti-policy-decision-v1",
                requestId: `plan-reuse:${result.seatId}:${probeBoundary.legalActions[0]?.stateVersion || "?"}:${probeBoundary.legalActions[0]?.decisionVersion || "?"}`,
                seatId: result.seatId,
                stateVersion: probeBoundary.legalActions[0]?.stateVersion ?? null,
                decisionVersion: probeBoundary.legalActions[0]?.decisionVersion ?? null,
                actionId: result.actionId,
                policy: {
                  type: "heuristic",
                  version: decisionFunction?.getProvenance?.()?.version || null,
                  modelChecksum: null,
                },
                planContinuationFastPath: true,
                diagnostics: { reasonCode: "plan-continuation-fast-path" },
              },
              actionOutcomes: [],
            }),
        });
        lastResult = ownGeneration === generation
          ? successResult
          : fail("MACHINE_POLICY_REQUEST_INVALIDATED", "Browser Machine Player generation 已变化", { seatId });
        return lastResult;
      } catch (error) {
        // fail-closed：协调器/提交错误显式转成 fail 结果（不静默，app 会记录）。
        lastResult = ownGeneration === generation
          ? fail(error?.code || "MACHINE_PLAYER_FAILED", error?.message || String(error), { seatId })
          : fail("MACHINE_POLICY_REQUEST_INVALIDATED", "Browser Machine Player generation 已变化", { seatId });
        return lastResult;
      }
    }

    function invalidate(reason = "Browser Rule Composition lifecycle 已变化") {
      generation += 1;
      coordinator = null;
      decisionFunction = null;
      lastResult = null;
      lastSubmittedKey = null;
      lastOutcomeSummary = null;
      lastDiagnostics = null;
      submittedCount = 0;
      return Object.freeze({ ok: true, generation });
    }

    function inspect() {
      return Object.freeze({
        generation,
        seatId: currentSeatId(),
        submittedCount,
        diagnostics: lastDiagnostics ? structuredClone(lastDiagnostics) : null,
        lastOutcomeSummary: structuredClone(lastOutcomeSummary),
        lastResult: structuredClone(lastResult),
      });
    }

    return Object.freeze({ runOnce, invalidate, inspect });
  }

  function createBrowserAiBootstrap(context = {}) {
    const missingKeys = REQUIRED_CONTEXT_KEYS.filter(
      (key) => !Object.prototype.hasOwnProperty.call(context, key) || context[key] == null,
    );
    if (missingKeys.length) {
      throw new Error(`Browser AI bootstrap 缺少依赖：${missingKeys.join(", ")}`);
    }

    const {
      ruleComposition,
      machinePlayerCoordinatorModule,
      heuristicDecisionFunctionModule,
      inputAdapter,
      isMachineSeat,
      machineConfig,
    } = context;
    const machinePlayerPort = createBrowserMachinePlayerPort({
      ruleComposition,
      machinePlayerCoordinatorModule,
      heuristicDecisionFunctionModule,
      inputAdapter,
      isMachineSeat,
      machineConfig,
    });
    ruleComposition.subscribe((event) => {
      if (event?.source === "lifecycle") {
        machinePlayerPort.invalidate(`Rule Composition lifecycle: ${event.event?.type || "unknown"}`);
      }
    });

    return Object.freeze({ machinePlayerPort });
  }

  return {
    REQUIRED_CONTEXT_KEYS,
    createBrowserMachinePlayerPort,
    createBrowserAiBootstrap,
  };
});
