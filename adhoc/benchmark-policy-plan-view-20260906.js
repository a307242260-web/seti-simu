"use strict";
const fs = require("node:fs"), v8 = require("node:v8"), zlib = require("node:zlib");
const crypto = require("node:crypto"), assert = require("node:assert/strict");
const port = require("../randomizer/game/ai/policy-port");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const policy = require("../randomizer/game/ai/heuristic-policy").createHeuristicPolicy({ difficulty: "laughable" });
const output = "reports/iteration/policy-plan-view-benchmark-20260906-v2.json";
const withoutPlans = outcomes => outcomes.map(outcome => ({ ...outcome,
  leaves: outcome.leaves.map(({ planSteps, ...leaf }) => leaf) }));
const digest = value => crypto.createHash("sha256").update(v8.serialize(value)).digest("hex");
function assertSameGraph(left, right) {
  const forward = new WeakMap(), reverse = new WeakMap();
  function visit(a, b, path) {
    if (!a || typeof a !== "object") { assert.equal(a, b, path); return; }
    assert.ok(b && typeof b === "object", path);
    if (forward.has(a)) { assert.equal(forward.get(a), b, `${path}: shared reference`); return; }
    assert.equal(reverse.has(b), false, `${path}: unexpected sharing`);
    forward.set(a, b); reverse.set(b, a);
    assert.equal(Array.isArray(a), Array.isArray(b), path);
    assert.deepEqual(Object.keys(a), Object.keys(b), path);
    for (const key of Object.keys(a)) visit(a[key], b[key], `${path}.${key}`);
  }
  visit(left, right, "$");
}
if (fs.existsSync(output)) console.log(`已有记录，跳过：${output}`);
else {
  const input = v8.deserialize(zlib.gunzipSync(fs.readFileSync("reports/iteration/policy-input-42-20260906.v8.gz")));
  const before = digest(input), report = { scope: "同一真实输入离线比较，仅Policy视图排除planSteps；不执行AI搜索；单次时间为候选门禁非全局提速" };
  try {
    let start = performance.now();
    let baseline = port.createDecisionContext(input);
    report.baselineMs = performance.now() - start;
    const evaluation = baseline.legalActions.map(a => evaluator.evaluateAction(baseline, a));
    const decision = policy.decide(baseline);
    const expected = { ...baseline, actionOutcomes: withoutPlans(baseline.actionOutcomes) };
    baseline = null;
    global.gc?.();
    start = performance.now();
    const candidate = port.createDecisionContext({ ...input, actionOutcomes: withoutPlans(input.actionOutcomes) });
    report.candidateMs = performance.now() - start;
    assertSameGraph(expected, candidate);
    assert.deepEqual(candidate.legalActions.map(a => evaluator.evaluateAction(candidate, a)), evaluation);
    assert.deepEqual(policy.decide(candidate), decision);
    assert.equal(digest(input), before);
    report.actionId = decision.actionId;
    report.actions = evaluation.length;
    report.leaves = candidate.actionOutcomes.reduce((n,o) => n + o.leaves.length, 0);
    report.candidateGraphBytes = v8.serialize(candidate).length;
    report.sameRemainingGraph = true; report.sameEvaluations = true; report.sourceUnchanged = true;
    report.passed = true;
  } catch (error) {
    report.passed = false; report.error = { message: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report));
  }
}
