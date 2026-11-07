'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),Module=require('node:module'),z=require('node:zlib');
const D='reports/ai-foundation-20261107/case152-completed-prefix-v1/',mp='reports/ai-foundation-20261107/analysis-lazy-trace-contexts-v1/source-manifest-20261107-v1.json',read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),manifest=read(mp),out=D+'native-blue-stop-tie-comparison-20261107-v1.json',checkpoint=D+'native-blue-stop-tie-comparison-20261107-v1.checkpoint.json';assert(!fs.existsSync(out));for(const[n,h]of Object.entries(manifest.sourceHashes))assert.equal(sha(n),h,n);
function compile(target,prototype,edit=s=>s){const file=require.resolve(target),m=new Module(file,module);m.filename=file;m.paths=module.paths;m._compile(edit(fs.readFileSync(D+prototype,'utf8')),file);m.loaded=true;require.cache[file]=m;return m;}
compile('../randomizer/game/effects/probe-turn-session','probe-turn-shared-payments-prototype-20261107-v4.js');
const ties=[];
function editOnce(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b);}
globalThis.__blueStopNativeTie=(origin,prefix,plans,state,goal,rest,end)=>{
 if(rest.netGain===end.netGain){assert(origin);ties.push({origin,prefix:[...prefix,...plans.map(p=>p.goal.id)],state,goal,rest,end});}
};
compile('../randomizer/game/ai/local-decision-plans','local-decision-plans-fixed-blue-prefix-prototype-20261107-v2.js',s=>{
 s=editOnce(s,'initialIncomeTail=null,fixedDataOrdering=false})','initialIncomeTail=null,fixedDataOrdering=false,auditOrigin=null,auditPrefix=[]})');
 s=editOnce(s,'firstBlueGoal:goal,fixedDataOrdering});','firstBlueGoal:goal,fixedDataOrdering,auditOrigin,auditPrefix:[...auditPrefix,...plans.map(p=>p.goal.id)]});');
 return editOnce(s,'     if(rest.netGain>endNow.netGain)return','     globalThis.__blueStopNativeTie(auditOrigin,auditPrefix,plans,current,goal,rest,endNow);\n     if(rest.netGain>endNow.netGain)return');
});
const funded=compile('../randomizer/game/ai/funded-movement-tail', 'funded-movement-r4-payments-prototype-20261107-v4.js',s=>editOnce(editOnce(s,'movementTail({state,seatId,intent})','movementTail({state,seatId,intent,auditOrigin})'),'fixedDataOrdering:state.turn.roundNumber===4});','fixedDataOrdering:state.turn.roundNumber===4,auditOrigin});')),quote=funded.exports.quote,quoted=[];funded.exports={quote(input){const q=quote(input);quoted.push(q);return q;}};
const ap=compile('../randomizer/game/ai/analysis-port','analysis-port-fast-stationary-prototype-20261107-v9.js',s=>{
 s=editOnce(s,'fundedMovement.quote({state,seatId,intent:policy.intent})','fundedMovement.quote({state,seatId,intent:policy.intent,auditOrigin:{node,movement:true}})');
 s=editOnce(s,'trackPurposeDelta:publicAmibaCurrencyTail,fixedDataOrdering,','trackPurposeDelta:publicAmibaCurrencyTail,fixedDataOrdering,auditOrigin:{node,movement:false},');
 return editOnce(s,'return Object.freeze({ openRoot, expand, identity,','return Object.freeze({ diagnosticEnvelope:node=>nodes.get(node).envelope, diagnosticPlanningState:node=>readPlanningState(nodes.get(node)), diagnosticIntent:node=>nodes.get(node).intent, openRoot, expand, identity,');
});
compile('../randomizer/game/ai/decision-search','decision-search-movement-defer-prototype-20261107-v8.js');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),values=require('../randomizer/game/ai/state-value'),search=require('../randomizer/game/ai/decision-search'),agent=require('../randomizer/game/ai/search-agent'),cold=read('reports/ai-foundation-20261105/third-round-teacher-v1/v314-cold-corpus-case-152-20261107-v1.json'),baseline=JSON.parse(z.gunzipSync(fs.readFileSync(cold.rawPath))),f=read(cold.fixture),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=ap.exports.createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0}),evaluate=values.createStateValueEvaluator(f.seatId),at=performance.now();
function guard(){assert(performance.now()-at<60000,'tie control diagnostic60s guard');assert(p.getDiagnostics().submissionCount<=4096,'tie control diagnostic4096 Native guard');}
function stateOf(e){return e.session?.session?.workingState||JSON.parse(e.committedState);}
function actor(s){return s.players.players.find(x=>x.id===f.seatId);}
function assets(s){const a=actor(s);return{resources:a.resources,income:a.income,hand:a.hand,reservedCards:a.reservedCards,techState:a.techState,dataState:a.dataState,blueBonusResources:a.blueBonusResources,pieces:s.pieces,planets:s.planets,aliens:s.aliens,science:s.data,finalScoring:s.finalScoring};}
function step(node,id,actions){const plan=p.resourceSpec(node)?.plans.find(x=>x.goal.id===id);assert(plan,'actual Native policy must retain fixed goal '+id);const actual=p.expandResourcePlan(node,plan,()=>null);assert(actual.complete);assert.notEqual(actual.node.status,'plan-infeasible');actions.push(...actual.prefixes.map(x=>x.action));guard();return actual.node;}
function finish(node,actions){const end=node.legalActions.find(a=>a.family==='end_turn');assert(end);const resource=p.resourceSpec(node);assert(!resource||resource.retainedActionIds.includes(end.actionId),'Native policy must permit stopping');const movement=p.goalMovementSpec(node);assert(!(movement?.selectedActionId&&movement.chosenGoal?.timing==='advance-before-rotation'),'no required movement can supersede stopping');assert(!p.cardPickSpec(node)?.fixed);actions.push(end);let next=p.expand(node,end.actionId);while(next.status==='decision'){const fixed=p.localDecisionSpec(next);assert.equal(fixed?.kind,'fixed-final-mark');const a=next.legalActions.find(a=>a.actionId===fixed.selectedActionId);assert(a);actions.push(a);next=p.expand(next,a.actionId);}assert(['turn-boundary','other-owner','terminal'].includes(next.status));return next;}
function difference(a,b){return Object.keys(a).filter(k=>!require('node:util').isDeepStrictEqual(a[k],b[k]));}
try{
 const r=search.searchDecision({port:p,root:p.openRoot(),evaluate,...agent.OPTIONS,modelKey:evaluate.modelKey,budget:agent.BUDGET});assert(r.complete);assert.equal(r.actionId,baseline.actionId);assert.equal(r.value,baseline.value);assert.equal(r.diagnostics.nativeExecutions,256);assert.equal(ties.length,9);
 const rows=[],saved=[];
 for(const [index,t] of [...ties].entries()){
  let node=t.origin.node;const origin=p.diagnosticEnvelope(node),prefix=[];
  if(t.origin.movement){const q=p.expandGoalMovementPlan(node);assert(q.complete);assert.equal(q.goalStatus,'required-prefix-completed');prefix.push(...q.prefixes.map(x=>x.action));node=q.node;}
  for(const goalId of t.prefix)node=step(node,goalId,prefix);
  const source=p.diagnosticEnvelope(node),context=p.diagnosticIntent(node),native=p.diagnosticPlanningState(node);
  const deltas=difference(assets(t.state),assets(native));
  assert(!deltas.some(k=>!['pieces','dataState','hand','reservedCards','resources','blueBonusResources'].includes(k)),JSON.stringify({index,deltas}));
  const phase=s=>[s.turn.roundNumber,s.turn.turnNumber,s.turn.currentPlayerId,actor(s).mainActionCompleted];assert.deepEqual(phase(native),phase(t.state));
  const actorLedger=s=>{const a=actor(s);return {resources:a.resources,income:a.income,hand:a.hand.map(c=>[c.id,c.cardId]),reserved:a.reservedCards.map(c=>[c.id,c.cardId]),tech:a.techState,placed:a.dataState.placedTokens.map(v=>[v.placementKind,v.placementSlot,v.blueSlot]).sort(),pool:a.dataState.poolTokens.length};};assert.deepEqual(actorLedger(native),actorLedger(t.state),`Native ledger agrees at tie ${index}`);
  const stop=[],cont=[];const stopNode=finish(node,stop);let next=node;
  for(const plan of t.rest.plans)next=step(next,plan.goal.id,cont);
  next=finish(next,cont);
  assert.equal(stop.length,t.end.requiredNativeInputs);assert.equal(cont.length,t.rest.requiredNativeInputs);assert.equal(t.rest.plans[0].goal.id,t.goal.id);
  const stopValue=evaluate.details(p.valueObservation(stopNode)),continueValue=evaluate.details(p.valueObservation(next)),sourceValue=evaluate.details(p.valueObservation(node));
  assert.equal(stopValue.value,values.sumValueParts([sourceValue.value,t.end.netGain]));assert.equal(continueValue.value,values.sumValueParts([sourceValue.value,t.rest.netGain]));
  const a=p.diagnosticEnvelope(stopNode),b=p.diagnosticEnvelope(next),stopState=stateOf(a),continueState=stateOf(b),aAssets=assets(stopState),bAssets=assets(continueState);
  const stopRank=[stopValue.value,-stopValue.purposePreparationDebt,-stopValue.unrealizedPurposeValue,-stop.length],continueRank=[continueValue.value,-continueValue.purposePreparationDebt,-continueValue.unrealizedPurposeValue,-cont.length];
  const firstDifference=stopRank.findIndex((x,i)=>x!==continueRank[i]);const preference=firstDifference<0?'tie':stopRank[firstDifference]>continueRank[firstDifference]?'stop':'continue';
  rows.push({index,fromMovement:t.origin.movement,prefixGoals:t.prefix,continueGoals:t.rest.plans.map(x=>x.goal.id),goalId:t.goal.id,sourceValue,stopValue,continueValue,stopInputs:stop.length,continueInputs:cont.length,preference,firstDifference,assetDifferences:difference(aAssets,bAssets),stopResources:aAssets.resources,continueResources:bAssets.resources,stopPlaced:aAssets.dataState.placedTokens,continuePlaced:bAssets.dataState.placedTokens,sameRuleRng:require('node:util').isDeepStrictEqual(stopState.meta.rngState,continueState.meta.rngState),previewNonLedgerDifferences:deltas});
  saved.push({origin,prefix,source,context,stop:{source,actions:stop,envelope:a},continue:{source,actions:cont,envelope:b}});guard();
 }
 assert.deepEqual(c.lifecycle.save().envelope,before);for(const[n,h]of Object.entries(manifest.sourceHashes))assert.equal(sha(n),h,n);
 fs.writeFileSync(checkpoint,JSON.stringify({fixture:cold.fixture,fixtureSha256:sha(cold.fixture),rows:saved})+'\n');
 const report={scope:'Both named Native exits at nine traced same-primary ties. No claim of state equivalence, new cold sample or autonomous result.',manifest:mp,manifestSha256:sha(mp),checkpoint,checkpointSha256:sha(checkpoint),rows,controlNativeExecutions:p.getDiagnostics().submissionCount-r.diagnostics.nativeExecutions,rootAndRngRestored:true,newAutonomousRuns:0};fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({out,controls:report.controlNativeExecutions,rows:rows.map(x=>[x.index,x.preference,x.firstDifference,x.stopInputs,x.continueInputs,x.assetDifferences,x.sameRuleRng])}));
}finally{p.close();c.dispose();delete globalThis.__blueStopNativeTie;}
