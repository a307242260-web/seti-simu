"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationEnv } = require("../randomizer/app/simulation-env");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = process.argv.includes("--details-v2")
  ? "reports/iteration/expired-sector-root-469-v2-20260908.json"
  : "reports/iteration/expired-sector-root-469-20260908.json";
if (fs.existsSync(output)) console.log(`已有单根：${output}`);
else {
  const env = createSimulationEnv(), report = { scope:"过期扇区目标修复后唯一469单根，不重跑完整局" };
  try {
    const old = JSON.parse(fs.readFileSync("reports/iteration/green-round4-candidate-clusters-20260908.json"));
    const record = JSON.parse(fs.readFileSync(`reports/research/${old.file}`));
    const save = JSON.parse(fs.readFileSync(record.savePath));
    const config = JSON.parse(fs.readFileSync("reports/iteration/data-root-53-aaaed8d0-20260907.json")).root.config;
    env.reset({ ...config, traceCounterfactualGoalClusters:true });
    for (const expected of save.replaySteps.slice(0,468)) {
      const action = env.legalActions().find(a=>a.actionId===expected.action.actionId);
      assert.deepEqual(action,expected.action); assert.equal(env.step(action).ok,true);
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after,expected.after);
    }
    assert.deepEqual(env.observe("player-green"),old.before);
    const legal=env.legalActions(), start=performance.now(), result=env.runHeuristicPolicyDecision();
    report.wallMs=performance.now()-start;
    assert.equal(result.ok,true); assert.ok(report.wallMs<30000);
    report.decision=result.policyDecision; report.plan=result.plan; report.searches=result.searches;
    report.fullDiagnostics=env.getCounterfactualDiagnostics();
    for(const s of result.searches)assert.deepEqual(s.diagnostics.failedNodeCountByCode,{});
    report.roots=result.actionOutcomes.map(outcome=>{
      const action=legal.find(a=>a.actionId===outcome.actionId); assert.ok(action);
      if(outcome.status!=="settled")return {action,status:outcome.status};
      const e=evaluator.evaluateOutcome({seatId:"player-green",observation:outcome.rootObservation,actionOutcomes:[outcome]},action,{});
      if (e.selectable === false) {
        assert.ok(e.reasonCodes?.length, "不可选结果必须有明确拒绝原因");
        return {action,status:outcome.status,evaluation:e,leafCount:outcome.leaves.length};
      }
      const leaf=outcome.leaves.find(l=>l.leafId===e.selectedLeafId); assert.ok(leaf);
      return {action,score:e.score,actualScoreDelta:e.actualScoreDelta,terminalReason:leaf.terminalReason,
        target:e.routeTargetId,leafCount:outcome.leaves.length,actionChain:leaf.actionChain,
        chain:leaf.planSteps?.map(s=>({action:s.action,goalDepth:s.goalDepth,routeTargetId:s.routeTargetId}))};
    });
    report.before={wallMs:old.wallMs,searches:old.searches,decision:old.decision};
    report.passed=true;
  }catch(error){report.error=error.stack;process.exitCode=1;}
  finally{env.dispose();fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
    console.log(JSON.stringify({output,passed:report.passed,error:report.error,wallMs:report.wallMs,
      decision:report.decision?.actionId,roots:report.roots?.filter(r=>r.score!=null).map(r=>({action:r.action.summary,score:r.score}))}));}
}
