"use strict";
// 只重放既有正式输入，无AI搜索；旋转逐步取证，终局来源分逐项对账。
const fs=require("node:fs"),assert=require("node:assert/strict");
const req=require("node:module").createRequire(process.cwd()+"/adhoc/board-score.js");
const {createSimulationEnv}=req("../randomizer/app/simulation-env");
const base="/Users/bilibili/code/seti-simu/";
const output=base+"reports/iteration/white-expiry-board-score-native-20260908.json";
if(fs.existsSync(output)){console.log(`已有checkpoint：${output}`);process.exit(0);}
const report={passed:false,versions:[]};let env;
try{
 for(const [key,end] of [["b7968542.cbf7966f",173],["cb456d23.04648dd1",193]]){
  const record=JSON.parse(fs.readFileSync(base+"reports/research/"+key+".full.json"));
  const save=JSON.parse(fs.readFileSync(base+record.savePath));
  const final=JSON.parse(save.committedState),white=final.players.players.find(p=>p.id==="player-white");
  const v={key,scoreSources:white.scoreSources,final:final.match.finalScores.find(p=>p.playerId==="player-white"),rotations:[],scoreEvents:[]};
  assert.equal(Object.values(white.scoreSources).reduce((a,b)=>a+b,0),v.final.baseScore);
  let previous=0;
  for(const [i,x] of save.replaySteps.entries()){
   const score=x.after.p["player-white"][0];
   if(score!==previous)v.scoreEvents.push({step:i+1,round:x.after.r,turn:x.after.t,actor:x.action.actorId,action:x.action.summary,delta:score-previous,score});
   previous=score;
  }
  env=createSimulationEnv();env.reset(JSON.parse(fs.readFileSync("reports/iteration/data-root-53-aaaed8d0-20260907.json")).root.config);
  let last=JSON.parse(env.saveBrowserSave().committedState).solarSystem.rotation;
  for(const [i,x] of save.replaySteps.slice(0,end).entries()){
   const a=env.legalActions().find(a=>a.actionId===x.action.actionId);assert.deepEqual(a,x.action);assert.equal(env.step(a).ok,true);
   const current=env.saveBrowserSave();assert.deepEqual(current.replaySteps.at(-1).after,x.after);
   const rotation=JSON.parse(current.committedState).solarSystem.rotation;
   if(JSON.stringify(rotation)!==JSON.stringify(last))v.rotations.push({step:i+1,round:x.after.r,turn:x.after.t,actor:a.actorId,action:a.summary,target:a.target,before:last,after:rotation});
   last=rotation;
  }
  const root=JSON.parse(env.saveBrowserSave().committedState);
  const expected=JSON.parse(JSON.parse(fs.readFileSync(base+"reports/iteration/white-r2-expiry-"+(key.startsWith("b796")?"baseline":"candidate")+"-20260908.json")).rootEnvelope.committedState);
  assert.deepEqual(root.solarSystem,expected.solarSystem);
  v.rootRotation=last;report.versions.push(v);env.dispose();env=null;
 }
 const [a,b]=report.versions;
 report.sourceDeltas=Object.keys(a.scoreSources).map(key=>({key,before:a.scoreSources[key],after:b.scoreSources[key],delta:b.scoreSources[key]-a.scoreSources[key]}));
 report.passed=true;
}catch(e){report.error=e.stack;process.exitCode=1;}
finally{env?.dispose();fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify({output,passed:report.passed,error:report.error,sourceDeltas:report.sourceDeltas,rotations:report.versions.map(v=>({key:v.key,events:v.rotations.map(x=>({step:x.step,actor:x.actor,action:x.action,count:x.after.rotationCount}))}))},null,2));}
