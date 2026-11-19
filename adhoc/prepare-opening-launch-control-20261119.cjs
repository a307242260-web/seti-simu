'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'..'),dir=path.join(repo,'reports/ai-foundation-20261119');
const pre=JSON.parse(fs.readFileSync(path.join(dir,'v486-random20-runtime-preflight-20261119-v1.json'))),rt=pre.runtime;
const out=path.join(dir,'opening-policy-board20-forced-launch-root-20261119-v1.json.gz');assert(!fs.existsSync(out));
const prefix=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir,'opening-policy-board20-prefix-checkpoint-20261119-v1.json.gz'))));
const original=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(repo,'reports/iteration/v486-original20-20261119/board-20-replay-20261119-v1.json.gz'))));
const {createSeededRandom}=require(path.join(rt,'randomizer/game/random'));
const {createSimulationRuleComposition}=require(path.join(rt,'randomizer/training/simulation-rule-composition'));
const seed=original.seed,random=createSeededRandom(seed),rngState={algorithm:'seti-simulation-mulberry32-v1',state:random.getState()};
const {composition:c}=createSimulationRuleComposition({seed,activePlayerCount:4,random,rngState,trustedProjectionReader:true});
const events=[];
function legal(){const x=c.inspect();return x.phase==='awaiting_input'?x.session.decision.choices:c.inputPort.enumerateActions({});}
function submit(a){const x=c.inspect(),d=x.phase==='awaiting_input'?x.session.decision:null;
 const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
  :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));events.push(a);
 fs.writeFileSync(out,zlib.gzipSync(JSON.stringify({envelope:c.lifecycle.save().envelope,events})));
}
try{
 c.lifecycle.newGame({seed,activePlayerCount:4,initialize:true,rngState});assert(c.lifecycle.restore(prefix.envelope).ok);
 for(const id of ['dlc_29.png','b_136.webp']){const a=legal().find(a=>a.target?.kind==='discard-hand-cards'&&a.target.cardIds?.[0]===id);assert(a);submit(a);}
 for(let i=19;i<23;i++){const expected=original.actions[i].action,a=legal().find(a=>a.actionId===expected.actionId&&JSON.stringify(a.target)===JSON.stringify(expected.target));assert(a);submit(a);}
 const launch=legal().find(a=>a.family==='launch'&&a.actorId==='player-white');assert(launch);submit(launch);
 console.log(JSON.stringify({acceptedInputs:events.length,reconstructedRecordedSetupInputs:6,forcedInputs:1}));
}finally{c.dispose();}
