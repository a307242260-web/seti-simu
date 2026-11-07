'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),file=require.resolve('../randomizer/game/ai/probe-capital'),valuePath=require.resolve('../randomizer/game/ai/state-value');
const manifestFile=process.env.SETI_CANDIDATE_SOURCE_MANIFEST,manifest=JSON.parse(fs.readFileSync(manifestFile));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const p of [file,valuePath]){const rel=path.relative(root,p);assert.equal(sha(p),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);}
const counts={quotes:0,heldSupplier:0,withAlternative:0,alternativePayments:0,additionalMissionQuotes:0,ordinaryMissionQuotes:0,investmentEvaluations:0,afterHeldInvestmentEvaluations:0,preparedBasis:0,fixedBasisEvaluations:0,genericPrepaid:0},keys=new Set();
globalThis.__V327_QUOTE_WORK__={counts,keys};
function instrument(file,edits){
 let s=fs.readFileSync(file,'utf8');for(const [old,neu]of edits){assert.equal(s.split(old).length,2,old);s=s.replace(old,neu);}
 const m=new Module(file,module);m.filename=file;m.paths=module.paths;require.cache[file]=m;m._compile(s,file);m.loaded=true;
}
const M='globalThis.__V327_QUOTE_WORK__';
instrument(file,[
 ['    const player = facts.player, seatId',`    ${M}.counts.quotes++; const player = facts.player, seatId`],
 ['    const cardRoute=heldLandingCard(facts,weights);',`    const cardRoute=heldLandingCard(facts,weights); if(cardRoute)${M}.counts.heldSupplier++;`],
 ['    const alternatives=[];',`    const alternatives=[]; if(cardRoute){let key=${M}.keys;key.add(JSON.stringify([goals.map(g=>[g.requirementId,g.route.cost,g.endpointFacts.cost]),player.credits,player.energy,cardRoute.cost.credits]));}`],
 ['      if(payment) alternatives.push',`      ${M}.counts.alternativePayments++; if(payment) alternatives.push`],
 ['    const portfolio=alternatives.length?',`    if(alternatives.length)${M}.counts.withAlternative++; const portfolio=alternatives.length?`],
 ['    const capitalValues = new Map();',`    const capitalValues = new Map(); let heldVariant=false;`],
 ['      if (!capitalValues.has(key)) capitalValues.set',`      if(!capitalValues.has(key)&&knownCurrentValue===undefined){${M}.counts.investmentEvaluations++;if(heldVariant)${M}.counts.afterHeldInvestmentEvaluations++;} if (!capitalValues.has(key)) capitalValues.set`],
 ['      const hand = card ?',`      heldVariant=Boolean(card); if(heldVariant)${M}.counts.additionalMissionQuotes++;else ${M}.counts.ordinaryMissionQuotes++; const hand = card ?`]
]);
instrument(valuePath,[['      const prepaid=fixed?(fixedPrepaid??=readyAnalysis.preparePrepaidCapital(facts,weights))(score,publicity)',`      if(fixed){${M}.counts.fixedBasisEvaluations++;if(!fixedPrepaid)${M}.counts.preparedBasis++;}else ${M}.counts.genericPrepaid++; const prepaid=fixed?(fixedPrepaid??=readyAnalysis.preparePrepaidCapital(facts,weights))(score,publicity)`]]);
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),search=require('../randomizer/game/ai/decision-search'),value=require(valuePath),agent=require('../randomizer/game/ai/search-agent');
const [fixture,acceptance]=process.argv.slice(2),f=JSON.parse(fs.readFileSync(fixture)),ref=JSON.parse(fs.readFileSync(acceptance)),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
assert.equal(sha(fixture),ref.fixtureSha256);assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
try{const evalValue=value.createStateValueEvaluator(f.seatId),r=search.searchDecision({port:p,root:p.openRoot(),evaluate:evalValue,...agent.OPTIONS,modelKey:evalValue.modelKey,budget:agent.BUDGET});assert(r.complete);assert.equal(r.actionId,ref.actionId);assert.equal(r.value,ref.value);assert.equal(r.diagnostics.nativeExecutions,ref.nativeInputs);assert.deepEqual(c.lifecycle.save().envelope,before);console.log(JSON.stringify({scope:'Instrumented arithmetic counts, not cold acceptance; Native inputs/choice/value unchanged',fixture,acceptance,counts,distinctHeldGeometryWalletFeeKeys:keys.size}));}finally{p.close();c.dispose();}
