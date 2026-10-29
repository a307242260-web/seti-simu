'use strict';
// Pure replay to one recorded root plus small native branch checks; never reruns AI search.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSimulationEnv}=require('../randomizer/app/simulation-env');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom}=require('../randomizer/game/random');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const {createAnalysisPort}=require('../randomizer/game/ai/analysis-port');
const cards=require('../randomizer/game/cards/deck');
const prefix='reports/ai-foundation-20261023/search-step295-analysis-20261029-v1';
const output='adhoc/ai-decision-corpus-20261029-reorg-v1/step295-20261029-v1.json';if(fs.existsSync(output))throw Error('Existing fixture; reuse');
const tracePath='reports/research/a760f3dd.ff4b36c1.full.json.decisions.jsonl',checkpointPath='reports/ai-foundation-20261023/search-unbounded-baseline-20261029-v1.checkpoint-step-280.json';
const bytes=fs.readFileSync(tracePath),traces=bytes.toString().trim().split('\n').map(JSON.parse),trace=traces[294];
const env=createSimulationEnv();let envelope;
try{
 env.loadCheckpoint(JSON.parse(fs.readFileSync(checkpointPath)));
 for(let i=280;i<294;i++){const a=env.legalActions().find(a=>a.actionId===traces[i].actionId);assert(a,`replay ${i+1}`);assert.equal(env.step(a).ok,true);}
 envelope=env.createCheckpoint().coreState.compositionEnvelope;
}finally{env.dispose();}
fs.mkdirSync('adhoc/ai-decision-corpus-20261029-reorg-v1',{recursive:true});fs.writeFileSync(output,JSON.stringify({compositionEnvelope:envelope,seatId:'player-white',source:{seed:JSON.parse(envelope.committedState).meta.seed,tracePath,step:295,originalActionId:trace.actionId},classification:{round:4,turn:6}},null,2)+'\n');console.log(output);
