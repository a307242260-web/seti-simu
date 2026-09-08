"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const req=require("node:module").createRequire(process.cwd()+"/adhoc/session-isolation.js");
const {createSimulationEnv}=req("../randomizer/app/simulation-env");
const output="/Users/bilibili/code/seti-simu/reports/iteration/session-sequence-isolation-483fc706-20260908.json";
if(fs.existsSync(output)){console.log(`已有证据：${output}`);process.exit(0);}
const env=createSimulationEnv();let fork;
const report={scope:"未改动483fc706基线，固定同一envelope及分支种子，重复正式place_data；不运行AI"};
try{
  env.loadCheckpoint(JSON.parse(fs.readFileSync("reports/iteration/data-root-53-aaaed8d0-20260907.json")).root);
  fork=env.createCounterfactualFork();
  const comp=fork.composition;
  const saved=comp.lifecycle.save();assert.equal(saved.ok,true);
  report.before=saved.envelope;
  const execute=()=>{
    fork.resetBranch("session-isolation-fixed-20260908");
    const restored=comp.lifecycle.restore(saved.envelope,{inPlace:true,silent:true});assert.equal(restored.ok,true);
    const action=comp.inputPort.enumerateActions().find(a=>a.family==="place_data");assert.ok(action);
    const result=comp.inputPort.submitAction(action);assert.equal(result.ok,true);
    return {action,envelope:comp.lifecycle.save().envelope};
  };
  report.first=execute();report.second=execute();
  assert.deepEqual(report.first.action,report.second.action);
  const first=report.first.envelope.session.session,second=report.second.envelope.session.session;
  report.sessionIds=[first.sessionId,second.sessionId];
  report.committedStateEqual=report.first.envelope.committedState===report.second.envelope.committedState;
  report.workingStateEqual=JSON.stringify(first.workingState)===JSON.stringify(second.workingState);
  report.completeEnvelopeEqual=JSON.stringify(report.first.envelope)===JSON.stringify(report.second.envelope);
  report.reproduced=first.sessionId!==second.sessionId && !report.completeEnvelopeEqual;
  assert.equal(report.reproduced,true);
}catch(error){report.error=error.stack;process.exitCode=1;}
finally{fork?.composition.dispose();env.dispose();fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({output,reproduced:report.reproduced,sessionIds:report.sessionIds,
committedStateEqual:report.committedStateEqual,workingStateEqual:report.workingStateEqual,error:report.error}));}
