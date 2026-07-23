"use strict";

const assert = require("node:assert/strict");
const {
  REQUIRED_CONTEXT_KEYS,
  CONTROLLER_STATIC_DEPENDENCY_KEYS,
  CONTROLLER_STATIC_CONSTANT_KEYS,
  createBrowserAiStaticContext,
  createBrowserAiBootstrap,
} = require("./browser-bootstrap");

function createHarness() {
  const commands = [];
  const controllerContexts = [];
  const ruleState = { players: [{ id: "red" }], turn: { round: 2 } };
  const ruleComposition = {
    inspect: () => "inspect",
    inputPort: {
      beginDrain: () => "drain",
      submitDecision: () => "decision",
      submitHostCommand(command) {
        commands.push(command);
        return command.kind === "card_trigger_list_free_move_candidates"
          ? { value: ["move"] }
          : command.kind;
      },
    },
    stateSourcePort: {
      read: () => ({ state: ruleState }),
    },
  };
  const aiControlRuntimeModule = {
    createAiControllerState: (owners) => ({ owners }),
    createAiCompositionStepPort: () => ({
      run: (kind, args) => ({ kind, args }),
    }),
  };
  const aiControllerModule = {
    createAiController(context) {
      controllerContexts.push(context);
      return { ready: true };
    },
  };
  const bootstrap = createBrowserAiBootstrap({
    aiControlRuntimeModule,
    aiControllerModule,
    ruleComposition,
    getRuleReadout: () => ruleState,
    isActionEffectFlowActive: () => false,
    stateOwners: { match: {}, action: {}, actionHistory: {}, ui: {}, getAlien: () => ({}) },
    controllerContext: { marker: "controller" },
  });
  return { bootstrap, commands, controllerContexts, ruleState };
}

(() => {
  for (const missingKey of REQUIRED_CONTEXT_KEYS) {
    const context = Object.fromEntries(
      REQUIRED_CONTEXT_KEYS
        .filter((key) => key !== missingKey)
        .map((key) => [key, {}]),
    );
    assert.throws(
      () => createBrowserAiBootstrap(context),
      new RegExp(missingKey),
      `缺少 ${missingKey} 时必须在创建期失败`,
    );
  }
})();

(() => {
  const dependencies = Object.fromEntries(
    CONTROLLER_STATIC_DEPENDENCY_KEYS.map((key) => [key, { key }]),
  );
  const constants = Object.fromEntries(
    CONTROLLER_STATIC_CONSTANT_KEYS.map((key) => [key, `constant:${key}`]),
  );
  const selected = createBrowserAiStaticContext(
    { ...dependencies, unrelatedModule: {} },
    { ...constants, UNRELATED_CONSTANT: true },
  );
  assert.deepEqual(Object.keys(selected), [
    ...CONTROLLER_STATIC_DEPENDENCY_KEYS,
    ...CONTROLLER_STATIC_CONSTANT_KEYS,
  ]);
  assert.equal(Object.isFrozen(selected), true);
  assert.throws(
    () => createBrowserAiStaticContext(
      { ...dependencies, players: null },
      constants,
    ),
    /players/,
  );
})();

(() => {
  const { bootstrap, commands, controllerContexts, ruleState } = createHarness();
  assert.deepEqual(bootstrap.controller, { ready: true });
  assert.equal(controllerContexts[0].marker, "controller");
  assert.deepEqual(controllerContexts[0].state.owners.match, {});
  assert.deepEqual(controllerContexts[0].getRuleProjection(), ruleState);
  assert.notEqual(controllerContexts[0].getRuleProjection().players, ruleState.players);
  assert.deepEqual(bootstrap.compositionPort.listCardTriggerFreeMoveCandidates(), ["move"]);
  assert.equal(bootstrap.compositionPort.runAutomationStep(), "ai_run_automation_step");
  assert.deepEqual(commands.map((command) => command.kind), [
    "card_trigger_list_free_move_candidates",
    "ai_run_automation_step",
  ]);
})();

console.log("AI browser bootstrap tests passed");
