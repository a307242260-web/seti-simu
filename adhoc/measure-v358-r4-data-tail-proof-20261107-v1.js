'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),file=require.resolve('../randomizer/game/ai/probe-capital'),valuePath=require.resolve('../randomizer/game/ai/analysis-port');
const manifestFile=process.env.SETI_CANDIDATE_SOURCE_MANIFEST,manifest=JSON.parse(fs.readFileSync(manifestFile));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const p of [file,valuePath]){const rel=path.relative(root,p);assert.equal(sha(p),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);}
const rel=path.relative(root,valuePath);assert.equal(sha(valuePath),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);
const counts={picks:[],summaries:[],compounds:[]};globalThis.__v358Proof=counts;
let src=fs.readFileSync(valuePath,'utf8');
function insert(marker,addition){assert.equal(src.split(marker).length,2);src=src.replace(marker,addition+marker);}
insert('      const continueKnown = postMainActions.length > 0 || knownRewardActions.length > 0;',`      if(sourceAction?.actionId==='choose_card:4c24d8e6'){
        const actor=childState.players.players.find(p=>p.id===seatId);
        globalThis.__v358Proof.picks.push({action:sourceAction.target,barrier:barrier?.code,knownAlienAcquisition:Boolean(knownAlienAcquisition),postMainActions:postMainActions.map(a=>a.family),knownHand:actor.hand.filter(c=>knownCards(envelope).has(c.id)).map(c=>c.cardId),opaque:actor.hand.filter(c=>!knownCards(envelope).has(c.id)).length,resources:actor.resources,computer:data.listComputerPlacedTokens(actor).map(t=>t.placementSlot),intent:intent&&{pathLength:intent.path.length,goal:intent.goal?.timing}});
      }
`);
insert('      const knownOrOpaque=card=>knownCards(stored.envelope).has(card.id)',`      if(computerPolicy&&state.turn.roundNumber===4&&stored.informationBarrier){
        globalThis.__v358Proof.summaries.push({kind,node:node.status,barrier:stored.informationBarrier.code,score:owner.resources.score,credits:owner.resources.credits,energy:owner.resources.energy,publicity:owner.resources.publicity,data:owner.resources.availableData,computer:data.listComputerPlacedTokens(owner).map(t=>t.placementSlot),blue:data.listBlueBonusPlacedTokens(owner).map(t=>t.blueSlot),knownAmibaTail:Boolean(knownAmibaTail),plans:computerPolicy.plans.map(p=>[p.goal.id,p.goal.kind]),retained:computerPolicy.retainedActionIds,actions:node.legalActions.map(a=>a.family),hasOwnVisit:hasOwnVisitSource(state),hasIntent:Boolean(stored.intent),end:Boolean(end),tail:computerPolicy.fixedComputerTail||computerPolicy.fixedBlueTail||null});
      }
`);
insert('              if(compound.available&&compound.plans[0]?.goal.id===plan.goal.id',`              if(state.turn.roundNumber===4&&stored.informationBarrier)globalThis.__v358Proof.compounds.push({kind,score:owner.resources.score,goal:plan.goal.id,result:compound});
`);
const m=new Module(valuePath,module);m.filename=valuePath;m.paths=module.paths;require.cache[valuePath]=m;m._compile(src,valuePath);m.loaded=true;
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),search=require('../randomizer/game/ai/decision-search'),value=require('../randomizer/game/ai/state-value'),agent=require('../randomizer/game/ai/search-agent');
const [fixture,acceptance]=process.argv.slice(2),f=JSON.parse(fs.readFileSync(fixture)),ref=JSON.parse(fs.readFileSync(acceptance)),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
assert.equal(sha(fixture),ref.fixtureSha256);assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
try{const evalValue=value.createStateValueEvaluator(f.seatId),r=search.searchDecision({port:p,root:p.openRoot(),evaluate:evalValue,...agent.OPTIONS,modelKey:evalValue.modelKey,budget:agent.BUDGET});assert(r.complete);assert.equal(r.actionId,ref.actionId);assert.equal(r.value,ref.value);assert.equal(r.diagnostics.nativeExecutions,ref.nativeInputs);assert.deepEqual(c.lifecycle.save().envelope,before);console.log(JSON.stringify({scope:'Round-four public acquisition and data-tail proof attribution. Instrumentation only.',fixture,acceptance,counts}));}finally{p.close();c.dispose();}
