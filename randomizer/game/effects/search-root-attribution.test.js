"use strict";

// 窄接口反例：两条不同根路线先后到达同一个状态，后到路线也必须得到终点收益。
const assert = require("node:assert/strict");
const stateStoreApi = require("../state/state-store");
const effectRuntimeApi = require("./session-runtime");
const standardDomain = require("./standard-action-session");
const { createRuleComposition } = require("../rule-composition");

const families = ["launch", "scan", "place_data", "analyze"];
function createComposition(continueAfterScore = false) {
  return createRuleComposition({
    stateStoreApi, effectRuntimeApi,
    createInitialState: () => stateStoreApi.createCommittedGameState({
      gameId: "search-root-attribution", rulesetVersion: "test-v1", seed: 124,
      rngState: {}, sequences: {}, match: { stage: 0, score: 0 },
      turn: { currentPlayerId: "p1" }, players: {}, solarSystem: {}, pieces: {},
      planets: {}, data: {}, cards: {}, tech: {}, aliens: {}, finalScoring: {},
    }),
    projectState: (root) => ({ stage: root.match.stage, score: root.match.score }),
    createActionRegistry() {
      function actions(root) {
        const available = root.match.stage === 0 ? ["launch", "scan"]
          : root.match.stage === 1 ? ["place_data"]
            : root.match.stage === 2 ? ["analyze"] : continueAfterScore ? ["scan"] : [];
        return available.map((family) => ({
          schemaVersion: "seti-standard-action-v1", actionId: `${family}:${root.meta.stateVersion}`,
          family, phase: "main", actorId: "p1", stateVersion: root.meta.stateVersion,
          decisionVersion: 0, target: {}, payload: {}, summary: family,
        }));
      }
      return {
        enumerate: actions,
        validate: (root, action) => actions(root).some((item) => item.actionId === action.actionId)
          ? { ok: true } : { ok: false, code: "STANDARD_ACTION_STALE" },
        execute(root, action) {
          root.match.stage = action.family === "scan" ? 1 : action.family === "analyze" ? 3 : 2;
          if (action.family === "analyze") root.match.score += 3;
          return { ok: true };
        },
      };
    },
    effectDomains: [{ create: standardDomain.createStandardActionDomain, families,
      options: { actionFamilies: families } }],
    createCounterfactualFork(envelope) {
      const fork = createComposition(continueAfterScore);
      assert.equal(fork.lifecycle.restore(envelope).ok, true);
      return fork;
    },
  });
}

const composition = createComposition();
const before = composition.lifecycle.save().envelope;
const actions = composition.inputPort.enumerateActions();
const outcomes = composition.counterfactualPort.evaluate(actions, {
  viewer: { playerId: "p1", role: "player" }, maxNodes: 16, maxExecutionNodes: 32,
  maxFrontierNodes: 16,
  maxDepth: 5, getBranchPriority: ({ branchObservation }) => branchObservation.stage,
  secondaryAgentSearch: {
    focalSeatId: "p1", maxProxyDepth: 1,
    selectRouteTarget: () => "score:3",
    completesRouteTarget: ({ branchObservation }) => branchObservation.score === 3,
    selectSuccessors: ({ legalSuccessors }) => legalSuccessors,
  },
});
// 两条链长度不同，stateVersion也不同；不能再要求忽略版本的语义合并。
for (const action of actions) {
  const result = outcomes.find((item) => item.actionId === action.actionId);
  assert.equal(result.status, "settled", `${action.family}根不得丢失共同终点：${JSON.stringify(result)}`);
  assert.ok(result.leaves.some((leaf) => leaf.observation.score === 3
    && leaf.actionChain[0] === action.actionId), "终点收益必须归回自己的根行动");
}
assert.deepEqual(composition.lifecycle.save().envelope, before);
const stopped = composition.counterfactualPort.evaluate(actions, {
  viewer: { playerId: "p1", role: "player" }, maxNodes: 16, maxExecutionNodes: 32,
  maxFrontierNodes: 16,
  secondaryAgentSearch: {
    focalSeatId: "p1", maxProxyDepth: 1,
    selectRouteTarget: () => "score:3",
    completesRouteTarget: () => false,
    selectSuccessors: () => [],
  },
});
for (const result of stopped) {
  assert.equal(result.status, "settled", "目标无可用后继不能抹掉已经完整执行的根行动");
  assert.equal(result.leaves[0].observation.score, 0, "未完成目标不奖励未来得分");
  assert.equal(result.leaves[0].terminalReason, "route-unreachable");
  assert.equal(result.leaves[0].actionChain.length, 1);
}
assert.deepEqual(composition.lifecycle.save().envelope, before);
const continuing = createComposition(true);
const continuingBefore = continuing.lifecycle.save().envelope;
const launch = continuing.inputPort.enumerateActions().filter((action) => action.family === "launch");
const [budgeted] = continuing.counterfactualPort.evaluate(launch, {
  viewer: { playerId: "p1", role: "player" }, maxNodes: 2, maxExecutionNodes: 2,
  maxFrontierNodes: 2,
  secondaryAgentSearch: {
    focalSeatId: "p1", maxProxyDepth: 2,
    selectRouteTarget: () => "score:3",
    completesRouteTarget: ({ action }) => action.family === "analyze",
    selectSuccessors: ({ legalSuccessors }) => legalSuccessors,
  },
});
assert.equal(continuing.counterfactualPort.getDiagnostics().executionLimitReached, true);
assert.equal(budgeted.code, "COUNTERFACTUAL_SEARCH_PRUNED", "保留真实结果不代表搜索已穷尽");
assert.deepEqual(budgeted.searchCompleteness, { status: "incomplete", reasons: ["node-budget"] });
assert.ok(budgeted.leaves.some((leaf) => leaf.observation.score === 3
  && leaf.terminalReason === "goal-completed" && leaf.actionChain.length === 2),
"launch→analyze的3分已结算，后续scan未执行不能抹掉它");
assert.ok(budgeted.leaves.every((leaf) => leaf.status !== "search_frontier"));
assert.deepEqual(continuing.lifecycle.save().envelope, continuingBefore);
console.log("search root attribution tests passed");
