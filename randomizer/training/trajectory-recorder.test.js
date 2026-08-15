"use strict";

const assert = require("node:assert");
const { createTrajectoryRecorder, LOG_SCHEMA } = require("./trajectory-recorder");

const recorder = createTrajectoryRecorder({ seed: "human-test", mode: "human-demo", episodeIndex: 3 });

const step0 = recorder.recordStep({
  actorPlayerId: "p1",
  action: { schemaVersion: "seti-standard-action-v1", actionId: "a1", family: "launch", actorId: "p1" },
  reward: { immediateScoreDelta: 2, terminalScoreDelta: 0, resourceDelta: { credits: -1 } },
  legalMask: [{ maskIndex: 0, actionId: "a1", family: "launch", actorPlayerId: "p1" }],
  terminal: false,
  ok: true,
  actorKind: "human",
});
assert.equal(step0.schemaVersion, LOG_SCHEMA, "step 必须使用 self-play log schema");
assert.equal(step0.type, "step");
assert.equal(step0.mode, "human-demo");
assert.equal(step0.episodeIndex, 3);
assert.equal(step0.seed, "human-test");
assert.equal(step0.stepIndex, 0);
assert.equal(step0.actorPlayerId, "p1");
assert.equal(step0.action.family, "launch");
assert.deepEqual(step0.reward.resourceDelta, { credits: -1 });
assert.equal(step0.legalMask.length, 1);
assert.equal(step0.terminal, false);
assert.equal(step0.ok, true);
assert.equal(step0.actorKind, "human");
assert.equal(step0.error, undefined, "成功步骤不携带 error");

recorder.recordStep({
  actorPlayerId: "p2",
  action: { family: "pass", actionId: "a2" },
  legalMask: [],
  terminal: false,
  ok: true,
  actorKind: "machine",
  error: null,
});
assert.equal(recorder.getStepCount(), 2, "stepIndex 必须按已确认输入递增");

recorder.truncateToStepCount(1);
assert.equal(recorder.getStepCount(), 1, "撤销对齐只保留已确认步数");
assert.equal(recorder.getRecords()[0].action.actionId, "a1", "截断保留最早确认步骤");

recorder.recordStep({
  actorPlayerId: "p2",
  action: { family: "pass", actionId: "a2" },
  legalMask: [],
  terminal: true,
  ok: true,
  actorKind: "machine",
});
recorder.finishEpisode({
  terminal: true,
  players: [{ playerId: "p1", score: 12, finalScore: 12 }, { playerId: "p2", score: 9, finalScore: 9 }],
});
assert.equal(recorder.getStepCount(), 2, "finishEpisode 不改变步骤计数");

const records = recorder.getRecords();
assert.equal(records.length, 3, "records = 2 steps + 1 summary");
const summary = records[2];
assert.equal(summary.type, "episode_summary");
assert.equal(summary.steps, 2);
assert.equal(summary.terminal, true);
assert.equal(summary.players.length, 2);
assert.equal(summary.players[0].playerId, "p1");

const jsonl = recorder.getJsonl();
const parsed = jsonl.split("\n").map((line) => JSON.parse(line));
assert.deepEqual(parsed, records, "JSONL 必须逐行还原全部记录");

// 汇总落盘后轨迹不可再截断
const beforeTruncate = recorder.getStepCount();
recorder.truncateToStepCount(0);
assert.equal(recorder.getStepCount(), beforeTruncate, "汇总后不允许回改已确认轨迹");

// getRecords 返回克隆，外部改写不影响录制器
records[0].action.family = "mutated";
assert.equal(recorder.getRecords()[0].action.family, "launch", "记录必须隔离外部写入");

console.log("trajectory recorder tests passed");
