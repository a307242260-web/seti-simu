"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const {createSimulationEnv}=require("../randomizer/app/simulation-env"),continuation=require("../randomizer/game/ai/plan-continuation");
const output="reports/iteration/white-gap-plan-trace-20260907.json";
if(fs.existsSync(output))console.log("已有白方计划失效证据，不重复重放");else{
  const root=JSON.parse(fs.readFileSync("reports/iteration/white-gap-roots-20260907.json")).rows.find(r=>r.step===191);
  const saved=JSON.parse(fs.readFileSync("reports/iteration/white-gap-ranking-191-20260907.json"));
  const record=JSON.parse(fs.readFileSync("reports/research/aed4e5db.1f55695a.full.json")),save=JSON.parse(fs.readFileSync(record.savePath));
  const report={scope:"白191已保存计划在真实后续轨迹的首次失效检查；之后只保存214/235真实前态，不运行搜索",checks:[],roots:[],events:[]};
  const env=createSimulationEnv();
  try{
    env.loadCheckpoint(root.checkpoint);let plan=saved.plan,turn=env.observe().publicState,invalidated=false;
    for(let i=190;i<235;i++){
      const expected=save.replaySteps[i],observation=env.observe(),actions=env.legalActions(),action=actions.find(a=>a.actionId===expected.action.actionId);
      assert.deepEqual(action,expected.action);
      if([214,235].includes(i+1)){const checkpoint=env.createCheckpoint();delete checkpoint.replaySteps;report.roots.push({step:i+1,checkpoint});}
      if(i>190&&expected.actorPlayerId==="player-white"&&!invalidated){
        const current=observation.publicState,reuse=continuation.planReuseCheck(plan,observation,actions,{sameTurn:current.roundNumber===turn.roundNumber&&current.turnNumber===turn.turnNumber});
        report.checks.push({step:i+1,hit:reuse.hit,reason:reuse.reason||null,affected:reuse.affected||null,expectedPlanAction:plan.nextActionId,actual:action.actionId});
        if(reuse.hit){assert.equal(reuse.action.actionId,action.actionId);plan=reuse.nextPlan;turn=current;}
        else{invalidated=true;report.firstMiss={step:i+1,...reuse};}
      }
      assert.equal(env.step(action).ok,true);assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after,expected.after);
      if([208,223,224,234].includes(i+1))report.events.push({step:i+1,action,committedState:env.createCheckpoint().coreState.committedState});
    }
    assert.ok(report.firstMiss);report.passed=true;
  }catch(error){report.passed=false;report.error={message:error.message,stack:error.stack};process.exitCode=1;}
  finally{env.dispose();fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify({passed:report.passed,checks:report.checks,firstMiss:report.firstMiss,error:report.error},null,2));}
}
