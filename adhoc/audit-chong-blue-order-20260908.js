"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const read = tag => JSON.parse(fs.readFileSync(`reports/iteration/chong-blue-order-${tag}-20260908.json`));
const output = "reports/iteration/chong-blue-order-audit-20260908.json";
if (fs.existsSync(output)) { console.log(`已有checkpoint：${output}`); process.exit(0); }
const choices = read("choices"), after = read("choices-after"), baseline = read("baseline"), candidate = read("candidate");
assert.ok([choices,after,baseline,candidate].every(r=>r.passed));
assert.deepEqual(choices.observation,after.observation);
assert.deepEqual(choices.legal,after.legal);
assert.deepEqual(choices.results,after.results,"策略筛选不改变任何正式单步执行、状态、RNG或领奖Decision");
const [eight,nine] = after.results.map(r=>r.envelope.session.session.workingState);
const player = state => state.players.players.find(p=>p.id === "player-brown");
assert.equal(player(nine).resources.score-player(eight).resources.score,2);
assert.deepEqual({...player(nine).resources,score:0},{...player(eight).resources,score:0});
for (const field of ["fossilsById","planetFossilIds","panelFossilSlots","unlockedBluePositions","transportTasksByRocketId","completedTransports"]) {
  assert.deepEqual(eight.aliens.chong[field],nine.aliens.chong[field]);
}
assert.deepEqual(baseline.observation,candidate.observation);
assert.deepEqual(baseline.legal,candidate.legal);
assert.deepEqual(baseline.leaf.planSteps.map(s=>s.action),candidate.leaf.planSteps.map(s=>s.action));
assert.equal(candidate.verifiedPlanInputs,24);
assert.equal(baseline.evaluation.score,candidate.evaluation.score);
assert.equal(baseline.evaluation.actualScoreDelta,candidate.evaluation.actualScoreDelta);
const select = r => ({wallMs:r.wallMs,nodes:r.diagnostics.executedNodeCount,inputs:r.diagnostics.successfulInputSubmissionCount,
  action:r.decision.actionId,score:r.evaluation.score,actualScoreDelta:r.evaluation.actualScoreDelta,
  traceNodes:Object.entries(r.diagnostics.executedNodeCountByActionSummary).filter(([key])=>/蓝[789]号/.test(key)),
  failure:r.diagnostics.failedNodeCountByCode});
const result={passed:true,scope:"只读已保存反例与单根；无AI重跑。正式输入/RNG不变不等于8/9状态等价。",
  sameRealRoot:true,formalRewardScoreDifference:2,sameFormalExecutionBeforeAfter:true,unchangedFossils:true,
  sameWinningChain:true,verifiedPlanInputs:24,baseline:select(baseline),candidate:select(candidate)};
fs.writeFileSync(output,JSON.stringify(result,null,2)+"\n");console.log(JSON.stringify(result));
