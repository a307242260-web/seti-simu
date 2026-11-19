'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'..'),dir=path.join(repo,'reports/ai-foundation-20261119'),seat='player-white';
const read=p=>JSON.parse(fs.readFileSync(p)),pre=read(path.join(dir,'v486-random20-runtime-preflight-20261119-v1.json')),rt=pre.runtime;
const prepared=read(path.join(dir,'teaching-chong2-preparation-20261119-v1.json'));assert.equal(prepared.status,'prepared');assert(prepared.cold.gatePassed);
const sorted=x=>x&&typeof x==='object'?Array.isArray(x)?x.map(sorted):Object.fromEntries(Object.keys(x).sort().map(k=>[k,sorted(x[k])])):x;
const hash=x=>crypto.createHash('sha256').update(Buffer.isBuffer(x)?x:JSON.stringify(sorted(x))).digest('hex');
for(const [p,h]of Object.entries(pre.sourceFiles))assert.equal(hash(fs.readFileSync(path.join(rt,p))),h,p);
const record=read(path.join(repo,'reports/research/2170d824.5fabd621.full.json')),steps=read(path.join(repo,record.savePath)).replaySteps;
const output=path.join(dir,'teaching-chong2-order-pair-20261119-v1.json');assert(!fs.existsSync(output));
const {createSeededRandom}=require(path.join(rt,'randomizer/game/random'));
const {createSimulationRuleComposition}=require(path.join(rt,'randomizer/training/simulation-rule-composition'));
const {buildRuleObservation}=require(path.join(rt,'randomizer/app/rule-observation'));
const {createAnalysisPort}=require(path.join(rt,'randomizer/game/ai/analysis-port'));
const value=require(path.join(rt,'randomizer/game/ai/state-value'));
const random=createSeededRandom(record.seed),rngState={algorithm:'seti-simulation-mulberry32-v1',state:random.getState()};
const {composition:c}=createSimulationRuleComposition({seed:record.seed,activePlayerCount:4,random,rngState,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,record.seed,v?.playerId)});
const report={schemaVersion:'seti-teaching-chong2-order-pair-v1',sourceCommit:pre.sourceCommit,seed:record.seed,status:'running',
 priorLiteralInputs:prepared.nativeInputs,nativeInputs:0,newAISearches:0,newFullGames:0,branches:[]};
const persist=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');persist();
const envelope=()=>c.lifecycle.save().envelope;
function legal(){const x=c.inspect();return x.phase==='awaiting_input'?x.session.decision.choices:c.inputPort.enumerateActions({});}
function restoreFile(p){const e=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(repo,p)))).envelope;assert(c.lifecycle.restore(e).ok);assert.deepEqual(envelope(),e);}
function submit(b,desired){assert(desired?.actorId===seat,'WHITE_CONTROL_WRONG_OWNER');assert(report.priorLiteralInputs+report.nativeInputs<300);const actions=legal();assert(actions.length&&actions.every(a=>a.actorId===seat));
 const a=actions.find(a=>a.family===desired.family&&hash(a.target||{})===hash(desired.target||{}));assert(a,'Known Native action unavailable: '+JSON.stringify(desired));
 const x=c.inspect(),d=x.phase==='awaiting_input'?x.session.decision:null,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
 assert(r.ok,JSON.stringify(r));report.nativeInputs++;b.actions.push(a);persist();
 fs.writeFileSync(path.join(dir,'teaching-chong2-order-active-checkpoint-20261119-v1.json.gz'),zlib.gzipSync(JSON.stringify({envelope:envelope(),nativeInputs:report.nativeInputs,branch:b.name})));
}
function snapshot(){const before=envelope(),port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});try{const n=port.openRoot(),result={observation:n.observation,value:value.evaluateStateValue(n.observation,seat)};assert.deepEqual(envelope(),before);return result;}finally{port.close();}}
function store(b,label){const e=envelope(),p=path.join(dir,'teaching-chong2-'+b.name+'-'+label+'-20261119-v1.json.gz');assert(!fs.existsSync(p));fs.writeFileSync(p,zlib.gzipSync(JSON.stringify({envelope:e})));b[label]={path:path.relative(repo,p),envelopeSha256:hash(e),snapshot:snapshot()};persist();}
try{
 c.lifecycle.newGame({seed:record.seed,activePlayerCount:4,initialize:true,rngState});
 for(const name of ['original-analysis','card-first','analysis-preserve-card']){
  const root=name==='card-first'?prepared.afterPlaySaved.path:prepared.rootSaved.path;
  const b={name,root,actions:[]};report.branches.push(b);persist();restoreFile(root);
  if(name==='card-first'){const end=legal().find(a=>a.family==='end_turn'&&a.actorId===seat);assert(end);submit(b,end);}
  for(let input=295;input<=308;input++)submit(b,steps[input-1].action);
  store(b,'incomeMenu');
  if(name==='original-analysis')submit(b,steps[308].action);
  else{const other=legal().find(a=>a.family==='choose_card'&&a.target?.cardInstanceId==='card-64-0'&&a.target?.choiceId?.startsWith('income:'));assert(other);submit(b,other);}
  store(b,'afterIncome');submit(b,steps[309].action);
  if(name==='analysis-preserve-card'){
   const play=legal().find(a=>a.family==='play_card'&&a.target?.cardInstanceId==='alien-chong-2-17');assert(play);submit(b,play);
   const end=legal().find(a=>a.family==='end_turn'&&a.actorId===seat);assert(end);submit(b,end);
  }
  store(b,'endpoint');
 }
 report.status='complete';report.totalLiteralInputs=report.priorLiteralInputs+report.nativeInputs;persist();
 const player=o=>o.publicState.players.find(p=>p.playerId===seat);
 console.log(JSON.stringify({status:report.status,totalLiteralInputs:report.totalLiteralInputs,branches:report.branches.map(b=>({name:b.name,inputs:b.actions.length,
  value:b.endpoint.snapshot.value,player:player(b.endpoint.snapshot.observation),hand:b.endpoint.snapshot.observation.selfState.hand.map(c=>c.cardId)}))}));
}catch(error){report.status='failed';report.failure={message:error.message,stack:error.stack};persist();console.error(error.stack);process.exitCode=1;}
finally{c.dispose();}
