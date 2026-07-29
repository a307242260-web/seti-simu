"use strict";

const assert = require("node:assert/strict");
const browserRuleComposition = require("./browser-rule-composition");
const productionKernel = require("../game/production-kernel");
const projectionAdapter = require("./browser-host/projection-adapter");
const standardAction = require("../game/actions/standard-action");

function createRandom(initial = 1) {
  let state = initial;
  const random = () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
  random.getState = () => state >>> 0;
  random.setState = (next) => { state = Number(next) >>> 0 || 1; };
  return random;
}

const composition = browserRuleComposition.createBrowserRuleComposition({
  productionKernelApi: productionKernel,
  random: createRandom(),
  counterfactualEnabled: false,
  browserProjection: {
    visibilityPolicy: projectionAdapter.defaultVisibilityPolicy,
    getFinalReadModelOwner: () => ({ project: () => Object.freeze({ players: [], finalBoard: {} }) }),
    getBrowserReadModelOwner: () => ({
      project: () => Object.freeze({
        schemaVersion: "test-browser-read-model",
        render: {},
      }),
    }),
    createRenderPresentation: () => ({}),
  },
});

assert.deepEqual(
  Object.keys(composition.capabilities),
  ["productionDomainPackId"],
  "Browser capability 只暴露 Production pack identity",
);
for (const forbidden of [
  "stateSourcePort", "productionActionRegistry", "productionActionOwners",
  "productionActionExecutorOwners", "executor", "provider", "canonicalState",
]) {
  assert.equal(Object.hasOwn(composition, forbidden), false, `Browser facade 不得暴露 ${forbidden}`);
}

const reset = composition.newGame({
  activePlayerCount: 4,
  rngState: { algorithm: "test", state: 1 },
});
assert.equal(reset.ok, true);
const families = new Set(composition.inputPort.enumerateActions({}).map((action) => action.family));
assert.equal(families.has("choose_card"), true);
const start = composition.inputPort.enumerateActions({})
  .find((action) => action.target?.kind === "start_initial_setup");
assert.ok(start);
const startResult = composition.inputPort.submitAction(start);
assert.equal(startResult.ok, true);
assert.ok(startResult.projection,
  "正常 Browser/Simulation 提交仍必须返回 projection；省略只允许反事实内部调用");

const viewer = {
  viewerId: `viewer:${start.actorId}`,
  playerId: start.actorId,
  role: "player",
};
const projected = composition.projectionSource.read(viewer);
assert.equal(projected.source.kind, "working");
assert.equal(projected.decision.ownerId, start.actorId);
assert.ok(projected.state.resident.finalReadModel);
assert.ok(projected.state.resident.browserReadModel);
assert.equal(JSON.stringify(projected.state).includes("drawPileCardIds"), false);

assert.equal(
  new Set(standardAction.ALL_FAMILIES).size,
  22,
  "Standard Action 完备集固定为 22 family",
);

assert.throws(() => productionKernel.installProductionKernel({
  hostKind: "browser",
  stateAdapter: {
    createWorkingState() {},
    createCommittedState() {},
    restoreWorkingState() {},
  },
  projectionAdapter: { projectState() {} },
  hostServices: {},
  standardActionDomainOptions: {},
}), /禁止 Host 注入 Standard Action Decision\/事务规则/);

{
  const paritySeed = "browser-simulation-fixed-parity";
  const simulationKernel = productionKernel.createSimulationRuleComposition({
    random: createRandom(11),
    seed: paritySeed,
    activePlayerCount: 4,
  });
  assert.equal(simulationKernel.newGame({
    seed: paritySeed,
    activePlayerCount: 4,
  }).ok, true);
  const baseline = simulationKernel.composition.lifecycle.save().envelope;
  const browserParity = browserRuleComposition.createBrowserRuleComposition({
    productionKernelApi: productionKernel,
    random: createRandom(99),
    counterfactualEnabled: false,
    browserProjection: {
      visibilityPolicy: projectionAdapter.defaultVisibilityPolicy,
      getFinalReadModelOwner: () => ({ project: () => Object.freeze({ players: [], finalBoard: {} }) }),
      getBrowserReadModelOwner: () => ({
        project: () => Object.freeze({ schemaVersion: "test-browser-read-model", render: {} }),
      }),
      createRenderPresentation: () => ({}),
    },
  });
  assert.equal(
    browserParity.lifecycle.restore(structuredClone(baseline), { trustedFork: true }).code,
    "RULE_COMPOSITION_TRUSTED_FORK_FORBIDDEN",
    "Browser/canonical composition 不得调用只属于隔离反事实 fork 的恢复快路径",
  );
  assert.equal(browserParity.lifecycle.restore(structuredClone(baseline)).ok, true);
  const simulationActions = simulationKernel.composition.inputPort.enumerateActions({});
  const browserActions = browserParity.inputPort.enumerateActions({});
  assert.deepEqual(browserActions, simulationActions,
    "Browser/Simulation 从同一 checkpoint 必须枚举完全相同的 Standard Action");
  const action = simulationActions.find((candidate) => candidate.family === "launch");
  assert.ok(action, "固定 parity checkpoint 必须存在 launch");
  assert.equal(simulationKernel.composition.inputPort.submitAction(action).ok, true);
  assert.equal(browserParity.inputPort.submitAction(
    browserActions.find((candidate) => candidate.actionId === action.actionId),
  ).ok, true);
  assert.deepEqual(
    browserParity.lifecycle.save().envelope,
    simulationKernel.composition.lifecycle.save().envelope,
    "Browser/Simulation 对同一 Action 必须得到同一 committed state、journal 与 checkpoint",
  );
  simulationKernel.composition.dispose();
  browserParity.dispose();
}

composition.dispose();
console.log("rule composition tests passed");
