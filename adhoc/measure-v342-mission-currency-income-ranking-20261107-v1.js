'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),file=require.resolve('../randomizer/game/ai/probe-capital'),valuePath=require.resolve('../randomizer/game/ai/state-value');
const manifestFile=process.env.SETI_CANDIDATE_SOURCE_MANIFEST,manifest=JSON.parse(fs.readFileSync(manifestFile));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const p of [file,valuePath]){const rel=path.relative(root,p);assert.equal(sha(p),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);}
const probePath=require.resolve('../randomizer/game/ai/probe-capital');
for(const p of [probePath,valuePath]){const rel=path.relative(root,p);assert.equal(sha(p),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);}
const counts={incomeQuotes:0,eligible:0,offers:0,declinedNonCurrency:0,declinedHighPublicity:0,declinedResearch:0,declinedContinuation:0,exactRanking:0};
globalThis.__missionCapProjection=counts;
function load(p,modify){const m=new Module(p,module);m.filename=p;m.paths=module.paths;const src=modify(fs.readFileSync(p,'utf8'));require.cache[p]=m;m._compile(src,p);m.loaded=true;}
function replace(s,a,b){assert.equal(s.split(a).length,2);return s.replace(a,b);}
load(probePath,s=>replace(s,'          if (!ranked.length) {',`
          if(readOnlyTraces&&facts.__supportedResearchCards&&ranked.length){
            const q=globalThis.__missionCapProjection;q.incomeQuotes++;
            if(facts.dataContinuation)q.declinedContinuation++;
            else if(wallet.publicity>=facts.researchCost)q.declinedHighPublicity++;
            else if(facts.__supportedResearchCards(hand).length)q.declinedResearch++;
            else if(ranked.some(r=>Object.keys(r.gain).some(k=>!['credits','energy','handSize'].includes(k))))q.declinedNonCurrency++;
            else{
              q.eligible++;q.offers+=ranked.length;
              const order=ranked.slice().sort((a,b)=>b.linear-a.linear||a.card.id.localeCompare(b.card.id));
              if(order[0].card!==ranked[0].card||ranked.some(r=>r.after!==before))throw Error('currency-only ranking or capital proof mismatch');
              q.exactRanking++;
            }
          }
          if (!ranked.length) {
`));
load(valuePath,s=>replace(s,'quoteReadOnlyPortfolio({...facts,investment,initialInvestmentCapital:','quoteReadOnlyPortfolio({...facts,investment,__supportedResearchCards:hand=>hand.filter(supportedResearch),initialInvestmentCapital:'));
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),search=require('../randomizer/game/ai/decision-search'),value=require(valuePath),agent=require('../randomizer/game/ai/search-agent');
const [fixture,acceptance]=process.argv.slice(2),f=JSON.parse(fs.readFileSync(fixture)),ref=JSON.parse(fs.readFileSync(acceptance)),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
assert.equal(sha(fixture),ref.fixtureSha256);assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
try{const evalValue=value.createStateValueEvaluator(f.seatId),r=search.searchDecision({port:p,root:p.openRoot(),evaluate:evalValue,...agent.OPTIONS,modelKey:evalValue.modelKey,budget:agent.BUDGET});assert(r.complete);assert.equal(r.actionId,ref.actionId);assert.equal(r.value,ref.value);assert.equal(r.diagnostics.nativeExecutions,ref.nativeInputs);assert.deepEqual(c.lifecycle.save().envelope,before);console.log(JSON.stringify({scope:'Compare typed fixed mission currency income ranking with every complete legacy opportunity-cost quote. Instrumentation, no acceptance timing.',fixture,acceptance,counts}));}finally{p.close();c.dispose();}
