'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),file=require.resolve('../randomizer/game/ai/probe-capital'),valuePath=require.resolve('../randomizer/game/ai/state-value');
const manifestFile=process.env.SETI_CANDIDATE_SOURCE_MANIFEST,manifest=JSON.parse(fs.readFileSync(manifestFile));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const p of [file,valuePath]){const rel=path.relative(root,p);assert.equal(sha(p),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);}
const counts={},matrices=new Map(),keys=new Set();
globalThis.__V329_QUOTE_WORK__={counts,matrices,keys};
let src=fs.readFileSync(file,'utf8');
const edits=[
 ['    const capitalValues = new Map();','    const capitalValues = new Map(); let activeHeld=null;'],
 ['      if (!capitalValues.has(key)) capitalValues.set',`      if(activeHeld&&!capitalValues.has(key)&&knownCurrentValue===undefined){const row=globalThis.__V329_QUOTE_WORK__.counts[activeHeld];row.continuations++;} if (!capitalValues.has(key)) capitalValues.set`],
 ['      const usedTokens = new Set(), effects = goal.endpointFacts.rewards, ledger = scalarOnly ? null : [];',`      const usedTokens = new Set(), effects = goal.endpointFacts.rewards, ledger = scalarOnly ? null : [];
        activeHeld=card?goal.planetId+'/'+effects.map(e=>e.type).join('+'):null;
        if(activeHeld){const {counts,matrices}=globalThis.__V329_QUOTE_WORK__;const row=counts[activeHeld]||={visits:0,continuations:0};row.visits++;
          if(!matrices.has(activeHeld))matrices.set(activeHeld,new Set());
          const stableKey=JSON.stringify([wallet.credits,wallet.energy,wallet.publicity,wallet.availableData,unknownCount,
            effects.map(e=>e.options),facts.board.aliens.slots.map(s=>[s.slotId,s.revealed,...['blue','pink','yellow'].map(t=>s.traces[t].firstPlaced)])]);
          matrices.get(activeHeld).add(stableKey);
        }`]
];
for(const [old,neu]of edits){assert.equal(src.split(old).length,2,old);src=src.replace(old,neu);}
const m=new Module(file,module);m.filename=file;m.paths=module.paths;require.cache[file]=m;m._compile(src,file);m.loaded=true;
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),search=require('../randomizer/game/ai/decision-search'),value=require(valuePath),agent=require('../randomizer/game/ai/search-agent');
const [fixture,acceptance]=process.argv.slice(2),f=JSON.parse(fs.readFileSync(fixture)),ref=JSON.parse(fs.readFileSync(acceptance)),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
assert.equal(sha(fixture),ref.fixtureSha256);assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
try{const evalValue=value.createStateValueEvaluator(f.seatId),r=search.searchDecision({port:p,root:p.openRoot(),evaluate:evalValue,...agent.OPTIONS,modelKey:evalValue.modelKey,budget:agent.BUDGET});assert(r.complete);assert.equal(r.actionId,ref.actionId);assert.equal(r.value,ref.value);assert.equal(r.diagnostics.nativeExecutions,ref.nativeInputs);assert.deepEqual(c.lifecycle.save().envelope,before);console.log(JSON.stringify({scope:'Instrumented arithmetic counts, not cold acceptance; Native inputs/choice/value unchanged',fixture,acceptance,counts,distinctRewardInputs:Object.fromEntries([...matrices].map(([k,s])=>[k,s.size]))}));}finally{p.close();c.dispose();}
