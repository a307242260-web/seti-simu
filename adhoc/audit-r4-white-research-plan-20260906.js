"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const {createSimulationEnv}=require("../randomizer/app/simulation-env");
const continuation=require("../randomizer/game/ai/plan-continuation");
const evaluator=require("../randomizer/game/ai/expected-score-evaluator");
const output="reports/iteration/r4-white-research-plan-20260906.json";
if(fs.existsSync(output))console.log(`已有记录，未重跑：${output}`);
else{
 const read=p=>JSON.parse(fs.readFileSync(p));
 const save=read(read("reports/research/7a4c63fd.0d21aebf.full.json").savePath);
 const env=createSimulationEnv(),report={scope:"实际白方第251步首次无计划处的一次搜索，后续仅检查计划；保存选中叶摘要，不序列化全部共享结果图",checks:[]};
 try{
  const checkpoint=read("reports/iteration/r4-white-plan-miss-20260906.json");
  delete checkpoint.replaySteps;env.loadCheckpoint(checkpoint);
  const observation=env.observe(),actions=env.legalActions(),start=performance.now();
  const result=env.runHeuristicPolicyDecision();report.ms=performance.now()-start;
  assert.equal(result.ok,true);report.chosen=result.policyDecision.actionId;report.plan=result.plan;
  assert.equal(report.chosen,save.replaySteps[250].action.actionId);
  const context={seatId:"player-white",observation,actionOutcomes:result.actionOutcomes};
  report.values=result.actionOutcomes.map(outcome=>{
   const action=actions.find(a=>a.actionId===outcome.actionId),value=evaluator.evaluateOutcome(context,action);
   const leaf=outcome.leaves.find(l=>l.leafId===value.selectedLeafId);
   return {action,value,leafCount:outcome.leaves.length,completeness:outcome.searchCompleteness,
    selected:leaf?{id:leaf.leafId,chain:leaf.actionChain,reason:leaf.terminalReason,
     score:evaluator.evaluateStateValue(leaf.observation,"player-white"),trace:leaf.secondaryAgentTrace}:null};
  });
  let plan=result.plan;
  for(let i=251;i<=253;i++){
   const reuse=continuation.planReuseCheck(plan,env.observe(),env.legalActions(),{sameTurn:true});
   report.checks.push({step:i+1,hit:reuse.hit,reason:reuse.reason,action:reuse.action?.actionId,expected:save.replaySteps[i].action.actionId});
   assert.equal(reuse.hit,true);assert.deepEqual(reuse.action,save.replaySteps[i].action);
   assert.equal(env.step(reuse.action).ok,true);assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after,save.replaySteps[i].after);
   plan=reuse.nextPlan;
  }
  report.passed=true;
 }catch(error){report.passed=false;report.error={message:error.message,stack:error.stack};process.exitCode=1;}
 finally{env.dispose();fs.writeFileSync(output,JSON.stringify(report));console.log(JSON.stringify({output,passed:report.passed,ms:report.ms,checks:report.checks,
  values:report.values?.map(v=>({action:v.action.summary,score:v.value.score,chain:v.selected?.chain})),error:report.error},null,2));}
}
