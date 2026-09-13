"use strict";
const fs = require("node:fs"), assert = require("node:assert/strict");
const { createSimulationRuleComposition } = require("../randomizer/game/production-kernel");
const { createSeededRandom } = require("../randomizer/game/random");
const { buildRuleObservation } = require("../randomizer/app/rule-observation");
const evaluator = require("../randomizer/game/ai/expected-score-evaluator");
const output = "adhoc/budget154-secondary-move-20260913.json";
if (fs.existsSync(output)) { console.log(`[skip] ${output}`); process.exit(0); }
const input = JSON.parse(fs.readFileSync("adhoc/budget154-input-20260913.json"));
const trace = JSON.parse(fs.readFileSync("adhoc/budget154-trace-ea9efe16-20260913.json"));
const seed = input.checkpoint.config.seed;
const composition = createSimulationRuleComposition({ seed, random:createSeededRandom(seed),
  trustedForkLifecycle:true }).composition;
// 与Simulation读边界一致：等待输入时读当前Decision，不枚举自由动作。
const legalActions = () => {
  const s = composition.inspect();
  return s.phase === "awaiting_input" ? s.session.decision.choices : composition.inputPort.enumerateActions({});
};
const submit = action => {
  const s = composition.inspect();
  const result = s.phase === "awaiting_input" ? composition.inputPort.submitDecision({
    decisionId:s.session.decision.decisionId, decisionVersion:s.session.decision.decisionVersion,
    ownerId:s.session.decision.ownerId, choice:action,
  }) : composition.inputPort.submitAction(action);
  assert.equal(result.ok,true,JSON.stringify(result));
};
const observe = () => buildRuleObservation(composition.projection({role:"simulation"}).state, seed, "player-green", legalActions());
try {
  assert.equal(composition.lifecycle.restore(input.checkpoint.coreState.compositionEnvelope).ok,true);
  submit(legalActions().find(a=>a.actionId===input.expectedAction.actionId));
  const replayed = [];
  let boundaryStep;
  for (const step of trace.plan.steps) {
    const key = JSON.parse(step.actionKey);
    if (key.target.skip === true) { boundaryStep=step; break; }
    const action = legalActions().find(a=>a.actionId===step.actionId);
    assert(action, `计划动作不合法：${step.actionId}；合法=${JSON.stringify(legalActions())}`);
    submit(action);
    replayed.push(action);
    if(action.family==="end_turn") assert.equal(composition.counterfactualPort.advanceFocalPlanningTurn("player-green").ok,true);
  }
  assert(boundaryStep,"未找到第二次免费移动边界");
  const envelope = composition.lifecycle.save().envelope;
  const observation = observe();
  const legal = legalActions();
  const selected = evaluator.selectSecondaryAgentSuccessors({ focalSeatId:"player-green", branchObservation:observation,
    legalSuccessors:legal, routeTargetId:boundaryStep.routeTargetId, routePlanId:boundaryStep.routePlanId });
  const variants = [];
  for (const action of legal) {
    assert.equal(composition.lifecycle.restore(envelope).ok,true);
    submit(action);
    variants.push({ action, admitted:selected.some(a=>a.actionId===action.actionId), observation:observe(),
      envelope:composition.lifecycle.save().envelope });
  }
  fs.writeFileSync(output,JSON.stringify({ source:"adhoc/budget154-trace-ea9efe16-20260913.json",
    scope:"按已保存最佳计划在正式隔离fork重放；仅使用正式单席规划跨turn，不运行新搜索。枚举第二颗探测器一次免费移动后的真实状态。",
    replayed, boundaryStep, envelope, observation, selected, variants },null,2)+"\n",{flag:"wx"});
  console.log(JSON.stringify({output,replayed:replayed.length,variants:variants.map(v=>({action:v.action.summary,admitted:v.admitted,
    resources:v.observation.publicState.players.find(p=>p.playerId==="player-green"),
    goals:v.observation.probeRouteRequirements.candidates.filter(g=>g.rocketId===4).map(g=>({id:g.targetId,required:g.required,benefit:g.targetBenefit.grossEquivalentValue}))}))}));
} finally { composition.dispose(); }
