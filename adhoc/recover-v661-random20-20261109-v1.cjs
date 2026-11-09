'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const {createEnvironment}=require(path.resolve('tools/research-free-analyze-random20'));
const [board,out,previous]=process.argv.slice(2),row=read('reports/ai-foundation-20261109/v661-random20-v1/v661-random20-verified-20261109-v1.json').rows.find(r=>r.number===Number(board));
assert(row&&!row.terminal);
const rec=read(row.record),prior=previous?read(previous):null,old=prior?.save||read(row.save),cp=prior?.checkpoint||read(rec.failure.checkpointPath);
const env=createEnvironment(),verify=createEnvironment(),actions=[],gate=[...(prior?.gate||[])];
const at=e=>e.createCheckpoint().coreState.compositionEnvelope;
const seal=s=>fs.writeFileSync(out,JSON.stringify(s)+'\n',{flag:'wx'});
const replay=(e,entry)=>{
 const a=e.legalActions().find(x=>x.actionId===entry.action.actionId&&x.actorId===entry.actorPlayerId);
 assert(a,'missing native input '+entry.action.actionId);
 const v=e.step(a);assert(v.ok,JSON.stringify(v));
};
try{
 env.loadCheckpoint(cp);
 verify.reset({seed:row.seed,agentType:'custom',seat:'player-white',activePlayerCount:4,compactReplay:true,opponentIdentity:rec.scenario.opponentPolicyVersion});
 for(const e of old.replaySteps)replay(verify,e);
 assert.deepEqual(at(env),at(verify),'candidate changed prior native prefix');
 const started=performance.now();let error=null;
 while(!env.isTerminal()&&performance.now()-started<Math.max(1000,180000-rec.wallMs-(prior?.ms||0))){
  const start=env.saveBrowserSave(),menu=env.legalActions();
  try{
   const x=env.runAgentDecision(),e=env.saveBrowserSave().replaySteps.at(-1);assert(e);
   if(e.actorPlayerId!=='player-white')assert(e.action.family==='pass'||['pass-reserve-card','pass-hand-limit'].includes(e.action.target?.kind));
   assert.equal(env.saveBrowserSave().replaySteps.length,start.replaySteps.length+1);
   assert(menu.some(a=>a.actionId===e.action.actionId));
   for(const q of x.searches||[])gate.push({input:old.replaySteps.length+actions.length+1,native:q.diagnostics.nativeExecutions,ms:q.rootAndSearchMilliseconds,complete:q.complete});
   actions.push(e);
  }catch(e){
   error={code:e.code,message:e.message,actionCount:actions.length};
   assert.equal(env.saveBrowserSave().committedState,start.committedState);break;
  }
 }
 const ms=performance.now()-started;for(const a of actions)replay(verify,a);
 assert.deepEqual(at(env),at(verify));
 const save=env.saveBrowserSave(),state=JSON.parse(save.committedState),terminal=env.isTerminal(),white=state.match.finalScores?.find(x=>x.playerId==='player-white')||null;
 const evidence={board:Number(board),source:row.record,sourceSha256:sha(row.record),failedCheckpoint:rec.failure.checkpointPath,
   sourceInputs:row.steps,recoveryInputs:(prior?.recoveryInputs||0)+actions.length,ms:(prior?.ms||0)+ms,originalWallMs:rec.wallMs,terminal,white,error,gate,
   replayNativeStateSessionRngExact:true,checkpoint:env.createCheckpoint(),save};
 seal(evidence);
 console.log(JSON.stringify({board:Number(board),terminal,score:white?.totalScore||null,error,actions:actions.length,ms,
   maxNative:Math.max(0,...gate.map(x=>x.native)),maxMs:Math.max(0,...gate.map(x=>x.ms)),over:gate.filter(x=>x.native>256||x.ms>600).length}));
}finally{env.dispose();verify.dispose();}
