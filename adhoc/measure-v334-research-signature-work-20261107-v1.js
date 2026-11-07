'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),Module=require('node:module'),path=require('node:path'),crypto=require('node:crypto');
const root=process.cwd(),file=require.resolve('../randomizer/game/ai/probe-capital'),valuePath=require.resolve('../randomizer/game/ai/state-value');
const manifestFile=process.env.SETI_CANDIDATE_SOURCE_MANIFEST,manifest=JSON.parse(fs.readFileSync(manifestFile));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
for(const p of [file,valuePath]){const rel=path.relative(root,p);assert.equal(sha(p),manifest.sourceHashes[rel]||manifest.baseRuntimeHashes[rel]);}
const counts={signatureCalls:0,layoutCalls:0,fallbacks:0,layoutChars:0,headChars:0,flatChars:0,shapeChecks:0,shapeChecksReusedByReference:0},headKeys=new Set(),layouts=new Set(),fullKeys=new Set(),wrappers=new WeakSet();
globalThis.__V334_RESEARCH_SIGNATURE__={counts,headKeys,layouts,fullKeys,wrappers};
let src=fs.readFileSync(valuePath,'utf8');
const old='    const symbols=trigger?.symbols;';const replace=`    const symbols=trigger?.symbols, measure=globalThis.__V334_RESEARCH_SIGNATURE__,counts=measure.counts;counts.signatureCalls++;
    if(symbols&&typeof symbols==='object'){counts.shapeChecks++;if(measure.wrappers.has(symbols))counts.shapeChecksReusedByReference++;measure.wrappers.add(symbols);}`;
assert.equal(src.split(old).length,2);src=src.replace(old,replace);
const hit='        return "layout:"+head+","+slots+","+entries+"]";';const nhit=`        counts.layoutCalls++;counts.layoutChars+=slots.length+entries.length;counts.headChars+=head.length;
        const key="layout:"+head+","+slots+","+entries+"]";measure.headKeys.add(head);measure.layouts.add(slots+","+entries);measure.fullKeys.add(key);counts.flatChars+=key.length;return key;`;
assert.equal(src.split(hit).length,2);src=src.replace(hit,nhit).replace('    __researchQuoteWork.symbolKeyFallbacks++;','    counts.fallbacks++;__researchQuoteWork.symbolKeyFallbacks++;');
const m=new Module(valuePath,module);m.filename=valuePath;m.paths=module.paths;require.cache[valuePath]=m;m._compile(src,valuePath);m.loaded=true;
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),{createAnalysisPort}=require('../randomizer/game/ai/analysis-port'),search=require('../randomizer/game/ai/decision-search'),value=require(valuePath),agent=require('../randomizer/game/ai/search-agent');
const [fixture,acceptance]=process.argv.slice(2),f=JSON.parse(fs.readFileSync(fixture)),ref=JSON.parse(fs.readFileSync(acceptance)),seed=f.source.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
assert.equal(sha(fixture),ref.fixtureSha256);assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope,p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
try{const evalValue=value.createStateValueEvaluator(f.seatId),r=search.searchDecision({port:p,root:p.openRoot(),evaluate:evalValue,...agent.OPTIONS,modelKey:evalValue.modelKey,budget:agent.BUDGET});assert(r.complete);assert.equal(r.actionId,ref.actionId);assert.equal(r.value,ref.value);assert.equal(r.diagnostics.nativeExecutions,ref.nativeInputs);assert.deepEqual(c.lifecycle.save().envelope,before);console.log(JSON.stringify({scope:'Instrumented arithmetic counts, not cold acceptance; Native inputs/choice/value unchanged',fixture,acceptance,counts,uniqueHeads:headKeys.size,uniqueLayouts:layouts.size,uniqueFullLayoutSignatures:fullKeys.size,orderedResearchStats:value.diagnosticOrderedResearchQuotes()}));}finally{p.close();c.dispose();}
