"use strict";
const fs=require("node:fs"),zlib=require("node:zlib"),assert=require("node:assert/strict");
const {createSimulationEnv}=require("../randomizer/app/simulation-env");
const continuation=require("../randomizer/game/ai/plan-continuation");
const output="reports/iteration/r4-white-swap-plan-20260906.json";
if(fs.existsSync(output))console.log(`已有记录，未重跑：${output}`);
else{
  const read=p=>JSON.parse(fs.readFileSync(p));
  const save=read(read("reports/research/7a4c63fd.0d21aebf.full.json").savePath);
  const report={scope:"复现同提交续跑后白方首次冷搜索，再仅用纯计划检查及保存动作推进到换牌；遇计划失效就停止，不追加搜索",checks:[]};
  const env=createSimulationEnv();
  try{
    const start=read("reports/iteration/r3-actual-opening-plan-20260906.json").beforeRoot;
    delete start.replaySteps;env.loadCheckpoint(start);
    function replay(index,action){
      assert.deepEqual(action,save.replaySteps[index].action);
      assert.equal(env.step(action).ok,true);
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after,save.replaySteps[index].after);
    }
    for(let i=23;i<213;i++)replay(i,env.legalActions().find(a=>a.actionId===save.replaySteps[i].action.actionId));
    let turn=env.observe().publicState;
    const begin=performance.now(),decision=env.runHeuristicPolicyDecision();
    report.ms=performance.now()-begin;assert.equal(decision.ok,true);
    assert.equal(decision.policyDecision.actionId,save.replaySteps[213].action.actionId);
    assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after,save.replaySteps[213].after);
    report.rootAction=decision.policyDecision.actionId;report.rootPlan=decision.plan;
    report.outcomesPath="reports/iteration/r4-white-land-plan-outcomes-20260906.json.gz";
    fs.writeFileSync(report.outcomesPath,zlib.gzipSync(JSON.stringify(decision.actionOutcomes)));
    let plan=decision.plan;
    for(let i=214;i<=253;i++){
      const observation=env.observe(),actions=env.legalActions();
      let action=actions.find(a=>a.actionId===save.replaySteps[i].action.actionId);
      if(save.replaySteps[i].actorPlayerId==="player-white"){
        const current=observation.publicState;
        const reuse=continuation.planReuseCheck(plan,observation,actions,
          {sameTurn:current.roundNumber===turn.roundNumber&&current.turnNumber===turn.turnNumber});
        report.checks.push({step:i+1,hit:reuse.hit,reason:reuse.reason,action:reuse.action?.actionId,recorded:action?.actionId});
        if(!reuse.hit){
          report.stoppedAt=i;report.checkpointPath="reports/iteration/r4-white-plan-miss-20260906.json";
          fs.writeFileSync(report.checkpointPath,JSON.stringify(env.createCheckpoint()));break;
        }
        action=reuse.action;plan=reuse.nextPlan;turn=current;
      }
      replay(i,action);report.verifiedThrough=i;
    }
    report.passed=true;
  }catch(error){report.passed=false;report.error={message:error.message,stack:error.stack};process.exitCode=1;}
  finally{env.dispose();fs.writeFileSync(output,JSON.stringify(report));console.log(JSON.stringify({output,passed:report.passed,ms:report.ms,checks:report.checks,error:report.error},null,2));}
}
