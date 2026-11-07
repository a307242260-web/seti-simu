'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),file=require.resolve('../randomizer/game/ai/probe-capital'),valuePath=require.resolve('../randomizer/game/ai/state-value');
const manifestFile=process.env.SETI_CANDIDATE_SOURCE_MANIFEST,manifest=JSON.parse(fs.readFileSync(manifestFile));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const p of [file,valuePath]){const rel=path.relative(root,p);assert.equal(sha(p),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);}
const counts={closures:0,calls:0,emptyPaid:0,hits:0,returnsZero:0,hasHeldResearch:0};
globalThis.__V330_PAID_RESEARCH_WORK__=counts;
let src=fs.readFileSync(valuePath,'utf8');
const start=`    return(hand,publicity,funding)=>{
      // Neither held nor paid research`;
const replacement=`    const observed=new Map(),m=globalThis.__V330_PAID_RESEARCH_WORK__;m.closures++;
    return(hand,publicity,funding)=>{
      m.calls++;const eligible=hand.some(supportedResearch),data=funding?.resources?.availableData;
      const clean=Number.isInteger(publicity)&&publicity>=facts.researchCost&&Number.isInteger(data)&&data>=0&&data<=6&&!funding.researchTriggers&&!funding.researchMarks;
      const key=!eligible&&clean?JSON.stringify([publicity,data,funding.resources.score===facts.player.score]):null;
      if(key!==null){m.emptyPaid++;if(observed.has(key))m.hits++;}
      if(eligible)m.hasHeldResearch++;
      // Neither held nor paid research`;
assert.equal(src.split(start).length,2);src=src.replace(start,replacement);
const end=`      return joint.held+joint.paid;`;assert.equal(src.split(end).length,2);src=src.replace(end,`      const total=joint.held+joint.paid;if(key!==null){if(observed.has(key)&&!Object.is(observed.get(key),total))throw Error('Paid research key differs');observed.set(key,total);}return total;`);
const m=new Module(valuePath,module);m.filename=valuePath;m.paths=module.paths;require.cache[valuePath]=m;m._compile(src,valuePath);m.loaded=true;
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),search=require('../randomizer/game/ai/decision-search'),value=require(valuePath),agent=require('../randomizer/game/ai/search-agent');
const [fixture,acceptance]=process.argv.slice(2),f=JSON.parse(fs.readFileSync(fixture)),ref=JSON.parse(fs.readFileSync(acceptance)),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
assert.equal(sha(fixture),ref.fixtureSha256);assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
try{const evalValue=value.createStateValueEvaluator(f.seatId),r=search.searchDecision({port:p,root:p.openRoot(),evaluate:evalValue,...agent.OPTIONS,modelKey:evalValue.modelKey,budget:agent.BUDGET});assert(r.complete);assert.equal(r.actionId,ref.actionId);assert.equal(r.value,ref.value);assert.equal(r.diagnostics.nativeExecutions,ref.nativeInputs);assert.deepEqual(c.lifecycle.save().envelope,before);console.log(JSON.stringify({scope:'Instrumented arithmetic counts, not cold acceptance; Native inputs/choice/value unchanged',fixture,acceptance,counts}));}finally{p.close();c.dispose();}
