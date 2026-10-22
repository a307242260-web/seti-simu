"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const {createSimulationRuleComposition}=require("../randomizer/training/simulation-rule-composition");
const {createSeededRandom}=require("../randomizer/game/random");
const {buildRuleObservation}=require("../randomizer/app/rule-observation");
const {createAnalysisPort}=require("../randomizer/game/ai/analysis-port");
const {searchDecision}=require("../randomizer/game/ai/decision-search");
const {createStateValueEvaluator}=require("../randomizer/game/ai/state-value");
const label=process.argv[2];assert(["baseline","immutable"].includes(label));
const output=`reports/ai-foundation-20261023/fork-state-reuse-${label}-v1.json`;assert(!fs.existsSync(output),"Reuse existing checkpoint");
const sha=value=>crypto.createHash("sha256").update(value).digest("hex"),fileSha=p=>sha(fs.readFileSync(p));
const report={scope:"three fixed cold 256-input prefixes, clone/parse census and unchanged search graph; instrumentation timings are not acceptance and do not imply complete search or whole-game speed",budget:{transitions:256,nodes:257,frontier:256,milliseconds:15000},label,rows:[]};
for(const id of ["062","105","152"]){
 const fixturePath=`adhoc/ai-decision-corpus-20261023-v1/case-${id}-20261023-v1.json`,f=JSON.parse(fs.readFileSync(fixturePath)),seed=f.source.seed;
 const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const comp=k.composition;assert(comp.lifecycle.restore(f.compositionEnvelope).ok);
 const before=comp.lifecycle.save().envelope,port=createAnalysisPort({composition:comp,seatId:f.seatId,maxCacheEntries:0}),root=port.openRoot(),evaluate=createStateValueEvaluator(f.seatId);
 const parse=JSON.parse,clone=globalThis.structuredClone,census={committedParses:0,fullStateClones:0,sessionClones:0,otherClones:0};
 JSON.parse=function(value,...args){if(typeof value==="string"&&value.includes('"schemaVersion":"seti-committed-game-state-v1"'))census.committedParses+=1;return parse(value,...args);};
 globalThis.structuredClone=function(value,...args){if(value?.meta&&value?.players&&value?.cards)census.fullStateClones+=1;else if(value?.workingState&&value?.sessionId)census.sessionClones+=1;else census.otherClones+=1;return clone(value,...args);};
 let result;const at=performance.now();try{result=searchDecision({port,root,evaluate,modelKey:evaluate.modelKey,planReuse:true,resourceDominance:true,moneyCapacityDominance:true,cardTradePruning:true,postMainPruning:true,openingPruning:true,cardChoiceEquivalence:true,budget:report.budget});}finally{JSON.parse=parse;globalThis.structuredClone=clone;}
 const milliseconds=performance.now()-at;assert.equal(result.diagnostics.transitions,256);assert(!result.complete);assert.deepEqual(comp.lifecycle.save().envelope,before);
 const rawPath=`adhoc/ai-decision-corpus-20261023-v1/fork-state-reuse-${label}-${id}-v1.raw.json`;fs.writeFileSync(rawPath,JSON.stringify(result)+"\n");
 const normalized=clone(result);normalized.diagnostics.milliseconds=0;
 const row={id,fixturePath,fixtureSha256:fileSha(fixturePath),milliseconds,complete:result.complete,stopReason:result.stopReason,diagnostics:result.diagnostics,census,port:port.getDiagnostics(),graphSha256:sha(JSON.stringify(normalized)),rawPath,rawSha256:fileSha(rawPath),rootUnchanged:true};
 report.rows.push(row);fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");console.log(JSON.stringify({id,milliseconds,census,port:row.port.milliseconds,graphSha256:row.graphSha256}));port.close();comp.dispose();
}
report.sourceHashes=Object.fromEntries(Object.keys(require.cache).filter(p=>p.includes("/randomizer/")).map(p=>[path.relative(process.cwd(),p),fileSha(p)]));report.status="complete";fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
