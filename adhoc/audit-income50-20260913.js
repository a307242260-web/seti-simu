"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const output="adhoc/income50-attribution-20260913.json";
if(fs.existsSync(output)){console.log(`[skip] ${output}`);process.exit(0);}
const read=p=>JSON.parse(fs.readFileSync(p));
const old=read("adhoc/income50-score-9c679f08-20260913.json"),next=read("adhoc/income50-score-88f686cf-20260913.json");
const oldRoot=old.roots.find(r=>r.actionId===old.actionId),newRoot=next.roots.find(r=>r.actionId===next.actionId);
const retained=newRoot.leaves.find(l=>JSON.stringify(l.actionChain)===JSON.stringify(oldRoot.evaluation.actionChain));
assert(retained);assert.equal(retained.terminalReason,"goal-completed");assert.equal(retained.evaluation.score,73.5);
assert.equal(newRoot.evaluation.score,74.5);
const records=["44713766.236c6969","ac7f0082.5ef60d81"].map(id=>read(`reports/research/${id}.full.json`));
for(let i=0;i<2;i++)assert.deepEqual([old,next][i].diagnostics.executedNodeCountByFamily,
  records[i].metrics.searches.find(s=>s.step===50&&s.kind==="strategic").diagnostics.executedNodeCountByFamily);
const saves=records.map(r=>read(r.savePath)),states=saves.map(s=>JSON.parse(s.committedState));
assert.deepEqual(saves[0].replaySteps.slice(0,50),saves[1].replaySteps.slice(0,50));
const breakdown=e=>({score:e.score,actual:e.actualScoreDelta,tech:e.techValue,income:e.incomeValue,
  alien:e.infrastructureValue-e.techValue-e.incomeValue,publicity:e.publicityResearchValue,sortKey:e.sortKey,
  techs:e.gainedTechIds});
const blueActions=saves[1].replaySteps.map((r,i)=>({step:i+1,action:r.action})).filter(r=>r.action.actorId==="player-blue");
assert.equal(blueActions.filter(r=>r.action.family==="scan").length,0);
assert.equal(blueActions.filter(r=>String(r.action.target?.choiceId).startsWith("scan4:")).length,0);
const players=states.map(s=>s.players.players.find(p=>p.id==="player-blue"));
const sources=Object.fromEntries([...new Set(players.flatMap(p=>Object.keys(p.scoreSources)))].map(k=>[k,
  (players[1].scoreSources[k]||0)-(players[0].scoreSources[k]||0)]).filter(([,n])=>n));
assert.equal(Object.values(sources).reduce((a,b)=>a+b,0),-9);
const result={old:breakdown(oldRoot.evaluation),candidate:breakdown(newRoot.evaluation),
  oldBestRetained:{leafId:retained.leafId,terminalReason:retained.terminalReason,score:retained.evaluation.score},
  blueExecution:{standardScans:0,purple4Choices:0,scanRelated:blueActions.filter(r=>/扫描/.test(r.action.summary))},
  blueBaseScoreDelta:sources,
  valuationSource:"expected-score-evaluator.js TECH_UNIT_VALUES purple2=10/purple4=10；techFutureValue乘剩余轮数，不检查实际利用；新60=(10+10)*3，旧36=(7+5)*3。",
  boundary:"原最优实际完成且被高1分路线替代，非贪心删除/预算挡住。科技利用未兑现是既有估值模型缺口；不把全部终局差异因果归于单一科技选择，也不宣称收入同收益状态等价。"};
fs.writeFileSync(output,JSON.stringify(result,null,2)+"\n",{flag:"wx"});
console.log(`[第50/51步归因通过] ${JSON.stringify(result)}`);
