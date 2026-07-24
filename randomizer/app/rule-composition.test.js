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
  "productionActionExecutorOwners", "executor", "provider", "workingRoot",
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
assert.equal(composition.inputPort.submitAction(start).ok, true);

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
}), /禁止 Host 注入 Standard Action continuation\/Decision/);

composition.dispose();
console.log("rule composition tests passed");
