'use strict';
// Six named plans, at most32 native inputs each. No search or branching
// enumeration: current greedy income, one known beneficiary swap, or one
// known Mars orbit. Compare exact states; do not use replenished identities.
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),values=require('../randomizer/game/ai/state-value'),demand=require('../randomizer/game/ai/resource-demand'),local=require('../randomizer/game/ai/local-decision-plans'),pick=require('../randomizer/game/ai/card-pick-planning'),cards=require('../randomizer/game/cards/deck'),effects=require('../randomizer/game/cards/effects');
const read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),folder='reports/ai-foundation-20261104/two-rounds-teacher-v2/',out=folder+'v158-known-income-timing-native-20261104-v1.json';assert(!fs.existsSync(out));
const sources={blue2:'reports/ai-foundation-20261104/two-rounds-teacher-v1/teacher-step-038-20261104-v1.json',blue3:folder+'ai-v158-step038-20261104-v1.json'},report={status:'running',plans:[],bounds:{namedPlans:6,maxNativeInputsPerPlan:32},knowledge:'Root38 known hand/public cards only; newly replenished public cards null, unknown owned identities hidden, native states never altered to execute a plan.',goalStatus:'active',goalAchieved:false};
function persist(){fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');}
for(const [technology,source]of Object.entries(sources)){
 const f=read(source),seed=f.source.seed,seatId=f.seatId,k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(f.compositionEnvelope).ok);const original=c.lifecycle.save().envelope,root=JSON.parse(original.committedState),owner=root.players.players.find(p=>p.id===seatId),known=new Set([...owner.hand,...root.cards.publicCards].filter(Boolean).map(c=>c.id));
 function current(){const e=c.lifecycle.save().envelope;return e.session?.session?.workingState||JSON.parse(e.committedState);}
 function legal(){return c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});}
 function value(){const obs=structuredClone(c.projection({role:'player',playerId:seatId}).state);obs.selfState.hand=obs.selfState.hand.map(card=>known.has(card.id)?card:{id:card.id,hidden:true});obs.publicState.board.publicCards=obs.publicState.board.publicCards.map(card=>card&&known.has(card.id)?card:null);return values.evaluateStateValue(obs,seatId);}
 function facts(){const s=current(),p=s.players.players.find(p=>p.id===seatId);return{resources:p.resources,income:p.income,technology:p.techState,data:p.dataState,hand:p.hand.map(c=>({id:c.id,cardId:known.has(c.id)?c.cardId:null,hidden:!known.has(c.id)})),probes:s.pieces.rockets.filter(r=>r.playerId===p.id),turn:s.turn.turnNumber};}
 try{for(const plan of ['immediate-energy-income','swap-to-known-credit-income','end-orbit-known-credit-income']){
  assert(c.lifecycle.restore(original).ok);const before=value(),row={technology,source,sourceSha256:sha(source),plan,before,beforeFacts:facts(),steps:[]};report.pending=row;persist();
  function submit(predicate,label){assert(row.steps.length<32);const a=legal().find(predicate);if(!a){row.missing=label;row.menu=legal();persist();throw Error('NATIVE_CONTROL_ACTION_MISSING:'+label);}const d=c.inspect().session?.decision,r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(r.ok,JSON.stringify(r));row.steps.push({actionId:a.actionId,family:a.family,target:a.target,payload:a.payload,summary:a.summary});}
  const family=(f,label=f)=>submit(a=>a.family===f,label),incomeId=plan==='immediate-energy-income'?'card-18-0':'card-40-0';
  if(plan==='swap-to-known-credit-income'){
   family('industry');submit(a=>a.target.cardInstanceId==='card-18-0','swap outgoing B48');submit(a=>a.target.cardInstanceId==='card-40-0','swap incoming known DLC40');
  }
  if(plan==='end-orbit-known-credit-income'){
   family('end_turn');family('orbit');submit(a=>a.target.cardInstanceId==='card-40-0','orbit pick known DLC40');submit(a=>a.actionId==='choose_target:96270e4a','native Mars sector scan');submit(a=>a.target.cardInstanceId===incomeId,'native orbit income');
  }else{
   for(let i=0;i<4;i++){family('place_data');submit(a=>a.target.target==='computer','computer data');}
   submit(a=>a.target.cardInstanceId===incomeId,'known fourth-slot income');
  }
  row.after=value();row.afterFacts=facts();row.valueDelta=row.after.total-before.total;row.rawEndpointEnvelope=c.lifecycle.save().envelope;assert(!row.rawEndpointEnvelope.session);report.plans.push(row);report.pending=null;persist();
 }
 assert(c.lifecycle.restore(original).ok);assert.deepEqual(c.lifecycle.save().envelope,original);
 }finally{c.dispose();}
}
report.status='complete';report.nativeInputs=report.plans.reduce((n,p)=>n+p.steps.length,0);report.originalRootAndRngRestored=true;report.sourceHashes=Object.fromEntries(Object.keys(require.cache).filter(p=>p.startsWith(process.cwd()+'/randomizer/')).map(p=>[p.slice(process.cwd().length+1),sha(p)]));persist();console.log(JSON.stringify(report.plans.map(p=>({technology:p.technology,plan:p.plan,inputs:p.steps.length,value:p.after.total,delta:p.valueDelta,components:p.after.components,resources:p.afterFacts.resources,income:p.afterFacts.income})),null,2));
