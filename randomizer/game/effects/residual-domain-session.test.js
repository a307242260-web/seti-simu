"use strict";

const assert = require("node:assert/strict");
const residual = require("./residual-domain-session");
const probeTurn = require("./probe-turn-session");
const finalScoring = require("../final-scoring");
const cardEffects = require("../cards/effects");
const aliens = require("../aliens");

function createRoot() {
  const taskCard = { id: "task-b1", cardId: "b_1.webp" };
  cardEffects.ensureCardEffectState(taskCard);
  return {
    meta: {
      stateVersion: 3,
      seed: "seti-163-residual-proof",
      rngState: {},
      cardInstanceSequence: 0,
      logicalTime: "2026-07-24T00:00:00.000Z",
    },
    match: { decisionVersion: 7 },
    playerState: {
      currentPlayerId: "p1",
      players: [
        {
          id: "p1",
          color: "white",
          colorLabel: "白色",
          initialSelection: { industry: { label: "哨兵探测网络" } },
          hand: [],
          reservedCards: [taskCard],
          resources: { credits: 5, energy: 5, publicity: 0, score: 30 },
          income: { credits: 1, energy: 1, publicity: 0, availableData: 0, handSize: 0 },
          scoreSources: { scanScore: 30 },
          techState: { ownedTiles: {}, disabledTiles: {}, blueBoardSlots: {} },
          mainActionCompleted: false,
          passCompletionPending: false,
        },
        {
          id: "p2",
          color: "brown",
          colorLabel: "棕色",
          hand: [],
          reservedCards: [],
          resources: { credits: 4, energy: 4, publicity: 0, score: 10 },
          income: { credits: 1, energy: 1, publicity: 0, availableData: 0, handSize: 0 },
          scoreSources: { orbitScore: 10 },
          techState: { ownedTiles: {}, disabledTiles: {}, blueBoardSlots: {} },
          mainActionCompleted: false,
          passCompletionPending: false,
        },
      ],
    },
    turnState: {
      roundNumber: 4,
      turnNumber: 3,
      actionCycleNumber: 2,
      currentPlayerId: "p1",
      startPlayerId: "p1",
      activePlayerIds: ["p1", "p2"],
      turnOrderPlayerIds: ["p1", "p2"],
      passedPlayerIds: ["p1"],
      completedTurnPlayerIds: [],
      cardTurnEventBonuses: [],
      visitedPlanetsByPlayerId: {},
    },
    cardState: { publicCards: [], drawPile: [], discardPile: [] },
    alienGameState: {},
    finalScoringState: finalScoring.createFinalScoringState(),
    rocketState: { rockets: [], statusNote: "" },
    solarState: {},
    planetStatsState: {},
    nebulaDataState: {
      sectorSettlements: {
        winsByPlayerId: {
          p1: [{ sectorId: "sector-4-a" }, { sectorId: "sector-3-a" }],
        },
      },
    },
    techGameState: { board: { stacks: {} }, ui: {} },
  };
}

function createHarness(module, createDomain) {
  const executors = new Map();
  const domain = module[createDomain]({
    runtime: {
      registerExecutor(type, executor) {
        executors.set(type, typeof executor === "function" ? { execute: executor } : executor);
      },
    },
    commitWorkingState(_state, context) {
      return { committedBy: context.source };
    },
  });
  return { domain, executors };
}

function execute(executor, root, effect) {
  return executor.execute(root, effect, { workingRoot: root });
}

function settleFinalMarkEffects(owner, root, spawnedEffects) {
  const queue = [...(spawnedEffects || [])];
  while (queue.length) {
    const effect = queue.shift().effect;
    if (effect.type !== residual.EFFECT_TYPES.FINAL_MARK) continue;
    const executor = owner.executors.get(residual.EFFECT_TYPES.FINAL_MARK);
    const selected = executor.getLegalChoices(root, effect, { workingRoot: root })[0];
    assert.ok(selected, "终局标记必须有正式合法选择");
    const settled = executor.resolveDecision(root, effect, selected, { workingRoot: root });
    assert.equal(settled.ok, true);
    queue.push(...(settled.spawnedEffects || []));
  }
}

(function proofConsumesRealSeti160HandoffsByEffectType() {
  const root = createRoot();
  root.turnState.roundNumber = 3;
  root.playerState.players[0].mainActionCompleted = true;
  const probe = createHarness(probeTurn, "createProbeTurnDomain");
  const owner = createHarness(residual, "createResidualDomain");
  const endTurn = execute(probe.executors.get(probeTurn.EFFECT_TYPES.EXECUTE), root, {
    ownerId: "p1",
    payload: {
      action: {
        schemaVersion: "seti-standard-action-v1",
        actionId: "end-turn:p1",
        family: "end_turn",
        actorId: "p1",
        target: { kind: "end-turn" },
        payload: {},
      },
    },
  });
  const handoffs = endTurn.spawnedEffects
    .map((entry) => entry.effect)
    .filter((effect) => effect.type === probeTurn.DOMAIN_HANDOFF_EFFECT_TYPE);
  assert.deepEqual(handoffs.map((effect) => (
    `${effect.payload.domain}:${effect.payload.effectType}`
  )), [
    "income:pass_income", "alien:turn_end_reveal",
    "company:turn_end", "card_trigger:turn_end",
  ]);
  for (const handoff of handoffs) {
    assert.equal(execute(owner.executors.get(residual.HANDOFF_TYPE), root, handoff).ok, true);
  }
  assert.equal(root.playerState.players[0].resources.credits, 6);
})();

(function proofConsumesRealRoundTransitionAndGameEndSequence() {
  for (const [roundNumber, expected] of [
    [3, ["card_trigger:round_transition", "company:round_start"]],
    [4, ["final_scoring:game_end"]],
  ]) {
    const root = createRoot();
    root.turnState.roundNumber = roundNumber;
    root.turnState.passedPlayerIds = ["p2"];
    root.playerState.players[0].passCompletionPending = true;
    const probe = createHarness(probeTurn, "createProbeTurnDomain");
    const owner = createHarness(residual, "createResidualDomain");
    const advanced = execute(
      probe.executors.get(probeTurn.EFFECT_TYPES.TURN_ADVANCE),
      root,
      { ownerId: "p1", payload: { didPass: true } },
    );
    const handoffs = advanced.spawnedEffects.map((entry) => entry.effect);
    assert.deepEqual(handoffs.map((effect) => (
      `${effect.payload.domain}:${effect.payload.effectType}`
    )), expected);
    for (const handoff of handoffs) {
      const settled = execute(owner.executors.get(residual.HANDOFF_TYPE), root, handoff);
      assert.equal(settled.ok, true);
      settleFinalMarkEffects(owner, root, settled.spawnedEffects);
    }
    if (roundNumber === 4) {
      assert.equal(root.playerState.players.every((player) => Number.isFinite(player.finalScore)), true);
    }
  }
})();

(function proofIndustryIsQuickAndZeroDecisionFlowCompletes() {
  const root = createRoot();
  root.turnState.passedPlayerIds = [];
  const owner = createHarness(residual, "createResidualDomain");
  const result = execute(owner.executors.get(residual.EFFECT_TYPES.EXECUTE), root, {
    ownerId: "p1",
    payload: {
      action: {
        schemaVersion: "seti-standard-action-v1",
        actionId: "industry:sentinel",
        family: "industry",
        actorId: "p1",
        target: {
          companyId: "哨兵探测网络",
          abilityId: "sentinel_arm_play_corner",
        },
        payload: {},
      },
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.spawnedEffects.length, 0);
  assert.equal(root.playerState.players[0].mainActionCompleted, false);
  assert.equal(root.playerState.players[0].industrySentinelArmedRound, 4);
})();

(function proofTurnEndCardTaskRunsInProductionOwner() {
  const root = createRoot();
  const owner = createHarness(residual, "createResidualDomain");
  const handoff = {
    type: residual.HANDOFF_TYPE,
    kind: "effect",
    ownerId: "p1",
    payload: {
      schemaVersion: residual.HANDOFF_SCHEMA,
      domain: "card_trigger",
      effectType: "turn_end",
      data: { roundNumber: 4, turnNumber: 3 },
    },
  };
  const started = execute(owner.executors.get(residual.HANDOFF_TYPE), root, handoff);
  assert.equal(started.ok, true);
  assert.equal(started.spawnedEffects.length, 1);
  const taskEffect = started.spawnedEffects[0].effect;
  const taskExecutor = owner.executors.get(residual.EFFECT_TYPES.CARD_DECISION);
  const choices = taskExecutor.getLegalChoices(root, taskEffect, { workingRoot: root });
  const confirm = choices.find((choice) => choice.target.choiceId.startsWith("confirm:"));
  assert.ok(confirm);
  const completed = taskExecutor.resolveDecision(
    root, taskEffect, confirm, { workingRoot: root },
  );
  assert.equal(completed.ok, true);
  assert.deepEqual(
    root.cardState.discardPile.map((card) => card.id),
    ["task-b1"],
  );
  assert.equal(root.playerState.players[0].resources.score, 34);
  assert.equal(root.playerState.players[0].scoreSources.taskCardScore, 4);
})();

(function proofGameEndWritesEveryPlayerFinalContract() {
  const root = createRoot();
  const owner = createHarness(residual, "createResidualDomain");
  const result = execute(owner.executors.get(residual.HANDOFF_TYPE), root, {
    type: residual.HANDOFF_TYPE,
    kind: "effect",
    ownerId: "p1",
    payload: {
      schemaVersion: residual.HANDOFF_SCHEMA,
      domain: "final_scoring",
      effectType: "game_end",
      data: { roundNumber: 5, gameEnded: true },
    },
  });
  assert.equal(result.ok, true);
  settleFinalMarkEffects(owner, root, result.spawnedEffects);
  for (const player of root.playerState.players) {
    assert.equal(Number.isFinite(player.finalScore), true);
    assert.equal(player.finalScore, player.finalScoreBreakdown.totalScore);
    assert.deepEqual(Object.keys(player.scoreSources).sort(), [
      "alienCardQuickScore", "alienEffectScore", "alienTraceBlueScore",
      "alienTracePinkScore", "alienTraceYellowScore", "blueTechScore",
      "cardEffectScore", "cardQuickScore", "industryEffectScore",
      "initialScore", "landScore", "orbitScore", "scanScore",
      "taskCardScore", "techBonusScore",
    ].sort());
  }
})();

(function proofAllEightSpeciesRevealThroughProductionOwner() {
  for (const speciesId of residual.SPECIES_IDS) {
    const root = createRoot();
    root.alienGameState = aliens.createDefaultAlienState();
    for (const traceType of aliens.TRACE_TYPES) {
      assert.equal(aliens.placeFirstTrace(
        root.alienGameState,
        1,
        traceType,
        traceType === "pink" ? "white" : "brown",
      ).ok, true);
    }
    const owner = createHarness(residual, "createResidualDomain");
    const result = execute(owner.executors.get(residual.HANDOFF_TYPE), root, {
      type: residual.HANDOFF_TYPE,
      kind: "effect",
      ownerId: "p1",
      payload: {
        schemaVersion: residual.HANDOFF_SCHEMA,
        domain: "alien",
        effectType: "reveal_species",
        data: { slotId: 1, speciesId },
      },
    });
    assert.equal(result.ok, true, `${speciesId} 必须由 residual owner 揭示: ${JSON.stringify(result)}`);
    assert.equal(aliens.getAlienSlot(root.alienGameState, 1).revealed, true);
  }
})();

(function proofType1EventSpawnsAndSettlesProductionDecision() {
  const root = createRoot();
  const triggerCard = { id: "trigger-b140", cardId: "b_140.webp" };
  cardEffects.ensureCardEffectState(triggerCard);
  root.playerState.players[0].reservedCards = [triggerCard];
  const augmented = residual.augmentEffectResult(root, {
    ok: true,
    nextState: {},
    spawnedEffects: [],
    events: [{ type: "orbit", planetId: "mars", playerId: "p1" }],
  }, { ownerId: "p1" });
  const decisions = augmented.spawnedEffects.filter((entry) => (
    entry.effect.type === residual.EFFECT_TYPES.CARD_DECISION
  ));
  assert.equal(decisions.length, 2, "真实 orbit event 必须产生 b140 的两个 type1 Decision");
  const owner = createHarness(residual, "createResidualDomain");
  const executor = owner.executors.get(residual.EFFECT_TYPES.CARD_DECISION);
  const first = decisions[0].effect;
  const confirm = executor.getLegalChoices(root, first, { workingRoot: root })
    .find((entry) => entry.target.choiceId.startsWith("confirm:"));
  assert.ok(confirm);
  const settled = executor.resolveDecision(root, first, confirm, { workingRoot: root });
  assert.equal(settled.ok, true);
})();

console.log("residual-domain-session production proofs passed");
