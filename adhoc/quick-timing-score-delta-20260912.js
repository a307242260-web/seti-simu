"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const crypto = require("node:crypto");
const paths = [
  "seti-saves/seti-save-research-turn-boundary-20260911-31a2e43b-full-v276.json",
  "seti-saves/seti-save-research-quick-timing-20260912-60f8cca6-full-v261.json",
];
const output = "reports/iteration/quick-timing-score-delta-20260912-60f8cca6.json";
if (fs.existsSync(output)) { console.log(`已有 checkpoint：${output}`); process.exit(0); }
const inputs = paths.map(path => {
  const raw = fs.readFileSync(path, "utf8");
  const save = JSON.parse(raw);
  return { path, sha256: crypto.createHash("sha256").update(raw).digest("hex"), save,
    root: JSON.parse(save.committedState) };
});
const fields = ["baseScore", "cardScore", "tileScore", "jiuzheCardScore", "jiuzhePenaltyScore", "runezuSymbolScore", "totalScore"];
const rows = inputs[0].root.players.players.map(before => {
  const after = inputs[1].root.players.players.find(p => p.id === before.id);
  const b = before.finalScoreBreakdown, a = after.finalScoreBreakdown;
  assert.equal(b.totalScore, before.finalScore);
  assert.equal(a.totalScore, after.finalScore);
  const delta = Object.fromEntries(fields.map(key => [key, a[key] - b[key]]));
  assert.equal(delta.totalScore, delta.baseScore + delta.cardScore + delta.tileScore
    + delta.jiuzheCardScore - delta.jiuzhePenaltyScore + delta.runezuSymbolScore);
  return { playerId: before.id, before: b, after: a, delta,
    sourceDelta: Object.fromEntries([...new Set([...Object.keys(before.scoreSources), ...Object.keys(after.scoreSources)])]
      .map(key => [key, (after.scoreSources[key] || 0) - (before.scoreSources[key] || 0)])) };
});
const totals = Object.fromEntries(fields.map(key => [key, rows.reduce((sum, row) => sum + row.delta[key], 0)]));
const actionIdentity = step => JSON.stringify({ actor: step.action.actorId, family: step.action.family,
  phase: step.action.phase, target: step.action.target, payload: step.action.payload });
const firstDifference = inputs[0].save.replaySteps.findIndex((step, i) =>
  !inputs[1].save.replaySteps[i] || actionIdentity(step) !== actionIdentity(inputs[1].save.replaySteps[i]));
assert(firstDifference >= 0);
const audit = JSON.parse(fs.readFileSync("reports/iteration/quick-timing-full-audit-20260912-60f8cca6.json", "utf8"));
const picks = audit.late.filter(x => x.compatibleTargets.some(t => t.targetId.startsWith("card:acquire:"))).map(x => {
  const conditional = [];
  for (const step of inputs[1].save.replaySteps.slice(x.step)) {
    if (step.action.phase !== "conditional") break;
    conditional.push({ step: step.stepIndex + 1, action: step.action });
  }
  const selected = conditional.find(s => Number.isInteger(s.action.target.slotIndex)
    && x.compatibleTargets.some(t => t.targetId === `card:acquire:${s.action.target.cardInstanceId}`));
  assert(selected, `第${x.step}步取牌必须兑现此前公开的准入目标`);
  return { rootStep: x.step, conditional, selectedTarget: `card:acquire:${selected.action.target.cardInstanceId}` };
});
const result = { sources: inputs.map(({ path, sha256 }) => ({ path, sha256 })), rows, totals,
  firstDifference: { step: firstDifference + 1,
    before: inputs[0].save.replaySteps[firstDifference].action,
    after: inputs[1].save.replaySteps[firstDifference].action }, picks,
  scope: "终局正式拆分的会计差异及已验证回放中的公开取牌后继；不是各代码改动的独立因果效应。首次分歧后不能按同一步号比较相同决策，不重跑AI。" };
fs.writeFileSync(output, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ totals, firstDifference: result.firstDifference, picks }, null, 2));
