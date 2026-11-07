'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),file=require.resolve('../randomizer/game/ai/probe-capital'),valuePath=require.resolve('../randomizer/game/ai/state-value');
const manifestFile=process.env.SETI_CANDIDATE_SOURCE_MANIFEST,manifest=JSON.parse(fs.readFileSync(manifestFile));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const p of [file,valuePath]){const rel=path.relative(root,p);assert.equal(sha(p),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);}
const target=require.resolve('../randomizer/game/ai/resource-demand'),rel=path.relative(root,target);
assert.equal(sha(target),manifest.sourceHashes[rel]);
const counts={batches:0,offers:0,maskedRow:0,handTriggers:0,finalMarkChoices:0,revealedAmiba:0,sourceExact:0};
globalThis.__swapOfferProjectionChecks={counts,assert};
let src=fs.readFileSync(target,'utf8');
function replace(a,b){assert.equal(src.split(a).length,2);src=src.replace(a,b);}
replace('    const p=owner(state,seatId),source=valueFacts(state,p),before=planningCapital(state,p);',`    const p=owner(state,seatId),source=valueFacts(state,p),before=planningCapital(state,p);
    const {counts,assert}=globalThis.__swapOfferProjectionChecks;counts.batches++;`);
replace('      return{card:incoming,gain:stateValue.purposeCapital(preview).total-before};',`      const oldPlayer={...p,hand:p.hand.map(c=>c.id===outgoing.id?incoming:c)};
      const oldState={...state,players:{...state.players,players:state.players.players.map(v=>v===p?oldPlayer:v)},
        cards:{...state.cards,publicCards:state.cards.publicCards.map(c=>c?.id===incoming.id?outgoing:c)}};
      const control=valueFacts(oldState,oldPlayer);
      assert.deepEqual(preview,control);assert.equal(JSON.stringify(preview),JSON.stringify(control),'including ordered DTO');
      counts.offers++;if(state.cards.unknownPublicSlotIndices?.length)counts.maskedRow++;
      if(preview.pendingHandCardTriggers.length)counts.handTriggers++;
      if(preview.sourcePendingFinalMarkChoice)counts.finalMarkChoices++;
      if(preview.amibaTraces)counts.revealedAmiba++;
      counts.sourceExact++;
      return{card:incoming,gain:stateValue.purposeCapital(preview).total-before};`);
const m=new Module(target,module);m.filename=target;m.paths=module.paths;require.cache[target]=m;m._compile(src,target);m.loaded=true;
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),search=require('../randomizer/game/ai/decision-search'),value=require(valuePath),agent=require('../randomizer/game/ai/search-agent');
const [fixture,acceptance]=process.argv.slice(2),f=JSON.parse(fs.readFileSync(fixture)),ref=JSON.parse(fs.readFileSync(acceptance)),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
assert.equal(sha(fixture),ref.fixtureSha256);assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
try{const evalValue=value.createStateValueEvaluator(f.seatId),r=search.searchDecision({port:p,root:p.openRoot(),evaluate:evalValue,...agent.OPTIONS,modelKey:evalValue.modelKey,budget:agent.BUDGET});assert(r.complete);assert.equal(r.actionId,ref.actionId);assert.equal(r.value,ref.value);assert.equal(r.diagnostics.nativeExecutions,ref.nativeInputs);assert.deepEqual(c.lifecycle.save().envelope,before);console.log(JSON.stringify({scope:'Every sibling public offer receives the exact same ordered valuation DTO as the unshared projection. Instrumented, not timing.',fixture,acceptance,counts}));}finally{p.close();c.dispose();}
