"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { createSimulationRuleComposition } = require("../../training/simulation-rule-composition"), { createSeededRandom } = require("../random"),
  { buildRuleObservation } = require("../../app/rule-observation"), { createAnalysisPort } = require("./analysis-port"),
  { searchDecision } = require("./decision-search"), { createStateValueEvaluator } = require("./state-value");
const fixture = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../adhoc/ai-decision-corpus-20261023-v1/case-062-20261023-v1.json")));
const techBoard = require("../tech/board-state"), playerTech = require("../tech/player-tech"), rockets = require("../rockets");
const initial = JSON.parse(fixture.compositionEnvelope.committedState), seed = fixture.source.seed, seatId = fixture.seatId;
const kernel = createSimulationRuleComposition({ seed, random: createSeededRandom(seed), activePlayerCount: 4,
  trustedProjectionReader: true, projectCounterfactualState: (s,v) => buildRuleObservation(s,seed,v?.playerId) });
kernel.newGame({ seed }); const comp = kernel.composition, evaluate = createStateValueEvaluator(seatId);
const own = s => s.players.players.find(p => p.id === seatId);
function controlled(energy, cards = 0) {
  const s = structuredClone(initial), p = own(s);
  p.mainActionCompleted = true;
  s.cards.discardPile.push(...p.hand.slice(cards)); p.hand = p.hand.slice(0,cards);
  Object.assign(p.resources, { credits: 0, energy, publicity: 0, availableData: 0, handSize: p.hand.length });
  p.dataState = { poolTokens: [], placedTokens: [], discardedCount: 0 };
  return s;
}
function open(s, cache = 0) {
  const restored=comp.lifecycle.restore({ ...fixture.compositionEnvelope, committedState: JSON.stringify(s) });
  assert(restored.ok, JSON.stringify(restored));
  const before = comp.lifecycle.save().envelope, port = createAnalysisPort({ composition: comp, seatId, maxCacheEntries: cache });
  return { before, port, root: port.openRoot() };
}
function run(s, enabled, cache = 0) {
  const { before, port, root } = open(s, cache);
  try {
    assert(port.postMainBorrowSpec(root));
    const result = searchDecision({ port: { ...port, postMainOptimalPlanSpec: () => null, ...(!enabled ? { postMainBorrowSpec: () => null } : {}) }, root, evaluate,
      modelKey: evaluate.modelKey, planReuse: true, resourceDominance: true, moneyCapacityDominance: true, cardTradePruning: true,
      postMainPruning: true, openingPruning: true, cardChoiceEquivalence: true,
      budget: { transitions: 4096, nodes: 4097, frontier: 4096, milliseconds: 15000 } });
    assert(result.complete, result.stopReason); assert.deepEqual(comp.lifecycle.save().envelope,before);
    if(enabled) for(const line of result.lines.filter(line => line.borrowPlan)) {
      assert.equal(line.borrowPlan.completion, "covered-by-origin-search");
      assert(["other-owner","information-barrier","terminal"].includes(result.lines[line.borrowPlan.witness.node].status));
      for(const edge of line.edges.filter(e=>e.borrowTileId)) { assert.equal(edge.cost,2); assert.equal(edge.steps.length,2); }
    }
    return result;
  } finally { port.close(); }
}
const rows=[];
for(const [name, s] of [["no-energy",controlled(0)], ["one-energy",controlled(1)], ["two-energy",controlled(2)], ["one-move-card",controlled(0,1)]]) {
  const raw=run(s,false), reduced=run(s,true), cached=run(s,true,256);
  for(const result of [reduced,cached]) {
    assert.equal(result.actionId,raw.actionId,name); assert.equal(result.value,raw.value,name); assert.equal(result.lines[0].distance,raw.lines[0].distance,name);
    assert(result.diagnostics.transitions<raw.diagnostics.transitions,name);
  }
  rows.push({name,raw:raw.diagnostics.transitions,reduced:reduced.diagnostics.transitions,value:reduced.value});
}
// Leaving an asteroid for Mercury makes orange2 strictly useful; it must remain and can win.
const useful=controlled(1), ship=useful.pieces.rockets.find(r=>r.playerId===seatId);
rockets.assignRocketToSlot(ship,4,1,rockets.findAvailableSlotIndex(useful.pieces,4,1,ship.id));
const usefulRaw=run(useful,false),usefulReduced=run(useful,true);
assert(usefulRaw.actionId.startsWith("industry:"));assert.equal(usefulReduced.actionId,usefulRaw.actionId);
assert.equal(usefulReduced.value,usefulRaw.value);assert.equal(usefulReduced.lines[0].distance,usefulRaw.lines[0].distance);
assert(usefulReduced.lines[0].edges.some(edge=>edge.borrowTileId==="orange2"));
rows.push({name:"asteroid-mercury-useful",raw:usefulRaw.diagnostics.transitions,reduced:usefulReduced.diagnostics.transitions,value:usefulReduced.value});
// The actual public borrow decision is still a mandatory choice: its preceding start cannot be skipped.
const source=controlled(1), first=open(source), spec=first.port.postMainBorrowSpec(first.root);
assert.deepEqual(spec.retainedTileIds,["orange2"]);
const macro=first.port.expandPostMainBorrow(first.root,"orange2");
const pending=first.port.expand(first.root,spec.industryActionId);
assert.equal(pending.status,"decision"); assert.equal(pending.legalActions.length,spec.availableTileIds.length);
assert.equal(first.port.postMainBorrowSpec(pending),null);
const mandatory=searchDecision({port:first.port,root:pending,evaluate,postMainPruning:true,
  budget:{transitions:4096,nodes:4097,frontier:4096,milliseconds:15000}});
assert(mandatory.complete);assert.equal(mandatory.diagnostics.postMainBorrowProofNodes,0);
assert.equal(mandatory.roots.length,spec.availableTileIds.length);

const ordinary=first.port.expand(pending,pending.legalActions.find(a=>a.target.tileId==="orange2").actionId);
assert.equal(first.port.identity(macro.node),first.port.identity(ordinary)); assert.deepEqual(macro.node.observation,ordinary.observation);
assert.equal(macro.submissions,2); assert.throws(()=>first.port.expandPostMainBorrow(first.root,"purple4"),/BORROW_INVALID/);
assert.deepEqual(comp.lifecycle.save().envelope,first.before); first.port.close();
assert.throws(()=>first.port.postMainBorrowSpec(first.root),/NODE_INVALID/);
// Owning orange2 removes its only remaining benefit; a disabled permanent tile can still be restored by borrowing.
for(const disabled of [false,true]) {
  const s=controlled(1), p=own(s);assert(techBoard.consumeStartupTileWithoutRewards(s.tech,"orange2").ok);assert(playerTech.recordPlayerTake(p.techState,"orange2").ok);if(disabled)assert(playerTech.removePlayerTile(p.techState,"orange2").ok);
  const opened=open(s);const facet=opened.port.postMainBorrowSpec(opened.root);assert(facet);
  assert.deepEqual(facet.retainedTileIds,disabled?["orange2"]:[]);opened.port.close();
  if(!disabled) {const raw=run(s,false),reduced=run(s,true);assert.equal(reduced.value,raw.value);assert.equal(reduced.actionId,raw.actionId);assert.equal(reduced.lines[0].distance,raw.lines[0].distance);rows.push({name:"owned-orange2",raw:raw.diagnostics.transitions,reduced:reduced.diagnostics.transitions,value:reduced.value});}
}
const beforeMain=controlled(1);own(beforeMain).mainActionCompleted=false;const rejected=open(beforeMain);assert.equal(rejected.port.postMainBorrowSpec(rejected.root),null);rejected.port.close();
// Pluto's reserve is an extra domain capability and is outside this quiet continuation proof.
const pluto=controlled(1), other=pluto.players.players.find(p=>p.reservedCards.some(c=>c.cardId==="b_139.webp"));
const card=other.reservedCards.find(c=>c.cardId==="b_139.webp");other.reservedCards=other.reservedCards.filter(c=>c!==card);own(pluto).reservedCards.push(card);
const extra=open(pluto);assert(extra.port.knownCardMoneyOrder(extra.root));assert.equal(extra.port.postMainBorrowSpec(extra.root),null);extra.port.close();
const limited=open(controlled(1));
const unfinished=searchDecision({port:{...limited.port,postMainOptimalPlanSpec:()=>null},root:limited.root,evaluate,postMainPruning:true,
  budget:{transitions:1,nodes:2,frontier:1,milliseconds:15000}});
assert(!unfinished.complete);assert.equal(unfinished.actionId,null);assert.equal(unfinished.planContinuation,null);assert.deepEqual(comp.lifecycle.save().envelope,limited.before);limited.port.close();
// Production factory disables initiating borrowing; an already pending native choice can still finish.
assert(comp.lifecycle.restore({...fixture.compositionEnvelope,committedState:JSON.stringify(useful)}).ok);
const factoryPort=createAnalysisPort({composition:comp,seatId,maxCacheEntries:256});
const agent=require("./search-agent").createSearchAgent({seatId,analysisPort:factoryPort});
function actions() { const inspect=comp.inspect();return inspect.phase==="awaiting_input"?inspect.session.decision.choices:comp.inputPort.enumerateActions({}); }
const factoryBefore=comp.lifecycle.save().envelope;
const firstDecision=agent.decide({seatId,legalActions:actions()});
assert(firstDecision.search.complete);assert.equal(firstDecision.search.diagnostics.postMainBorrowMacros,0);
assert(!firstDecision.actionId.startsWith("industry:"));assert.deepEqual(comp.lifecycle.save().envelope,factoryBefore);
assert(firstDecision.search.lines.every(l=>l.edges.every(e=>!e.borrowTileId)));
const manualBorrow=actions().find(a=>a.target?.abilityId==="turing_borrow_tech");assert(manualBorrow);
assert(firstDecision.search.roots.find(a=>a.actionId===manualBorrow.actionId).completion==='excluded-by-resource-policy');
assert(comp.inputPort.submitQuickAction(manualBorrow).ok);
assert.equal(comp.inspect().phase,"awaiting_input");assert.equal(actions().length,8);
const pendingBefore=comp.lifecycle.save().envelope,secondDecision=agent.decide({seatId,legalActions:actions()});
assert(secondDecision.search.complete);assert.equal(secondDecision.search.diagnostics.postMainBorrowProofNodes,0);
assert.equal(secondDecision.search.roots.length,8);assert.deepEqual(comp.lifecycle.save().envelope,pendingBefore);
const inspection=comp.inspect(),choice=actions().find(a=>a.actionId===secondDecision.actionId);
assert.equal(choice.target.tileId,"orange2");assert(comp.inputPort.submitDecision({decisionId:inspection.session.decision.decisionId,
  decisionVersion:inspection.session.decision.decisionVersion,ownerId:seatId,choice}).ok);
assert.notEqual(comp.inspect().phase,"awaiting_input");factoryPort.close();
comp.dispose();console.log(JSON.stringify({postMainBorrow:"passed",rows}));
