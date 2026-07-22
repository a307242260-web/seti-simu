"use strict";

const assert = require("node:assert/strict");
const { createConditionalDecisionDomain } = require("./conditional-decision-domain");
const { createConditionalActionExecutor } = require("./conditional-action-executor");

function createFixture() {
  const root = {
    meta: { stateVersion: 5 },
    match: { decisionVersion: 9 },
    finalScoringState: {},
    techGameState: { board: {}, ui: {} },
    rocketState: { rockets: [] },
    cardState: { publicCards: [] },
    playerState: { currentPlayerId: "move-owner", players: [{
      id: "move-owner",
      resources: { energy: 1 },
      hand: [
        { id: "move-1", discardActionCode: 2 },
        { id: "move-2", discardActionCode: 2 },
      ],
    }] },
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
  const state = {
    finalPending: true,
    probePending: true,
    finalHandlerCalls: [],
    movePaymentCalls: [],
    passReserveCalls: [],
    cardTriggerCalls: [],
    cardTaskCalls: [],
    dataPlacementCalls: [],
    industryMoveCalls: [],
  };
  let contextReads = 0;
  const domain = createConditionalDecisionDomain(() => {
    contextReads += 1;
    const resolved = {
      FINAL_SCORE_IDS: ["a", "b"],
      finalScoring: {
        getNextPendingMarkForPlayer: () => (state.finalPending ? { id: "pending-final" } : null),
        canMarkTile: (_finalState, tileId) => ({ ok: tileId === "a" }),
      },
      getCurrentPlayer: () => finalPlayer,
      getPendingProbeSectorScanDecision: () => (state.probePending ? probePending : null),
      getHeadlessConditionalPlayer: (pending) => pending.player
        || root.playerState.players.find((player) => player.id === pending.playerId)
        || null,
      compositionDecisions: { peek: () => null },
      compositionState: {},
      handleFinalScoreTileClick: (tileId) => {
        state.finalHandlerCalls.push(tileId);
        return { ok: true, progressed: true, tileId };
      },
      getPlayerById: (playerId) => root.playerState.players.find((player) => player.id === playerId) || null,
      cards: { getCardLabel: (card) => card?.label || card?.id || "card" },
      getPendingPassReserveSelection: (workingRoot) => workingRoot.match.passReserveContinuation || null,
      getPassReserveSelectionCards: () => [{ id: "reserve-a", label: "预留 A" }, { id: "reserve-b", label: "预留 B" }],
      confirmPassReserveSelection: (workingRoot, cardId) => {
        state.passReserveCalls.push(cardId);
        delete workingRoot.match.passReserveContinuation;
        return { ok: true, progressed: true };
      },
      getPendingCardTriggerAction: (workingRoot) => workingRoot.match.cardTriggerContinuation || null,
      getPendingCardTaskCompletion: (workingRoot) => workingRoot.match.cardTaskCompletionContinuation || null,
      getPendingCardTriggerFreeMove: (workingRoot) => workingRoot.match.cardTriggerFreeMoveContinuation || null,
      getPendingCardCornerFreeMove: (workingRoot) => workingRoot.match.cardCornerFreeMoveContinuation || null,
      getPendingDataPlacementDecision: (workingRoot) => workingRoot.match.dataPlacementContinuation || null,
      data: {
        listPlaceDataChoices: () => [
          { target: "computer", blueSlot: null, label: "电脑" },
          { target: "blue-tech", blueSlot: 2, label: "蓝色科技" },
        ],
      },
      confirmDataPlacement: (workingRoot, target, blueSlot) => {
        state.dataPlacementCalls.push([target, blueSlot]);
        delete workingRoot.match.dataPlacementContinuation;
        return { ok: true, progressed: true };
      },
      skipPendingDataPlacement: (workingRoot) => {
        state.dataPlacementCalls.push(["skip"]);
        delete workingRoot.match.dataPlacementContinuation;
        return { ok: true, progressed: true, skipped: true };
      },
      handleCardTriggerChoice: (workingRoot, choiceIndex) => {
        state.cardTriggerCalls.push(choiceIndex);
        delete workingRoot.match.cardTriggerContinuation;
        return { ok: true, progressed: true };
      },
      cancelCardTriggerChoice: () => true,
      confirmCardTaskCompletion: (workingRoot, choiceId) => {
        state.cardTaskCalls.push(choiceId);
        delete workingRoot.match.cardTaskCompletionContinuation;
        return { ok: true, progressed: true };
      },
      isMovePaymentCard: (card) => Number(card?.discardActionCode) === 2,
      players: {
        canAfford: (player, cost) => Number(player?.resources?.energy || 0) >= Number(cost?.energy || 0),
      },
      resolveMovePaymentDecision: (_workingRoot, options) => {
        state.movePaymentCalls.push(structuredClone(options));
        delete root.match.movePaymentContinuation;
        return { ok: true, progressed: true };
      },
      rocketActions: {
        getMovableTokensForPlayer: (rocketState, playerId) => rocketState.rockets.filter((rocket) => rocket.playerId === playerId),
        canMoveRocket: () => ({ ok: true }),
      },
      getRequiredMovePointsForUi: () => 1,
      canPayForMove: () => ({ ok: true }),
      formatRocketLabel: (rocket) => `火箭 ${rocket.id}`,
      executeIndustryFreeMove: (workingRoot, deltaX, deltaY, rocketId) => {
        state.industryMoveCalls.push([deltaX, deltaY, rocketId]);
        delete workingRoot.match.industryFreeMoveContinuation;
        return { ok: true, progressed: true };
      },
    };
    return new Proxy(resolved, {
      get(target, property) {
        return property in target ? target[property] : (() => null);
      },
    });
  });
  return { root, finalPlayer, scanPlayer, state, domain, getContextReads: () => contextReads };
}

{
  const fixture = createFixture();
  fixture.state.finalPending = false;
  fixture.state.probePending = false;
  fixture.root.rocketState.rockets = [{ id: 7, playerId: "move-owner" }];
  fixture.root.match.industryFreeMoveContinuation = {
    playerId: "move-owner",
    movesLeft: 1,
    movedRocketIds: [],
    label: "寰宇动力",
  };
  const executor = createConditionalActionExecutor({ domain: fixture.domain });
  const decision = executor.inspect(fixture.root);
  assert.equal(decision.ownerId, "move-owner");
  assert.deepEqual(decision.choices.map((choice) => choice.target.kind), [
    "industry-free-move",
    "industry-free-move",
    "industry-free-move",
    "industry-free-move",
  ]);
  const result = executor.execute(fixture.root, toDescriptor(executor, fixture.root, "choose_target"));
  assert.equal(result.ok, true);
  assert.deepEqual(fixture.state.industryMoveCalls, [[0, 1, 7]]);
}

{
  const fixture = createFixture();
  fixture.state.finalPending = false;
  fixture.state.probePending = false;
  fixture.root.match.passReserveContinuation = { effectId: "pass", playerId: "move-owner", roundNumber: 2 };
  const executor = createConditionalActionExecutor({ domain: fixture.domain });
  const decision = executor.inspect(fixture.root);
  assert.deepEqual(decision.choices.map((choice) => choice.choiceId), ["reserve-a", "reserve-b"]);
  assert.equal(fixture.root.match.passReserveContinuation.selectedCardId, undefined, "规则 continuation 不得保存 UI 选择");
  const result = executor.execute(fixture.root, toDescriptor(executor, fixture.root, "choose_card"));
  assert.equal(result.ok, true);
  assert.deepEqual(fixture.state.passReserveCalls, ["reserve-a"]);
}

{
  const fixture = createFixture();
  fixture.state.finalPending = false;
  fixture.state.probePending = false;
  fixture.root.match.cardTriggerContinuation = {
    playerId: "move-owner",
    matches: [{ card: { id: "card-a" }, effect: { label: "奖励 A" } }],
  };
  const executor = createConditionalActionExecutor({ domain: fixture.domain });
  const decision = executor.inspect(fixture.root);
  assert.deepEqual(decision.choices.map((choice) => choice.target.kind), ["card-trigger", "card-trigger-cancel"]);
  const result = executor.execute(fixture.root, toDescriptor(executor, fixture.root, "choose_branch"));
  assert.equal(result.ok, true);
  assert.deepEqual(fixture.state.cardTriggerCalls, [0]);
}

{
  const fixture = createFixture();
  fixture.state.finalPending = false;
  fixture.state.probePending = false;
  fixture.root.match.cardTaskCompletionContinuation = {
    playerId: "move-owner",
    ready: { card: { id: "task-a" }, effects: [] },
  };
  const executor = createConditionalActionExecutor({ domain: fixture.domain });
  const decision = executor.inspect(fixture.root);
  assert.deepEqual(decision.choices.map((choice) => choice.target.kind), ["card-task-completion"]);
  const result = executor.execute(fixture.root, toDescriptor(executor, fixture.root, "accept_optional_effect"));
  assert.equal(result.ok, true);
  assert.deepEqual(fixture.state.cardTaskCalls, ["confirm"]);
}

{
  const fixture = createFixture();
  fixture.state.finalPending = false;
  fixture.state.probePending = false;
  fixture.root.match.movePaymentContinuation = {
    playerId: "move-owner",
    requiredMovePoints: 2,
    rocketId: 7,
    deltaX: 1,
    deltaY: 0,
  };
  const executor = createConditionalActionExecutor({ domain: fixture.domain });
  const decision = executor.inspect(fixture.root);
  assert.equal(decision.ownerId, "move-owner");
  assert.ok(decision.choices.every((choice) => choice.family === "choose_payment"));
  assert.deepEqual(
    decision.choices.map((choice) => choice.payload.selectedHandIndices),
    [[0], [1], [0, 1]],
    "支付合法项必须只从 Composition continuation 与 working player 枚举",
  );
  const result = executor.execute(fixture.root, toDescriptor(executor, fixture.root, "choose_payment"));
  assert.equal(result.ok, true);
  assert.deepEqual(fixture.state.movePaymentCalls, [{ automated: true, selectedHandIndices: [0] }]);
  assert.equal(fixture.root.match.movePaymentContinuation, undefined);
}

{
  const fixture = createFixture();
  fixture.state.finalPending = false;
  fixture.state.probePending = false;
  fixture.root.match.dataPlacementContinuation = { playerId: "move-owner", resumeKind: "gain-data-reward" };
  const executor = createConditionalActionExecutor({ domain: fixture.domain });
  const decision = executor.inspect(fixture.root);
  assert.deepEqual(decision.choices.map((choice) => choice.target.kind), [
    "pending-data-placement",
    "pending-data-placement",
    "skip-pending-data-placement",
  ]);
  assert.deepEqual(decision.choices[1].target, {
    kind: "pending-data-placement",
    choiceId: "blue-tech:2",
    slotId: "blue-tech",
    blueSlot: 2,
  });
  const result = executor.execute(fixture.root, toDescriptor(executor, fixture.root, "choose_target"));
  assert.equal(result.ok, true);
  assert.deepEqual(fixture.state.dataPlacementCalls, [["computer", null]]);
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
