"use strict";

const assert = require("node:assert/strict");
const probeTurn = require("./probe-turn-session");
const planetRewards = require("../actions/planet-rewards");

function createRoot({
  roundNumber = 4,
  passedPlayerIds = [],
  currentPlayerId = "p1",
} = {}) {
  return {
    meta: { stateVersion: 1, seed: "probe-turn-owner-boundary", rngState: {} },
    match: { decisionVersion: 0 },
    playerState: {
      currentPlayerId,
      players: [
        {
          id: "p1",
          color: "white",
          hand: [],
          resources: { credits: 5, energy: 5 },
          mainActionCompleted: true,
          passCompletionPending: passedPlayerIds.includes("p1"),
        },
        {
          id: "p2",
          color: "brown",
          hand: [],
          resources: { credits: 5, energy: 5 },
          mainActionCompleted: false,
          passCompletionPending: passedPlayerIds.includes("p2"),
        },
      ],
    },
    turnState: {
      roundNumber,
      turnNumber: 1,
      actionCycleNumber: 1,
      turnOrderPlayerIds: ["p1", "p2"],
      startPlayerId: "p1",
      activePlayerIds: ["p1", "p2"],
      passedPlayerIds: [...passedPlayerIds],
      completedTurnPlayerIds: [],
      cardTurnEventBonuses: [],
      visitedPlanetsByPlayerId: {},
    },
    cardState: {},
  };
}

function createHarness() {
  const executors = new Map();
  const domain = probeTurn.createProbeTurnDomain({
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

function endTurnAction() {
  return {
    schemaVersion: "seti-standard-action-v1",
    actionId: "end_turn:test",
    family: "end_turn",
    actorId: "p1",
    target: { kind: "end-turn" },
    payload: {},
  };
}

function handoffSummary(entry) {
  return {
    type: entry.effect.type,
    kind: entry.effect.kind,
    ownerId: entry.effect.ownerId,
    schemaVersion: entry.effect.payload.schemaVersion,
    domain: entry.effect.payload.domain,
    effectType: entry.effect.payload.effectType,
  };
}

(function testPassStartsWithVersionedCompanyHandoff() {
  const root = createRoot();
  root.playerState.players[0].mainActionCompleted = false;
  const { executors } = createHarness();
  const execute = executors.get(probeTurn.EFFECT_TYPES.EXECUTE).execute;
  const result = execute(root, {
    ownerId: "p1",
    payload: {
      action: {
        ...endTurnAction(),
        actionId: "pass:test",
        family: "pass",
        target: { kind: "pass" },
      },
    },
  }, { workingRoot: root });
  assert.equal(result.ok, true);
  assert.deepEqual(handoffSummary(result.spawnedEffects[0]), {
    type: probeTurn.DOMAIN_HANDOFF_EFFECT_TYPE,
    kind: "handoff",
    ownerId: "p1",
    schemaVersion: probeTurn.DOMAIN_HANDOFF_SCHEMA_VERSION,
    domain: "company",
    effectType: "company_pass",
  });
  assert.equal(result.spawnedEffects.at(-1).effect.type, probeTurn.EFFECT_TYPES.PASS_COMMIT);
})();

(function testEndTurnHandoffsPrecedePureTurnAdvance() {
  const root = createRoot({ roundNumber: 3, passedPlayerIds: ["p1"] });
  const { executors } = createHarness();
  const execute = executors.get(probeTurn.EFFECT_TYPES.EXECUTE).execute;
  const result = execute(root, {
    ownerId: "p1",
    payload: { action: endTurnAction() },
  }, { workingRoot: root });
  assert.equal(result.ok, true);
  assert.deepEqual(
    result.spawnedEffects.slice(0, -1).map((entry) => (
      `${entry.effect.payload.domain}:${entry.effect.payload.effectType}`
    )),
    [
      "income:pass_income",
      "alien:turn_end_reveal",
      "company:turn_end",
      "card_trigger:turn_end",
    ],
  );
  assert.equal(result.spawnedEffects.at(-1).effect.type, probeTurn.EFFECT_TYPES.TURN_ADVANCE);
})();

(function testIncomeAndAlienCardRewardsAreOnlyCrossDomainHandoffs() {
  const root = createRoot();
  const { executors } = createHarness();
  const executeReward = executors.get(probeTurn.EFFECT_TYPES.REWARD).execute;
  for (const [rewardType, domain, effectType] of [
    [planetRewards.EFFECT_TYPES.INCOME, "income", "planet_reward_income"],
    [planetRewards.EFFECT_TYPES.AOMOMO_CARD, "alien", "planet_reward_aomomo_card"],
  ]) {
    const result = executeReward(root, {
      ownerId: "p1",
      payload: { reward: { type: rewardType, options: {} } },
    }, { workingRoot: root });
    assert.equal(result.ok, true);
    assert.deepEqual(
      `${result.spawnedEffects[0].effect.payload.domain}:${result.spawnedEffects[0].effect.payload.effectType}`,
      `${domain}:${effectType}`,
    );
  }
})();

(function testRoundTransitionHandoffsFollowPureAdvance() {
  const root = createRoot({ roundNumber: 3, passedPlayerIds: ["p1", "p2"] });
  const { executors } = createHarness();
  const advance = executors.get(probeTurn.EFFECT_TYPES.TURN_ADVANCE).execute;
  const result = advance(root, {
    ownerId: "p1",
    payload: { didPass: true },
  }, { workingRoot: root });
  assert.equal(result.ok, true);
  assert.equal(root.turnState.roundNumber, 4);
  assert.equal(root.playerState.currentPlayerId, "p2");
  assert.deepEqual(
    result.spawnedEffects.map((entry) => (
      `${entry.effect.payload.domain}:${entry.effect.payload.effectType}`
    )),
    ["card_trigger:round_transition", "company:round_start"],
  );
})();

console.log("probe-turn-session tests passed");
