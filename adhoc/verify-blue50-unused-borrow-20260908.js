"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const req=require("node:module").createRequire(process.cwd()+"/adhoc/verify50.js");
const {createSimulationEnv}=req("../randomizer/app/simulation-env");
const base="/Users/bilibili/code/seti-simu/reports/iteration/";
const output=base+"blue50-unused-borrow-20260908.json";
if(fs.existsSync(output)){console.log(`已有checkpoint：${output}`);process.exit(0);}
const old=JSON.parse(fs.readFileSync(base+"blue50-expiry-baseline-20260908.json"));
const actions=old.leaf.planSteps.map(s=>s.action);
assert.equal(actions[7].target.abilityId,"turing_borrow_tech");
assert.equal(actions[8].target.tileId,"orange3");assert.equal(actions[9].family,"end_turn");
const report={passed:false,scope:"正式路径对照，不运行AI；完整状态差异不等于搜索估值或准入证明",paths:[]};
let env,fork;
function diff(a,b,path="",out=[]){
  if(JSON.stringify(a)===JSON.stringify(b))return out;
  if(a&&b&&typeof a==="object"&&typeof b==="object"){
    for(const k of new Set([...Object.keys(a),...Object.keys(b)]))diff(a[k],b[k],path+"."+k,out);
  }else out.push({path,before:a??null,after:b??null});return out;
}
try{
  env=createSimulationEnv();env.reset(JSON.parse(fs.readFileSync("reports/iteration/data-root-53-aaaed8d0-20260907.json")).root.config);
  for(const omit of [false,true]){
    fork=env.createCounterfactualFork(old.rootEnvelope).composition;
    let pending=false;const executed=[];
    for(const [i,expected] of actions.entries()){
      if(omit&&(i===7||i===8))continue;
      const s=fork.inspect(),d=s.session?.decision;
      const legal=s.phase==="awaiting_input"?d.choices:fork.inputPort.enumerateActions();
      const action=legal.find(a=>a.actionId===expected.actionId);assert.ok(action,`${i}: ${expected.summary}`);
      const r=action.phase==="conditional"?fork.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:action}):fork.inputPort.submitAction(action);
      assert.equal(r.ok,true);executed.push(action.summary);
      if(action.family==="end_turn")pending=true;
      if(pending){const a=fork.counterfactualPort.advanceFocalPlanningTurn("player-blue");if(a.ok)pending=false;else assert.equal(a.code,"COUNTERFACTUAL_FOCAL_TURN_SESSION_PENDING");}
    }
    report.paths.push({omit,executed,envelope:fork.lifecycle.save().envelope});fork.dispose();fork=null;
  }
  report.differences=diff(...report.paths.map(p=>JSON.parse(p.envelope.committedState)));
  report.passed=true;
}catch(e){report.error=e.stack;process.exitCode=1;}
finally{fork?.dispose();env?.dispose();fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify({output,passed:report.passed,error:report.error,differences:report.differences},null,2));}
