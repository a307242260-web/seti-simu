"use strict";

const assert = require("node:assert/strict");
const { createConditionalDecisionDomain, createConditionalPlayerResolver } = require("./conditional-decision-domain");
const { createConditionalActionExecutor } = require("./conditional-action-executor");
const { createBrowserPendingDecisionOwner } = require("../game/effects/browser-pending-decision");

{
  const fallback = { id: "fallback" };
  const resolver = createConditionalPlayerResolver({
    resolvePlayerReference: (_root, reference) => reference.playerId === "p1" ? { id: "p1" } : null,
    getEffectOwnerPlayer: () => null,
    getCurrentPlayer: () => fallback,
  });
  assert.equal(resolver({}, { playerId: "p1" }).id, "p1");
  assert.equal(resolver({}, {}).id, "fallback");
}

{
  const root = { marker: "unchanged" };
  const owner = createBrowserPendingDecisionOwner({
    inspectSession: () => ({ phase: "idle" }),
    enumerate: (_workingRoot, kind, pending) => ({
      actorPlayer: { id: pending.playerId },
      candidates: [{
        family: "choose_reward",
        target: { kind: `${kind}-choice`, choiceId: "a" },
      }],
    }),
  });
  const opened = owner.runRuleTransaction(root, () => {
    owner.open(root, "strategy_slot", { playerId: "p1", slotIds: ["top"] });
    return owner.takeOpenedDecisionEffect();
  });
  assert.equal(opened.ownerId, "p1");
  assert.equal(opened.payload.choices[0].decisionContext.kind, "strategy_slot");
  assert.deepEqual(root, { marker: "unchanged" }, "DecisionEffect 打开不得把 pending 复制进 working root");
  const deferred = owner.runRuleTransaction(root, () => {
    owner.defer(root, "turn_end_reveal", { playerId: "p1", didPass: true });
    return owner.takeDeferredDecisionEffects();
  });
  assert.equal(deferred.length, 1);
  assert.equal(deferred[0].payload.choices[0].decisionContext.kind, "turn_end_reveal");
  assert.deepEqual(root, { marker: "unchanged" }, "deferred Decision 也不得把续体复制进 working root");
  assert.throws(
    () => owner.runRuleTransaction(root, () => owner.open(root, "legacy-industry", { playerId: "p1" })),
    /不支持的 browser pending Decision/,
  );
  assert.deepEqual(root, { marker: "unchanged" }, "未知旧类型必须 fail-closed 且零污染");
}

{
  const fixture = createFixture();
  fixture.state.finalPending = false;
  fixture.state.probePending = false;
  fixture.domain.describePendingDecision(fixture.root, "pirates_raid", {
    playerId: "move-owner",
    planetId: "earth",
  });
  const turnEnd = fixture.domain.describePendingDecision(fixture.root, "turn_end_reveal", {
    playerId: "move-owner",
    endingPlayerId: "move-owner",
    didPass: true,
  });
  assert.equal(turnEnd.actorPlayer.id, "move-owner");
  assert.deepEqual(turnEnd.candidates.map((choice) => choice.target.kind), ["turn-end-reveal-confirm"]);
}

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
      techState: { ownedTiles: {}, disabledTiles: {} },
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
    discardCalls: [],
    landCalls: [],
    traceCalls: [],
    alienPicker: null,
    industryMoveCalls: [],
    strategyCalls: [],
    techCalls: [],
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
      getSimulationConditionalPlayer: (_workingRoot, pending) => pending.player
        || root.playerState.players.find((player) => player.id === pending.playerId)
        || null,
      handleFinalScoreTileClick: (tileId) => {
        state.finalHandlerCalls.push(tileId);
        return { ok: true, progressed: true, tileId };
      },
      getPlayerById: (_workingRoot, playerId) => root.playerState.players.find((player) => player.id === playerId) || null,
      cards: { getCardLabel: (card) => card?.label || card?.id || "card" },
      getPendingPassReserveSelection: () => null,
      getPassReserveSelectionCards: () => [{ id: "reserve-a", label: "预留 A" }, { id: "reserve-b", label: "预留 B" }],
      confirmPassReserveSelection: (workingRoot, cardId) => {
        state.passReserveCalls.push(cardId);
        return { ok: true, progressed: true };
      },
      data: {
        listPlaceDataChoices: () => [
          { target: "computer", blueSlot: null, label: "电脑" },
          { target: "blue-tech", blueSlot: 2, label: "蓝色科技" },
        ],
      },
      confirmDataPlacement: (workingRoot, target, blueSlot) => {
        state.dataPlacementCalls.push([target, blueSlot]);
        return { ok: true, progressed: true };
      },
      skipPendingDataPlacement: (workingRoot) => {
        state.dataPlacementCalls.push(["skip"]);
        return { ok: true, progressed: true, skipped: true };
      },
      finalizePendingDiscardSelection: (_workingRoot, handIndexes) => {
        state.discardCalls.push([...handIndexes]);
        return { ok: true, progressed: true };
      },
      cancelDiscardSelection: () => {
        return { ok: true, progressed: true, skipped: true };
      },
      getAlienTracePickerState: () => state.alienPicker,
      getAlienTraceChoiceSlotIds: (_workingRoot, allowed) => allowed || [1],
      canPlaceStateTrace: () => true,
      aliens: {
        TRACE_TYPES: ["yellow"],
        getAlienSlotLabel: (slotId) => `外星人 ${slotId}`,
        getTraceTypeLabel: (traceType) => traceType,
      },
      handleStateTraceSlotPlacement: (workingRoot, slotId, traceType) => {
        state.traceCalls.push([slotId, traceType]);
        return { ok: true, progressed: true };
      },
      confirmLandTargetChoice: (workingRoot, choiceIndex) => {
        state.landCalls.push(choiceIndex);
        return { ok: true, progressed: true };
      },
      isTechTilePickingActive: (workingRoot) => Boolean(workingRoot.techGameState.ui.techSelectionActive),
      getResearchTechSelectionOptions: () => ({}),
      isTechTileOwnedByOtherPlayer: () => false,
      tech: {
        listTakeableTiles: () => ["orange1", "purple1"],
        getAvailableBlueSlots: () => [],
      },
      industry: {
        isTechBlockedByPirates: () => false,
      },
      handleSupplyTechTileClick: (workingRoot, tileId) => {
        state.techCalls.push([workingRoot, tileId]);
        workingRoot.techGameState.ui.techSelectionActive = false;
        return { ok: true, progressed: true, tileId };
      },
      confirmIndustryTuringBorrow: (workingRoot, tileId) => {
        state.techCalls.push([workingRoot, tileId]);
        workingRoot.techGameState.ui.techSelectionActive = false;
        return { ok: true, progressed: true, tileId };
      },
      cancelIndustryAbilityFlow: () => ({ ok: true }),
      confirmStrategyPassiveSlotChoice: (_workingRoot, slotId, pending) => {
        state.strategyCalls.push(["confirm", slotId, pending.effectId]);
        return { ok: true, progressed: true };
      },
      cancelStrategyPassiveSlotChoice: () => {
        state.strategyCalls.push(["cancel"]);
      },
      handleCardTriggerChoice: (_workingRoot, choiceIndex, pending) => {
        state.cardTriggerCalls.push(choiceIndex);
        assert.equal(pending.matches[choiceIndex].effect.label, "奖励 A");
        return { ok: true, progressed: true };
      },
      cancelCardTriggerChoice: () => true,
      confirmCardTaskCompletion: (_workingRoot, choiceId, options) => {
        state.cardTaskCalls.push(choiceId);
        assert.equal(options.pending.ready.card.id, "task-a");
        return { ok: true, progressed: true };
      },
      isMovePaymentCard: (card) => Number(card?.discardActionCode) === 2,
      players: {
        canAfford: (player, cost) => Number(player?.resources?.energy || 0) >= Number(cost?.energy || 0),
      },
      resolveMovePaymentDecision: (_workingRoot, options) => {
        state.movePaymentCalls.push(structuredClone(options));
        return { ok: true, progressed: true };
      },
      rocketActions: {
        getMovableTokensForPlayer: (rocketState, playerId) => rocketState.rockets.filter((rocket) => rocket.playerId === playerId),
        canMoveRocket: () => ({ ok: true }),
      },
      getRequiredMovePointsForUi: () => 1,
      canPayForMove: () => ({ ok: true }),
      formatRocketLabel: (rocket) => `火箭 ${rocket.id}`,
      executeIndustryFreeMove: (_workingRoot, deltaX, deltaY, rocketId) => {
        state.industryMoveCalls.push([deltaX, deltaY, rocketId]);
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

function describeSessionDecision(domain, workingRoot, kind, pending) {
  const described = domain.describePendingDecision(workingRoot, kind, pending);
  return {
    ...described,
    candidates: described.candidates.map((choice) => ({
      ...choice,
      decisionContext: { kind, pending: structuredClone(pending) },
    })),
  };
}

{
  const fixture = createFixture();
  fixture.state.finalPending = false;
  fixture.state.probePending = false;
  const pending = {
    playerId: "move-owner",
    flowType: "turing_borrow_tech",
  };
  fixture.root.techGameState.ui = {
    techSelectionActive: true,
    selectedTileId: null,
    pendingTileId: null,
    allowedTechTypes: ["orange", "purple"],
  };
  const executor = createConditionalActionExecutor({ domain: fixture.domain });
  const decision = describeSessionDecision(fixture.domain, fixture.root, "industry_ability", pending);
  assert.equal(decision.actorPlayer.id, "move-owner");
  assert.deepEqual(
    decision.candidates.filter((choice) => choice.target.kind === "research-tech-tile")
      .map((choice) => choice.target.tileId),
    ["orange1", "purple1"],
  );
  const result = executor.executeEffectChoice(fixture.root, decision.candidates[0]);
  assert.equal(result.ok, true);
  assert.equal(fixture.state.techCalls.length, 1);
  assert.equal(fixture.state.techCalls[0][0], fixture.root, "科技 Decision 必须沿用同一 Composition workingRoot");
  assert.equal(fixture.state.techCalls[0][1], "orange1");
}

{
  const fixture = createFixture();
  fixture.state.finalPending = false;
  fixture.state.probePending = false;
  const pending = {
    playerId: "move-owner",
    type: "land_target",
    resumeKind: "main-planet-action",
    actionType: "land",
    choices: [
      { label: "环绕", kind: "orbit", rocketId: 7 },
      { label: "登陆", kind: "land", target: "mars", rocketId: 7 },
    ],
  };
  assert.doesNotThrow(() => JSON.stringify(pending));
  const executor = createConditionalActionExecutor({ domain: fixture.domain });
  const decision = describeSessionDecision(fixture.domain, fixture.root, "land_target", pending);
  assert.equal(decision.actorPlayer.id, "move-owner");
  assert.deepEqual(decision.candidates.map((choice) => choice.target), [
    { kind: "land-target", choiceId: "0", planetId: null, rocketId: 7 },
    { kind: "land-target", choiceId: "1", planetId: "mars", rocketId: 7 },
  ]);
  const result = executor.executeEffectChoice(fixture.root, decision.candidates[0]);
  assert.equal(result.ok, true);
  assert.deepEqual(fixture.state.landCalls, [0]);
}

{
  const fixture = createFixture();
  fixture.state.finalPending = false;
  fixture.state.probePending = false;
  const pending = {
    playerId: "move-owner",
    type: "pass_hand_limit",
    count: 2,
    required: true,
  };
  const decision = fixture.domain.describePendingDecision(fixture.root, "discard", pending);
  assert.equal(decision.actorPlayer.id, "move-owner");
  assert.deepEqual(decision.candidates.map((choice) => choice.target), [{
    kind: "discard-hand-cards",
    choiceId: "0+1",
    handIndexes: [0, 1],
    cardIds: ["move-1", "move-2"],
  }]);
}

{
  const fixture = createFixture();
  fixture.state.finalPending = false;
  fixture.state.probePending = false;
  fixture.root.rocketState.rockets = [{ id: 7, playerId: "move-owner" }];
  const pending = {
    playerId: "move-owner",
    movesLeft: 1,
    movedRocketIds: [],
    label: "寰宇动力",
  };
  const executor = createConditionalActionExecutor({ domain: fixture.domain });
  const decision = describeSessionDecision(fixture.domain, fixture.root, "industry_free_move", pending);
  assert.equal(decision.actorPlayer.id, "move-owner");
  assert.deepEqual(decision.candidates.map((choice) => choice.target.kind), [
    "industry-free-move",
    "industry-free-move",
    "industry-free-move",
    "industry-free-move",
  ]);
  const result = executor.executeEffectChoice(fixture.root, decision.candidates[0]);
  assert.equal(result.ok, true);
  assert.deepEqual(fixture.state.industryMoveCalls, [[0, 1, 7]]);
}

{
  const fixture = createFixture();
  fixture.state.finalPending = false;
  fixture.state.probePending = false;
  const pending = {
    effectId: "strategy-effect",
    playerId: "move-owner",
    slotIds: ["top", "bottom"],
  };
  const executor = createConditionalActionExecutor({ domain: fixture.domain });
  const decision = describeSessionDecision(fixture.domain, fixture.root, "strategy_slot", pending);
  assert.deepEqual(decision.candidates.map((choice) => choice.target.kind), [
    "strategy-passive-slot",
    "strategy-passive-slot",
    "cancel-strategy-passive-slot",
  ]);
  assert.equal(executor.executeEffectChoice(fixture.root, decision.candidates[0]).ok, true);
  assert.deepEqual(fixture.state.strategyCalls, [["confirm", "top", "strategy-effect"]]);
  assert.equal(executor.executeEffectChoice(fixture.root, decision.candidates[2]).ok, true);
  assert.deepEqual(fixture.state.strategyCalls.at(-1), ["cancel"]);
}

{
  const fixture = createFixture();
  fixture.state.finalPending = false;
  fixture.state.probePending = false;
  const decision = fixture.domain.describePendingDecision(fixture.root, "pass_reserve", {
    effectId: "pass",
    playerId: "move-owner",
    roundNumber: 2,
  });
  assert.deepEqual(decision.candidates.map((choice) => choice.target.choiceId), ["reserve-a", "reserve-b"]);
}

{
  const fixture = createFixture();
  fixture.state.finalPending = false;
  fixture.state.probePending = false;
  fixture.root.rocketState.rockets = [{ id: 7, playerId: "move-owner" }];
  const pendingByKind = {
    scan_target: {
      playerId: "move-owner",
      type: "sector_scan",
      choices: [{ nebulaId: "n1", sectorX: 3, label: "星云 1" }],
    },
    public_scan: {
      playerId: "move-owner",
      type: "public_scan",
      choices: [{ nebulaId: "n2", sectorX: 4, label: "星云 2" }],
      publicScanQueue: { currentIndex: 0, items: [{ cardId: "public-1" }] },
    },
    scan_free_move: { playerId: "move-owner" },
    probe_sector_scan: {
      playerId: "move-owner",
      choices: [{ rocket: { id: 7 } }],
      effect: { options: { maxTargets: 1 } },
    },
    probe_location_reward: {
      playerId: "move-owner",
      choices: [{ rocket: { id: 7 } }],
    },
    card_trigger: {
      playerId: "move-owner",
      matches: [{ card: { id: "card-a" }, effect: { label: "奖励 A" } }],
    },
    card_task_completion: {
      playerId: "move-owner",
      ready: { card: { id: "task-a" }, effects: [] },
    },
    card_trigger_free_move: {
      playerId: "move-owner",
      match: { effect: { options: { movementPoints: 1 } } },
    },
    card_move: { playerId: "move-owner", poolRemaining: 1, moved: false },
    card_corner_free_move: {
      playerId: "move-owner",
      action: { label: "免费移动", movementPoints: 1 },
    },
  };
  const targetKinds = Object.fromEntries(Object.entries(pendingByKind).map(([kind, pending]) => [
    kind,
    fixture.domain.describePendingDecision(fixture.root, kind, pending)
      .candidates.map((choice) => choice.target.kind),
  ]));
  assert.deepEqual(targetKinds, {
    scan_target: ["sector-scan-target"],
    public_scan: ["scan-target"],
    scan_free_move: ["scan-free-move", "scan-free-move", "scan-free-move", "scan-free-move"],
    probe_sector_scan: ["probe-sector-selection"],
    probe_location_reward: ["probe-location-reward"],
    card_trigger: ["card-trigger", "card-trigger-cancel"],
    card_task_completion: ["card-task-completion"],
    card_trigger_free_move: ["skip-card-trigger-free-move"],
    card_move: ["skip-card-effect-move"],
    card_corner_free_move: ["skip-card-corner-free-move"],
  }, "扫描、公共扫描、免费移动与两类探测必须完全由 Session legal choices 枚举");
  const actionChoice = fixture.domain.describePendingDecision(fixture.root, "scan_free_move", {
    stage: "action_choice",
    playerId: "move-owner",
    choices: ["launch", "move", "skip"],
  });
  assert.deepEqual(actionChoice.candidates.map((choice) => choice.target.kind), [
    "scan-action-launch",
    "scan-action-move",
    "scan-action-skip",
  ], "扫描 4 的发射/移动分支也必须进入同一 Session Decision 链");
}

{
  const fixture = createFixture();
  fixture.state.finalPending = false;
  fixture.state.probePending = false;
  const pending = {
    playerId: "move-owner",
    matches: [{ card: { id: "card-a" }, effect: { label: "奖励 A" } }],
  };
  const executor = createConditionalActionExecutor({ domain: {
    describeDecision: (workingRoot) => describeSessionDecision(
      fixture.domain,
      workingRoot,
      "card_trigger",
      pending,
    ),
    executeChoice: (...args) => fixture.domain.executeChoice(...args),
  } });
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
  const pending = {
    playerId: "move-owner",
    ready: { card: { id: "task-a" }, effects: [] },
  };
  const executor = createConditionalActionExecutor({ domain: {
    describeDecision: (workingRoot) => describeSessionDecision(
      fixture.domain,
      workingRoot,
      "card_task_completion",
      pending,
    ),
    executeChoice: (...args) => fixture.domain.executeChoice(...args),
  } });
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
  const pending = {
    playerId: "move-owner",
    requiredMovePoints: 2,
    rocketId: 7,
    deltaX: 1,
    deltaY: 0,
  };
  const decision = fixture.domain.describePendingDecision(fixture.root, "move_payment", pending);
  assert.equal(decision.actorPlayer.id, "move-owner");
  assert.ok(decision.candidates.every((choice) => choice.family === "choose_payment"));
  assert.deepEqual(
    decision.candidates.map((choice) => choice.selectedHandIndices),
    [[0], [1], [0, 1]],
    "支付合法项必须只从 Decision payload 与 working player 枚举",
  );
}

{
  const fixture = createFixture();
  fixture.state.finalPending = false;
  fixture.state.probePending = false;
  const pending = { playerId: "move-owner", resumeKind: "gain-data-reward" };
  const executor = createConditionalActionExecutor({ domain: fixture.domain });
  const decision = describeSessionDecision(fixture.domain, fixture.root, "data_placement", pending);
  assert.deepEqual(decision.candidates.map((choice) => choice.target.kind), [
    "pending-data-placement",
    "pending-data-placement",
    "skip-pending-data-placement",
  ]);
  assert.deepEqual(decision.candidates[1].target, {
    kind: "pending-data-placement",
    choiceId: "blue-tech:2",
    slotId: "blue-tech",
    blueSlot: 2,
  });
  const result = executor.executeEffectChoice(fixture.root, decision.candidates[0]);
  assert.equal(result.ok, true);
  assert.deepEqual(fixture.state.dataPlacementCalls, [["computer", null]]);
}

{
  const fixture = createFixture();
  fixture.state.finalPending = false;
  fixture.state.probePending = false;
  const pending = { playerId: "move-owner", targetPlayerId: "move-owner" };
  fixture.state.alienPicker = {
    mode: "trace-board",
    playerId: "move-owner",
    targetPlayerId: "move-owner",
    allowedAlienSlotIds: [1],
    allowedTraceTypes: ["yellow"],
  };
  const executor = createConditionalActionExecutor({ domain: fixture.domain });
  const decision = describeSessionDecision(fixture.domain, fixture.root, "alien_trace", pending);
  assert.deepEqual(decision.candidates.map((choice) => choice.target.kind), ["alien-state-trace"]);
  const result = executor.executeEffectChoice(fixture.root, decision.candidates[0]);
  assert.equal(result.ok, true);
  assert.deepEqual(fixture.state.traceCalls, [[1, "yellow"]]);
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
  const scanDecision = fixture.domain.describePendingDecision(
    fixture.root,
    "probe_sector_scan",
    {
      player: fixture.scanPlayer,
      choices: [
        { rocket: { id: "rocket-1" } },
        { rocket: { id: "rocket-2" } },
      ],
      effect: { options: { maxTargets: 1 } },
    },
  );
  assert.equal(scanDecision.actorPlayer.id, fixture.scanPlayer.id, "扫描 DecisionEffect 必须保留唯一 owner");
  assert.deepEqual(scanDecision.candidates.map((choice) => choice.target.choiceId), ["rocket-1", "rocket-2"]);
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
