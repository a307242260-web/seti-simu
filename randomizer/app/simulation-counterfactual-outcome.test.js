"use strict";

const assert = require("node:assert/strict");
const { createSimulationEnv } = require("./simulation-env");
const outcomeModel = require("../game/ai/outcome-model");
const solar = require("../solar-system/core");

function drainOpeningDecisions(environment) {
  let guard = 0;
  while (environment.legalActions()[0]?.family?.startsWith("choose_")) {
    assert.equal(environment.step(environment.legalActions()[0]).ok, true);
    guard += 1;
    assert.ok(guard < 20, "opening Decision 不得无限循环");
  }
}

function createSaturnLandingCheckpoint(environment) {
  drainOpeningDecisions(environment);
  const checkpoint = structuredClone(environment.createCheckpoint());
  const roots = [
    JSON.parse(checkpoint.coreState.committedState),
    JSON.parse(checkpoint.coreState.compositionEnvelope.committedState),
  ];
  const green = roots[0].players.players.find((player) => player.color === "green");
  const saturn = solar.createSolarSnapshot(roots[0].solarSystem)
    .planetLocations.find((planet) => planet.planetId === "saturn");
  assert.ok(green && saturn);
  for (const root of roots) {
    root.players.currentPlayerId = green.id;
    root.turn.currentPlayerId = green.id;
    root.turn.roundNumber = 1;
    root.turn.turnNumber = 4;
    root.turn.passedPlayerIds = [];
    delete root.match.pendingDecision;
    const player = root.players.players.find((candidate) => candidate.id === green.id);
    Object.assign(player.resources, {
      credits: 20,
      energy: 20,
      score: 0,
      availableData: 0,
    });
    player.dataState = { poolTokens: [], placedTokens: [], discardedCount: 0 };
    player.mainActionCompleted = false;
    player.passCompletionPending = false;
    Object.assign(root.pieces.rockets[0], {
      playerId: player.id,
      color: player.color,
      surface: "solar-board",
      sectorX: saturn.x,
      sectorY: saturn.y,
      referencePlacement: null,
      angleDegrees: null,
      radius: null,
    });
  }
  checkpoint.coreState.committedState = JSON.stringify(roots[0]);
  checkpoint.coreState.compositionEnvelope.committedState = JSON.stringify(roots[1]);
  checkpoint.replaySteps = null;
  return { checkpoint, playerId: green.id };
}

const env = createSimulationEnv();
const direct = createSimulationEnv();
try {
  env.reset({ seed: "seti-156-outcome-contract", activePlayerCount: 4 });
  direct.reset({ seed: "seti-156-outcome-contract", activePlayerCount: 4 });
  assert.deepEqual(
    direct.createCheckpoint(),
    env.createCheckpoint(),
    "setup Policy 改为真实 leaf 估值后，同 seed 的规则、RNG 与非策略状态仍必须完全一致",
  );
  const actions = env.legalActions();
  const selectedActions = actions.slice(0, 2);
  const before = env.createCheckpoint();
  const project = (items) => outcomeModel.projectOutcomeObservations(items, {
    seatId: selectedActions[0].actorPlayerId,
    stateVersion: selectedActions[0].stateVersion,
    decisionVersion: selectedActions[0].decisionVersion,
  });
  const outcomes = project(env.evaluateActionOutcomes(selectedActions));
  const reversed = project(env.evaluateActionOutcomes([...selectedActions].reverse()));

  assert.deepEqual(env.createCheckpoint(), before,
    "执行全部候选后 canonical bytes/RNG/session/journal/history/replay 必须不变");
  assert.deepEqual(outcomes, reversed, "候选枚举顺序不得改变 action outcome");
  assert.equal(outcomes.every((outcome) => outcome.schemaVersion === "seti-action-outcome-v1"), true);

  for (const action of selectedActions) {
    direct.loadCheckpoint(before);
    const result = direct.step(direct.legalActions().find((candidate) => candidate.actionId === action.actionId));
    assert.equal(result.ok, true);
    const outcome = outcomes.find((candidate) => candidate.actionId === action.actionId);
    const directObservation = outcomeModel.createDecisionObservation(
      direct.observe(action.actorPlayerId),
      {
      seatId: action.actorPlayerId,
      stateVersion: result.legalActions[0]?.stateVersion ?? action.stateVersion,
      decisionVersion: result.legalActions[0]?.decisionVersion ?? action.decisionVersion,
      },
    );
    assert.deepEqual(
      outcome.leaves[0].observation.outcomeProjection,
      directObservation.outcomeProjection,
      "沙箱与直接标准执行必须得到相同 viewer-safe leaf projection",
    );
    assert.equal(outcome.status, "settled", "当前标准 Decision 提交后必须到达下一稳定决策边界");
    assert.equal(outcome.confidence, "low",
      "独立候选随机协议未聚合期望时必须明确返回 low-confidence");
  }

  const stale = { ...selectedActions[0], actionId: "stale-action" };
  const failed = env.evaluateActionOutcomes([stale])[0];
  assert.equal(failed.status, "failed");
  assert.equal(failed.code, "COUNTERFACTUAL_ACTION_STALE");
  assert.deepEqual(env.createCheckpoint(), before, "stale fork 必须零提交、零污染");
} finally {
  env.dispose();
  direct.dispose();
}

{
  const sandbox = createSimulationEnv();
  const actual = createSimulationEnv();
  try {
    sandbox.reset({ seed: "seti-104-official-v1", activePlayerCount: 4 });
    const { checkpoint, playerId } = createSaturnLandingCheckpoint(sandbox);
    actual.reset({ seed: "seti-104-official-v1", activePlayerCount: 4 });
    sandbox.loadCheckpoint(checkpoint);
    actual.loadCheckpoint(checkpoint);
    const landing = sandbox.legalActions().find((action) => (
      action.family === "land" && action.target?.planetId === "saturn"
    ));
    assert.ok(landing, "R1 T04 必须能枚举土星登陆");
    const before = sandbox.createCheckpoint();
    const outcome = sandbox.evaluateActionOutcomes([landing])[0];
    assert.equal(outcome.status, "settled");
    assert.equal(outcome.leaves.length, 2, "两个未揭示外星人槽位必须形成两个真实叶子");
    assert.equal(outcome.leaves.every((leaf) => leaf.actionChain.length === 2), true,
      "登陆叶必须包含 land -> 黄色痕迹 Decision 全链");
    const leafStats = outcome.leaves.map((leaf) => {
      const player = leaf.observation.publicState.players
        .find((candidate) => candidate.playerId === playerId);
      return { score: player.score, availableData: player.availableData };
    });
    assert.deepEqual(leafStats, [
      { score: 13, availableData: 2 },
      { score: 11, availableData: 2 },
    ], "每个叶必须包含登陆 8 分、首次 2 数据及痕迹槽位奖励");
    assert.deepEqual(sandbox.createCheckpoint(), before, "土星候选评估不得污染 canonical root");

    const directLanding = actual.legalActions().find((action) => action.actionId === landing.actionId);
    assert.equal(actual.step(directLanding).ok, true);
    const afterLand = actual.observe(playerId).publicState.players
      .find((player) => player.playerId === playerId);
    assert.equal(afterLand.score, 8, "土星登陆生产奖励必须先结算 8 分");
    assert.equal(afterLand.availableData, 2, "土星首次登陆必须结算 2 数据");
    const traceChoices = actual.legalActions();
    assert.equal(traceChoices.length, 2);
    assert.equal(traceChoices.every((choice) => (
      choice.family === "choose_target"
      && choice.target?.kind === "planet-reward-alien-trace"
      && choice.target?.traceType === "yellow"
    )), true);
    assert.equal(actual.step(traceChoices[0]).ok, true);
    const committed = JSON.parse(actual.createCheckpoint().coreState.committedState);
    assert.equal(committed.aliens.aliens[traceChoices[0].target.alienSlotId].traces.yellow.firstPlaced, true);
  } finally {
    sandbox.dispose();
    actual.dispose();
  }
}

console.log("simulation counterfactual outcome tests passed");
