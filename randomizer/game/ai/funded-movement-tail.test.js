'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),z=require('node:zlib');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation'),{createAnalysisPort}=require('./analysis-port'),values=require('./state-value'),agent=require('./search-agent'),tail=require('./funded-movement-tail'),{searchDecision}=require('./decision-search');
const read=p=>JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../../'+p)));
const evidence=read('reports/ai-foundation-20261104/two-rounds-teacher-v2/v156-movement-tail-native-controls-20261104-v3.json'),guide=read(evidence.sourceEvidence),raw=JSON.parse(z.gunzipSync(fs.readFileSync(path.resolve(__dirname,'../../../'+guide.rawPath)))),f=read(evidence.fixture),seatId=f.seatId,seed=f.source.seed;
assert.equal(evidence.status,'complete');assert.equal(evidence.available,20);
const rootState=f.compositionEnvelope.session?.session?.workingState||JSON.parse(f.compositionEnvelope.committedState),actor=rootState.players.players.find(p=>p.id===seatId),known=new Set([...actor.hand,...actor.reservedCards,...rootState.cards.publicCards].filter(Boolean).map(c=>c.id)),techIndices=new Map(Object.entries(rootState.tech.stacks).map(([id,t])=>[id,t.bonusIndex]));
function planning(s){return{...s,cards:{...s.cards,publicCards:s.cards.publicCards.map(c=>c&&known.has(c.id)?c:null)},tech:{...s.tech,stacks:Object.fromEntries(Object.entries(s.tech.stacks).map(([id,t])=>[id,techIndices.get(id)===t.bonusIndex?t:{...t,depleted:true,remaining:0,bonusId:null}]))}};}
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;let matched=0,rejected=0;
function open(){const port=createAnalysisPort({composition:c,seatId,maxCacheEntries:0});port.setResourcePlanning(true);port.setCardPickPlanning(true);port.setMovementPlanning(true);port.setDecisionPlanning(agent.OPTIONS);return port;}
try{
 for(const row of evidence.rows.filter(r=>r.envelope)){
  const e=row.envelope,s=e.session?.session?.workingState||JSON.parse(e.committedState),edge=raw.lines.find(l=>l.node===row.sourceNode).edges.find(e=>e.goalPlan),goal=edge.goalPlan;
  const intent={goal:goal.objective,path:goal.route,rocketId:Number(goal.objective.id.split(':')[1]),free:false,prefixOnly:false},state=planning(s),before=JSON.stringify(state),q=tail.quote({state,seatId,intent});
  assert.equal(q.available,row.available);assert.equal(JSON.stringify(state),before);
  if(!q.available){rejected++;continue;}
  assert.equal(q.netGain,row.quote.netGain);assert.equal(q.requiredNativeInputs,row.nativeInputs);matched++;
  // This valid controlled root preserves all known card instances while
  // moving the newly replenished public offers to discard, as in the saved
  // knowledge-only native reference. It does not claim the old history.
  const control=structuredClone(e),canonical=JSON.parse(control.committedState);assert(!control.session);
  canonical.cards.publicCards=canonical.cards.publicCards.map(card=>{if(!card||known.has(card.id))return card;canonical.cards.discardPile.push(card);return null;});control.committedState=JSON.stringify(canonical);assert(c.lifecycle.restore(control).ok);const original=c.lifecycle.save().envelope,port=open();
  try{
   const root=port.openRoot(),bound=port.movementPlanValueBound(root);assert(bound,'paid fixed prefix must retain this verified source '+row.sourceNode);assert.equal(bound.valueDelta,q.netGain);assert.equal(values.evaluateStateValue(root.observation,seatId).total,row.before.total);assert.equal(bound.observationAvailable,false);assert.equal(bound.successorEnvelopeAvailable,false);assert.deepEqual(c.lifecycle.save().envelope,original);
  }finally{port.close();}
 }
 assert.equal(matched,20);assert(rejected>0);
 assert(c.lifecycle.restore(f.compositionEnvelope).ok);const original=c.lifecycle.save().envelope,port=open();
 try{
  const root=port.openRoot();assert.equal(port.movementPlanValueBound(root),null,'uncompleted main action cannot use a movement tail certificate');const evaluate=values.createStateValueEvaluator(seatId),result=searchDecision({port,root,evaluate,...agent.OPTIONS,modelKey:evaluate.modelKey,budget:{transitions:256,nodes:2048,frontier:512,milliseconds:5000}});assert(result.complete);assert.equal(result.actionId,raw.actionId);assert.equal(result.value,raw.value);assert(result.diagnostics.movementValuePrunes>0);assert(result.diagnostics.nativeExecutions<256);const bounds=result.lines.flatMap(l=>l.actionBounds||[]).filter(b=>b.boundKind==='fixed-paid-movement-tail');assert(bounds.length>0);for(const b of bounds)assert(b.value>b.upperBound,'strict comparison preserves value/distance ties');assert.deepEqual(c.lifecycle.save().envelope,original);
  console.log(JSON.stringify({nativeControlledPlans:matched,rejectedNativeChoices:rejected,rootValue:result.value,actionIdenticalToFullReference:true,nativeInputs:result.diagnostics.nativeExecutions,movementValuePrunes:result.diagnostics.movementValuePrunes,ruleMoveQueries:port.getDiagnostics().movementRuleQueries,rootAndRngUnchanged:true}));
 }finally{port.close();}
}finally{c.dispose();}
