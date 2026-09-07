"use strict";
const fs=require("node:fs"),zlib=require("node:zlib"),readline=require("node:readline"),assert=require("node:assert/strict");
const evaluator=require("../randomizer/game/ai/expected-score-evaluator");
const base="reports/iteration/white-gap-ranking-191-20260907";
async function main(){
  if(fs.existsSync(`${base}.json`))return console.log("已有评分摘要，不重复生成");
  let header,outcome;const candidates=[];
  function summarize(){
    if(!outcome)return;
    const action=header.legalActions.find(a=>a.actionId===outcome.actionId);assert.ok(action);
    const evaluation=evaluator.evaluateAction({seatId:"player-white",legalActions:header.legalActions,observation:outcome.rootObservation,actionOutcomes:[outcome]},action);
    const leaf=outcome.leaves.find(l=>l.leafId===evaluation.selectedLeafId);
    if(leaf&&!Array.isArray(leaf.planSteps)){assert.equal(action.family,"pass");assert.deepEqual(leaf.actionChain,[action.actionId]);}
    candidates.push({action,evaluation,leafCount:outcome.leaves.length,plan:leaf?.planSteps?leaf.planSteps.map(s=>s.action):null});
  }
  for await(const line of readline.createInterface({input:fs.createReadStream(`${base}.capture.jsonl.gz`).pipe(zlib.createGunzip()),crlfDelay:Infinity})){
    const row=JSON.parse(line);
    if(row.type==="header")header=row;
    if(row.type==="outcome"){summarize();outcome={...row.outcome,leaves:[]};}
    if(row.type==="leaf"){assert.equal(row.actionId,outcome.actionId);outcome.leaves.push(row.leaf);}
  }
  summarize();assert.equal(header.result.ok,true);assert.deepEqual(header.diagnostics.failedNodeCountByCode,{});
  const historical=JSON.parse(fs.readFileSync("reports/iteration/white-gap-roots-20260907.json")).rows.find(r=>r.step===191).historicalSearch.find(s=>s.kind==="strategic");
  const comparison={actionEqual:header.result.policyDecision.actionId===historical.action,nodesEqual:header.diagnostics.executedNodeCount===historical.diagnostics.executedNodeCount,inputsEqual:header.diagnostics.successfulInputSubmissionCount===historical.diagnostics.successfulInputSubmissionCount};
  fs.writeFileSync(`${base}.json`,JSON.stringify({scope:"从已保存原生候选离线恢复摘要，不重跑搜索；合成PASS叶按正式契约无planSteps",wallMs:header.wallMs,diagnostics:header.diagnostics,comparison,candidates,plan:header.result.plan},null,2)+"\n");
  console.log(JSON.stringify({comparison,candidates:candidates.map(c=>({action:c.action.summary,score:c.evaluation.score,leaves:c.leafCount,route:c.evaluation.routeTargetId}))},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
