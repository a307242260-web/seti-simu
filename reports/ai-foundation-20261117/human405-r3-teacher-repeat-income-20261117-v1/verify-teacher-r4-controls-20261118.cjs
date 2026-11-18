'use strict';
// Replay recorded controls only. No search, fallback, or inferred teacher move.
const fs=require('node:fs'),path=require('node:path'),z=require('node:zlib'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=process.argv[2]||path.resolve(__dirname,'../../..'),dir=path.join(root,'reports/ai-foundation-20261117/human405-r3-teacher-repeat-income-20261117-v1');
const {createSeededRandom}=require(path.join(root,'randomizer/game/random'));
const {createSimulationRuleComposition}=require(path.join(root,'randomizer/training/simulation-rule-composition'));
const ordered=x=>Array.isArray(x)?x.map(ordered):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,ordered(x[k])])):x;
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(ordered(x))).digest('hex');
const read=n=>JSON.parse(z.gunzipSync(fs.readFileSync(path.join(dir,n))));
function verify(label,initial,rows,expected,failure){
 const seed=JSON.parse(initial.committedState).meta.seed,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true});k.newGame({seed});const c=k.composition;
 const menu=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
 try{
  assert(c.lifecycle.restore(initial).ok);
  for(const {action} of rows){
   const a=menu().find(a=>a.actionId===action.actionId&&a.actorId===action.actorId&&digest(a.target)===digest(action.target));assert(a,label+' missing '+action.summary);
   const d=c.inspect().session?.decision,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,label+' rejected '+action.summary);
  }
  if(failure){assert(!menu().some(a=>a.actionId===failure.action.actionId));assert.deepEqual(menu().map(a=>a.actionId),failure.legal.map(a=>a.actionId))}
  const actual=c.lifecycle.save().envelope,canon=e=>({state:JSON.parse(e.committedState),session:JSON.parse(JSON.stringify(e.session))});assert.deepEqual(canon(actual),canon(expected),label+' final state/session/RNG');
  return {label,inputs:rows.length,completeNativeStateEqual:true,sessionEqual:true,rngEqual:true,failedActionStillAbsent:!!failure};
 }finally{c.dispose()}
}
const cases=[];
for(const n of ['teacher-r4-fixed-replay-20261118-v1.json.gz','teacher-r4-adapted-replay-20261118-v2.json.gz','teacher-r4-adapted-replay-20261118-v3.json.gz','teacher-r4-adapted-replay-20261118-v4.json.gz','teacher-r4-data-repair-20261118-v1.json.gz','teacher-r4-retain-final-cards-20261118-v1.json.gz','teacher-r4-retain-final-cards-20261118-v2.json.gz']){
 const d=read(n);cases.push(verify(n,d.initial,d.rows,d.end,d.failure));
 if(d.adaptations)assert(d.adaptations.every(a=>a.rootUnchanged!==false));
}
const control=read('teacher-r4-first-plan-control-20261118-v1.json.gz');
for(const c of control.cases)cases.push(verify(c.kind,control.root,c.rows,c.end,null));
const turn=read('teacher-r4-point265-plan-control-20261118-v1.json.gz');
for(const c of turn.cases)cases.push(verify(c.kind,turn.root,c.rows,c.end,null));
const turn272=read('teacher-r4-point272-plan-control-20261118-v2.json.gz');
for(const c of turn272.cases)cases.push(verify(c.kind,turn272.root,c.rows,c.end,null));
const free272=read('teacher-r4-point272-free-move-control-20261118-v1.json.gz');
cases.push(verify('known-one-step-fewer-than-two-scan-closes',free272.root,free272.rows,free272.end,null));
console.log(JSON.stringify({source:'27646b5b9e562c5e05b765c16989f7d60ae98336',cases,reranAI:false}));
