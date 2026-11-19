'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const repo=path.resolve(__dirname,'..'),D=path.join(repo,'reports/ai-foundation-20261119'),read=p=>JSON.parse(fs.readFileSync(p)),hash=b=>crypto.createHash('sha256').update(b).digest('hex'),seat='player-white';
const pre=read(path.join(D,'v486-random20-runtime-preflight-20261119-v1.json')),rt=pre.runtime;
for(const[p,h]of Object.entries(pre.sourceFiles))assert.equal(hash(fs.readFileSync(path.join(rt,p))),h,p);
const source='reports/ai-foundation-20261119/teacher-r4-order-analysis-first-20261119-v1.json.gz',before=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(repo,source)))).envelope;
const {createSeededRandom}=require(path.join(rt,'randomizer/game/random')),{createSimulationRuleComposition}=require(path.join(rt,'randomizer/training/simulation-rule-composition')),{buildRuleObservation}=require(path.join(rt,'randomizer/app/rule-observation')),{createAnalysisPort}=require(path.join(rt,'randomizer/game/ai/analysis-port')),k=require(path.join(rt,'randomizer/game/production-kernel')),rd=require(path.join(rt,'randomizer/game/ai/resource-demand')),effects=require(path.join(rt,'randomizer/game/cards/effects')),value=require(path.join(rt,'randomizer/game/ai/state-value'));
const seed='seti-free-analyze-v1',random=createSeededRandom(seed),rngState={algorithm:'seti-simulation-mulberry32-v1',state:random.getState()},{composition:c}=createSimulationRuleComposition({seed,activePlayerCount:4,random,rngState,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});
const output=path.join(D,'teacher-r4-held-pickup-native-routes-20261119-v1.json');
const previous=fs.existsSync(output)?read(output):null,resume=previous?.failure;
if(previous){assert.equal(previous.status,'failed');assert(resume.message.includes("'idle' !== 'stable'"));}
const report=previous||{schemaVersion:'seti-r4-held-pickup-native-routes-v1',status:'running',source,sourceSha256:hash(fs.readFileSync(path.join(repo,source))),sourceCommit:pre.sourceCommit,nativeInputs:0,newAISearches:0,newGames:0,cases:{}};
const persist=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');if(previous){report.status='running';report.previousFailureArchive='reports/ai-foundation-20261119/teacher-r4-held-pickup-idle-inspection-failure-20261119-v1.json.gz';delete report.failure;}persist();const envelope=()=>c.lifecycle.save().envelope;
const state=()=>{const e=envelope();return e.session?.session?.workingState||JSON.parse(e.committedState)};
function menu(){const x=c.inspect(),d=x.phase==='awaiting_input'?x.session.decision:null;return{decision:d,actions:d?d.choices:c.inputPort.enumerateActions({})};}
let actions=[],reveals=[];
function input(a){assert(a);assert.equal(a.actorId,seat);assert(report.nativeInputs<400);const{decision:d}=menu();const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));report.nativeInputs++;actions.push(a);if(r.irreversibleBarrier)reveals.push({afterInput:actions.length,barrier:r.irreversibleBarrier});persist();}
function choose(test){const m=menu(),a=m.actions.find(test);assert(a,'No legal requested action: '+JSON.stringify(m.actions));input(a);}
function facts(){const s=state(),p=s.players.players.find(p=>p.id===seat);return{turn:s.turn,resources:p.resources,income:p.income,technology:p.techState,hand:p.hand.map(c=>({id:c.id,cardId:c.cardId})),reserved:p.reservedCards.map(c=>({id:c.id,cardId:c.cardId})),probes:s.pieces.rockets.filter(p=>p.playerId===seat),completedTaskCount:p.completedTaskCount,data:p.dataState,rng:s.meta.rngState};}
try{
 c.lifecycle.newGame({seed,activePlayerCount:4,initialize:true,rngState});assert(c.lifecycle.restore(before).ok);assert.equal(state().turn.roundNumber,4);
 const p=state().players.players.find(p=>p.id===seat),card=p.hand.find(c=>c.cardId==='chong_9.webp');assert(card);const fee=effects.getCardPlayCost(card);assert.deepEqual(fee,{credits:2});
 const requirements=k.getProbeRouteRequirements(state(),seat),old=rd.heldLandingGoal({state:state(),seatId:seat,candidates:()=>requirements.candidates});assert.equal(old,null);report.oldPlannerReturnsNoHeldRoute=true;report.initial=facts();persist();
 for(const[name,planet,satellite]of [['io','jupiter','io'],['enceladus','saturn','enceladus']]){
  assert(c.lifecycle.restore(resume&&name==='io'?resume.envelope:before).ok);actions=resume&&name==='io'?[...resume.actions]:[];reveals=[];
  const candidate=requirements.candidates.find(c=>!c.launchRequired&&c.rocketId===7&&c.planetId===planet&&c.endpointTarget.satelliteId===satellite);assert(candidate);assert(p.resources.energy>=candidate.required.paidMovementPoints&&p.resources.credits>=fee.credits);
  if(!(resume&&name==='io'))for(const step of candidate.path){choose(a=>a.family==='move'&&a.target.rocketId===7&&a.target.deltaX===step.deltaX&&a.target.deltaY===step.deltaY);choose(a=>a.family==='choose_payment'&&a.target.choiceId==='energy');}
  if(!(resume&&name==='io'))choose(a=>a.family==='play_card'&&a.target.cardInstanceId===card.id);
  let landed=Boolean(resume&&name==='io'&&resume.actions.some(a=>a.target?.actionType==='land')),conditional=[];
  for(let i=0;i<40&&c.inspect().phase==='awaiting_input';i++){
   const offered=menu().actions;conditional.push(offered.map(a=>({id:a.actionId,family:a.family,target:a.target,summary:a.summary})));
   const land=offered.find(a=>a.target?.actionType==='land'&&a.target.rocketId===7&&a.target.planetId===planet&&a.target.landTarget?.satelliteId===satellite);
   const take=land||[...offered].sort((a,b)=>a.actionId.localeCompare(b.actionId))[0];assert(take);if(land)landed=true;input(take);
  }
  assert(landed,'No Native card landing target selected');assert.equal(envelope().session,null);
  choose(a=>a.family==='end_turn');
  for(let i=0;i<20&&c.inspect().phase==='awaiting_input';i++){const offered=menu().actions;const selected=offered.find(a=>a.family==='accept_optional_effect')||[...offered].sort((a,b)=>a.actionId.localeCompare(b.actionId))[0];input(selected);}
  assert.equal(envelope().session,null);const end=envelope(),f=facts(),port=createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});let observation;try{observation=port.openRoot().observation}finally{port.close()}
  const cp='reports/ai-foundation-20261119/teacher-r4-held-pickup-'+name+'-20261119-v1.json.gz';fs.writeFileSync(path.join(repo,cp),zlib.gzipSync(JSON.stringify({before,envelope:end,actions,observation})));
  report.cases[name]={checkpoint:cp,inputs:actions.length,candidate:{id:candidate.requirementId,path:candidate.path,printedFee:fee,energyForMovement:candidate.required.paidMovementPoints,knownReward:candidate.targetBenefit},facts:f,evaluation:value.evaluateStateValue(observation,seat),revealBoundaries:reveals,conditionalMenus:conditional};persist();
 }
 report.status='complete';persist();console.log(JSON.stringify({status:report.status,nativeInputs:report.nativeInputs,oldPlannerReturnsNoHeldRoute:true,cases:Object.fromEntries(Object.entries(report.cases).map(([n,c])=>[n,{inputs:c.inputs,wallet:c.facts.resources,probes:c.facts.probes,taskCount:c.facts.completedTaskCount,value:c.evaluation.total,reveals:c.revealBoundaries}]))}));
}catch(e){report.status='failed';report.failure={message:e.message,stack:e.stack,envelope:envelope(),actions};persist();console.error(e.stack);process.exitCode=1}finally{c.dispose()}
