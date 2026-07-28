(function (root, factory) {
  "use strict";
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root) {
    root.SetiAppAiBrowserBootstrap = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";
  const REQUIRED_CONTEXT_KEYS = Object.freeze([
    "ruleComposition",
    "outcomeModel",
    "expectedScoreEvaluator",
    "policyInputAdapterModule",
    "projectionAdapter",
    "inputAdapter",
    "createPolicy",
    "projectionSource",
    "isMachineSeat",
  ]);

  function fail(code, message, details = {}) {
    return Object.freeze({ ok: false, code, message, ...structuredClone(details) });
  }

  function createCompositionPolicyBoundaryReader(options = {}) {
    const composition = options.ruleComposition;
    const projectionSource = options.projectionSource;
    if (!composition?.inspect || !projectionSource?.read
      || !composition?.inputPort?.enumerateActions) {
      throw new TypeError("Browser Machine Player boundary reader 需要 Rule Composition inspect/input 与 Browser projection ports");
    }
    return function readBoundary(seatId) {
      const stabilized = composition.lifecycle?.save?.();
      if (stabilized?.ok === false) {
        const error = new Error(stabilized.message || "Rule Composition authority 稳定化失败");
        error.code = stabilized.code || "RULE_COMPOSITION_STABILIZE_FAILED";
        throw error;
      }
      const inspection = composition.inspect();
      const source = projectionSource.read({
        viewerId: `machine:${seatId}`,
        playerId: seatId,
        role: "player",
      });
      const decision = inspection.session?.decision || source.decision || null;
      if (inspection.phase === "awaiting_input" && decision) {
        const legalActions = (decision.choices || []).filter(Boolean);
        return {
          kind: "decision",
          actorId: decision.ownerId,
          stateVersion: legalActions[0]?.stateVersion ?? source.source.stateVersion,
          decisionVersion: legalActions[0]?.decisionVersion ?? 0,
          ...(decision.decisionVersion === (legalActions[0]?.decisionVersion ?? 0)
            ? {}
            : { submissionDecisionVersion: decision.decisionVersion }),
          decisionId: decision.decisionId,
          legalActions,
        };
      }
      const actorId = source.state?.match?.currentPlayerId ?? null;
      if (source.state?.match?.terminal) {
        return { kind: "terminal", terminal: { phase: "completed" } };
      }
      const legalActions = composition.inputPort.enumerateActions({ actorId });
      return {
        kind: "action",
        actorId,
        stateVersion: legalActions[0]?.stateVersion ?? source.source.stateVersion,
        decisionVersion: legalActions[0]?.decisionVersion
          ?? Math.max(0, Number(source.state?.match?.decisionVersion) || 0),
        legalActions,
      };
    };
  }

  function createBrowserMachinePlayerPort(options = {}) {
    const {
      ruleComposition,
      outcomeModel,
      expectedScoreEvaluator,
      projectionSource,
      policyInputAdapterModule,
      projectionAdapter,
      inputAdapter,
      createPolicy,
      isMachineSeat,
    } = options;
    if (!policyInputAdapterModule?.createPolicyInputAdapter
      || !projectionAdapter?.projectSource
      || !outcomeModel?.createDecisionObservation
      || typeof expectedScoreEvaluator?.evaluateStrategicFactsPriority !== "function"
      || !inputAdapter?.dispatchAction
      || !inputAdapter?.submitDecision
      || typeof createPolicy !== "function"
      || typeof isMachineSeat !== "function") {
      throw new TypeError("Browser Machine Player port 缺少 policy/projection/input/seat ports");
    }
    const readBoundary = createCompositionPolicyBoundaryReader({ ruleComposition, projectionSource });
    const drivers = new Map();
    let generation = 0;
    let lastResult = null;
    let lastOutcomeSummary = null;

    function currentSeatId() {
      const inspection = ruleComposition.inspect();
      const source = projectionSource.read();
      return (inspection.phase === "awaiting_input"
        ? inspection.session?.decision?.ownerId ?? source.decision?.ownerId
        : null)
        ?? source.state?.match?.currentPlayerId
        ?? null;
    }

    function getDriver(seatId) {
      if (!drivers.has(seatId)) {
        drivers.set(seatId, policyInputAdapterModule.createPolicyInputAdapter({
          policy: createPolicy(seatId),
          readBoundary: () => readBoundary(seatId),
          readObservation: () => {
            const boundary = readBoundary(seatId);
            const projected = projectionAdapter.projectSource({
              viewer: { viewerId: `machine:${seatId}`, playerId: seatId, role: "player" },
            });
            return outcomeModel.createDecisionObservation(projected, {
              seatId,
              stateVersion: boundary.stateVersion,
              decisionVersion: boundary.decisionVersion,
            });
          },
          readActionOutcomes: (boundary) => {
            const setupBoundary = boundary.legalActions.every((action) => (
              ["choose_card", "choose_payment"].includes(action.family)
              && ["select_initial_card", "confirm_initial_setup", "discard-hand-cards"]
                .includes(action.target?.kind)
            ));
            if (setupBoundary) return [];
            let rootStrategicFacts = null;
            const getBranchPriority = ({ rootObservation, branchObservation }) => {
              rootStrategicFacts = rootStrategicFacts
                || outcomeModel.createStrategicFacts(rootObservation, seatId);
              return expectedScoreEvaluator.evaluateStrategicFactsPriority(
                rootStrategicFacts,
                outcomeModel.createStrategicFacts(branchObservation, seatId),
              );
            };
            const evaluatedActions = boundary.legalActions
              .filter(expectedScoreEvaluator.requiresCounterfactualOutcome);
            const evaluatedOutcomes = outcomeModel.projectOutcomeObservations(
              ruleComposition.counterfactualPort.evaluate(evaluatedActions, {
                viewer: { viewerId: `machine:${seatId}`, playerId: seatId, role: "player" },
                confidence: "low",
                maxDepth: 8,
                maxLeaves: 8,
                maxFrontierPerRoot: 8,
                getBranchPriority,
              }),
              {
                seatId,
                stateVersion: boundary.stateVersion,
                decisionVersion: boundary.decisionVersion,
              },
            );
            const byActionId = new Map(evaluatedOutcomes.map((outcome) => [
              outcome.actionId,
              outcome,
            ]));
            const rootObservation = evaluatedOutcomes[0]?.rootObservation
              || outcomeModel.createDecisionObservation(
                projectionAdapter.projectSource({
                  viewer: { viewerId: `machine:${seatId}`, playerId: seatId, role: "player" },
                }),
                {
                  seatId,
                  stateVersion: boundary.stateVersion,
                  decisionVersion: boundary.decisionVersion,
                },
              );
            const outcomes = boundary.legalActions.map((action) => (
              byActionId.get(action.actionId) || {
                schemaVersion: outcomeModel.OUTCOME_SCHEMA_VERSION,
                actionId: action.actionId,
                status: "unresolved",
                confidence: "none",
                code: "STRATEGIC_GOAL_NOT_EVALUATED",
                reasonCodes: ["strategic-goal-not-evaluated"],
                rootObservation,
                leaves: [],
              }
            ));
            lastOutcomeSummary = Object.freeze({
              seatId,
              actions: Object.freeze(boundary.legalActions.map((action) => ({
                actionId: action.actionId,
                family: action.family,
                outcome: (() => {
                  const outcome = outcomes.find((candidate) => candidate.actionId === action.actionId);
                  return {
                    status: outcome?.status || "missing",
                    code: outcome?.code || null,
                    leaves: outcome?.leaves?.length || 0,
                  };
                })(),
              }))),
              timing: ruleComposition.counterfactualPort.getDiagnostics?.() || null,
            });
            return outcomes;
          },
          inputAdapter,
          onPause: options.onPause,
          onDiagnostic: options.onDiagnostic,
          defaultDeadlineMs: options.defaultDeadlineMs,
        }));
      }
      return drivers.get(seatId);
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
      const result = await getDriver(seatId).runOnce(runOptions);
      lastResult = ownGeneration === generation
        ? result
        : fail("MACHINE_POLICY_REQUEST_INVALIDATED", "Browser Machine Player generation 已变化", { seatId });
      return lastResult;
    }

    function invalidate(reason = "Browser Rule Composition lifecycle 已变化") {
      generation += 1;
      for (const driver of drivers.values()) driver.invalidate(reason);
      drivers.clear();
      lastResult = null;
      return Object.freeze({ ok: true, generation });
    }

    function inspect() {
      return Object.freeze({
        generation,
        seatId: currentSeatId(),
        drivers: Object.freeze([...drivers.entries()].map(([seatId, driver]) => ({
          seatId,
          host: driver.inspect(),
        }))),
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
      outcomeModel,
      expectedScoreEvaluator,
      policyInputAdapterModule,
      projectionAdapter,
      inputAdapter,
      createPolicy,
      projectionSource,
      isMachineSeat,
    } = context;
    const machinePlayerPort = createBrowserMachinePlayerPort({
      ruleComposition,
      outcomeModel,
      expectedScoreEvaluator,
      projectionSource,
      policyInputAdapterModule,
      projectionAdapter,
      inputAdapter,
      createPolicy,
      isMachineSeat,
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
    createCompositionPolicyBoundaryReader,
    createBrowserMachinePlayerPort,
    createBrowserAiBootstrap,
  };
});
