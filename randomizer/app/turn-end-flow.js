(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.SetiAppTurnEndFlow = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const BROWSER_STATIC_DEPENDENCY_KEYS = Object.freeze([]);

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
    const productionDecisionOwnedBySession = () => ({
      ok: false,
      code: "TURN_END_DECISION_INPUT_OWNED_BY_SESSION",
      message: "回合末 Decision 只能通过当前 Effect Session identity 提交",
    });

    function dispatch(family) {
      const actions = hostPort.listHumanActions?.(family) || [];
      return actions.length === 1 ? hostPort.submitHumanAction(actions[0]) : {
        ok: false,
        code: "TURN_END_PRODUCTION_OWNER_REQUIRED",
        message: "当前没有唯一正式回合行动",
      };
    }

    return Object.freeze({
      createPassEvent,
      passForCurrentPlayer() {
        return dispatch("pass");
      },
      endCurrentTurn() {
        return dispatch("end_turn");
      },
      executePassFirstRotateEffect: productionDecisionOwnedBySession,
      executePassHandLimitEffect: productionDecisionOwnedBySession,
      maybeResumeTurnEndAfterReveal: productionDecisionOwnedBySession,
      maybeContinuePendingTurnEndRevealFlow: productionDecisionOwnedBySession,
      maybeContinueAlienRevealQueuedOpportunities: productionDecisionOwnedBySession,
      finishCurrentTurnAfterAlienReveal: productionDecisionOwnedBySession,
    });
  }

  function createBrowserTurnEndFlow(options = {}) {
    return createTurnEndFlow({ hostPort: options.hostPort || {} });
  }

  function createTurnEndPort(context = {}) {
    return Object.freeze({
      createPassEvent: (...args) => context.getRuntime()?.createPassEvent(...args),
      passForCurrentPlayer(execution = {}) {
        return context.getRuntime()?.passForCurrentPlayer(execution.workingRoot, execution);
      },
      endCurrentTurn(execution = {}) {
        return context.getRuntime()?.endCurrentTurn(execution.workingRoot, execution);
      },
      executePassFirstRotateEffect: (...args) => context.getRuntime()?.executePassFirstRotateEffect(...args),
      executePassHandLimitEffect: (...args) => context.getRuntime()?.executePassHandLimitEffect(...args),
      maybeResumeTurnEndAfterReveal: (...args) => context.getRuntime()?.maybeResumeTurnEndAfterReveal(...args),
      maybeContinuePendingTurnEndRevealFlow: (...args) => (
        context.getRuntime()?.maybeContinuePendingTurnEndRevealFlow(...args)
      ),
      maybeContinueAlienRevealQueuedOpportunities: (...args) => (
        context.getRuntime()?.maybeContinueAlienRevealQueuedOpportunities(...args)
      ),
    });
  }

  return Object.freeze({
    BROWSER_STATIC_DEPENDENCY_KEYS,
    createBrowserTurnEndFlow,
    createBrowserTurnEndStaticContext,
    createTurnEndFlow,
    createTurnEndPort,
  });
});
