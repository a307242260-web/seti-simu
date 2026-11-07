'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const load=n=>require(path.resolve(n)),read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const {createSeededRandom}=load('randomizer/game/random'),{createSimulationRuleComposition}=load('randomizer/training/simulation-rule-composition');
const {buildRuleObservation}=load('randomizer/app/rule-observation'),{createAnalysisPort}=load('randomizer/game/ai/analysis-port');
const {createSearchAgent}=load('randomizer/game/ai/search-agent');
const [fixture,out]=process.argv.slice(2),f=read(fixture),seat=f.seatId,seed=f.source.seed;
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});
const c=k.composition,p=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
try{
 assert(c.lifecycle.restore(f.compositionEnvelope).ok);const before=c.lifecycle.save().envelope;
 const agent=createSearchAgent({seatId:seat,analysisPort:p}),legalActions=c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
 const r=agent.decide({seatId:seat,legalActions}),action=legalActions.find(q=>q.actionId===r.actionId);
 assert.deepEqual(c.lifecycle.save().envelope,before);
 const quotes=r.search.lines.flatMap(l=>l.knownScanTiming?[l.knownScanTiming]:[]);
 const gate={complete:r.search.complete,inputs:r.search.diagnostics.nativeExecutions,ms:r.search.rootAndSearchMilliseconds};
 const result={source:fixture,sourceSha256:sha(fixture),action,gate,quotes,search:r.search,rootAndRngRestored:true,newAutonomousRuns:0};
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({action:action.summary,value:r.search.value,gate,roots:r.search.roots.filter(x=>x.value!=null).map(x=>[x.actionId,x.value]),quotes}));
}finally{p.close();c.dispose();}
