"use strict";
const fs = require("node:fs");
const zlib = require("node:zlib");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const policy = require("../randomizer/game/ai/policy-port");
const label = process.argv[2];
assert.ok(["before", "after"].includes(label));
const output = `reports/iteration/policy-copy-r4-${label}-20260906.json`;
if (fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const bytes = fs.readFileSync("reports/iteration/probe-source-opening-20260906.json.gz");
  const source = JSON.parse(zlib.gunzipSync(bytes));
  const actions = source.comparison.map((row) => row.action);
  const outcomes = source.outcomes.filter((row) => actions.some((action) => action.actionId === row.actionId));
  const input = { requestId: "policy-copy-r4", seatId: actions[0].actorId,
    stateVersion: actions[0].stateVersion, decisionVersion: actions[0].decisionVersion,
    observation: outcomes[0].rootObservation, legalActions: actions, actionOutcomes: outcomes };
  const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
  const inputBefore = hash(JSON.stringify(input));
  policy.createDecisionContext(input);
  const times = [];
  let result;
  for (let index = 0; index < 5; index++) {
    const start = performance.now();
    result = policy.createDecisionContext(input);
    times.push(performance.now() - start);
  }
  assert.equal(hash(JSON.stringify(input)), inputBefore);
  const resultHash = hash(JSON.stringify(result));
  if (label === "after") {
    const before = JSON.parse(fs.readFileSync("reports/iteration/policy-copy-r4-before-20260906.json"));
    assert.equal(resultHash, before.resultHash);
  }
  const report = { label, sourceHash: hash(bytes), policySourceHash: hash(fs.readFileSync("randomizer/game/ai/policy-port.js")),
    scope: "已有真实结果的纯Policy复制；JSON恢复不保留原运行时别名，耗时不冒充原整局或原决策耗时。一次预热、五次计时，不运行搜索。",
    leafCount: outcomes.reduce((sum, row) => sum + row.leaves.length, 0), times,
    medianMilliseconds: [...times].sort((a, b) => a - b)[2], resultHash, inputUnchanged: true };
  fs.writeFileSync(output, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
