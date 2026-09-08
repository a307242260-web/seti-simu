"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const req=require("node:module").createRequire(process.cwd()+"/adhoc/check161.js");
const {createSimulationEnv}=req("../randomizer/app/simulation-env");
const evaluator=req("../randomizer/game/ai/expected-score-evaluator");
const mode=process.argv.includes("--rules-baseline")?"rules-baseline":process.argv.includes("--quick-move")?"quick-move":"fangzhou";
const output="/Users/bilibili/code/seti-simu/reports/iteration/blue50-expiry-"+mode+"-20260908.json";
if(fs.existsSync(output)){console.log(`已有checkpoint：${output}`);process.exit(0);}
const report={passed:false,rootStep:50,codeHead:require("node:child_process").execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim()};
let env,fork;
try{
  const record=JSON.parse(fs.readFileSync("/private/tmp/seti-turing-immediate-expiry-20260908/reports/research/b7968542.cbf7966f.full.json"));
  const save=JSON.parse(fs.readFileSync(require("node:path").resolve("/private/tmp/seti-turing-immediate-expiry-20260908",record.savePath)));
  const config=JSON.parse(fs.readFileSync("/private/tmp/seti-turing-immediate-expiry-20260908/reports/iteration/data-root-53-aaaed8d0-20260907.json")).root.config;
  const seatId="player-blue";
  env=createSimulationEnv();env.reset(config);
  for(const expected of save.replaySteps.slice(0,49)){
    const action=env.legalActions().find(a=>a.actionId===expected.action.actionId);
    assert.deepEqual(action,expected.action);assert.equal(env.step(action).ok,true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after,expected.after);
  }
  report.observation=env.observe(seatId);report.legal=env.legalActions();
  fork=env.createCounterfactualFork().composition;report.rootEnvelope=fork.lifecycle.save().envelope;
  console.log("[单点50] 已恢复蓝方第一轮盘面，开始4096上限候选比较");
  const start=performance.now(),result=env.runHeuristicPolicyDecision();
  report.wallMs=performance.now()-start;report.diagnostics=env.getCounterfactualDiagnostics();
  report.decision=result.policyDecision;report.plan=result.plan;
  assert.equal(result.ok,true);assert.deepEqual(report.diagnostics.failedNodeCountByCode,{});
  const winner=result.actionOutcomes.find(o=>o.actionId===result.policyDecision.actionId);assert.ok(winner);
  report.evaluation=evaluator.evaluateOutcome({seatId,actionOutcomes:[winner]},report.legal.find(a=>a.actionId===winner.actionId),{});
  report.leaf=winner.leaves.find(l=>l.leafId===report.evaluation.selectedLeafId);assert.ok(report.leaf);
  report.candidates=result.actionOutcomes.map(outcome=>{
    const action=report.legal.find(a=>a.actionId===outcome.actionId);assert.ok(action);
    const evaluation=evaluator.evaluateOutcome({seatId,actionOutcomes:[outcome]},action,{});
    const leaf=(outcome.leaves||[]).find(l=>l.leafId===evaluation.selectedLeafId);
    return {action,status:outcome.status,code:outcome.code,evaluation,leaf:leaf||null,
      leafShapes:(outcome.leaves||[]).map(l=>({leafId:l.leafId,status:l.status,keys:Object.keys(l)}))};
  });
  let pending=false;
  for(const expected of report.leaf.planSteps.map(s=>s.action)){
    const inspected=fork.inspect(),decision=inspected.session?.decision;
    const available=inspected.phase==="awaiting_input"?decision.choices:fork.inputPort.enumerateActions();
    const action=available.find(a=>a.actionId===expected.actionId);assert.ok(action,expected.actionId);
    const submitted=action.phase==="conditional"
      ?fork.inputPort.submitDecision({decisionId:decision.decisionId,decisionVersion:decision.decisionVersion,ownerId:decision.ownerId,choice:action})
      :fork.inputPort.submitAction(action);
    assert.equal(submitted.ok,true);
    if(action.family==="end_turn")pending=true;
    if(pending){const advanced=fork.counterfactualPort.advanceFocalPlanningTurn(seatId);if(advanced.ok)pending=false;else assert.equal(advanced.code,"COUNTERFACTUAL_FOCAL_TURN_SESSION_PENDING");}
  }
  report.verifiedEnvelope=fork.lifecycle.save().envelope;
  const p=JSON.parse(report.verifiedEnvelope.committedState).players.players.find(p=>p.id===seatId);
  assert.equal(p.resources.score,report.evaluation.leafValue.realizedScore);
  assert.deepEqual(p.income,report.evaluation.leafValue.infrastructure.income);
  assert.ok(report.wallMs<30000,"单根30秒门禁");
  report.passed=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
finally{fork?.dispose();env?.dispose();fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({output,passed:report.passed,error:report.error,ms:report.wallMs,nodes:report.diagnostics?.executedNodeCount,inputs:report.diagnostics?.successfulInputSubmissionCount,
    candidates:report.candidates?.map(c=>({action:c.action.summary,family:c.action.family,status:c.status,value:c.evaluation.value,selectable:c.evaluation.selectable,reasons:c.evaluation.reasonCodes})),plan:report.leaf?.planSteps.map(s=>s.action.summary)},null,2));}
