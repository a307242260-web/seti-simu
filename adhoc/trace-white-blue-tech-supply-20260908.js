"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const req=require("node:module").createRequire(process.cwd()+"/adhoc/tech-marks.js");
const {createSimulationEnv}=req("../randomizer/app/simulation-env");
const base="/Users/bilibili/code/seti-simu/",output=base+"reports/iteration/white-blue-tech-supply-20260908.json";
if(fs.existsSync(output)){console.log(`已有checkpoint：${output}`);process.exit(0);}
const report={passed:false,versions:[]};let env;
try{
 for(const key of ["b7968542.cbf7966f","cb456d23.04648dd1"]){
  const record=JSON.parse(fs.readFileSync(base+"reports/research/"+key+".full.json"));
  const save=JSON.parse(fs.readFileSync(base+record.savePath));
  const v={key,tech:[],marks:[],thresholds:[],researchRoots:[]};
  env=createSimulationEnv();env.reset(JSON.parse(fs.readFileSync("reports/iteration/data-root-53-aaaed8d0-20260907.json")).root.config);
  let state=JSON.parse(env.saveBrowserSave().committedState);
  for(const [i,x] of save.replaySteps.entries()){
   const before=state.players.players.find(p=>p.id==="player-white");
   if(x.action.actorId==="player-white"&&x.action.summary.startsWith("研究 blue"))v.researchRoots.push({step:i+1,round:x.after.r,turn:x.after.t,action:x.action,white:before,tech:state.tech,legal:env.legalActions()});
   const a=env.legalActions().find(a=>a.actionId===x.action.actionId);assert.deepEqual(a,x.action);assert.equal(env.step(a).ok,true);
   const current=env.saveBrowserSave();assert.deepEqual(current.replaySteps.at(-1).after,x.after);state=JSON.parse(current.committedState);
   const after=state.players.players.find(p=>p.id==="player-white");
   const event={step:i+1,round:x.after.r,turn:x.after.t,actor:a.actorId,action:a.summary};
   // scoreSources为稀疏累计来源，未发生过的来源按0计，仅用于账本差额。
   const delta=(after.scoreSources?.techBonusScore||0)-(before.scoreSources?.techBonusScore||0);
   if(delta||a.actorId==="player-white"&&a.summary.startsWith("研究 "))v.tech.push({...event,delta,total:after.scoreSources.techBonusScore,target:a.target});
   for(const n of [25,50,70])if(before.resources.score<n&&after.resources.score>=n)v.thresholds.push({...event,threshold:n,before:before.resources.score,after:after.resources.score});
   if(a.target?.choiceId?.startsWith("final:"))v.marks.push({...event,tiles:state.finalScoring.tiles});
  }
  assert.deepEqual(state,JSON.parse(save.committedState),"完整正式重放终态必须匹配");
  v.finalMatch=true;report.versions.push(v);env.dispose();env=null;
 }
 report.passed=true;
}catch(e){report.error=e.stack;process.exitCode=1;}
finally{env?.dispose();fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify({...report,versions:report.versions.map(v=>({...v,marks:v.marks.map(({tiles,...e})=>e),researchRoots:v.researchRoots.map(x=>({step:x.step,action:x.action.summary,tech:x.tech,choices:x.legal.map(a=>a.summary)}))}))},null,2));}
