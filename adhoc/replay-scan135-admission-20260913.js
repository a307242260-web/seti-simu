"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict"),{execFileSync}=require("node:child_process");
const codeRoot=process.argv[3]||require("node:path").resolve(__dirname,"..");
const {createSimulationRuleComposition}=require(codeRoot+"/randomizer/game/production-kernel");
const {createSeededRandom}=require(codeRoot+"/randomizer/game/random");
const {buildRuleObservation}=require(codeRoot+"/randomizer/app/rule-observation");
const evaluator=require(codeRoot+"/randomizer/game/ai/expected-score-evaluator");
const commit=execFileSync("git",["rev-parse","--short","HEAD"],{cwd:codeRoot,encoding:"utf8"}).trim();
const output=`adhoc/scan135-admission-${commit}-20260913.json`;
if(fs.existsSync(output)){console.log(`[skip] ${output}`);process.exit(0);}
assert(process.argv[2],"需要已保存的新优胜计划文件");
const trace=JSON.parse(fs.readFileSync(process.argv[2]));
const input=JSON.parse(fs.readFileSync("adhoc/scan-cost135-input-20260913.json"));
const seed=input.checkpoint.config.seed,seat="player-green";
const c=createSimulationRuleComposition({seed,random:createSeededRandom(seed),trustedForkLifecycle:true}).composition;
const legal=()=>{const s=c.inspect();return s.phase==="awaiting_input"?s.session.decision.choices:c.inputPort.enumerateActions({});};
const observe=()=>buildRuleObservation(c.projection({role:"simulation"}).state,seed,seat,legal());
const chain=[],rows=[];
const submit=a=>{assert(a);const s=c.inspect();const r=s.phase==="awaiting_input"?c.inputPort.submitDecision({decisionId:s.session.decision.decisionId,
  decisionVersion:s.session.decision.decisionVersion,ownerId:s.session.decision.ownerId,choice:a}):c.inputPort.submitAction(a);
  assert.equal(r.ok,true,JSON.stringify(r));chain.push(a.actionId);
  if(a.family==="end_turn"){const advanced=c.counterfactualPort.advanceFocalPlanningTurn(seat);assert.equal(advanced.ok,true,JSON.stringify(advanced));}
};
try{
  assert.equal(c.lifecycle.restore(input.checkpoint.coreState.compositionEnvelope).ok,true);
  let previous=legal().find(a=>a.actionId===trace.actionId);submit(previous);
  // 前12个后继都只消费根已知牌，止于第一次第三色痕迹揭示前，不使用真实未知物种推进假设链。
  for(const step of trace.plan.steps.slice(0,12)){
    const actions=legal(),observation=observe();
    const chosen=actions.find(a=>a.actionId===step.actionId);
    assert(chosen,`正式输入缺失 ${step.actionId}`);
    const selected=evaluator.selectSecondaryAgentSuccessors({focalSeatId:seat,currentAction:previous,
      branchObservation:observation,legalSuccessors:actions,actionChain:chain,
      routeTargetId:step.routeTargetId,routePlanId:step.routePlanId,routeResultTargetIds:[step.routeTargetId]});
    rows.push({index:rows.length,action:chosen,routeTargetId:step.routeTargetId,routePlanId:step.routePlanId,
      admitted:selected.some(a=>a.actionId===chosen.actionId),selectedIds:selected.map(a=>a.actionId),
      movement:observation.probeRouteRequirements?.movementContext});
    submit(chosen);previous=chosen;
  }
  const record={commit,source:process.argv[2],scope:"正式隔离fork重放已保存新计划前12步，检查同绑定局部后继准入；不证明全局beam顺序或隐藏后继。",rows};
  fs.writeFileSync(output,JSON.stringify(record,null,2)+"\n",{flag:"wx"});console.log(JSON.stringify({output,rows:rows.map(r=>({index:r.index,action:r.action.summary,admitted:r.admitted,movement:r.movement?.phase}))}));
}finally{c.dispose();}
