"use strict";

const assert = require("node:assert");
const { createTrajectoryRecorder } = require("../../training/trajectory-recorder");
const { createTrajectoryRecordingAdapter } = require("./trajectory-recording");

let terminalFlag = false;
let onFinalizedRecorder = null;
const adapter = createTrajectoryRecordingAdapter({
  createRecorder: () => createTrajectoryRecorder({ seed: "adapter-test", mode: "human-demo" }),
  enumerateActions: () => [
    { actionId: "launch-1", family: "launch", actorId: "p1", stateVersion: 1, decisionVersion: 0 },
    { actionId: "pass-1", family: "pass", actorId: "p1", stateVersion: 1, decisionVersion: 0 },
  ],
  inspectDecision: () => ({
    decisionId: "d1",
    decisionVersion: 2,
    ownerId: "p1",
    decisionKind: "choose_card",
    choices: [{ choiceId: "c1", family: "choose_card", actionId: "choose-1" }],
  }),
  projectObservation: () => ({
    outcomeProjection: { viewerSeatId: "p1", scoring: { realizedScore: 1 } },
  }),
  createReward: () => ({ immediateScoreDelta: 1, terminalScoreDelta: 0, resourceDelta: {} }),
  isMachineSeat: (seatId) => String(seatId) !== "p1",
  isTerminal: () => terminalFlag,
  readFinalPlayers: () => [
    { playerId: "p1", score: 12, finalScore: 12 },
    { playerId: "p2", score: 9, finalScore: 9 },
  ],
  onFinalized: (recorder) => { onFinalizedRecorder = recorder; },
});

assert.equal(adapter.isActive(), false, "reset 前录制器未激活");
adapter.reset();
assert.equal(adapter.isActive(), true, "reset 后录制器激活");
adapter.onSessionOpened();

let rawCalls = 0;
const rawDispatch = () => { rawCalls += 1; return { ok: true }; };
const result = adapter.dispatchAction(
  { schemaVersion: "seti-standard-action-v1", actionId: "launch-1", family: "launch", actorId: "p1", phase: "main", stateVersion: 1, decisionVersion: 0 },
  rawDispatch,
);
assert.equal(result.ok, true);
assert.equal(rawCalls, 1, "规则提交必须仍然发生");
assert.equal(adapter.getStepCount(), 1);
let records = adapter.getRecords();
assert.equal(records[0].actorPlayerId, "p1");
assert.equal(records[0].action.family, "launch");
assert.equal(records[0].legalMask.length, 2, "legalMask 必须是提交时点完整合法集");
assert.equal(records[0].reward.immediateScoreDelta, 1);
assert.equal(records[0].actorKind, "human", "人类席位标记 human");

let rawFailedCalls = 0;
const rawFailed = () => { rawFailedCalls += 1; return { ok: false, code: "X" }; };
const failed = adapter.dispatchAction(
  { schemaVersion: "seti-standard-action-v1", actionId: "pass-1", family: "pass", actorId: "p1", phase: "main", stateVersion: 1, decisionVersion: 0 },
  rawFailed,
);
assert.equal(failed.ok, false);
assert.equal(rawFailedCalls, 1);
assert.equal(adapter.getStepCount(), 1, "失败提交不得进入轨迹");

const rawDecision = () => ({ ok: true });
const decisionResult = adapter.submitDecision(
  { decisionId: "d1", decisionVersion: 2, ownerId: "p1", choice: { choiceId: "c1" } },
  rawDecision,
);
assert.equal(decisionResult.ok, true);
assert.equal(adapter.getStepCount(), 2);
records = adapter.getRecords();
assert.equal(records[1].action.family, "choose_card", "Decision 步骤必须记录 family");
assert.equal(records[1].legalMask.length, 1, "Decision legalMask 来自 session choices");

// 撤销对齐：sessionBase=0（reset 后未再打开 session），journal replay 只保留 1 步
adapter.reconcile(1);
assert.equal(adapter.getStepCount(), 1, "撤销后轨迹必须与确认 replay 对齐");
assert.equal(adapter.getRecords()[0].action.family, "launch", "保留最早未撤销步骤");

// 机器席位步骤
const rawMachine = () => ({ ok: true });
const machineResult = adapter.dispatchAction(
  { schemaVersion: "seti-standard-action-v1", actionId: "launch-1", family: "launch", actorId: "p2", phase: "main", stateVersion: 2, decisionVersion: 0 },
  rawMachine,
);
assert.equal(machineResult.ok, true);
assert.equal(adapter.getStepCount(), 2);
assert.equal(adapter.getRecords()[1].actorKind, "machine", "机器席位标记 machine");

// 终局：terminal 触发一次 finalize（summary + 回调），重复提交不重复 finalize
terminalFlag = true;
const rawFinal = () => ({ ok: true });
adapter.dispatchAction(
  { schemaVersion: "seti-standard-action-v1", actionId: "pass-1", family: "pass", actorId: "p1", phase: "main", stateVersion: 3, decisionVersion: 0 },
  rawFinal,
);
assert.equal(adapter.isFinalized(), true, "终局后录制器进入 finalized");
assert.equal(onFinalizedRecorder, adapter.getRecorder(), "终局回调携带录制器");
const summary = adapter.getRecords().at(-1);
assert.equal(summary.type, "episode_summary");
assert.equal(summary.terminal, true);
assert.equal(summary.players.length, 2);
assert.equal(adapter.getStepCount(), 3, "终局步骤仍计入轨迹");
const afterFinalizeCount = adapter.getStepCount();
adapter.reconcile(0);
assert.equal(adapter.getStepCount(), afterFinalizeCount, "finalized 后不可再截断");
adapter.dispatchAction(
  { schemaVersion: "seti-standard-action-v1", actionId: "launch-1", family: "launch", actorId: "p1", phase: "main", stateVersion: 3, decisionVersion: 0 },
  () => ({ ok: true }),
);
assert.equal(adapter.getStepCount(), afterFinalizeCount, "finalized 后不再追加步骤");

console.log("browser trajectory recording tests passed");
