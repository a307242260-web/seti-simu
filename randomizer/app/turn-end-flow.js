(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SetiAppTurnEndFlow = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const BROWSER_INPUT_NAMES = Object.freeze([
    "executePassFirstRotateEffect",
    "executePassHandLimitEffect",
    "passForCurrentPlayer",
    "maybeResumeTurnEndAfterReveal",
    "maybeContinuePendingTurnEndRevealFlow",
    "maybeContinueAlienRevealQueuedOpportunities",
    "endCurrentTurn",
  ]);
  const BROWSER_STATIC_DEPENDENCY_KEYS = Object.freeze([]);

  function createBrowserInputPort(registry, getTarget) {
    if (typeof registry?.registerTarget !== "function") {
      throw new TypeError("turn_end input port 需要已校验 registry");
    }
    if (typeof getTarget !== "function") {
      throw new TypeError("turn_end input port 缺少 owner resolver");
    }
    return registry.registerTarget("turn_end", BROWSER_INPUT_NAMES, getTarget);
  }

  function createBrowserTurnEndStaticContext() {
    return Object.freeze({});
  }

  function createPassEvent(player) {
    return Object.freeze({
      type: "pass",
      playerId: player?.id || null,
      playerColor: player?.color || null,
    });
  }

  function createTurnEndFlow(context = {}) {
    const hostPort = context.hostPort || context;

    function dispatch(family) {
      const actions = hostPort.listHumanActions?.(family) || [];
      return actions.length === 1 ? hostPort.submitHumanAction(actions[0]) : {
        ok: false,
        code: "TURN_END_PRODUCTION_OWNER_REQUIRED",
        message: "当前没有唯一正式回合行动",
      };
    }

    function inspectDecision() {
      const inspection = hostPort.inspect?.();
      return inspection?.phase === "awaiting_input" ? inspection.session?.decision : null;
    }

    function submitDecision(...hints) {
      const values = hints.flatMap((hint) => (
        ["string", "number"].includes(typeof hint) ? [String(hint)]
          : hint && typeof hint === "object" ? Object.values(hint).map(String) : []
      ));
      return hostPort.submitActiveDecision?.("residual-domain", (target, candidate) => {
        const text = JSON.stringify({ target, payload: candidate?.payload || {} });
        return values.length === 0 || values.every((value) => text.includes(value));
      }) || {
        ok: false,
        code: "TURN_END_DECISION_REQUIRED",
        message: "当前没有正式回合末 Decision",
      };
    }

    function continueProductionDecision(...hints) {
      return inspectDecision()
        ? submitDecision(...hints)
        : { ok: true, code: "PRODUCTION_TURN_END_SETTLED" };
    }

    return Object.freeze({
      createPassEvent,
      passForCurrentPlayer() {
        return dispatch("pass");
      },
      endCurrentTurn() {
        return dispatch("end_turn");
      },
      executePassFirstRotateEffect: continueProductionDecision,
      executePassHandLimitEffect: continueProductionDecision,
      maybeResumeTurnEndAfterReveal: continueProductionDecision,
      maybeContinuePendingTurnEndRevealFlow: continueProductionDecision,
      maybeContinueAlienRevealQueuedOpportunities: continueProductionDecision,
      finishCurrentTurnAfterAlienReveal: continueProductionDecision,
    });
  }

  function createBrowserTurnEndFlow(options = {}) {
    return createTurnEndFlow({ hostPort: options.hostPort || {} });
  }

  function createTurnEndPort(context = {}) {
    const commandMethods = [
      "executePassFirstRotateEffect",
      "executePassHandLimitEffect",
      "maybeResumeTurnEndAfterReveal",
      "maybeContinuePendingTurnEndRevealFlow",
      "maybeContinueAlienRevealQueuedOpportunities",
    ];
    const port = {
      createPassEvent: (...args) => context.getRuntime()?.createPassEvent(...args),
      passForCurrentPlayer(execution = {}) {
        return execution.workingRoot
          ? context.getRuntime()?.passForCurrentPlayer(execution.workingRoot, execution)
          : context.dispatchCommand("passForCurrentPlayer", [execution]);
      },
      endCurrentTurn(execution = {}) {
        return execution.workingRoot
          ? context.getRuntime()?.endCurrentTurn(execution.workingRoot, execution)
          : context.dispatchCommand("endCurrentTurn", [execution]);
      },
    };
    for (const name of commandMethods) {
      port[name] = (...args) => context.dispatchCommand(name, args);
    }
    return Object.freeze(port);
  }

  return Object.freeze({
    BROWSER_INPUT_NAMES,
    BROWSER_STATIC_DEPENDENCY_KEYS,
    createBrowserInputPort,
    createBrowserTurnEndFlow,
    createBrowserTurnEndStaticContext,
    createTurnEndFlow,
    createTurnEndPort,
  });
});
