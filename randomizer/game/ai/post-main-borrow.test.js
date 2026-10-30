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
// The production policy forbids starting this ability. Keep native legality
// visible, and complete saves already inside its mandatory native decision.
const agent=require('./search-agent');
function run(s,cache=0){
 const {before,port,root}=open(s,cache),banned=new Set();
 const capture=node=>{for(const a of node.legalActions)if(a.family==='industry'&&a.target?.abilityId==='turing_borrow_tech')banned.add(a.actionId);};capture(root);assert(banned.size);
 try{
  const wrapped={...port,identity(node){capture(node);return port.identity(node);}},r=searchDecision({port:wrapped,root,evaluate,...agent.OPTIONS,budget:{transitions:256,nodes:1024,frontier:256,milliseconds:15000}});
  assert(r.complete,r.stopReason);assert(r.diagnostics.disabledBorrowStarts>0);assert.equal(r.diagnostics.postMainBorrowMacros,0);
  assert(port.getResourcePrefixGraph().edges.every(e=>!banned.has(e.actionId)));assert(r.lines.every(l=>!l.borrowPlan&&l.edges.every(e=>!e.borrowTileId&&!banned.has(e.actionId))));
  assert.deepEqual(comp.lifecycle.save().envelope,before);return r;
 }finally{port.close();}
}
const rows=[];
for(const [name,s] of [['no-energy',controlled(0)],['one-energy',controlled(1)],['two-energy',controlled(2)],['one-move-card',controlled(0,1)]]){
 const a=run(s),b=run(s,256);assert.equal(a.actionId,b.actionId);assert.equal(a.value,b.value);rows.push({name,inputs:a.diagnostics.nativeExecutions,value:a.value});
}
const useful=controlled(1),ship=useful.pieces.rockets.find(r=>r.playerId===seatId);rockets.assignRocketToSlot(ship,4,1,rockets.findAvailableSlotIndex(useful.pieces,4,1,ship.id));run(useful);
const source=controlled(1),current=open(source),start=current.root.legalActions.find(a=>a.family==='industry'&&a.target?.abilityId==='turing_borrow_tech');assert(start);current.port.close();assert(comp.inputPort.submitQuickAction(start).ok);
const pending=comp.lifecycle.save().envelope,cold=createAnalysisPort({composition:comp,seatId,maxCacheEntries:0});
try{
 const root=cold.openRoot();assert.equal(root.status,'decision');assert(root.legalActions.every(a=>a.family==='choose_target'&&a.target.tileId));
 const r=searchDecision({port:cold,root,evaluate,...agent.OPTIONS,budget:{transitions:256,nodes:1024,frontier:256,milliseconds:15000}});assert(r.complete,r.stopReason);assert.equal(r.diagnostics.postMainBorrowMacros,0);
 const choice=root.legalActions.find(a=>a.actionId===r.actionId);assert(choice,'an already committed native choice remains completable');assert.deepEqual(comp.lifecycle.save().envelope,pending);
 const decision=comp.inspect().session.decision;assert(comp.inputPort.submitDecision({decisionId:decision.decisionId,decisionVersion:decision.decisionVersion,ownerId:decision.ownerId,choice}).ok);
}finally{cold.close();comp.dispose();}
console.log(JSON.stringify({productionBorrowPolicy:'passed',nativeStartsDisabled:true,mandatorySavedDecisionCompletable:true,rows}));
