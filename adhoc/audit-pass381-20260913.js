"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const {createSimulationEnv}=require("../randomizer/app/simulation-env");
const evaluator=require("../randomizer/game/ai/expected-score-evaluator");
const output="adhoc/pass381-audit-20260913.json",inputPath="adhoc/pass381-input-20260913.json";
if(fs.existsSync(output)){console.log(`[skip] ${output}`);process.exit(0);}
const source="seti-saves/seti-save-research-scan-free-cost-20260913-de73734c-full-v278.json";
const save=JSON.parse(fs.readFileSync(source)),env=createSimulationEnv();
try {
  if(fs.existsSync(inputPath))env.loadCheckpoint(JSON.parse(fs.readFileSync(inputPath)).checkpoint);
  else {
    env.reset({seed:save.seed,activePlayerCount:4,aiDifficulty:"laughable"});
    for(let i=0;i<380;i++){
      const expected=save.replaySteps[i],a=env.legalActions().find(a=>a.actionId===expected.action.actionId);
      assert.deepEqual(a,expected.action,`动作${i+1}`);assert.equal(env.step(a).ok,true);
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after,expected.after,`结果${i+1}`);
      if((i+1)%50===0)console.log(`[PASS输入重放，无AI] ${i+1}/380`);
    }
    const checkpoint=env.createCheckpoint();delete checkpoint.replaySteps;delete checkpoint.effectSessionJournals;delete checkpoint.browserReplaySteps;
    fs.writeFileSync(inputPath,JSON.stringify({source,verifiedReplaySteps:380,checkpoint})+"\n",{flag:"wx"});
  }
  const observation=env.observe("player-white"),actions=env.legalActions();
  assert(actions.every(a=>a.target.kind==="pass-hand-limit"));
  console.log(`[PASS单决策诊断] ${actions.length}个正式弃牌组合`);
  const start=performance.now(),r=env.runHeuristicPolicyDecision();assert.equal(r.ok,true);
  assert.equal(r.actionId,save.replaySteps[380].action.actionId);
  const roots=(r.actionOutcomes||[]).map(o=>{
    const action=actions.find(a=>a.actionId===o.actionId),e=evaluator.evaluateAction({seatId:"player-white",actionOutcomes:[o]},action);
    return {action,evaluation:e,leafCount:o.leaves?.length};
  });
  const record={source,step:381,actionId:r.actionId,wallMs:performance.now()-start,observation,roots,diagnostics:env.getCounterfactualDiagnostics()};
  fs.writeFileSync(output,JSON.stringify(record,null,2)+"\n",{flag:"wx"});
  console.log(JSON.stringify({output,wallMs:record.wallMs,roots:roots.map(r=>({cards:r.action.target.cardIds,score:r.evaluation.score,sortKey:r.evaluation.sortKey,selectable:r.evaluation.selectable,leaves:r.leafCount}))}));
}finally{env.dispose();}
