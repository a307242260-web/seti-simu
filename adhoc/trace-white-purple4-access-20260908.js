"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const req=require("node:module").createRequire(process.cwd()+"/adhoc/purple4.js");
const {createSimulationEnv}=req("../randomizer/app/simulation-env");
const base="/Users/bilibili/code/seti-simu/",output=base+"reports/iteration/white-purple4-access-20260908.json";
if(fs.existsSync(output)){console.log(`已有checkpoint：${output}`);process.exit(0);}
const report={passed:false,versions:[]};let env;
try{
 for(const [key,end] of [["b7968542.cbf7966f",320],["cb456d23.04648dd1",301]]){
  const record=JSON.parse(fs.readFileSync(base+"reports/research/"+key+".full.json"));
  const save=JSON.parse(fs.readFileSync(base+record.savePath));
  const v={key,handEvents:[]};env=createSimulationEnv();env.reset(JSON.parse(fs.readFileSync("reports/iteration/data-root-53-aaaed8d0-20260907.json")).root.config);
  let state=JSON.parse(env.saveBrowserSave().committedState);
  for(const [i,x] of save.replaySteps.slice(0,end).entries()){
   const before=state.players.players.find(p=>p.id==="player-white").hand;
   const a=env.legalActions().find(a=>a.actionId===x.action.actionId);assert.deepEqual(a,x.action);assert.equal(env.step(a).ok,true);
   const current=env.saveBrowserSave();assert.deepEqual(current.replaySteps.at(-1).after,x.after);state=JSON.parse(current.committedState);
   const after=state.players.players.find(p=>p.id==="player-white").hand;
   if(JSON.stringify(before)!==JSON.stringify(after))v.handEvents.push({step:i+1,round:x.after.r,turn:x.after.t,actor:a.actorId,action:a.summary,
    added:after.filter(c=>!before.some(b=>b.id===c.id)),removed:before.filter(c=>!after.some(b=>b.id===c.id))});
  }
  v.white=state.players.players.find(p=>p.id==="player-white");v.legal=env.legalActions();v.observation=env.observe("player-white");
  report.versions.push(v);env.dispose();env=null;
 }
 report.passed=true;
}catch(e){report.error=e.stack;process.exitCode=1;}
finally{env?.dispose();fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify({output,passed:report.passed,error:report.error,versions:report.versions.map(v=>({key:v.key,resources:v.white.resources,hand:v.white.hand.map(c=>c.cardId),research:v.legal.filter(a=>a.family==="research_tech"),dlc15:v.handEvents.filter(e=>[...e.added,...e.removed].some(c=>c.cardId==="dlc_15.png"))}))},null,2));}
