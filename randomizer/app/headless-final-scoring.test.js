"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createHeadlessEnv } = require("./headless-env");
const highCouplingState = require("../game/state/high-coupling-slices");

function readCheckpointState(checkpoint) {
  return JSON.parse(checkpoint.coreState.committedState);
}

function writeCheckpointState(checkpoint, committedState) {
  const serialized = highCouplingState.createHighCouplingStateStore(committedState).serialize();
  assert.equal(serialized.ok, true, serialized.message || serialized.code);
  checkpoint.coreState = {
    ...checkpoint.coreState,
    version: 2,
    committedState: serialized.serialized,
  };
}

function advanceToTurnBoundary(env) {
  for (let index = 0; index < 100; index += 1) {
    const actions = env.legalActions();
    if (actions[0]?.decisionType === "turn_action") return;
    assert.ok(actions[0], "夹具应能推进到 turn action 边界");
    const result = env.step(actions[0]);
    assert.equal(result.ok, true, result.error || `夹具第 ${index} 步推进失败`);
  }
  assert.fail("夹具未能在步数上限内到达 turn action 边界");
}

function buildFinalScoringCheckpoint(env, availableTileIds) {
  const checkpoint = env.createCheckpoint();
  const committedState = readCheckpointState(checkpoint);
  const playerState = committedState.players;
  const playerId = committedState.turn.currentPlayerId;
  const player = playerState.players.find((candidate) => candidate.id === playerId);
  assert.ok(player, "checkpoint 应包含当前玩家");
  player.resources.score = 25;

  for (const [tileId, tile] of Object.entries(committedState.finalScoring.tiles)) {
    tile.marks = availableTileIds.includes(tileId)
      ? []
      : [{
        id: `fixture-block-${tileId}`,
        tileId,
        playerId,
        playerColor: player.color,
        threshold: 999,
        slotIndex: 3,
        slot3Order: 1,
      }];
  }
  writeCheckpointState(checkpoint, committedState);
  delete checkpoint.replaySteps;
  return { checkpoint, playerId };
}

function createFixture(availableTileIds) {
  const env = createHeadlessEnv();
  env.reset({ seed: "seti47-final-scoring", activePlayerCount: 4 });
  advanceToTurnBoundary(env);
  return { env, ...buildFinalScoringCheckpoint(env, availableTileIds) };
}

const multi = createFixture(["a", "b"]);
const multiOpening = multi.env.loadCheckpoint(structuredClone(multi.checkpoint));
const multiActions = multi.env.legalActions();
assert.deepEqual(multiActions.map((action) => action.family), [
  "choose_final_scoring",
  "choose_final_scoring",
]);
assert.deepEqual(
  multiActions.map((action) => action.target.choiceId).sort(),
  ["a", "b"],
);
assert.equal(multiOpening.decision.actorPlayerId, multi.playerId, "终局计分 owner 应为当前 pending 玩家");
assert.equal(multiOpening.decision.pendingOwnerPlayerId, multi.playerId);
assert.equal(multiOpening.decision.source, "pending_owner");
assert.equal(multiOpening.decision.decisionType, "conditional_choice");
assert.equal(multiOpening.decision.choiceCount, 2, "两个合法板块必须保留独立 policy step");

const beforeCursor = multi.env.createCheckpoint().replayCursor.stepIndex;
const selected = multiActions.find((action) => action.target.choiceId === "b");
const selectedResult = multi.env.step(selected);
assert.equal(selectedResult.ok, true, selectedResult.error);
assert.equal(
  multi.env.createCheckpoint().replayCursor.stepIndex,
  beforeCursor + 1,
  "执行 choose_final_scoring 后 replay cursor 必须 +1",
);
const selectedMark = readCheckpointState(multi.env.createCheckpoint()).finalScoring.tiles.b.marks
  .find((mark) => mark.playerId === multi.playerId && Number(mark.threshold) === 25);
assert.ok(selectedMark, "所选终局板块应原子写入 25 分门槛标记");

const replayForkFixture = createFixture(["a", "b"]);
const replayFork = replayForkFixture.env;
const replayOpening = replayFork.loadCheckpoint(structuredClone(multi.checkpoint));
assert.deepEqual(replayOpening, multiOpening, "fresh checkpoint replay 前 observation 必须一致");
assert.deepEqual(replayFork.legalActions(), multiActions, "fresh checkpoint replay 前 legalActions 必须一致");
const replayResult = replayFork.step(
  replayFork.legalActions().find((action) => action.target.choiceId === "b"),
);
assert.equal(replayResult.ok, true, replayResult.error);
assert.deepEqual(replayResult.observation, selectedResult.observation, "fresh checkpoint replay 后 observation 必须一致");
assert.equal(
  replayFork.createCheckpoint().replayCursor.stepIndex,
  beforeCursor + 1,
  "fresh checkpoint replay cursor 必须与源分支一致",
);
replayFork.dispose();
multi.env.dispose();

const singleton = createFixture(["a"]);
const singletonBeforeCursor = singleton.env.createCheckpoint().replayCursor.stepIndex;
const singletonObservation = singleton.env.loadCheckpoint(structuredClone(singleton.checkpoint));
assert.notEqual(singletonObservation.decision?.decisionType, "conditional_choice", "唯一板块不得暴露 policy step");
assert.equal(
  singleton.env.createCheckpoint().replayCursor.stepIndex,
  singletonBeforeCursor,
  "环境自动项不得伪造 policy replay step",
);
const singletonMark = readCheckpointState(singleton.env.createCheckpoint()).finalScoring.tiles.a.marks
  .find((mark) => mark.playerId === singleton.playerId && Number(mark.threshold) === 25);
assert.ok(singletonMark, "唯一合法终局板块应由环境自动标记");
const autoEvent = singleton.env.getReplay().environmentEvents.find((event) => (
  event.type === "automatic_conditional_choice" && event.family === "choose_final_scoring"
));
assert.equal(autoEvent?.ownerPlayerId, singleton.playerId, "自动事件应保留正确 owner");
assert.equal(autoEvent?.target?.choiceId, "a");
singleton.env.dispose();

const appSource = fs.readFileSync(__filename.replace(/app\/headless-final-scoring\.test\.js$/, "app.js"), "utf8");
const enumerateSource = appSource.slice(
  appSource.indexOf("function enumerateHeadlessConditionalActions"),
  appSource.indexOf("function executeHeadlessConditionalAction"),
);
const executeSource = appSource.slice(
  appSource.indexOf("function executeHeadlessConditionalAction"),
  appSource.indexOf("function getHeadlessDecisionOwnerState"),
);
assert.equal(enumerateSource.includes("runAiFinalScoreMarkDecision"), false, "枚举不得回退 final-score AI resolver");
assert.equal(executeSource.includes("runAiFinalScoreMarkDecision"), false, "执行不得回退 final-score AI resolver");
assert.match(appSource, /headless 禁止调用 final-score AI resolver/, "headless composition 应禁用旧 resolver");

console.log("headless final-scoring tests passed");
