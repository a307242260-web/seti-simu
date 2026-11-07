'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),file=require.resolve('../randomizer/game/ai/probe-capital'),valuePath=require.resolve('../randomizer/game/ai/state-value');
const manifestFile=process.env.SETI_CANDIDATE_SOURCE_MANIFEST,manifest=JSON.parse(fs.readFileSync(manifestFile));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const p of [file,valuePath]){const rel=path.relative(root,p);assert.equal(sha(p),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);}
const target=require.resolve('../randomizer/game/ai/card-pick-planning'),rel=path.relative(root,target);
assert.equal(sha(target),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);
const counts={offers:0,same:0,lower:0,higher:0,alreadyMarked:0,examples:[]};
globalThis.__swapMarkTrace=counts;
let src=fs.readFileSync(target,'utf8');
const anchor='        return{card:incoming,gain:demand.planningCapital(preview,next)-before};';
assert.equal(src.split(anchor).length,2);
src=src.replace(anchor,`        const t=globalThis.__swapMarkTrace,previous=demand.planningCapital(preview,next),wasMarked=next.industryRoundMarkRound===state.turn.roundNumber;
        const marked={...next,industryRoundMarkRound:state.turn.roundNumber,industryRoundMarkTurn:state.turn.turnNumber};
        const sameEndpoint={...preview,players:{...preview.players,players:preview.players.players.map(q=>q===next?marked:q)}};
        const actual=demand.planningCapital(sameEndpoint,marked);
        t.offers++;if(wasMarked)t.alreadyMarked++;
        if(actual===previous)t.same++;else{
         if(actual<previous)t.lower++;else t.higher++;
         if(t.examples.length<12)t.examples.push({round:state.turn.roundNumber,turn:state.turn.turnNumber,score:p.resources.score,
          computer:data.listComputerPlacedTokens(p).map(q=>q.placementSlot),incoming:incoming.cardId,outgoing:outgoing.cardId,
          markBefore:[next.industryRoundMarkRound,next.industryRoundMarkTurn],markAfter:[marked.industryRoundMarkRound,marked.industryRoundMarkTurn],
          before,previous,actual});
        }
        return{card:incoming,gain:previous-before};`);
const m=new Module(target,module);m.filename=target;m.paths=module.paths;require.cache[target]=m;m._compile(src,target);m.loaded=true;
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),search=require('../randomizer/game/ai/decision-search'),value=require(valuePath),agent=require('../randomizer/game/ai/search-agent');
const [fixture,acceptance]=process.argv.slice(2),f=JSON.parse(fs.readFileSync(fixture)),ref=JSON.parse(fs.readFileSync(acceptance)),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
assert.equal(sha(fixture),ref.fixtureSha256);assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
try{const evalValue=value.createStateValueEvaluator(f.seatId),r=search.searchDecision({port:p,root:p.openRoot(),evaluate:evalValue,...agent.OPTIONS,modelKey:evalValue.modelKey,budget:agent.BUDGET});assert(r.complete);assert.equal(r.actionId,ref.actionId);assert.equal(r.value,ref.value);assert.equal(r.diagnostics.nativeExecutions,ref.nativeInputs);assert.deepEqual(c.lifecycle.save().envelope,before);console.log(JSON.stringify({scope:'Evaluate the actual consumed company mark in otherwise identical public-card previews; all original decisions preserved in this diagnostic, not a timing sample',fixture,acceptance,counts}));}finally{p.close();c.dispose();}
