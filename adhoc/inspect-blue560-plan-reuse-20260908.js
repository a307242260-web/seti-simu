"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const req=require("node:module").createRequire(process.cwd()+"/adhoc/reuse560.js");
const {createSimulationEnv}=req("../randomizer/app/simulation-env");
const continuation=req("../randomizer/game/ai/plan-continuation");
const base="/Users/bilibili/code/seti-simu/reports/iteration/";
const output=base+"blue560-plan-reuse-20260908.json";
if(fs.existsSync(output)){console.log(`已有checkpoint：${output}`);process.exit(0);}
const report={passed:false,cases:[]};let env;
try{
  const config=JSON.parse(fs.readFileSync("reports/iteration/data-root-53-aaaed8d0-20260907.json")).root.config;
  const record=JSON.parse(fs.readFileSync("reports/research/1969fccc.addcef7f.full.json"));
  const save=JSON.parse(fs.readFileSync(record.savePath));
  env=createSimulationEnv();env.reset(config);
  for(const mode of ["baseline","candidate"]){
    const source=JSON.parse(fs.readFileSync(base+`blue536-turing-${mode}-20260908.json`));
    const checkpoint=env.createCheckpoint();delete checkpoint.replaySteps;
    checkpoint.coreState.committedState=source.rootEnvelope.committedState;
    checkpoint.coreState.compositionEnvelope=source.rootEnvelope;
    env.loadCheckpoint(checkpoint);
    let plan=source.plan,lastBlueTurn=null;
    const result={mode,checks:[],intervening:[]};
    for(let step=536;step<=560;step++){
      const observation=env.observe("player-blue"),legal=env.legalActions();
      const expected=save.replaySteps[step-1].action;
      if(step>536&&expected.actorId==="player-blue"){
        const turn=`${observation.publicState.roundNumber}:${observation.publicState.turnNumber}`;
        const reuse=continuation.planReuseCheck(plan,observation,legal,{sameTurn:turn===lastBlueTurn});
        result.checks.push({step,nextActionId:plan?.nextActionId,hit:reuse.hit,reason:reuse.reason,affected:reuse.affected,
          expected:source.leaf.planSteps.find(s=>s.action.actionId===plan?.nextActionId)?.action,
          actualLegal:step===560?legal:undefined});
        if(reuse.hit)plan=reuse.nextPlan;
        else if(step<560)throw new Error(`unexpected early miss ${mode}/${step}: ${reuse.reason}`);
      }
      if(step===560)break;
      const action=legal.find(a=>a.actionId===expected.actionId);assert.ok(action);assert.deepEqual(action,expected);
      assert.equal(env.step(action).ok,true);
      if(expected.actorId==="player-blue")lastBlueTurn=`${observation.publicState.roundNumber}:${observation.publicState.turnNumber}`;
      if(expected.target?.kind==="planet-reward-alien-trace")result.intervening.push({step,action});
    }
    report.cases.push(result);
  }
  report.passed=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
finally{env?.dispose();fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify(report,null,2));}
