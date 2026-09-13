"use strict";
const fs=require("node:fs"),assert=require("node:assert/strict");
const {createSimulationRuleComposition}=require("../randomizer/game/production-kernel");
const {createSeededRandom}=require("../randomizer/game/random");
const {buildRuleObservation}=require("../randomizer/app/rule-observation");
const evaluator=require("../randomizer/game/ai/expected-score-evaluator");
const output="adhoc/income37-prefix-20260913.json";
if(fs.existsSync(output)){console.log(`[skip] ${output}`);process.exit(0);}
const input=require("./budget37-input-20260913.json"),trace=require("./income37-ea6ed08f-20260913.json");
const seed=input.checkpoint.config.seed,seat="player-green";
const c=createSimulationRuleComposition({seed,random:createSeededRandom(seed),trustedForkLifecycle:true}).composition;
const legal=()=>{const s=c.inspect();return s.phase==="awaiting_input"?s.session.decision.choices:c.inputPort.enumerateActions({});};
const rows=[];
try{
  assert.equal(c.lifecycle.restore(input.checkpoint.coreState.compositionEnvelope).ok,true);
  for(const id of [trace.actionId,...trace.plan.steps.slice(0,8).map(s=>s.actionId)]){
    const actions=legal(),a=actions.find(a=>a.actionId===id);assert(a,`缺失${id}`);
    if(a.target?.choiceId?.startsWith("income:")){
      const observation=buildRuleObservation(c.projection({role:"simulation"}).state,seed,seat,actions);
      const selected=evaluator.selectSecondaryAgentSuccessors({focalSeatId:seat,branchObservation:observation,
        legalSuccessors:actions,routeTargetId:"orbit:mars:planet:",routePlanId:"probe:rocket:1:orbit:mars:planet:"});
      rows.push({incomeChoices:actions.map(x=>x.actionId),selected:selected.map(x=>x.actionId)});
      assert(!selected.some(x=>x.actionId==="choose_card:e72339e2"),"旧收入选择应由贪心删除");
    }
    const s=c.inspect(),r=s.phase==="awaiting_input"?c.inputPort.submitDecision({decisionId:s.session.decision.decisionId,
      decisionVersion:s.session.decision.decisionVersion,ownerId:s.session.decision.ownerId,choice:a}):c.inputPort.submitAction(a);
    assert.equal(r.ok,true,JSON.stringify(r));rows.push({action:a});
    if(a.family==="end_turn")assert.equal(c.counterfactualPort.advanceFocalPlanningTurn(seat).ok,true);
  }
  fs.writeFileSync(output,JSON.stringify({scope:"只核验根已公开dlc21的精选与打出，以及收入分支删除；收入发生的真实盲抽不作为搜索评分证据，不证明整条假设链收益。",rows},null,2)+"\n",{flag:"wx"});
  console.log(`[正式前缀核验，无AI] 9次输入通过；旧收入后继被删除；${output}`);
}finally{c.dispose();}
