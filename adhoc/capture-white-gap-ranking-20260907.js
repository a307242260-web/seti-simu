"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict"),zlib=require("node:zlib");
const {Readable}=require("node:stream"),{pipeline}=require("node:stream/promises");
const {createSimulationEnv}=require("../randomizer/app/simulation-env"),evaluator=require("../randomizer/game/ai/expected-score-evaluator");
const base="reports/iteration/white-gap-ranking-191-20260907";
async function main(){
  if(fs.existsSync(`${base}.json`)||fs.existsSync(`${base}.capture.jsonl.gz`))return console.log("已有白方191候选，不重跑");
  const row=JSON.parse(fs.readFileSync("reports/iteration/white-gap-roots-20260907.json")).rows.find(r=>r.step===191),env=createSimulationEnv();
  try{
    env.loadCheckpoint(row.checkpoint);const legalActions=env.legalActions(),start=performance.now(),result=env.runHeuristicPolicyDecision(),wallMs=performance.now()-start,diagnostics=env.getCounterfactualDiagnostics();
    async function* lines(){const {actionOutcomes,...decision}=result;yield JSON.stringify({type:"header",codeCommit:"1f55695a",checkpoint:row.checkpoint,result:decision,legalActions,wallMs,diagnostics})+"\n";for(const outcome of actionOutcomes){const {leaves,...metadata}=outcome;yield JSON.stringify({type:"outcome",outcome:metadata})+"\n";for(const leaf of leaves||[])yield JSON.stringify({type:"leaf",actionId:outcome.actionId,leaf})+"\n";}}
    await pipeline(Readable.from(lines()),zlib.createGzip(),fs.createWriteStream(`${base}.capture.jsonl.gz`));
    assert.equal(result.ok,true);assert.deepEqual(diagnostics.failedNodeCountByCode,{});assert.ok(wallMs<30000);
    const context={seatId:"player-white",legalActions,observation:result.actionOutcomes.find(o=>o.rootObservation).rootObservation,actionOutcomes:result.actionOutcomes};
    const candidates=legalActions.map(action=>{const evaluation=evaluator.evaluateAction(context,action),outcome=result.actionOutcomes.find(o=>o.actionId===action.actionId),leaf=outcome?.leaves?.find(l=>l.leafId===evaluation.selectedLeafId);if(leaf&&!Array.isArray(leaf.planSteps))assert.equal(action.family,"pass","只有合成PASS叶可无逐步计划");return {action,evaluation,leafCount:outcome?.leaves?.length||0,plan:leaf?.planSteps?leaf.planSteps.map(s=>s.action):null};});
    const historical=row.historicalSearch.find(s=>s.kind==="strategic");
    const comparison={actionEqual:result.policyDecision.actionId===historical.action,nodesEqual:diagnostics.executedNodeCount===historical.diagnostics.executedNodeCount,inputsEqual:diagnostics.successfulInputSubmissionCount===historical.diagnostics.successfulInputSubmissionCount};
    fs.writeFileSync(`${base}.json`,JSON.stringify({scope:"当前108.5白191真实前态单次搜索及全部候选；历史一致性按comparison逐项报告",wallMs,diagnostics,comparison,candidates,plan:result.plan},null,2)+"\n");
    console.log(JSON.stringify({wallMs,comparison,nodes:diagnostics.executedNodeCount,inputs:diagnostics.successfulInputSubmissionCount,candidates:candidates.map(c=>({action:c.action.summary,score:c.evaluation.score,status:c.evaluation.status,leaves:c.leafCount}))},null,2));
  }finally{env.dispose();}
}
main().catch(error=>{fs.writeFileSync(`${base}.failure.json`,JSON.stringify({message:error.message,stack:error.stack},null,2)+"\n");console.error(error);process.exitCode=1;});
