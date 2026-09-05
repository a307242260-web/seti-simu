"use strict";
const assert = require("node:assert/strict");
const stateStoreApi = require("../state/state-store");
const effectRuntimeApi = require("./session-runtime");
const domain = require("./standard-action-session");
const { createRuleComposition } = require("../rule-composition");

function createComposition() {
  return createRuleComposition({
    stateStoreApi, effectRuntimeApi,
    createInitialState: () => stateStoreApi.createCommittedGameState({
      gameId: "payment-choice", rulesetVersion: "test-v1", seed: 17, rngState: {}, sequences: {},
      match: { energy: 3, score: 0, started: false }, turn: { currentPlayerId: "p1" },
      players: {}, solarSystem: {}, pieces: {}, planets: {}, data: {}, cards: {}, tech: {}, aliens: {}, finalScoring: {},
    }),
    projectState: (root) => ({ energy: root.match.energy, score: root.match.score }),
    createActionRegistry() {
      const action = { schemaVersion: "seti-standard-action-v1", actionId: "move:test", family: "move",
        phase: "main", actorId: "p1", stateVersion: 0, decisionVersion: 0, target: {}, payload: {} };
      return {
        enumerate: (root) => root.match.started ? [] : [action],
        validate: () => ({ ok: true }),
        execute(root, current) {
          if (current.family === "choose_payment") {
            root.match.energy -= current.payload.energyCost;
            root.match.score += current.payload.reward;
            return { ok: true };
          }
          root.match.started = true;
          return { ok: true, decisionEffect: {
            type: domain.DECISION_EFFECT_TYPE, kind: "decision", ownerId: "p1", decisionKind: "choose_payment",
            payload: { choices: [[1, 1], [2, 3]].map(([energyCost, reward]) => ({
              schemaVersion: "seti-standard-action-v1", actionId: `choose_payment:${energyCost}`,
              family: "choose_payment", phase: "conditional", actorId: "p1",
              target: { kind: "move-payment" }, payload: { energyCost, reward },
            })) },
          } };
        },
      };
    },
    effectDomains: [{ create: domain.createStandardActionDomain, families: ["move", "choose_payment"],
      options: { actionFamilies: ["move", "choose_payment"] } }],
    createCounterfactualFork(envelope) {
      const fork = createComposition();
      assert.equal(fork.lifecycle.restore(envelope).ok, true);
      return fork;
    },
  });
}
const composition = createComposition();
const before = composition.lifecycle.save().envelope;
const [result] = composition.counterfactualPort.evaluate(composition.inputPort.enumerateActions(), {
  viewer: { playerId: "p1", role: "player" }, maxNodes: 8, maxExecutionNodes: 16,
  secondaryAgentSearch: { focalSeatId: "p1", maxProxyDepth: 1,
    selectRouteTarget: () => "move:reward", selectSuccessors: ({ legalSuccessors }) => legalSuccessors,
    completesRouteTarget: ({ branchObservation }) => branchObservation.score > 0 },
});
assert.equal(result.status, "settled");
assert.deepEqual(result.leaves.map((leaf) => [leaf.observation.energy, leaf.observation.score]).sort(),
  [[1, 3], [2, 1]], "不同费用和结果的支付选择必须分别执行，不能固定取第一项");
assert.deepEqual(composition.lifecycle.save().envelope, before);
const [pending] = composition.counterfactualPort.evaluate(composition.inputPort.enumerateActions(), {
  viewer: { playerId: "p1", role: "player" }, maxNodes: 1, maxExecutionNodes: 1,
  secondaryAgentSearch: { focalSeatId: "p1", maxProxyDepth: 2,
    selectRouteTarget: () => "move:reward", selectSuccessors: ({ legalSuccessors }) => legalSuccessors,
    completesRouteTarget: () => true },
});
assert.equal(pending.code, "COUNTERFACTUAL_SEARCH_PRUNED");
assert.equal(pending.leaves.length, 0, "目标标为完成但正式支付未结束，仍不能保留为完成叶");
assert.deepEqual(composition.lifecycle.save().envelope, before);
console.log("search payment choice tests passed");
