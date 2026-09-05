"use strict";
const assert = require("node:assert/strict");
const stateStoreApi = require("../state/state-store");
const effectRuntimeApi = require("./session-runtime");
const domain = require("./standard-action-session");
const { createRuleComposition } = require("../rule-composition");

// 两个根到同一真实状态，再有三条不同终点。检验全局队列与共享来源，不模拟完整游戏。
function createComposition(metadataKind = null) {
  return createRuleComposition({
    stateStoreApi, effectRuntimeApi,
    createInitialState: () => stateStoreApi.createCommittedGameState({
      gameId: "search-budget", rulesetVersion: "test-v1", seed: 19,
      rngState: { state: 1 }, sequences: { rocket: 1 },
      match: { stage: 0, score: 0 }, turn: { currentPlayerId: "p1" },
      players: {}, solarSystem: {}, pieces: {}, planets: {}, data: {}, cards: {},
      tech: {}, aliens: {}, finalScoring: {},
    }),
    projectState: (state) => ({ ...state.match }),
    // metadata归提交上下文；不能在registry的普通副本里写后假设它会覆盖外层meta。
    transformEffectResult(state, result, effect) {
      if (metadataKind && state.match.stage === 1) {
        const value = effect.payload.action.family === "launch" ? 1 : 2;
        if (metadataKind === "rng") state.meta.rngState.state = value;
        else state.meta.sequences.rocket = value;
      }
      return result;
    },
    createActionRegistry() {
      function enumerate(state) {
        const variants = state.match.stage === 0 ? [["launch", 0], ["scan", 0]]
          : state.match.stage === 1 ? [["move", 1], ["move", 2], ["move", 3]] : [];
        return variants.map(([family, value]) => ({
          schemaVersion: "seti-standard-action-v1", family, phase: "main", actorId: "p1",
          actionId: `${family}:${state.meta.stateVersion}:${value}`,
          stateVersion: state.meta.stateVersion, decisionVersion: 0,
          target: { value }, payload: {}, summary: family,
        }));
      }
      return { enumerate,
        validate: (state, action) => ({ ok: enumerate(state).some((item) => item.actionId === action.actionId) }),
        execute(state, action) {
          state.match.stage += 1;
          const metadataValue = !metadataKind ? 0 : metadataKind === "rng"
            ? state.meta.rngState.state : state.meta.sequences.rocket;
          state.match.score = action.family === "move"
            ? action.target.value + 10 * metadataValue : 0;
          return { ok: true };
        },
      };
    },
    effectDomains: [{ create: domain.createStandardActionDomain,
      families: ["launch", "scan", "move"], options: { actionFamilies: ["launch", "scan", "move"] } }],
    createCounterfactualFork(envelope) {
      const fork = createComposition(metadataKind);
      assert.equal(fork.lifecycle.restore(envelope).ok, true);
      return fork;
    },
  });
}
const composition = createComposition();
const before = composition.lifecycle.save().envelope;
const actions = composition.inputPort.enumerateActions();
const options = {
  maxNodes: 8, maxExecutionNodes: 16, maxFrontierNodes: 2,
  viewer: { playerId: "p1", role: "player" },
  secondaryAgentSearch: { focalSeatId: "p1", maxProxyDepth: 3,
    selectSuccessors: ({ legalSuccessors }) => legalSuccessors,
    selectRouteTarget: () => "score", completesRouteTarget: ({ action }) => action.family === "move",
  },
};
const outcomes = composition.counterfactualPort.evaluate(actions, options);
const diagnostics = composition.counterfactualPort.getDiagnostics();
assert.ok(diagnostics.maxRetainedFrontierSize <= 2);
assert.ok(diagnostics.beamPrunedOriginCount > 0);
assert.ok(diagnostics.sharedPhysicalExecutionOriginCount > 0, "相同物理状态须共享执行但保留两个来源");
for (const outcome of outcomes) {
  assert.equal(outcome.status, "settled");
  assert.ok(outcome.leaves.length > 0, "每个根须得到完成叶");
  assert.ok(outcome.leaves.every((leaf) => leaf.actionChain[0] === outcome.actionId));
  assert.deepEqual(outcome.searchCompleteness, { status: "incomplete", reasons: ["beam-budget"] });
}
assert.deepEqual(composition.counterfactualPort.evaluate([...actions].reverse(), options), outcomes,
  "换序不能改变根覆盖、叶或完整性");
const complete = composition.counterfactualPort.evaluate(actions, { ...options, maxFrontierNodes: 8 });
for (const outcome of complete) {
  assert.deepEqual(outcome.leaves.map((leaf) => leaf.observation.score).sort(), [1, 2, 3]);
  assert.deepEqual(outcome.searchCompleteness, { status: "complete", reasons: [] });
}
assert.throws(() => composition.counterfactualPort.evaluate(actions, { ...options, maxFrontierNodes: 1 }), /BUDGET_INVALID/);
assert.throws(() => composition.counterfactualPort.evaluate(actions, { ...options, maxMilliseconds: Number.EPSILON }), /SEARCH_TIMEOUT/);
assert.deepEqual(composition.lifecycle.save().envelope, before, "包括超时路径在内不得提交真实根");
composition.dispose();
for (const metadataKind of ["rng", "sequence"]) {
  const distinct = createComposition(metadataKind);
  const results = distinct.counterfactualPort.evaluate(distinct.inputPort.enumerateActions(),
    { ...options, maxFrontierNodes: 8 });
  for (const result of results) {
    const expected = result.actionId.startsWith("launch:") ? [11, 12, 13] : [21, 22, 23];
    assert.deepEqual(result.leaves.map((leaf) => leaf.observation.score).sort(), expected,
      `${metadataKind}影响后继时不能共享另一个根的物理状态`);
  }
  distinct.dispose();
}
console.log("search budget tests passed");
