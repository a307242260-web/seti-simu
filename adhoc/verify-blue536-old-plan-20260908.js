"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const req=require("node:module").createRequire(process.cwd()+"/adhoc/verify536.js");
const {createSimulationEnv}=req("../randomizer/app/simulation-env");
const base="/Users/bilibili/code/seti-simu/reports/iteration/";
const output=base+"blue536-old-plan-on-turing-20260908.json";
if(fs.existsSync(output)){console.log(`已有checkpoint：${output}`);process.exit(0);}
const report={passed:false,borrowChecks:[]};let env,fork;
try{
  const old=JSON.parse(fs.readFileSync(base+"blue536-turing-baseline-20260908.json"));
  env=createSimulationEnv();env.reset(JSON.parse(fs.readFileSync("reports/iteration/data-root-53-aaaed8d0-20260907.json")).root.config);
  fork=env.createCounterfactualFork(old.rootEnvelope).composition;
  let pending=false;
  for(const step of old.leaf.planSteps){
    const inspected=fork.inspect(),decision=inspected.session?.decision;
    const available=inspected.phase==="awaiting_input"?decision.choices:fork.inputPort.enumerateActions();
    const action=available.find(a=>a.actionId===step.action.actionId);assert.ok(action,step.action.actionId);
    assert.deepEqual(action,step.action,"正式动作身份不因公共公司字段变化");
    if(action.target?.kind==="residual-domain"&&action.target?.tileId){
      const state=JSON.parse(fork.lifecycle.save().envelope.committedState);
      const p=state.players.players.find(p=>p.id===action.actorId),tile=action.target.tileId;
      const duplicate=Boolean(p.techState.ownedTiles[tile])&&!p.techState.disabledTiles[tile];
      report.borrowChecks.push({tile,duplicate,techState:p.techState});assert.equal(duplicate,false,"旧优胜计划借用不是被剪的重复能力");
    }
    const result=action.phase==="conditional"
      ?fork.inputPort.submitDecision({decisionId:decision.decisionId,decisionVersion:decision.decisionVersion,ownerId:decision.ownerId,choice:action})
      :fork.inputPort.submitAction(action);
    assert.equal(result.ok,true);
    if(action.family==="end_turn")pending=true;
    if(pending){const a=fork.counterfactualPort.advanceFocalPlanningTurn("player-blue");if(a.ok)pending=false;else assert.equal(a.code,"COUNTERFACTUAL_FOCAL_TURN_SESSION_PENDING");}
  }
  report.finalEnvelope=fork.lifecycle.save().envelope;
  assert.equal(report.finalEnvelope.committedState,old.verifiedEnvelope.committedState,"旧计划在新代码上的正式终态逐字节相同");
  report.steps=old.leaf.planSteps.length;report.oldValue=old.evaluation.value;report.passed=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
finally{fork?.dispose();env?.dispose();fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify({output,passed:report.passed,error:report.error,steps:report.steps,oldValue:report.oldValue,borrowChecks:report.borrowChecks}));}
