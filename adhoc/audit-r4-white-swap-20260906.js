"use strict";
const fs = require("node:fs");
const zlib = require("node:zlib");
const assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = "reports/iteration/r4-white-swap-20260906.json";
if(fs.existsSync(output)) console.log(`已有记录，未重跑：${output}`);
else {
  const read = path=>JSON.parse(fs.readFileSync(path));
  const record = read("reports/research/7a4c63fd.0d21aebf.full.json");
  const save = read(record.savePath);
  const report = {scope:"正式重放共同前缀后，白方第254步一次冷计划诊断；保存全部outcomes，不运行全盘",
    savePath:record.savePath,verifiedThrough:22};
  const env = createSimulationEnv();
  try {
    const initial = read("reports/iteration/r3-actual-opening-plan-20260906.json").beforeRoot;
    delete initial.replaySteps;
    env.loadCheckpoint(initial);
    for(let i=23;i<253;i++) {
      const expected = save.replaySteps[i];
      const action = env.legalActions().find(a=>a.actionId===expected.action.actionId);
      assert.deepEqual(action,expected.action);
      assert.equal(env.step(action).ok,true);
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after,expected.after);
      report.verifiedThrough=i;
    }
    report.checkpointPath="reports/iteration/r4-white-before-swap-20260906.json";
    fs.writeFileSync(report.checkpointPath,JSON.stringify(env.createCheckpoint()));
    report.observation=env.observe();
    const actions=env.legalActions();
    const start=performance.now();
    const result=env.runHeuristicPolicyDecision();
    report.ms=performance.now()-start;
    assert.equal(result.ok,true);
    report.chosen=result.policyDecision.actionId;
    report.recorded=save.replaySteps[253].action.actionId;
    report.matchesRecorded=report.chosen===report.recorded;
    report.plan=result.plan;
    report.diagnostics=env.getCounterfactualDiagnostics();
    report.outcomePath="reports/iteration/r4-white-swap-outcomes-20260906.json.gz";
    fs.writeFileSync(report.outcomePath,zlib.gzipSync(JSON.stringify(result.actionOutcomes)));
    const context={seatId:"player-white",observation:report.observation,actionOutcomes:result.actionOutcomes};
    report.values=result.actionOutcomes.map(outcome=>{
      const action=actions.find(a=>a.actionId===outcome.actionId);
      const value=evaluator.evaluateOutcome(context,action);
      return {action,value,completeness:outcome.searchCompleteness,
        selectedLeaf:outcome.leaves.find(l=>l.leafId===value.selectedLeafId)||null};
    });
    report.passed=true;
  }catch(error){report.passed=false;report.error={message:error.message,stack:error.stack};process.exitCode=1;}
  finally{
    env.dispose();fs.writeFileSync(output,JSON.stringify(report));
    console.log(JSON.stringify({output,passed:report.passed,ms:report.ms,chosen:report.chosen,
      matches:report.matchesRecorded,nodes:report.diagnostics?.executedNodeCount,
      values:report.values?.map(v=>({action:v.action.summary,score:v.value.score,
        actual:v.value.actualScoreDelta,chain:v.selectedLeaf?.actionChain,completeness:v.completeness})),error:report.error},null,2));
  }
}
