"use strict";
const assert = require("node:assert/strict");
const evaluator = require("./expected-score-evaluator");
const outcomeModel = require("./outcome-model");
const hand = [0,1,2,3,4,5,99].map(code=>({id:`corner-${code}`,discardActionCode:code}));
const observation = outcomeModel.createDecisionObservation({
  publicState:{roundNumber:2,players:[{playerId:"p1",score:0,credits:0,energy:0,publicity:0,
    income:{},techState:{ownedTiles:{}},dataProgress:{}}],board:{aliens:{slots:[]}}},
  selfState:{playerId:"p1",hand,reservedCards:[]},
},{seatId:"p1"});
const actions = [...hand.map(card=>({family:"card_corner",phase:"quick",actorId:"p1",
  actionId:`card_corner:${card.id}`,target:{cardInstanceId:card.id},payload:{}})),
  {family:"card_corner",phase:"quick",actorId:"p1",actionId:"card_corner:missing",target:{cardInstanceId:"missing"}}];
function targets(legalActions) {
  return evaluator.enumerateSecondaryAgentRootTargets({focalSeatId:"p1",rootObservation:observation,legalActions});
}
const expected = [4,5].map(code=>({targetId:`card:resolve:corner-${code}`,planId:`card:resolve:corner-${code}`,
  resultTargetIds:[`card:resolve:corner-${code}`],compatibleActionIds:[`card_corner:corner-${code}`]}));
assert.deepEqual(targets(actions),expected);
assert.deepEqual(targets([...actions].reverse()),expected);
for(const code of [4,5]) {
  const action = actions.find(a=>a.target.cardInstanceId===`corner-${code}`);
  const input = {action,targetId:`card:resolve:corner-${code}`,focalSeatId:"p1",branchObservation:observation};
  assert.equal(evaluator.completesSecondaryAgentRouteTarget(input),false);
  assert.equal(evaluator.completesSecondaryAgentRouteTarget({...input,branchObservation:{...observation,
    selfState:{...observation.selfState,hand:hand.filter(c=>c.id!==`corner-${code}`)}}}),true);
  assert.equal(evaluator.completesSecondaryAgentRouteTarget({...input,branchObservation:{...observation,
    selfState:{...observation.selfState,hand:hand.filter(c=>c.id!=="corner-0")}}}),false);
}
console.log("score corner target tests passed");
