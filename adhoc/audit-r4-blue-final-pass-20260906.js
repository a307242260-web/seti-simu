"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const {createSimulationEnv}=require("../randomizer/app/simulation-env");
const output="reports/iteration/r4-blue-final-pass-20260906.json";
if(fs.existsSync(output))console.log(`已有记录，未重跑：${output}`);
else{
 const read=p=>JSON.parse(fs.readFileSync(p));
 const record=read("reports/research/7a4c63fd.0d21aebf.full.json"),save=read(record.savePath);
 const report={scope:"正式重放到蓝方末轮PASS前；检查未使用数据，不运行AI搜索",savePath:record.savePath};
 const env=createSimulationEnv();
 try{
  const initial=read("reports/iteration/r3-actual-opening-plan-20260906.json").beforeRoot;
  delete initial.replaySteps;env.loadCheckpoint(initial);
  const target=save.replaySteps.findIndex((step,i)=>i>23&&step.actorPlayerId==="player-blue"&&step.action.family==="pass"&&save.replaySteps[i-1].after.r===4);
  assert.ok(target>23);
  for(let i=23;i<target;i++){
   const expected=save.replaySteps[i],action=env.legalActions().find(a=>a.actionId===expected.action.actionId);
   assert.deepEqual(action,expected.action);assert.equal(env.step(action).ok,true);
   assert.deepEqual(env.saveBrowserSave().replaySteps.at(-1).after,expected.after);
  }
  report.targetIndex=target;report.observation=env.observe();report.actions=env.legalActions();
  report.checkpointPath="reports/iteration/r4-blue-before-final-pass-20260906.json";
  fs.writeFileSync(report.checkpointPath,JSON.stringify(env.createCheckpoint()));report.passed=true;
 }catch(error){report.passed=false;report.error={message:error.message,stack:error.stack};process.exitCode=1;}
 finally{env.dispose();fs.writeFileSync(output,JSON.stringify(report));console.log(JSON.stringify({output,passed:report.passed,targetIndex:report.targetIndex,
  player:report.observation?.publicState.players.find(p=>p.playerId==="player-blue"),data:report.observation?.dataAnalyzeRequirements,
  actions:report.actions?.map(a=>({family:a.family,summary:a.summary,target:a.target})),error:report.error},null,2));}
}
