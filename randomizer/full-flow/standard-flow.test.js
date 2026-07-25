"use strict";

const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../app/simulation-env");
const heuristicPolicy = require("../game/ai/heuristic-policy");
const fixture = require("./standard-flow-v1.fixture");

function committedState(environment) {
  const serialized = environment.createCheckpoint().coreState.committedState;
  return typeof serialized === "string" ? JSON.parse(serialized) : structuredClone(serialized);
}

function chooseOpeningAction(actions, progressByPlayer) {
  const actorId = actions[0]?.actorPlayerId;
  const progress = progressByPlayer.get(actorId) || { industry: false, initialIds: new Set() };
  let action = actions.find((candidate) => candidate.target?.kind === "start_initial_setup")
    || actions.find((candidate) => candidate.target?.kind === "confirm_initial_setup");
  if (!action && !progress.industry) {
    action = actions.find((candidate) => (
      candidate.target?.kind === "select_initial_card"
      && candidate.target?.selectionKind === "industry"
    ));
    if (action) progress.industry = true;
  }
  if (!action && progress.initialIds.size < fixture.expected.initialCardCount) {
    action = actions.find((candidate) => (
      candidate.target?.kind === "select_initial_card"
      && candidate.target?.selectionKind === "initial"
      && !progress.initialIds.has(candidate.target.cardId)
    ));
    if (action) progress.initialIds.add(action.target.cardId);
  }
  progressByPlayer.set(actorId, progress);
  return action || actions[0] || null;
}

function submit(environment, action, operations) {
  assert.ok(action, "完整流程必须存在下一条标准 action");
  const result = environment.step(action);
  assert.equal(result.ok, true, result.error || result.message || action.actionId);
  assert.notEqual(result.blocked, true, `完整流程不得 blocked：${action.actionId}`);
  operations.push({
    family: action.family,
    actorPlayerId: action.actorPlayerId,
    targetKind: action.target?.kind || null,
  });
}

const env = createSimulationEnv();
const restored = createSimulationEnv();
const operations = [];
try {
  const actualPolicyProvenance = heuristicPolicy.createHeuristicPolicy({
    difficulty: fixture.config.aiDifficulty,
  }).getProvenance();
  assert.deepEqual(fixture.policyProvenance, actualPolicyProvenance,
    "full-flow fixture 必须记录代码当前实际 Policy provenance");

  env.reset(fixture.config);
  const openingProgress = new Map();
  for (let guard = 0; env.legalActions()[0]?.family?.startsWith("choose_"); guard += 1) {
    assert.ok(guard < fixture.expected.maximumOpeningInputs,
      "初始选择与收入链必须通过有限标准输入结束");
    const actions = env.legalActions();
    submit(env, chooseOpeningAction(actions, openingProgress), operations);
  }

  const opened = committedState(env);
  assert.equal(opened.match.initialSetup, undefined);
  assert.equal(opened.match.initialSetupConfig, undefined);
  assert.equal(opened.players.players.length, fixture.expected.playerCount);
  for (const player of opened.players.players) {
    assert.ok(player.initialSelection?.industry?.id, `${player.id} 必须完成公司选择`);
    assert.equal(
      player.initialSelection.removedInitialCards.length,
      fixture.expected.initialCardCount,
      `${player.id} 必须完成初始牌选择`,
    );
  }
  const committedBytes = JSON.stringify(opened);
  for (const forbidden of fixture.expected.forbiddenCommittedFields) {
    assert.equal(committedBytes.includes(`"${forbidden}"`), false,
      `committed state 不得包含 ${forbidden}`);
  }

  const launch = env.legalActions().find((action) => action.family === "launch");
  const rocketCountBeforeLaunch = opened.pieces.rockets.length;
  submit(env, launch, operations);
  const launched = committedState(env);
  assert.equal(launched.pieces.rockets.length, rocketCountBeforeLaunch + 1,
    "标准发射必须创建唯一 canonical rocket");
  assert.equal(launched.pieces.rockets.every((rocket) => rocket.surface === "solar-board"), true);

  const move = env.legalActions().find((action) => action.family === "move");
  submit(env, move, operations);
  for (let guard = 0; env.legalActions()[0]?.family?.startsWith("choose_"); guard += 1) {
    assert.ok(guard < 6, "移动支付 Decision 必须有限收敛");
    submit(env, env.legalActions()[0], operations);
  }

  const checkpoint = env.createCheckpoint();
  assert.equal(checkpoint.effectSessionCheckpoint ?? null, null,
    "稳定边界不得遗留 Effect Session checkpoint");
  assert.equal(checkpoint.effectSessionJournals.length, operations.length,
    "每次标准输入必须留下一个 Effect Session journal");

  restored.reset({ ...fixture.config, seed: `${fixture.config.seed}:restore-target` });
  restored.loadCheckpoint(structuredClone(checkpoint));
  assert.deepEqual(restored.observe(), env.observe(),
    "checkpoint 恢复必须得到相同 viewer-safe observation");
  assert.deepEqual(restored.legalActions(), env.legalActions(),
    "checkpoint 恢复必须枚举相同标准 action");
  assert.deepEqual(restored.createCheckpoint(), checkpoint,
    "checkpoint 恢复不得改写 committed state、Session journal 或 replay");
} finally {
  env.dispose();
  restored.dispose();
}

console.log("standard full-flow v2 passed");
