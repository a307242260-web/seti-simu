'use strict';
// Fixed recorded actions only: no agent/search, no regenerated game result.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=process.argv[2]||path.resolve(__dirname,'../../..');
const {createSeededRandom}=require(path.join(root,'randomizer/game/random'));
const {createSimulationRuleComposition}=require(path.join(root,'randomizer/training/simulation-rule-composition'));
const archive=JSON.parse(fs.readFileSync(path.join(root,'reports/research/2170d824.5fabd621.replay.json')));
const ordered=x=>Array.isArray(x)?x.map(ordered):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,ordered(x[k])])):x;
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(ordered(x))).digest('hex');
const random=createSeededRandom(archive.seed),rngState={algorithm:'seti-simulation-mulberry32-v1',state:random.getState()};
const kernel=createSimulationRuleComposition({seed:archive.seed,activePlayerCount:archive.activePlayerCount,random,rngState,trustedProjectionReader:true});
const c=kernel.composition;
try{
 c.lifecycle.newGame({seed:archive.seed,activePlayerCount:archive.activePlayerCount,initialize:true,rngState});
 c.inputPort.beginDrain({metadata:{source:'verify-fixed-current-full-replay'}});
 for(const [i,{action}] of archive.actions.entries()){
  const inspection=c.inspect(),d=inspection.phase==='awaiting_input'?inspection.session.decision:null;
  const a=(d?.choices||c.inputPort.enumerateActions({})).find(a=>a.actionId===action.actionId&&a.family===action.family&&a.actorId===action.actorId&&digest(a.target||{})===digest(action.target||{}));
  assert(a,`recorded input not legal at ${i+1}`);
  const result=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
  assert(result.ok,`recorded input rejected at ${i+1}`);
 }
 const {envelope}=c.lifecycle.save(),s=JSON.parse(envelope.committedState);
 const actual={nativeStateSha256:digest(s),sessionSha256:digest(envelope.session),rng:s.meta.rngState};
 assert.deepEqual(actual,archive.expected,'complete state, session or RNG differs');assert(s.turn.gameEnded);
 assert.equal(archive.actions.length,354);assert.equal(s.players.players.find(p=>p.id==='player-white').resources.score,192);
 console.log(JSON.stringify({inputs:354,originalRunSource:archive.ruleCommit,verificationSource:archive.verification.sourceCommit,nativeStateEqual:true,sessionEqual:true,rngEqual:true,reranAI:false,...actual}));
}finally{c.dispose()}
