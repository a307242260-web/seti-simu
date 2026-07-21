"use strict";

const assert = require("node:assert/strict");
const { createConditionalDecisionDomain } = require("./conditional-decision-domain");
const { createConditionalActionExecutor } = require("./conditional-action-executor");

function createFixture() {
  const root = {
    meta: { stateVersion: 5 },
    match: { decisionVersion: 9 },
  };
  const finalPlayer = { id: "final-owner" };
  const scanPlayer = { id: "scan-owner" };
  const probePending = {
    player: scanPlayer,
    choices: [
      { rocket: { id: "rocket-1" } },
      { rocket: { id: "rocket-2" } },
    ],
    effect: { options: { maxTargets: 1 } },
  };
  const state = { finalPending: true, finalHandlerCalls: [] };
  let contextReads = 0;
  const domain = createConditionalDecisionDomain(() => {
    contextReads += 1;
    return {
      browserRuleState: root,
      finalScoringState: {},
      FINAL_SCORE_IDS: ["a", "b"],
      finalScoring: {
        getNextPendingMarkForPlayer: () => (state.finalPending ? { id: "pending-final" } : null),
        canMarkTile: (_finalState, tileId) => ({ ok: tileId === "a" }),
      },
      getCurrentPlayer: () => finalPlayer,
      getPendingProbeSectorScanDecision: () => probePending,
      getHeadlessConditionalPlayer: (pending) => pending.player,
      decisionSessions: { peek: () => null },
      decisionState: {},
      handleFinalScoreTileClick: (tileId) => {
        state.finalHandlerCalls.push(tileId);
        return { ok: true, progressed: true, tileId };
      },
    };
  });
  return { root, finalPlayer, scanPlayer, state, domain, getContextReads: () => contextReads };
}

function toDescriptor(executor, root, family) {
  const decision = executor.inspect(root);
  const option = executor.getOptions(root, family).choices[0];
  return {
    schemaVersion: "seti-standard-action-v1",
    actionId: `${family}:domain-fixture`,
    family,
    phase: "conditional",
    actorId: decision.ownerId,
    stateVersion: decision.stateVersion,
    decisionVersion: decision.decisionVersion,
    target: option.target,
    payload: option.payload,
    decision: option.decision,
  };
}

{
  const fixture = createFixture();
  const executor = createConditionalActionExecutor({ domain: fixture.domain });

  const finalDecision = executor.inspect(fixture.root);
  assert.equal(finalDecision.ownerId, fixture.finalPlayer.id, "最高优先级终局选择必须是唯一 owner");
  assert.equal(finalDecision.stateVersion, 5);
  assert.equal(finalDecision.decisionVersion, 9);
  assert.deepEqual(finalDecision.choices.map((choice) => choice.choiceId), ["a"]);
  assert.deepEqual(finalDecision.followup.handlerIds, ["final-score-tile"]);

  const result = executor.execute(
    fixture.root,
    toDescriptor(executor, fixture.root, "choose_final_scoring"),
  );
  assert.equal(result.ok, true);
  assert.deepEqual(fixture.state.finalHandlerCalls, ["a"], "choice 必须路由到生产 followup handler");

  fixture.state.finalPending = false;
  const scanDecision = executor.inspect(fixture.root);
  assert.equal(scanDecision.ownerId, fixture.scanPlayer.id, "高优先级结束后才可暴露扫描 owner");
  assert.deepEqual(scanDecision.choices.map((choice) => choice.choiceId), ["rocket-1", "rocket-2"]);
  assert.deepEqual(scanDecision.followup.handlerIds, ["probe-sector-selection"]);
  assert.equal(fixture.getContextReads(), 1, "显式 domain context 应只解析一次");
}

{
  const fixture = createFixture();
  const choice = {
    choiceId: "unknown",
    family: "choose_target",
    target: { kind: "not-migrated", choiceId: "unknown" },
    payload: { marker: "must-not-run" },
    followup: { kind: "choice_handler", handlerId: "not-migrated" },
  };
  const before = structuredClone(fixture.root);
  const result = fixture.domain.executeChoice(fixture.root, choice, { choices: [choice] });
  assert.equal(result.ok, false);
  assert.equal(result.code, "CONDITIONAL_FOLLOWUP_UNMIGRATED");
  assert.deepEqual(fixture.root, before, "未知 followup 必须在 mutation 前 fail-closed");
  assert.deepEqual(fixture.state.finalHandlerCalls, []);
}

console.log("conditional decision domain behavior tests passed");
