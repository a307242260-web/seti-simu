"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const projectRequire = require("node:module").createRequire(process.cwd() + "/adhoc/root53.js");
const { createSimulationEnv } = projectRequire("../randomizer/app/simulation-env");
const evaluator = projectRequire("../randomizer/game/ai/expected-score-evaluator");
const tag = process.argv[2];
assert.ok(["baseline", "candidate"].includes(tag));
const output = `/Users/bilibili/code/seti-simu/reports/iteration/company-income-root53-${tag}-20260908.json`;
const existing = fs.existsSync(output) ? JSON.parse(fs.readFileSync(output)) : null;
if(existing?.passed){console.log(`已有checkpoint：${output}`);process.exit(0);}
const report = existing || {tag, rootStep:53, codeHead:require("node:child_process").execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(), passed:false};
if(existing){assert.ok(existing.leaf && existing.evaluation,"恢复审计必须已有完整优胜叶，不重跑搜索");report.auditRecovery={previousError:existing.error,searchReused:true};delete report.error;}
let env, fork;
try {
  const record=JSON.parse(fs.readFileSync("reports/research/6a79eb7c.4fbce3b5.full.json"));
  const save=JSON.parse(fs.readFileSync(record.savePath));
  const config=JSON.parse(fs.readFileSync("reports/iteration/data-root-53-aaaed8d0-20260907.json")).root.config;
  const seatId="player-brown";
  env=createSimulationEnv();env.reset(config);
  for(const expected of save.replaySteps.slice(0,52)){
    const action=env.legalActions().find(a=>a.actionId===expected.action.actionId);
    assert.deepEqual(action,expected.action);assert.equal(env.step(action).ok,true);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after,expected.after);
  }
  fork=env.createCounterfactualFork().composition;
  report.rootEnvelope=fork.lifecycle.save().envelope;
  report.observation=env.observe(seatId);
  const legal=env.legalActions();
  if(!existing){
  console.log(`[单点53] ${tag}已恢复相同前52步，开始4096上限搜索`);
  const started=performance.now(), result=env.runHeuristicPolicyDecision();
  report.wallMs=performance.now()-started;report.diagnostics=env.getCounterfactualDiagnostics();
  assert.equal(result.ok,true);assert.deepEqual(report.diagnostics.failedNodeCountByCode,{});
  assert.ok(report.wallMs<30000,"单根30秒门禁");
  report.plan=result.plan;report.decision=result.policyDecision;
  const outcome=result.actionOutcomes.find(o=>o.actionId===result.policyDecision.actionId);
  report.evaluation=evaluator.evaluateOutcome({seatId,observation:outcome.rootObservation,actionOutcomes:[outcome]},legal.find(a=>a.actionId===outcome.actionId),{});
  report.leaf=outcome.leaves.find(l=>l.leafId===report.evaluation.selectedLeafId);
  assert.ok(report.leaf);
  }
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
  report.passed=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
finally{
  fork?.dispose();env?.dispose();
  fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({output,passed:report.passed,error:report.error,ms:report.wallMs,nodes:report.diagnostics?.executedNodeCount,inputs:report.diagnostics?.successfulInputSubmissionCount,value:report.evaluation?.value,actions:report.leaf?.planSteps.map(s=>s.action.summary)}));
}
