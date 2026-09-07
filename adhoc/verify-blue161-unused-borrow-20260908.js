"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const req=require("node:module").createRequire(process.cwd()+"/adhoc/borrow.js");
const {createSimulationEnv}=req("../randomizer/app/simulation-env");
const output="/Users/bilibili/code/seti-simu/reports/iteration/blue161-unused-borrow-20260908.json";
if(fs.existsSync(output)){console.log(`已有checkpoint：${output}`);process.exit(0);}
const root=JSON.parse(fs.readFileSync("/Users/bilibili/code/seti-simu/reports/iteration/blue161-candidates-20260908.json"));
const report={passed:false,source:"blue161-candidates-20260908.json",scope:"只重放已保存扫描优胜链，删去无后续卫星登陆的借橙4动作；不运行搜索"};
let env,fork;
try{
  assert.equal(root.passed,true);
  const record=JSON.parse(fs.readFileSync("reports/research/68307c5f.a7d65847.full.json"));
  const save=JSON.parse(fs.readFileSync(record.savePath));
  const config=JSON.parse(fs.readFileSync("reports/iteration/data-root-53-aaaed8d0-20260907.json")).root.config;
  env=createSimulationEnv();env.reset(config);
  for(const expected of save.replaySteps.slice(0,160)){const action=env.legalActions().find(a=>a.actionId===expected.action.actionId);assert.deepEqual(action,expected.action);assert.equal(env.step(action).ok,true);}
  fork=env.createCounterfactualFork().composition;
  const actions=root.leaf.planSteps.map(s=>s.action);
  const index=actions.findIndex(a=>a.family==="industry");
  assert.ok(index>=0);assert.equal(actions[index+1].summary,"借用 orange4");
  assert.ok(actions.slice(index+2).every(a=>["place_data","choose_target","end_turn"].includes(a.family)));
  report.removed=actions.slice(index,index+2);
  const key=a=>JSON.stringify([a.family,a.phase,a.target,a.payload]);
  report.submitted=[];
  let pending=false;
  for(const expected of actions.filter((_,i)=>i!==index&&i!==index+1)){
    const inspected=fork.inspect(),decision=inspected.session?.decision;
    const legal=inspected.phase==="awaiting_input"?decision.choices:fork.inputPort.enumerateActions();
    const candidates=legal.filter(a=>key(a)===key(expected));assert.equal(candidates.length,1,expected.summary);
    const action=candidates[0];
    const result=action.phase==="conditional"?fork.inputPort.submitDecision({decisionId:decision.decisionId,decisionVersion:decision.decisionVersion,ownerId:decision.ownerId,choice:action}):fork.inputPort.submitAction(action);
    assert.equal(result.ok,true);report.submitted.push(action);
    if(action.family==="end_turn")pending=true;
    if(pending){const advanced=fork.counterfactualPort.advanceFocalPlanningTurn("player-blue");if(advanced.ok)pending=false;else assert.equal(advanced.code,"COUNTERFACTUAL_FOCAL_TURN_SESSION_PENDING");}
  }
  report.originalEnvelope=root.verifiedEnvelope;
  report.withoutBorrowEnvelope=fork.lifecycle.save().envelope;
  const before=JSON.parse(report.originalEnvelope.committedState),after=JSON.parse(report.withoutBorrowEnvelope.committedState);
  report.changedTopLevelKeys=Object.keys(before).filter(k=>JSON.stringify(before[k])!==JSON.stringify(after[k]));
  report.playerChanges={};
  for(const a of before.players.players){const b=after.players.players.find(p=>p.id===a.id);report.playerChanges[a.id]=Object.fromEntries([...new Set([...Object.keys(a),...Object.keys(b)])].filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k])).map(k=>[k,{before:a[k],after:b[k]}]));}
  for(const k of ["cards","data","pieces","planets","aliens","tech","solarSystem","finalScoring","turn"])assert.deepEqual(after[k],before[k],k+"收益与盘面必须一致");
  for(const a of before.players.players){const b=after.players.players.find(p=>p.id===a.id);for(const k of ["resources","income","hand","techState","scoreSources"])assert.deepEqual(b[k],a[k],a.id+"."+k);}
  report.passed=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
finally{fork?.dispose();env?.dispose();fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify({output,passed:report.passed,error:report.error,changedTopLevelKeys:report.changedTopLevelKeys,playerChanges:report.playerChanges},null,2));}
