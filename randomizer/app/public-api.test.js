"use strict";

const assert = require("node:assert/strict");
const publicApi = require("./public-api");

const calls = [];
const projection = { schemaVersion: "seti-browser-host-v1", source: { stateVersion: 3 } };
const api = publicApi.createPublicApi({
  inspectProjection: () => projection,
  inspectInput: () => ({ submissionSequence: 2 }),
  capture: () => ({ ok: true, envelope: { schemaVersion: "save-v1" } }),
  restore: (envelope) => (calls.push(["restore", envelope]), { ok: true }),
  dispatchAction: (action) => (calls.push(["action", action]), { ok: true, action }),
  submitDecision: (submission) => (calls.push(["decision", submission]), { ok: true, submission }),
});

assert.deepEqual(
  Object.keys(api),
  [
    "schemaVersion",
    "inspect",
    "capture",
    "restore",
    "input",
    "getRecordedTrajectory",
    "isTrajectoryRecordingEnabled",
  ],
  "Browser public facade 顶层不得恢复规则 executor 或分散 inspect",
);
assert.deepEqual(
  Object.keys(api.input),
  ["dispatchAction", "submitDecision"],
  "Browser public input 只允许完整 Standard Action/Decision",
);
assert.equal(Object.isFrozen(api), true);
assert.equal(Object.isFrozen(api.input), true);
assert.equal(api.getRecordedTrajectory(), null, "未装配录制器时返回 null");
assert.equal(api.isTrajectoryRecordingEnabled(), false, "未装配录制器时返回 false");

const inspected = api.inspect();
assert.notEqual(inspected.projection, projection);
assert.equal(Object.isFrozen(inspected), true);
assert.equal(Object.isFrozen(inspected.projection), true);
projection.source.stateVersion = 4;
assert.equal(inspected.projection.source.stateVersion, 3);

const action = { actionId: "action-1", target: { playerId: "p1" } };
api.input.dispatchAction(action);
action.target.playerId = "tampered";
assert.equal(calls[0][1].target.playerId, "p1");

const decision = { decisionId: "decision-1", choice: { choiceId: "choice-1" } };
api.input.submitDecision(decision);
decision.choice.choiceId = "tampered";
assert.equal(calls[1][1].choice.choiceId, "choice-1");

const envelope = { schemaVersion: "save-v1", rules: {} };
api.restore(envelope);
envelope.rules.tampered = true;
assert.equal(calls[2][1].rules.tampered, undefined);

assert.throws(
  () => publicApi.createPublicApi({}),
  /viewer-safe inspect/,
  "缺失窄端口必须在装配期失败",
);

const apiRecorded = publicApi.createPublicApi({
  inspectProjection: () => projection,
  inspectInput: () => ({ submissionSequence: 2 }),
  capture: () => ({ ok: true }),
  restore: () => ({ ok: true }),
  dispatchAction: (action) => ({ ok: true, action }),
  submitDecision: (submission) => ({ ok: true, submission }),
  getRecordedTrajectory: () => '{"schemaVersion":"seti-self-play-log-v1"}\n',
  isTrajectoryRecordingEnabled: () => true,
});
assert.equal(
  apiRecorded.getRecordedTrajectory(),
  '{"schemaVersion":"seti-self-play-log-v1"}\n',
  "装配录制器后返回 self-play JSONL",
);
assert.equal(apiRecorded.isTrajectoryRecordingEnabled(), true, "录制开关状态可查");

console.log("public-api tests passed");
