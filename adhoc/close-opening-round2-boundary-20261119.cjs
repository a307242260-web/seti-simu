'use strict';
// Reading the next PASS boundary consumes no additional controlled input.
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..'),dir=path.join(repo,'reports/ai-foundation-20261119');
const pre=JSON.parse(fs.readFileSync(path.join(dir,'v486-random20-runtime-preflight-20261119-v1.json'))),rt=pre.runtime;
const saved=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir,'opening-policy-board20-retained-purple-round2-checkpoint-20261119-v1.json.gz'))));
const out=path.join(dir,'opening-policy-board20-round2-boundary-20261119-v1.json');assert(!fs.existsSync(out));
const {createSeededRandom}=require(path.join(rt,'randomizer/game/random'));
const {createSimulationRuleComposition}=require(path.join(rt,'randomizer/training/simulation-rule-composition'));
const {buildRuleObservation}=require(path.join(rt,'randomizer/app/rule-observation'));
const {createAnalysisPort}=require(path.join(rt,'randomizer/game/ai/analysis-port'));
const {createSearchAgent}=require(path.join(rt,'randomizer/game/ai/search-agent'));
const seed=JSON.parse(saved.envelope.committedState).meta.seed,random=createSeededRandom(seed),rngState={algorithm:'seti-simulation-mulberry32-v1',state:random.getState()};
const {composition:c}=createSimulationRuleComposition({seed,activePlayerCount:4,random,rngState,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});
const port=createAnalysisPort({composition:c,seatId:'player-white'}),agent=createSearchAgent({seatId:'player-white',analysisPort:port});
const report={sourceCommit:pre.sourceCommit,newCommittedInputs:0,newFullGames:0,priorSafetyStopPreserved:true,status:'checking'};
try{
 c.lifecycle.newGame({seed,activePlayerCount:4,initialize:true,rngState});assert(c.lifecycle.restore(saved.envelope).ok);agent.loadCheckpoint(saved.machineAI);
 const actions=c.inputPort.enumerateActions({}),before=c.lifecycle.save().envelope;
 const selected=agent.decide({seatId:'player-white',legalActions:actions}),a=actions.find(a=>a.actionId===selected.actionId);assert.deepEqual(c.lifecycle.save().envelope,before);
 report.search={action:a,complete:selected.search.complete,nativeInputs:selected.search.diagnostics.nativeExecutions,milliseconds:selected.search.rootAndSearchMilliseconds};
 assert(selected.search.complete&&report.search.nativeInputs<=256&&report.search.milliseconds<=600);assert.equal(a.family,'pass','boundary not yet reached; no input may be submitted');
 const s=JSON.parse(before.committedState),p=s.players.players.find(p=>p.id==='player-white');assert.equal(s.turn.roundNumber,2);
 report.boundary={round:2,phase:'before-pass-card-and-income',resources:p.resources,income:p.income,techState:p.techState,hand:p.hand,dataState:p.dataState,traceSlots:s.aliens.aliens,rockets:s.pieces.rockets.filter(r=>r.playerId==='player-white'||r.playerColor==='white')};
 report.status='complete';
}catch(e){report.status='incomplete';report.failure={message:e.message,stack:e.stack};process.exitCode=1;}
finally{fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');port.close();c.dispose();}
console.log(JSON.stringify(report));
