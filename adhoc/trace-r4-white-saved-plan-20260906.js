"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const {createSimulationEnv}=require("../randomizer/app/simulation-env");
const continuation=require("../randomizer/game/ai/plan-continuation");
const output="reports/iteration/r4-white-saved-plan-trace-20260906.json";
if(fs.existsSync(output))console.log(`已有记录，未重跑：${output}`);
else{
  const read=p=>JSON.parse(fs.readFileSync(p));
  const source=read("reports/iteration/r4-white-swap-plan-20260906.json");
  const save=read(read("reports/research/7a4c63fd.0d21aebf.full.json").savePath);
  const report={scope:"从导出失败记录保留的真实rootPlan做纯计划核对；不运行AI搜索",checks:[]};
  const env=createSimulationEnv();
  try{
    assert.ok(source.rootPlan);
    const initial=read("reports/iteration/r3-actual-opening-plan-20260906.json").beforeRoot;
    delete initial.replaySteps;env.loadCheckpoint(initial);
    function replay(i,action){assert.deepEqual(action,save.replaySteps[i].action);assert.equal(env.step(action).ok,true);
      assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after,save.replaySteps[i].after);}
    for(let i=23;i<213;i++)replay(i,env.legalActions().find(a=>a.actionId===save.replaySteps[i].action.actionId));
    let turn=env.observe().publicState,plan=source.rootPlan;
    replay(213,env.legalActions().find(a=>a.actionId===source.rootAction));
    for(let i=214;i<=253;i++){
      const observation=env.observe(),actions=env.legalActions();
      let action=actions.find(a=>a.actionId===save.replaySteps[i].action.actionId);
      if(save.replaySteps[i].actorPlayerId==="player-white"){
        const current=observation.publicState;
        const reuse=continuation.planReuseCheck(plan,observation,actions,
          {sameTurn:current.roundNumber===turn.roundNumber&&current.turnNumber===turn.turnNumber});
        report.checks.push({step:i+1,hit:reuse.hit,reason:reuse.reason,chosen:reuse.action?.actionId,recorded:action?.actionId});
        if(!reuse.hit){report.stoppedAt=i;report.checkpointPath="reports/iteration/r4-white-plan-miss-20260906.json";
          fs.writeFileSync(report.checkpointPath,JSON.stringify(env.createCheckpoint()));break;}
        action=reuse.action;plan=reuse.nextPlan;turn=current;
      }
      replay(i,action);report.verifiedThrough=i;
    }
    report.passed=true;
  }catch(error){report.passed=false;report.error={message:error.message,stack:error.stack};process.exitCode=1;}
  finally{env.dispose();fs.writeFileSync(output,JSON.stringify(report));console.log(JSON.stringify(report,null,2));}
}
