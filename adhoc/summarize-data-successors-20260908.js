"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const source = "reports/iteration/data-successors-483fc706-20260908.json";
const oldSource = "/private/tmp/seti-rules-baseline-20260908.ohUO6T/reports/iteration/data-pick-repeats-53-8ba9b8d8-20260907.json";
const output = "reports/iteration/data-successor-boundaries-20260908.json";
if (fs.existsSync(output)) { console.log(`已有checkpoint：${output}`); process.exit(0); }
const current = JSON.parse(fs.readFileSync(source)), old = JSON.parse(fs.readFileSync(oldSource));
assert.equal(current.passed, true); assert.equal(old.passed, true);
const oldByKey = new Map(old.rows.map(row => [row.key, row])), byNode = new Map();
for (const row of current.rows) {
  if (!byNode.has(row.nodeKey)) byNode.set(row.nodeKey, []);
  byNode.get(row.nodeKey).push(row);
}
const selected = [...byNode].filter(([,rows]) => rows.every(r => r.selected.length === 1
  && r.selected[0].action.family === "place_data"));
const inputs = {}, candidates = [];
for (const [nodeKey, rows] of selected) {
  const prior = oldByKey.get(nodeKey); assert.ok(prior);
  assert.deepEqual(prior.origins.map(o=>o.key).sort(), rows.map(r=>r.originKey).sort(), "全部来源均经过后继选择，无遗漏已结束来源");
  for (const r of rows) {
    assert.equal(r.completedGoal, false); assert.equal(r.goalCompletionPending, false);
    assert.equal(r.beforeTarget, r.selected[0].routeTargetId);
    assert.equal(r.beforePlan, r.selected[0].routePlanId);
    assert.equal(r.masked, true); assert.equal(r.hiddenBarrier, null);
    assert.equal(r.phase, "idle"); assert.equal(r.inputCount, 2);
    assert.deepEqual(r.inputs.map(a=>a.family), ["place_data", "choose_target"]);
    assert.equal(r.childKey, rows[0].childKey);
  }
  const first = rows[0], childKey = `${first.childKey}:${first.selected[0].action.actionId}:15:player-brown`;
  assert.ok(oldByKey.has(childKey), "下一次放数据确实执行，不只停留在候选队列");
  const slot = first.inputs[1].target.choiceId;
  inputs[slot] = (inputs[slot] || 0) + 1;
  candidates.push({ nodeKey, childKey, origins: rows.length, slot });
}
assert.equal(selected.length, 132);
const report = { source, oldSource, capturedOriginRows: current.rows.length,
  capturedPhysicalNodes: byNode.size, continuousPhysicalNodes: selected.length, inputs,
  allOriginsMatched: true, allNextNodesFound: true, allTargetsUnchanged: true,
  allPreviouslyMaskedWithoutNewBarrier: true, allInputsExactlyDataAndChoice: true,
  scope: "只证明当前132处正式后继唯一和已执行输入边界；尚不证明重排队列后的效果或融合RNG/计划等价", candidates };
fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ output, ...report, candidates: undefined }, null, 2));
