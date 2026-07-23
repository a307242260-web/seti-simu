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
  function createAiOwnerInputPort(registry, context = {}) {
    return registry.register("ai", {
      setPlayerDifficulty: (workingRoot, command) => {
        const value = context.setPlayerDifficulty(workingRoot, {
          ...command,
          playerId: command.playerId ?? command.args?.[0],
          difficulty: command.difficulty ?? command.args?.[1],
          label: command.label ?? command.args?.[2],
        });
        return { ok: value?.ok !== false, value };
      },
    });
  }



  const REQUIRED_CONTEXT_KEYS = Object.freeze([
    "aiControlRuntimeModule",
    "ruleComposition",
    "policyInputAdapterModule",
    "projectionAdapter",
    "inputAdapter",
    "createPolicy",
    "projectionSource",
    "readAiControlProjection",
    "stateOwners",
    "controlContext",
    "inputPort",
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
      const inspection = composition.inspect();
      const source = projectionSource.read({
        viewerId: `machine:${seatId}`,
        playerId: seatId,
        role: "player",
      });
      const decision = source.decision || inspection.session?.decision || null;
      if (inspection.phase === "awaiting_input" && decision) {
        const legalActions = (decision.choices || [])
          .map((choice) => choice?.standardAction || choice?.action || choice)
          .filter(Boolean);
        return {
          kind: "decision",
          actorId: decision.ownerId,
          stateVersion: legalActions[0]?.stateVersion ?? source.source.stateVersion,
          decisionVersion: decision.decisionVersion,
          decisionId: decision.decisionId,
          legalActions,
        };
      }
      const actorId = source.state?.match?.currentPlayerId ?? null;
      if (source.state?.match?.terminal) {
        return { kind: "terminal", terminal: { phase: "completed" } };
      }
      return {
        kind: "action",
        actorId,
        stateVersion: source.source.stateVersion,
        decisionVersion: Math.max(0, Number(source.state?.match?.decisionVersion) || 0),
        legalActions: composition.inputPort.enumerateActions({ actorId }),
      };
    };
  }

  function createBrowserMachinePlayerPort(options = {}) {
    const {
      ruleComposition,
      projectionSource,
      policyInputAdapterModule,
      projectionAdapter,
      inputAdapter,
      createPolicy,
      isMachineSeat,
    } = options;
    if (!policyInputAdapterModule?.createPolicyInputAdapter
      || !projectionAdapter?.projectSource
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

    function currentSeatId() {
      const inspection = ruleComposition.inspect();
      const source = projectionSource.read();
      return source.decision?.ownerId
        ?? inspection.session?.decision?.ownerId
        ?? source.state?.match?.currentPlayerId
        ?? null;
    }

    function getDriver(seatId) {
      if (!drivers.has(seatId)) {
        drivers.set(seatId, policyInputAdapterModule.createPolicyInputAdapter({
          policy: createPolicy(seatId),
          readBoundary: () => readBoundary(seatId),
          readObservation: () => projectionAdapter.projectSource({
            viewer: { viewerId: `machine:${seatId}`, playerId: seatId, role: "player" },
          }),
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
      aiControlRuntimeModule,
      ruleComposition,
      policyInputAdapterModule,
      projectionAdapter,
      inputAdapter,
      createPolicy,
      projectionSource,
      readAiControlProjection,
      stateOwners,
      controlContext,
    } = context;
    const state = aiControlRuntimeModule.createAiControllerState(stateOwners);
    let controller = null;
    const machinePlayerPort = createBrowserMachinePlayerPort({
      ruleComposition,
      projectionSource,
      policyInputAdapterModule,
      projectionAdapter,
      inputAdapter,
      createPolicy,
      isMachineSeat: (seatId) => Boolean(controller?.isAiAutoBattlePlayer?.(seatId)),
    });
    const controlRuntime = aiControlRuntimeModule.createAiControlRuntime({
      ...controlContext,
      state,
      recordAiAutoBattleLog: () => null,
      recordAiAutoBattleBug: () => null,
      resetAiStrategyDemandCache: () => {},
      setPlayerAiDifficulty: (playerId, difficulty, label) => context.inputPort
        .setPlayerDifficulty(playerId, difficulty, label),
      runMachinePlayerStepThroughComposition: (options) => machinePlayerPort.runOnce(options),
      getRuleProjection: () => {
        return structuredClone(readAiControlProjection());
      },
    });
    controller = Object.freeze({
      ...controlRuntime,
      getPlayerAgentLabel(playerId) {
        const player = controlContext.getPlayerById(playerId);
        return controlRuntime.isAiAutoBattlePlayer(playerId)
          ? `${player?.colorLabel || "电脑玩家"}AI`
          : "人类";
      },
    });
    ruleComposition.subscribe((event) => {
      if (event?.source === "lifecycle") {
        machinePlayerPort.invalidate(`Rule Composition lifecycle: ${event.event?.type || "unknown"}`);
      }
    });

    return Object.freeze({ controller, machinePlayerPort });
  }

  return {
    createAiOwnerInputPort,
    REQUIRED_CONTEXT_KEYS,
    createCompositionPolicyBoundaryReader,
    createBrowserMachinePlayerPort,
    createBrowserAiBootstrap,
  };
});
