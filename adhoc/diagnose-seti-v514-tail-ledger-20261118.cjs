'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root='/var/folders/cl/yh68cq4s3pz4w8cy0_95jbj00000gn/T/seti-v514-standalone-20261118-kyog1z0g';
const out='/Users/bilibili/code/seti-simu/reports/ai-foundation-20261118/v514-tail-ledger-diagnostic-20261118-v1.json';
if(fs.existsSync(out))throw Error('reuse saved diagnostic');
const fixturePath=path.join(root,'adhoc/ai-decision-corpus-20261023-v1/case-105-20261023-v1.json');
const f=JSON.parse(fs.readFileSync(fixturePath)),seed=f.source.seed;
const {createSimulationRuleComposition}=require(path.join(root,'randomizer/training/simulation-rule-composition'));
const {createSeededRandom}=require(path.join(root,'randomizer/game/random'));
const {buildRuleObservation}=require(path.join(root,'randomizer/app/rule-observation'));
const {createAnalysisPort}=require(path.join(root,'randomizer/game/ai/analysis-port'));
const {searchDecision}=require(path.join(root,'randomizer/game/ai/decision-search'));
const values=require(path.join(root,'randomizer/game/ai/state-value')),agent=require(path.join(root,'randomizer/game/ai/search-agent'));
const assert=require('node:assert/strict');const kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>buildRuleObservation(s,seed,w?.playerId)});kernel.newGame({seed});const c=kernel.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);const original=c.lifecycle.save().envelope,evaluate=values.createStateValueEvaluator(f.seatId);const rows=[];
function run(label,budget){const p=createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});try{const r=searchDecision({...agent.OPTIONS,port:p,root:p.openRoot(),evaluate,modelKey:evaluate.modelKey,budget});assert.deepEqual(c.lifecycle.save().envelope,original);const row={label,budget,complete:r.complete,stopReason:r.stopReason,value:r.value,actionId:r.actionId,transitions:r.diagnostics.transitions,native:r.diagnostics.nativeExecutions,logicalNodes:r.lines.length,rootAndRngExact:true,rootSignature:r.roots.map(x=>[x.actionId,x.goal?.id,x.value,x.valueType,x.completion])};rows.push(row);fs.writeFileSync(out,JSON.stringify({kind:'isolated budget-accounting failure diagnosis; unchanged runtime and test',fixtureSha256:crypto.createHash('sha256').update(fs.readFileSync(fixturePath)).digest('hex'),rows},null,2)+'\n');return r;}finally{p.close();}}
try{const reference=run('original-unbounded',agent.BUDGET);assert(reference.complete);const native=run('test-budget-is-native-count',{transitions:reference.diagnostics.nativeExecutions,nodes:1024,frontier:256,milliseconds:15000});if(reference.diagnostics.transitions!==reference.diagnostics.nativeExecutions){const charged=run('budget-is-charged-transition-count',{transitions:reference.diagnostics.transitions,nodes:1024,frontier:256,milliseconds:15000});if(charged.complete){assert.equal(charged.actionId,reference.actionId);assert.equal(charged.value,reference.value);assert.deepEqual(charged.roots,reference.roots);}}
 console.log(JSON.stringify({rows:rows.map(({rootSignature,...x})=>x),newAutonomousGames:0}));}finally{c.dispose();}
