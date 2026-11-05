'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSimulationEnv}=require('../randomizer/app/simulation-env'),values=require('../randomizer/game/ai/state-value'),local=require('../randomizer/game/ai/local-decision-plans'),amiba=require('../randomizer/game/aliens/amiba');
const dir='reports/ai-foundation-20261105/third-round-teacher-v1',cp=dir+'/teacher-before-input-127-20261105-v1.checkpoint.json',manifest='reports/ai-foundation-20261105/candidate-v197-stationary-prefix-20261105-v1/manifest.json',out=dir+'/v197-known-research-order-control-20261105-v2.json',read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');assert(!fs.existsSync(out));
const env=createSimulationEnv(),seatId='player-white',rows=[];let inputs=0;
const state=()=>{const e=env.createCheckpoint().coreState.compositionEnvelope;return e.session?.session?.workingState||JSON.parse(e.committedState);};
const legal=()=>env.legalActions();
function submit(action,steps){assert(action,'known control action missing');assert.equal(action.actorId,seatId);const r=env.step(action);assert(r.ok,JSON.stringify(r));inputs++;steps.push(action);}
const rewardValue=r=>(r.gain?.score||0)+(r.gain?.publicity||0)*.5+(r.dataCount||0)*.5+(r.drawCards||0);
function settle(steps){
 for(let n=0;n<8;n++){
  const s=state(),actions=legal(),head=env.createCheckpoint().coreState.compositionEnvelope.session?.session?.queue?.[0];if(!head)return;
  let action=actions.find(a=>a.family==='accept_optional_effect'&&a.target?.choiceId?.startsWith('confirm:trigger:'));
  if(!action&&actions.every(a=>a.target?.slotId)){
   const entries=actions.map(a=>{const entry=amiba.listSymbolsInRegion(s.aliens,a.target.region).find(e=>e.slotId===a.target.slotId);assert(entry);return{a,value:rewardValue(entry.reward)};}).sort((a,b)=>b.value-a.value||a.a.target.slotId.localeCompare(b.a.target.slotId));action=entries[0].a;
  }
  if(!action&&actions.every(a=>a.target?.tileId&&a.target?.choiceId?.startsWith('final:'))){const spec=local.finalMark({state:s,seatId,actions});action=actions.find(a=>a.actionId===spec.selectedActionId);}
  assert(action,'unexpected native decision '+JSON.stringify(actions.map(a=>({family:a.family,target:a.target}))));submit(action,steps);
 }
 throw Error('known control did not settle within audited effect count');
}
try{
 for(const [label,order]of [['teacher',['paid-purple','automatic','held-orange']],['held-first',['held-orange','paid-purple','automatic']]]){
  env.loadCheckpoint(read(cp));const initial=env.createCheckpoint().coreState.compositionEnvelope,known=new Set(env.observe(seatId).selfState.hand.map(c=>c.id)),steps=[],checkpoints=[];
  function snapshot(){const obs=env.observe(seatId),masked=structuredClone(obs);masked.selfState.hand=masked.selfState.hand.map(c=>known.has(c.id)?c:{id:c.id,hidden:true});const own=obs.publicState.players.find(p=>p.playerId===seatId);return{score:own.score,finalScore:own.finalScore,resources:state().players.players.find(p=>p.id===seatId).resources,tech:own.techState,symbols:amiba.getPublicSymbolState(state().aliens),maskedHandValue:values.evaluateStateValue(masked,seatId)};}
  const before=snapshot();
  for(const purpose of order){
   const cardId=purpose==='automatic'?'amiba_0.webp':'b_101.webp';submit(legal().find(a=>purpose==='paid-purple'?a.family==='research_tech':a.family==='play_card'&&env.observe(seatId).selfState.hand.find(c=>c.id===a.target?.cardInstanceId)?.cardId===cardId),steps);
   if(purpose!=='automatic')submit(legal().find(a=>a.target?.tileId===(purpose==='paid-purple'?'purple2':'orange2')),steps);
   settle(steps);submit(legal().find(a=>a.family==='end_turn'),steps);settle(steps);checkpoints.push({purpose,after:snapshot()});
  }
  const after=snapshot(),endpointPath=dir+'/v197-order-'+label+'-after-three-actions-20261105-v2.checkpoint.json';fs.writeFileSync(endpointPath,JSON.stringify(env.createCheckpoint())+'\n');
  const alien={amiba:structuredClone(after.symbols)},resolved=amiba.resolveRegionReward(alien,'blue');assert(resolved.ok);const symbolQuotes=resolved.results.map(r=>({slot:r.slotId,symbolId:r.symbolId,reward:r.reward,value:rewardValue(r.reward)}));
  rows.push({label,order,before,checkpoints,after,steps,endpointPath,endpointSha256:sha(endpointPath),conditionalBlueRegionNativeRewards:symbolQuotes,conditionalScope:'Readonly formal symbol queries only; future blue4 trace payment/reachability is not established here.'});
  env.loadCheckpoint(read(cp));assert.deepEqual(env.createCheckpoint().coreState.compositionEnvelope,initial);
 }
 fs.writeFileSync(out,JSON.stringify({candidate:'V197/V24',candidateAdmitted:false,checkpoint:cp,checkpointSha256:sha(cp),candidateSourceManifest:manifest,candidateSourceManifestSha256:sha(manifest),scope:'Two finite native controls from the same current root, executing the same three known actions in different order. No policy search or autonomous game; new blind identity is masked and never funds a purpose.',inputs,newAutonomousRuns:0,rootAndRngRestored:true,rows},null,2)+'\n');
 console.log(JSON.stringify({output:out,inputs,rows:rows.map(r=>({label:r.label,score:r.after.score,finalScore:r.after.finalScore,value:r.after.maskedHandValue.total,symbols:r.after.symbols.symbolSlots,conditionalBlueRegion:r.conditionalBlueRegionNativeRewards.map(q=>q.value)}))}));
}finally{env.dispose();}
