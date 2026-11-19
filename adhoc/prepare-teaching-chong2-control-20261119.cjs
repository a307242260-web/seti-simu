'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'..'),dir=path.join(repo,'reports/ai-foundation-20261119'),seat='player-white';
const read=p=>JSON.parse(fs.readFileSync(p)),pre=read(path.join(dir,'v486-random20-runtime-preflight-20261119-v1.json')),rt=pre.runtime;
const sorted=x=>x&&typeof x==='object'?Array.isArray(x)?x.map(sorted):Object.fromEntries(Object.keys(x).sort().map(k=>[k,sorted(x[k])])):x;
const hash=x=>crypto.createHash('sha256').update(Buffer.isBuffer(x)?x:JSON.stringify(sorted(x))).digest('hex');
for(const [p,h]of Object.entries(pre.sourceFiles))assert.equal(hash(fs.readFileSync(path.join(rt,p))),h,p);
const record=read(path.join(repo,'reports/research/2170d824.5fabd621.full.json')),save=read(path.join(repo,record.savePath));
const end=record.roundEnds.find(r=>r.round===3),cpFile=path.join(repo,end.checkpointPath),cp=read(cpFile);
assert.equal(end.beforeInput,260);assert.equal(hash(fs.readFileSync(cpFile)),end.checkpointSha256);
const expected=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir,'teaching-input295-context-20261119-v1.json.gz'))));
const output=path.join(dir,'teaching-chong2-preparation-20261119-v1.json');assert(!fs.existsSync(output));
const {createSeededRandom}=require(path.join(rt,'randomizer/game/random'));
const {createSimulationRuleComposition}=require(path.join(rt,'randomizer/training/simulation-rule-composition'));
const {buildRuleObservation}=require(path.join(rt,'randomizer/app/rule-observation'));
const {createAnalysisPort}=require(path.join(rt,'randomizer/game/ai/analysis-port'));
const {searchDecision}=require(path.join(rt,'randomizer/game/ai/decision-search'));
const values=require(path.join(rt,'randomizer/game/ai/state-value')),agent=require(path.join(rt,'randomizer/game/ai/search-agent'));
const random=createSeededRandom(record.seed),rngState={algorithm:'seti-simulation-mulberry32-v1',state:random.getState()};
const {composition:c}=createSimulationRuleComposition({seed:record.seed,activePlayerCount:4,random,rngState,trustedProjectionReader:true,
 projectCounterfactualState:(s,v)=>buildRuleObservation(s,record.seed,v?.playerId)});
const report={schemaVersion:'seti-teaching-chong2-preparation-v1',sourceCommit:pre.sourceCommit,seed:record.seed,status:'running',
 sourceFilesVerified:Object.keys(pre.sourceFiles).length,newFullGames:0,newAISearches:0,nativeInputs:0,prefix:[],cardWitness:[]};
const persist=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');persist();
const envelope=()=>c.lifecycle.save().envelope;
function state(){const e=envelope();return e.session?.session?.workingState||JSON.parse(e.committedState);}
function legal(){const x=c.inspect();return x.phase==='awaiting_input'?x.session.decision.choices:c.inputPort.enumerateActions({});}
function submit(list,desired){
 if(desired.actorId!==seat)assert(desired.family==='pass'||desired.phase==='conditional','FROZEN_OPPONENT_ACTION_FORBIDDEN');
 assert(report.nativeInputs<300);const actions=legal();assert(actions.length&&actions.every(a=>a.actorId===desired.actorId),'INPUT_OWNER_DRIFT');
 const a=actions.find(a=>a.family===desired.family&&hash(a.target||{})===hash(desired.target||{}));assert(a,'Recorded Native input unavailable '+desired.actionId);
 const x=c.inspect(),d=x.phase==='awaiting_input'?x.session.decision:null,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
 assert(r.ok,JSON.stringify(r));report.nativeInputs++;list.push(a);persist();
 fs.writeFileSync(path.join(dir,'teaching-chong2-active-checkpoint-20261119-v1.json.gz'),zlib.gzipSync(JSON.stringify({envelope:envelope(),nativeInputs:report.nativeInputs})));
}
function snapshot(){const before=envelope(),port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});try{const n=port.openRoot(),result={observation:n.observation,value:values.evaluateStateValue(n.observation,seat),legalActions:n.legalActions};assert.deepEqual(envelope(),before);return result;}finally{port.close();}}
function store(name){const e=envelope(),file=path.join(dir,'teaching-chong2-'+name+'-20261119-v1.json.gz');assert(!fs.existsSync(file));fs.writeFileSync(file,zlib.gzipSync(JSON.stringify({envelope:e})));return{path:path.relative(repo,file),envelopeSha256:hash(e)};}
try{
 c.lifecycle.newGame({seed:record.seed,activePlayerCount:4,initialize:true,rngState});assert(c.lifecycle.restore(cp.coreState.compositionEnvelope).ok);assert.deepEqual(envelope(),cp.coreState.compositionEnvelope);
 for(let input=260;input<=294;input++)submit(report.prefix,save.replaySteps[input-1].action);
 report.root=snapshot();assert.deepEqual(report.root.observation.publicState,expected.context.observation.publicState);assert.deepEqual(report.root.observation.selfState,expected.context.observation.selfState);
 report.rootObservationExact=true;report.rootSaved=store('root295');persist();
 const before=envelope(),evaluate=values.createStateValueEvaluator(seat),port=createAnalysisPort({composition:c,seatId:seat});
 try{const started=performance.now(),root=port.openRoot();report.newAISearches++;persist();const r=searchDecision({port,root,evaluate,modelKey:evaluate.modelKey,...agent.OPTIONS,budget:{transitions:null,nodes:null,frontier:null,milliseconds:null}});
  report.search=r;report.cold={complete:r.complete,actionId:r.actionId,value:r.value,nativeInputs:r.diagnostics.nativeExecutions,milliseconds:performance.now()-started};assert.deepEqual(envelope(),before);report.cold.rootAndRngUnchanged=true;
  report.cold.gatePassed=r.complete&&r.diagnostics.nativeExecutions<=256&&report.cold.milliseconds<=600;persist();
 }finally{port.close();}
 if(!report.cold.gatePassed){report.status='single-point-gate-failed';persist();}
 else{
  const card=state().players.players.find(p=>p.id===seat).hand.find(c=>c.cardId==='chong_2.webp');assert(card);
  const play=legal().find(a=>a.family==='play_card'&&a.target?.cardInstanceId===card.id);assert(play);submit(report.cardWitness,play);
  report.afterPlay=snapshot();report.afterPlaySaved=store('after-play');report.status='prepared';persist();
 }
 console.log(JSON.stringify({status:report.status,nativeInputs:report.nativeInputs,cold:report.cold,
  afterPlay:report.afterPlay&&{value:report.afterPlay.value,player:report.afterPlay.observation.publicState.players.find(p=>p.playerId===seat),legal:report.afterPlay.legalActions.map(a=>({id:a.actionId,f:a.family,t:a.target,summary:a.summary}))}}));
}catch(error){report.status='failed';report.failure={message:error.message,stack:error.stack};persist();console.error(error.stack);process.exitCode=1;}
finally{c.dispose();}
