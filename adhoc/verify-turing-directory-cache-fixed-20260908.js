"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const req=require("node:module").createRequire(process.cwd()+"/adhoc/turing-cache.js");
const {createSimulationEnv}=req("../randomizer/app/simulation-env");
const mode=process.argv[2];
assert.ok(["warm","cold-orange3","cold-orange4"].includes(mode));
const base="/Users/bilibili/code/seti-simu/reports/iteration/";
const output=process.cwd()+`/reports/iteration/turing-directory-cache-fixed-${mode}-20260908.json`;
if(fs.existsSync(output)){console.log(`已有checkpoint：${output}`);process.exit(0);}
const report={mode,passed:false,cases:[]};
let env,fork;
try{
  const config=JSON.parse(fs.readFileSync("reports/iteration/data-root-53-aaaed8d0-20260907.json")).root.config;
  env=createSimulationEnv();env.reset(config);fork=env.createCounterfactualFork().composition;
  if(mode==="warm"){
    const original=JSON.parse(fs.readFileSync(base+"blue161-candidates-20260908.json")).rootEnvelope;
    for(const tile of ["orange3","orange4"]){
      assert.equal(fork.lifecycle.restore(original).ok,true);
      const before=fork.projection({playerId:"player-blue",role:"player"}).state.probeRouteRequirements;
      const company=fork.inputPort.enumerateActions().find(a=>a.family==="industry"&&a.target.abilityId==="turing_borrow_tech");
      assert.ok(company);assert.equal(fork.inputPort.submitAction(company).ok,true);
      const d=fork.inspect().session.decision;
      const choice=d.choices.find(a=>a.target.tileId===tile);assert.ok(choice);
      assert.equal(fork.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice}).ok,true);
      const envelope=fork.lifecycle.save().envelope;
      const start=performance.now(),after=fork.projection({playerId:"player-blue",role:"player"}).state.probeRouteRequirements;
      report.cases.push({tile,before,after,envelope,projectionMs:performance.now()-start});
    }
  }else{
    const tile=mode.slice(5);
    const source=JSON.parse(fs.readFileSync(process.cwd()+"/reports/iteration/turing-directory-cache-fixed-warm-20260908.json")).cases.find(c=>c.tile===tile);
    assert.ok(source);assert.equal(fork.lifecycle.restore(source.envelope).ok,true);
    assert.equal(fork.lifecycle.save().envelope.committedState,source.envelope.committedState);
    const start=performance.now(),after=fork.projection({playerId:"player-blue",role:"player"}).state.probeRouteRequirements;
    report.cases.push({tile,after,projectionMs:performance.now()-start,sameCommittedState:true,
      warmEqualsCold:JSON.stringify(source.after)===JSON.stringify(after)});
  }
  if(mode!=="warm") assert.equal(report.cases[0].warmEqualsCold,true);
  report.passed=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
finally{fork?.dispose();env?.dispose();fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify({output,passed:report.passed,error:report.error,cases:report.cases.map(c=>({tile:c.tile,projectionMs:c.projectionMs,warmEqualsCold:c.warmEqualsCold,beforeCount:c.before?.candidates?.length,afterCount:c.after?.candidates?.length}))},null,2));}
