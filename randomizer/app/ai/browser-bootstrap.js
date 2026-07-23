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
    "aiControlRuntimeModule",
    "aiControllerModule",
    "ruleComposition",
    "getRuleReadout",
    "isActionEffectFlowActive",
    "stateOwners",
    "controllerContext",
  ]);

  function createBrowserAiBootstrap(context = {}) {
    const missingKeys = REQUIRED_CONTEXT_KEYS.filter(
      (key) => !Object.prototype.hasOwnProperty.call(context, key) || context[key] == null,
    );
    if (missingKeys.length) {
      throw new Error(`Browser AI bootstrap 缺少依赖：${missingKeys.join(", ")}`);
    }

    const {
      aiControlRuntimeModule,
      aiControllerModule,
      ruleComposition,
      getRuleReadout,
      isActionEffectFlowActive,
      heuristicPolicy,
      stateOwners,
      controllerContext,
    } = context;
    const state = aiControlRuntimeModule.createAiControllerState(stateOwners);
    const runCompositionStep = aiControlRuntimeModule.createAiCompositionStepPort({
      inspect: (...args) => ruleComposition.inspect(...args),
      getRuleReadout,
      isActionEffectFlowActive,
      beginDrain: (...args) => ruleComposition.inputPort.beginDrain(...args),
      readState: (...args) => ruleComposition.stateSourcePort.read(...args),
      heuristicPolicy,
      submitDecision: (...args) => ruleComposition.inputPort.submitDecision(...args),
      submitHostCommand: (...args) => ruleComposition.inputPort.submitHostCommand(...args),
    }).run;
    const submitHostCommand = (command, options) => (
      ruleComposition.inputPort.submitHostCommand(command, options)
    );
    const controller = aiControllerModule.createAiController({
      ...controllerContext,
      state,
      setPlayerAiDifficulty: (playerId, difficulty, label) => submitHostCommand({
        kind: "ai_set_player_difficulty",
        playerId,
        difficulty,
        label,
      }),
      runAiAutomationStepThroughComposition: (...args) => (
        runCompositionStep("ai_run_automation_step", args)
      ),
      recoverAiIdleActionEffectThroughComposition: (...args) => (
        runCompositionStep("ai_recover_idle_action_effect", args)
      ),
      getRuleProjection: () => {
        const ruleState = ruleComposition.stateSourcePort.read().state;
        return {
          players: structuredClone(ruleState.players),
          turn: structuredClone(ruleState.turn),
        };
      },
      getRuleReadout,
    });
    const compositionPort = Object.freeze({
      buildTurnActionCandidates: (...args) => submitHostCommand({
        kind: "ai_build_turn_candidates",
        args,
      }),
      listCardTriggerFreeMoveCandidates: (...args) => (
        submitHostCommand({
          kind: "card_trigger_list_free_move_candidates",
          args,
        }, { commit: false }).value || []
      ),
      resolveToTurnBoundary: (options = {}) => submitHostCommand({
        kind: "ai_resolve_to_turn_boundary",
        options,
      }),
      runAutomationStep: () => submitHostCommand({ kind: "ai_run_automation_step" }),
      runActionEffectStep: () => submitHostCommand({ kind: "ai_run_action_effect_step" }),
      runNonTurnStep: () => submitHostCommand({ kind: "ai_run_non_turn_step" }),
      runSelectedTurnAction: (selector = {}, options = {}) => submitHostCommand({
        kind: "ai_run_selected_turn_action",
        selector,
        options,
      }),
    });

    return Object.freeze({ controller, compositionPort });
  }

  return { REQUIRED_CONTEXT_KEYS, createBrowserAiBootstrap };
});
