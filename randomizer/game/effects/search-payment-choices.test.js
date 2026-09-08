"use strict";
const assert = require("node:assert/strict");
const stateStoreApi = require("../state/state-store");
const effectRuntimeApi = require("./session-runtime");
const domain = require("./standard-action-session");
const { createRuleComposition } = require("../rule-composition");
const outcomeModel = require("../ai/outcome-model");

function createComposition(hiddenCase = null) {
  return createRuleComposition({
    stateStoreApi, effectRuntimeApi,
    createInitialState: () => stateStoreApi.createCommittedGameState({
      gameId: "payment-choice", rulesetVersion: "test-v1", seed: 17, rngState: {}, sequences: {},
      match: { energy: 3, score: 0, started: false, payments: [] }, turn: { currentPlayerId: "p1" },
      players: {}, solarSystem: {}, pieces: {}, planets: {}, data: {}, cards: {}, tech: {}, aliens: {}, finalScoring: {},
    }),
    projectState: (root) => ({ energy: root.match.energy, score: root.match.score, payments: root.match.payments,
      selfState: { hand: [{ id: "known" }] } }),
    createActionRegistry() {
      const action = { schemaVersion: "seti-standard-action-v1", actionId: "move:test", family: "move",
        phase: "main", actorId: "p1", stateVersion: 0, decisionVersion: 0, target: {}, payload: {} };
      return {
        enumerate: (root) => root.match.started ? [] : [action],
        validate: () => ({ ok: true }),
        execute(root, current) {
          if (current.phase === "conditional") {
            root.match.payments.push(current.actionId);
            root.match.energy -= current.payload.energyCost;
            root.match.score += current.payload.reward;
            return { ok: true };
          }
          root.match.started = true;
          return { ok: true,
            ...(hiddenCase ? { irreversible: { code: "hidden_card_draw", reason: "测试抽牌边界" } } : {}),
            decisionEffect: {
            type: hiddenCase?.effectType || domain.DECISION_EFFECT_TYPE, kind: "decision", ownerId: "p1",
            decisionKind: hiddenCase?.choices[0]?.family || "choose_payment",
            payload: { choices: hiddenCase?.choices || [[1, 1], [2, 3]].map(([energyCost, reward]) => ({
              schemaVersion: "seti-standard-action-v1", actionId: `choose_payment:${energyCost}`,
              family: "choose_payment", phase: "conditional", actorId: "p1",
              target: {}, payload: { energyCost, reward },
            })) },
          } };
        },
      };
    },
    effectDomains: [{ create(options) {
      const standard = domain.createStandardActionDomain(options);
      options.runtime.registerExecutor("science_domain_pick_card", {
        getLegalChoices: (_state, effect) => structuredClone(effect.payload.choices),
        resolveDecision(state, _effect, choice) {
          const result = options.executeRegisteredAction(state, choice);
          return { ok: result.ok, nextState: result.nextState };
        },
      });
      return standard;
    }, families: ["move", "choose_payment", "choose_card"],
      options: { actionFamilies: ["move", "choose_payment", "choose_card"] } }],
    createCounterfactualFork(envelope) {
      const fork = createComposition(hiddenCase);
      assert.equal(fork.lifecycle.restore(envelope).ok, true);
      return fork;
    },
  });
}
const composition = createComposition();
const before = composition.lifecycle.save().envelope;
const [result] = composition.counterfactualPort.evaluate(composition.inputPort.enumerateActions(), {
  viewer: { playerId: "p1", role: "player" }, maxNodes: 8, maxExecutionNodes: 16,
  maxFrontierNodes: 8,
  secondaryAgentSearch: { focalSeatId: "p1", maxProxyDepth: 1,
    selectRouteTarget: () => "move:reward", selectSuccessors: ({ legalSuccessors }) => legalSuccessors,
    completesRouteTarget: ({ branchObservation }) => branchObservation.score > 0 },
});
assert.equal(result.status, "settled");
assert.deepEqual(result.leaves.map((leaf) => [leaf.observation.energy, leaf.observation.score]).sort(),
  [[1, 3], [2, 1]], "不同费用和结果的支付选择必须分别执行，不能固定取第一项");
assert.deepEqual(composition.lifecycle.save().envelope, before);
assert.deepEqual(composition.counterfactualPort.getDiagnostics().executedNodeCountByDecisionKind, {
  "move:main": 1,
  [`choose_payment:conditional/decision=choose_payment/effect=${domain.DECISION_EFFECT_TYPE}`]: 2,
}, "无 target.kind 的支付仍按正式 Decision 分类，主行动不能误归入它启动的后继支付");
const [pending] = composition.counterfactualPort.evaluate(composition.inputPort.enumerateActions(), {
  viewer: { playerId: "p1", role: "player" }, maxNodes: 1, maxExecutionNodes: 1,
  maxFrontierNodes: 1,
  secondaryAgentSearch: { focalSeatId: "p1", maxProxyDepth: 2,
    selectRouteTarget: () => "move:reward", selectSuccessors: ({ legalSuccessors }) => legalSuccessors,
    completesRouteTarget: () => true },
});
assert.equal(pending.code, "COUNTERFACTUAL_SEARCH_PRUNED");
assert.equal(pending.leaves.length, 0, "目标标为完成但正式支付未结束，仍不能保留为完成叶");
assert.deepEqual(composition.lifecycle.save().envelope, before);
console.log("search payment choice tests passed");

function payment(id, cardIds, kind = "move-payment") {
  return { schemaVersion: "seti-standard-action-v1", actionId: id,
    family: "choose_payment", phase: "conditional", actorId: "p1",
    target: { kind, cardIds }, payload: { energyCost: 0, reward: 1 } };
}
for (const { choices, allowed, effectType } of [
  { choices: [payment("hidden-move", ["future"])], allowed: [] },
  { choices: [payment("hidden-move", ["future"]), payment("known-move", ["known"]), payment("energy", [])],
    allowed: ["known-move", "energy"] },
  { choices: [payment("hidden-income", ["future"], "discard-hand-cards")], allowed: [] },
  { choices: [{ ...payment("generic-discard", ["future"], "trade-card-selection"), family: "choose_card" }],
    allowed: ["generic-discard"] },
  { choices: [{ ...payment("unknown-reward", ["future"]), family: "choose_card",
      target: { cardInstanceId: "future", publicSlotIndex: 0 }, summary: "未知牌的秘密牌名",
      presentation: { imageSrc: "secret-card.png" } }], allowed: ["unknown-reward"],
    effectType: "science_domain_pick_card" },
]) {
  const hidden = createComposition({ choices, effectType });
  const root = hidden.lifecycle.save().envelope;
  const results = hidden.counterfactualPort.evaluate(hidden.inputPort.enumerateActions(), {
    viewer: { playerId: "p1", role: "player" }, maxNodes: 16, maxExecutionNodes: 16,
    maxFrontierNodes: 16,
    secondaryAgentSearch: { focalSeatId: "p1", maxProxyDepth: 1,
      selectRouteTarget: () => "move:reward", selectSuccessors: ({ legalSuccessors }) => {
        for (const action of legalSuccessors.filter(a => a.actionId === "unknown-reward")) {
          assert.equal(action.target.cardInstanceId, null);
          assert.equal(action.presentation, undefined, "未知牌面展示不能进入选择器");
          assert.ok(!action.summary.includes("秘密牌名"));
        }
        return legalSuccessors;
      },
      completesRouteTarget: ({ branchObservation }) => branchObservation.score > 0 },
  });
  // 自动排空不一定占独立actionChain项，必须检查正式执行写入的支付事实。
  const standard = results.map(result => ({ ...result,
    rootObservation: { ...result.rootObservation, schemaVersion: outcomeModel.OBSERVATION_SCHEMA_VERSION },
    leaves: result.leaves.map(leaf => ({ ...leaf,
      observation: { ...leaf.observation, schemaVersion: outcomeModel.OBSERVATION_SCHEMA_VERSION } })),
  }));
  assert.doesNotThrow(() => outcomeModel.assertOutcomeSet(standard, hidden.inputPort.enumerateActions()));
  assert.throws(() => outcomeModel.assertOutcomeSet(standard.map(result => ({ ...result,
    searchCompleteness: { status: "incomplete", reasons: ["unrecognized-reason"] },
  })), hidden.inputPort.enumerateActions()), /searchCompleteness/);
  const payments = results.flatMap(result => result.leaves || []).map(leaf => leaf.observation.payments);
  assert.ok(results.flatMap(result => result.leaves || []).every(leaf => leaf.status !== "awaiting_input"),
    "普通主行动不能把无安全后继的未结算条件流程作为结果叶");
  assert.ok(payments.every(ids => !ids.includes("hidden-move") && !ids.includes("hidden-income")),
    "新盲抽移动牌不能通过唯一支付自动结算或多选后继进入完成计划");
  for (const id of allowed) {
    assert.ok(payments.some(ids => ids.includes(id)), `支付${id}仍应保留：${JSON.stringify(results)}`);
  }
  assert.deepEqual(hidden.lifecycle.save().envelope, root);
}
console.log("hidden payment boundaries passed");
