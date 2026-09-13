"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const output="adhoc/secondary-probe154-gate-20260913.json";
if(fs.existsSync(output)){console.log(`[skip] ${output}`);process.exit(0);}
const baseline=JSON.parse(fs.readFileSync("adhoc/budget154-trace-ea9efe16-20260913.json"));
const candidate=JSON.parse(fs.readFileSync("adhoc/secondary-probe154-e750f8e8-20260913.json"));
assert.deepEqual(candidate.plan,baseline.plan,"实际优胜完整计划及每步依赖事实须相同");
assert.equal(candidate.actionId,baseline.actionId);
const macroIds=[baseline.actionId,...baseline.plan.steps.filter(s=>!["discard-hand-card","confirm"].includes(JSON.parse(s.actionKey).target.kind)).map(s=>s.actionId)];
const matchingLeaves=candidate.outcomes.flatMap(o=>o.leaves||[]).filter(l=>JSON.stringify(l.actionChain)===JSON.stringify(macroIds));
assert(matchingLeaves.length>0,"实际完整叶须包含原优胜宏步链，不用frontier替代");
assert(candidate.wallMs<30000);
assert.equal(candidate.boundaryBefore.length,4);
assert.equal(candidate.boundaryAfter.length,2);
assert.deepEqual(candidate.diagnostics.failedNodeCountByCode,{});
assert(candidate.diagnostics.attemptedNodeCountByFamily.quick_trade<baseline.diagnostics.attemptedNodeCountByFamily.quick_trade);
const result={baseline:"adhoc/budget154-trace-ea9efe16-20260913.json",candidate:"adhoc/secondary-probe154-e750f8e8-20260913.json",
  matchingCompleteLeaves:matchingLeaves.length,exactWinningPlanAndDependencyFacts:true,selectedActionUnchanged:true,
  boundaryChoices:[4,2],quickTradeNodes:[baseline.diagnostics.attemptedNodeCountByFamily.quick_trade,candidate.diagnostics.attemptedNodeCountByFamily.quick_trade],
  wallMs:[baseline.wallMs,candidate.wallMs],nodes:[4096,candidate.diagnostics.executedNodeCount],
  clarification:"首份候选诊断误将原始capturePlanStep.action.actionId读成actionId，导致planSteps为null、oldBestLeaf=-1。未重跑搜索；以已保存完整优胜plan及真实leaf.actionChain纠正判读。评分函数未改、优胜计划和逐步事实一致；未另补造原始叶分数。",
  scope:"仅此共同输入的原最佳完整路线保留与局部缩减通过；全局最优及终局得分不由此推出。"};
fs.writeFileSync(output,JSON.stringify(result,null,2)+"\n",{flag:"wx"});console.log(JSON.stringify(result));
