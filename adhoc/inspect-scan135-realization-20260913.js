"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const {createSimulationEnv}=require("../randomizer/app/simulation-env");
const output="adhoc/scan135-realization-20260913.json";
if(fs.existsSync(output)){console.log(`[skip] ${output}`);process.exit(0);}
const input=JSON.parse(fs.readFileSync("adhoc/scan-cost135-input-20260913.json"));
const save=JSON.parse(fs.readFileSync("seti-saves/seti-save-research-scan-free-cost-20260913-de73734c-full-v278.json"));
const trace=JSON.parse(fs.readFileSync("adhoc/scan-cost135-de73734c-20260913.json"));
const env=createSimulationEnv(),checkpoints=[];
try{
  env.loadCheckpoint(input.checkpoint);
  for(let i=134;i<154;i++){
    const expected=save.replaySteps[i], legal=env.legalActions();
    const action=legal.find(a=>a.actionId===expected.action.actionId);
    assert.deepEqual(action,expected.action,`动作${i+1}`);
    if([134,146,153].includes(i))checkpoints.push({step:i+1,observation:env.observe("player-green"),legalActions:legal});
    assert.equal(env.step(action).ok,true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after,expected.after,`结果${i+1}`);
  }
  const actual=save.replaySteps.slice(135).map((s,i)=>({...s,step:i+136})).filter(s=>s.action.actorId==="player-green");
  let same=0;while(same<trace.plan.steps.length&&trace.plan.steps[same].actionId===actual[same]?.action.actionId)same++;
  const planned=trace.plan.steps[same];
  const record={source:"seti-saves/seti-save-research-scan-free-cost-20260913-de73734c-full-v278.json",
    verifiedSteps:20,matchingFocalPlanPrefix:same,firstPlannedMismatch:planned,actualMismatch:actual[same],checkpoints};
  fs.writeFileSync(output,JSON.stringify(record,null,2)+"\n",{flag:"wx"});
  console.log(JSON.stringify({output,matching:same,actualStep:actual[same]?.step,
    plannedStillLegal:checkpoints.at(-1).legalActions.some(a=>a.actionId===planned.actionId),
    aliens:checkpoints.map(c=>({step:c.step,aliens:c.observation.publicState.board.aliens}))}));
}finally{env.dispose();}
