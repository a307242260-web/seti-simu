"use strict";
const assert = require("node:assert/strict");
const stateStoreApi = require("../state/state-store");
const effectRuntimeApi = require("./session-runtime");
const domain = require("./standard-action-session");
const { createRuleComposition } = require("../rule-composition");

// 只验证搜索宏步/目标边界，不替代正式扫描收益测试。
function createComposition(hidden = false) {
  const families = ["place_data", "choose_target", "scan"];
  return createRuleComposition({
    stateStoreApi, effectRuntimeApi,
    createInitialState: () => stateStoreApi.createCommittedGameState({
      gameId: "placement-boundary", rulesetVersion: "test-v1", seed: 17,
      rngState: {}, sequences: {}, match: { placed: 0, scanned: false },
      turn: { currentPlayerId: "p1" }, players: {}, solarSystem: {}, pieces: {},
      planets: {}, data: {}, cards: {}, tech: {}, aliens: {}, finalScoring: {},
    }),
    projectState: root => ({ ...root.match }),
    createActionRegistry() {
      function action(root, family, conditional = false) {
        return { schemaVersion: "seti-standard-action-v1", family,
          actionId: `${family}:${root.meta.stateVersion}`, actorId: "p1",
          stateVersion: root.meta.stateVersion, decisionVersion: 0,
          phase: conditional ? "conditional" : "main",
          target: conditional ? { target: "computer", choiceId: "data:computer" } : {}, payload: {} };
      }
      return {
        enumerate: root => root.match.scanned ? [] : [
          ...(root.match.placed < 2 ? [action(root, "place_data")] : []),
          ...(root.match.placed ? [action(root, "scan")] : []),
        ],
        validate: () => ({ ok: true }),
        execute(root, current) {
          if (current.family === "choose_target") {
            root.match.placed += 1;
            return { ok: true, ...(hidden ? { irreversible: { code: "hidden_card_draw" } } : {}) };
          }
          if (current.family === "scan") {
            root.match.scanned = true;
            return { ok: true };
          }
          return { ok: true, decisionEffect: {
            type: domain.DECISION_EFFECT_TYPE, kind: "decision", ownerId: "p1",
            decisionKind: "choose_target", payload: { choices: [action(root, "choose_target", true)] },
          } };
        },
      };
    },
    effectDomains: [{ create: domain.createStandardActionDomain, families,
      options: { actionFamilies: families } }],
    createCounterfactualFork(envelope) {
      const fork = createComposition(hidden);
      assert.equal(fork.lifecycle.restore(envelope).ok, true);
      return fork;
    },
  });
}

for (const mode of ["branch", "unique", "complete", "mixed", "rebind", "hidden", "failure"]) {
  const composition = createComposition(mode === "hidden");
  const before = composition.lifecycle.save().envelope;
  const actions = composition.inputPort.enumerateActions();
  const targets = mode === "mixed" ? ["scan", "fill"] : [mode === "branch" ? "scan" : "fill"];
  const [outcome] = composition.counterfactualPort.evaluate(actions, {
    viewer: { role: "player", playerId: "p1" },
    maxNodes: 16, maxExecutionNodes: 16, maxFrontierNodes: 8,
    secondaryAgentSearch: {
      focalSeatId: "p1", maxProxyDepth: 1,
      selectRootTargets: () => targets.map(targetId => ({ targetId, planId: targetId,
        compatibleActionIds: actions.map(action => action.actionId) })),
      completesRouteTarget: ({ targetId, branchObservation: state }) => targetId === "scan"
        ? state.scanned : state.placed >= (mode === "complete" ? 1 : 2),
      selectSuccessors({ routeTargetId, legalSuccessors, branchObservation }) {
        if (mode === "failure") throw Object.assign(new Error("placement selector failed"), {
          code: "PLACEMENT_SELECTOR_FAILED",
        });
        const chosen = routeTargetId === "scan" ? legalSuccessors
          : legalSuccessors.filter(action => action.family === "place_data");
        return chosen.map(action => mode === "rebind" && branchObservation.placed === 1
          ? { ...action, routeTargetId: "new-fill", routePlanId: "new-fill" } : action);
      },
    },
  });
  const diagnostics = composition.counterfactualPort.getDiagnostics();
  if (mode === "failure") {
    assert.equal(diagnostics.failedNodeCountByCode.PLACEMENT_SELECTOR_FAILED, 1);
    assert.equal(outcome.leaves.length, 0);
  } else {
    assert.deepEqual(diagnostics.failedNodeCountByCode, {});
    assert.equal(outcome.status, "settled", mode);
    if (["branch", "mixed"].includes(mode)) {
      assert.deepEqual([...new Set(outcome.leaves.filter(leaf => leaf.observation.scanned)
        .map(leaf => leaf.observation.placed))].sort(), [1, 2],
      `${mode}: 一次放置后的扫描分叉不得被另一条续填路线吞掉`);
    }
    if (mode === "mixed") assert.ok(outcome.leaves.some(leaf => leaf.rootRouteTargetId === "fill"
      && leaf.observation.placed === 2 && !leaf.observation.scanned));
    if (mode === "unique") {
      assert.equal(diagnostics.executedNodeCount, 1, "唯一目标续填保留一个宏节点");
      assert.equal(diagnostics.successfulInputSubmissionCount, 4, "每个Action与选位仍独立正式提交");
    }
    if (mode === "complete") {
      assert.equal(outcome.leaves[0].observation.placed, 1, "完成边界不能被合法续填越过");
      assert.equal(diagnostics.successfulInputSubmissionCount, 2);
    }
    if (["rebind", "hidden"].includes(mode)) {
      assert.equal(diagnostics.executedNodeCount, 2, `${mode}: 在独立节点处理续填`);
      assert.equal(outcome.leaves[0].observation.placed, 2);
    }
  }
  assert.deepEqual(composition.lifecycle.save().envelope, before, `${mode}: 正式根、RNG与序列不可变`);
  composition.dispose();
}
console.log("search placement boundary tests passed");
