"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationRuleComposition } = require("../randomizer/game/production-kernel");
const { createSeededRandom } = require("../randomizer/game/random");
const { buildRuleObservation } = require("../randomizer/app/rule-observation");
const output = "adhoc/budget485-scan4-20260913.json";
if (fs.existsSync(output)) { console.log(`[skip] ${output}`); process.exit(0); }
const input = JSON.parse(fs.readFileSync("adhoc/budget485-input-20260913.json"));
const trace = JSON.parse(fs.readFileSync("adhoc/budget485-trace-093a25c6-20260913.json"));
const seed = input.checkpoint.config.seed, seat = "player-green";
const composition = createSimulationRuleComposition({ seed, random:createSeededRandom(seed), trustedForkLifecycle:true }).composition;
const replayed = [];
const legal = () => { const s=composition.inspect(); return s.phase==="awaiting_input" ? s.session.decision.choices : composition.inputPort.enumerateActions({}); };
const observe = () => buildRuleObservation(composition.projection({role:"simulation"}).state,seed,seat,legal());
const submit = action => {
  assert(action,`没有所需动作，合法=${JSON.stringify(legal())}`);
  const s=composition.inspect();
  const result=s.phase==="awaiting_input" ? composition.inputPort.submitDecision({decisionId:s.session.decision.decisionId,
    decisionVersion:s.session.decision.decisionVersion,ownerId:s.session.decision.ownerId,choice:action}) : composition.inputPort.submitAction(action);
  assert.equal(result.ok,true,JSON.stringify(result)); replayed.push(action);
};
const find = predicate => legal().find(predicate);
try {
  assert.equal(composition.lifecycle.restore(input.checkpoint.coreState.compositionEnvelope).ok,true);
  submit(find(a=>a.actionId===input.expectedAction.actionId));
  for(const step of trace.plan.steps.slice(0,3)) submit(find(a=>a.actionId===step.actionId));
  // end_turn触发终局标记Decision，必须先正式处理标记再推进单席位回合。
  const advanced=composition.counterfactualPort.advanceFocalPlanningTurn(seat);
  assert.equal(advanced.ok,true,JSON.stringify(advanced));
  // 从同一根正式分支准备一次扫描。此处是可复核规则实验，不冒充原搜索优胜路线。
  for(const slot of [1]) {
    submit(find(a=>a.family==="place_data"));
    submit(find(a=>a.target?.blueSlot===slot));
  }
  for(let i=0;i<4&&!find(a=>a.family==="scan");i++) {
    const p=observe().publicState.players.find(p=>p.playerId===seat);
    submit(find(a=>a.target?.tradeId===(p.credits<2?"cards-for-credit":"cards-for-energy")));
    for(let j=0;j<4 && composition.inspect().phase==="awaiting_input";j++) {
      const a=find(a=>a.target?.kind==="confirm")||find(a=>a.target?.kind==="discard-hand-card"&&a.presentation?.selected===false);
      submit(a);
    }
  }
  submit(find(a=>a.family==="scan"));
  for(let i=0;i<12&&!legal().some(a=>String(a.target?.choiceId||"").startsWith("scan4:"));i++) {
    assert.equal(composition.inspect().phase,"awaiting_input");
    submit(legal()[0]);
  }
  assert(legal().some(a=>String(a.target?.choiceId||"").startsWith("scan4:")),"未达到紫4边界");
  const envelope=composition.lifecycle.save().envelope, observation=observe(), choices=legal(), variants=[];
  for(const action of choices) {
    assert.equal(composition.lifecycle.restore(envelope).ok,true); submit(action);
    variants.push({action,observation:observe(),envelope:composition.lifecycle.save().envelope});
  }
  fs.writeFileSync(output,JSON.stringify({source:"adhoc/budget485-input-20260913.json",scope:"共同根正式分支实验，非原优胜链；扫描选择按合法目录首项，用于核对紫4边界。",
    replayed:replayed.slice(0,-choices.length),envelope,observation,choices,variants},null,2)+"\n",{flag:"wx"});
  console.log(JSON.stringify({output,movement:observation.probeRouteRequirements.movementContext,
    variants:variants.map(v=>({action:v.action.summary,player:v.observation.publicState.players.find(p=>p.playerId===seat),
      goals:v.observation.probeRouteRequirements.candidates.map(g=>({id:g.targetId,source:g.sourceId,cost:g.required,benefit:g.targetBenefit.grossEquivalentValue}))}))}));
} finally { composition.dispose(); }
