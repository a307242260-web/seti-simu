"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const {createSimulationEnv}=require("../randomizer/app/simulation-env");
const output="adhoc/income50-input-20260913.json";
if(fs.existsSync(output)){console.log(`[skip] ${output}`);process.exit(0);}
const source="seti-saves/seti-save-research-data-corner-greedy-20260913-236c6969-full-v278.json";
const save=JSON.parse(fs.readFileSync(source));
const candidate=JSON.parse(fs.readFileSync("seti-saves/seti-save-research-income-choice-greedy-20260913-5ef60d81-full-v272.json"));
assert.deepEqual(save.replaySteps.slice(0,50),candidate.replaySteps.slice(0,50));
const env=createSimulationEnv();
try{
  env.reset({seed:save.seed,activePlayerCount:4,aiDifficulty:"laughable"});
  for(let i=0;i<49;i++){
    const expected=save.replaySteps[i],a=env.legalActions().find(a=>a.actionId===expected.action.actionId);
    assert.deepEqual(a,expected.action);assert.equal(env.step(a).ok,true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after,expected.after);
  }
  const checkpoint=env.createCheckpoint();
  delete checkpoint.replaySteps;delete checkpoint.effectSessionJournals;delete checkpoint.browserReplaySteps;
  fs.writeFileSync(output,JSON.stringify({source,verifiedReplaySteps:49,checkpoint,legalActions:env.legalActions(),
    expectedAction:save.replaySteps[49].action,expectedNext:[save.replaySteps[50].action,candidate.replaySteps[50].action]},null,2)+"\n",{flag:"wx"});
  console.log(`[输入重放，无AI] 前49步正式action/after一致，保存第50步输入：${output}`);
}finally{env.dispose();}
