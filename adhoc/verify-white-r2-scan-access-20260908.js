"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const req=require("node:module").createRequire(process.cwd()+"/adhoc/access.js");
const {createSimulationEnv}=req("../randomizer/app/simulation-env");
const base="/Users/bilibili/code/seti-simu/reports/iteration/";
const output=base+"white-r2-scan-access-20260908.json";
if(fs.existsSync(output)){console.log(`已有checkpoint：${output}`);process.exit(0);}
const old=JSON.parse(fs.readFileSync(base+"white-r2-expiry-baseline-20260908.json"));
const next=JSON.parse(fs.readFileSync(base+"white-r2-expiry-candidate-20260908.json"));
const p=r=>JSON.parse(r.rootEnvelope.committedState).players.players.find(p=>p.id==="player-white");
assert.deepEqual(p(old),p(next));
const report={passed:false,playerStateEqual:true,cases:[]};let env,fork;
try{
 env=createSimulationEnv();env.reset(JSON.parse(fs.readFileSync("reports/iteration/data-root-53-aaaed8d0-20260907.json")).root.config);
 for(const [name,r] of [["baseline",old],["candidate",next]]){
  fork=env.createCounterfactualFork(r.rootEnvelope).composition;
  for(const step of old.leaf.planSteps.slice(0,3)){
   const d=fork.inspect().session?.decision;
   const legal=fork.inspect().phase==="awaiting_input"?d.choices:fork.inputPort.enumerateActions();
   const a=legal.find(a=>a.actionId===step.action.actionId);assert.ok(a,step.action.summary);
   const x=a.phase==="conditional"?fork.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):fork.inputPort.submitAction(a);assert.equal(x.ok,true);
  }
  const choices=fork.inspect().session.decision.choices;
  const expected=old.leaf.planSteps[3].action;
  report.cases.push({name,scanRequirements:r.observation.sectorWinRequirements,
   expected,expectedAvailable:choices.some(a=>a.actionId===expected.actionId),choices});
  fork.dispose();fork=null;
 }
 assert.equal(report.cases[0].expectedAvailable,true);assert.equal(report.cases[1].expectedAvailable,false);
 report.passed=true;
}catch(e){report.error=e.stack;process.exitCode=1;}
finally{fork?.dispose();env?.dispose();fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify({...report,cases:report.cases.map(c=>({name:c.name,expected:c.expected.summary,expectedAvailable:c.expectedAvailable,choices:c.choices.map(a=>a.summary)}))},null,2));}
