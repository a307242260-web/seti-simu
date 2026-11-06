'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation'),demand=require('../randomizer/game/ai/resource-demand'),cards=require('../randomizer/game/cards/deck'),effects=require('../randomizer/game/cards/effects');
const F='reports/ai-foundation-20261106/dlc20-alien-legality-v1/',source='reports/ai-foundation-20261105/third-round-teacher-v1/v263-standard-r3-native-verification-prefix-20261106-v1.checkpoint.json',read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),record=read('reports/research/20fa9816.7a747f86.quick-400.json'),label=process.argv[2];assert(['dlc20-legality','electric-income'].includes(label));
const cp=read(source),root=cp.prefixes[label==='dlc20-legality'?'178':'176'],seed=record.seed,path=F+label+'-native-control-20261106-v1.json',r=fs.existsSync(path)?read(path):{scope:'Fixed named Native control only. No AI search or autonomous game; accepted-input checkpoint resumes without rerunning prefix. Unknown identities do not select an action.',source,sourceSha256:sha(source),label,productionSourceHashes:Object.fromEntries(['randomizer/game/cards/play-domain.js','randomizer/game/ai/resource-demand.js'].map(n=>[n,sha(n)])),steps:[],envelope:root,newAutonomousRuns:0,status:'running'};assert.equal(r.sourceSha256,sha(source));for(const[n,h]of Object.entries(r.productionSourceHashes))assert.equal(sha(n),h,n);
if(r.status==='complete'){console.log(JSON.stringify({reused:true,label,status:r.status,inputs:r.steps.length}));process.exit(0);}
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(r.envelope).ok);let index=0,newInputs=0;const started=performance.now();
const state=()=>{const e=c.lifecycle.save().envelope;return e.session?.session?.workingState||JSON.parse(e.committedState);},owner=()=>state().players.players.find(p=>p.id==='player-white'),actions=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({}),assets=()=>{const p=owner();return{resources:p.resources,income:p.income,hand:p.hand,technology:p.techState,computer:p.dataState};};
function save(){r.envelope=c.lifecycle.save().envelope;r.endpoint=assets();r.nextMenu=actions();r.lastExecutionMilliseconds=performance.now()-started;fs.writeFileSync(path,JSON.stringify(r)+'\n');}
function step(name,predicate){const i=index++;if(i<r.steps.length){assert.equal(r.steps[i].name,name);return;}assert(r.steps.length<40,'fixed Native control40-input global limit');const a=actions().find(predicate);if(!a){r.status='stopped-at-unexpected-menu';r.pending=name;save();throw Error('No fixed named Native action: '+name);}const d=c.inspect().session?.decision,res=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(res.ok,JSON.stringify(res));r.steps.push({name,action:a});newInputs++;r.status='running';delete r.pending;save();}
try{
 if(!r.before)r.before=assets();
 if(label==='dlc20-legality'){
  step('play-known-dlc20',a=>a.family==='play_card'&&a.target.cardInstanceId==='card-62-0');
  if(r.steps.length===1){const d=c.inspect().session.decision;assert.deepEqual(d.choices.map(a=>a.target.cardInstanceId),['card-60-0']);const before=c.lifecycle.save().envelope,old=read(record.savePath).replaySteps[178].action,res=c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:old});assert.equal(res.ok,false);assert.deepEqual(c.lifecycle.save().envelope,before);r.historicalAlienChoiceRejected={code:res.code,stateSessionRngUnchanged:true};save();}
  step('discard-only-legal-known-dlc25',a=>a.family==='choose_card'&&a.target.cardInstanceId==='card-60-0');
  assert.equal(owner().resources.score,77);assert.deepEqual(owner().hand.map(c=>c.cardId),['chong_7.webp']);r.status='complete';
 }else{
  if(!r.incomeQuotes){const s=state(),p=owner();r.incomeQuotes=p.hand.map(card=>({cardId:card.cardId,id:card.id,income:cards.getIncomeGainForCard(card),price:effects.getCardPrice(card),greedyValue:demand.incomeCardValue(s,p.id,card)}));}
  step('select-known-dlc25-energy-income',a=>a.family==='choose_card'&&a.target.choiceId==='income:card-60-0');
  step('end-completed-scan-turn',a=>a.family==='end_turn');
  step('trade-two-known-cards-for-energy',a=>a.family==='quick_trade'&&a.target.tradeId==='cards-for-energy');
  step('pay-known-chong7',a=>a.family==='choose_payment'&&a.target.cardInstanceId==='alien-chong-7-5'&&a.target.select);
  step('pay-known-chong2',a=>a.family==='choose_payment'&&a.target.cardInstanceId==='alien-chong-2-6'&&a.target.select);
  step('confirm-two-known-card-payment',a=>a.family==='choose_payment'&&a.target.confirm);
  step('standard-scan-funded-by-electric-income',a=>a.family==='scan');
  step('scan-known-sector4b',a=>a.family==='choose_target'&&a.target.nebulaId==='sector-4-b');
  step('public-b14-scan-known-sector1a',a=>a.family==='choose_card'&&a.target.cardInstanceId==='card-50-0'&&a.target.nebulaId==='sector-1-a');
  step('fill-computer5-open',a=>a.family==='place_data');
  step('fill-computer5-select',a=>a.family==='choose_target'&&a.target.target==='computer');
  step('fill-computer6-open',a=>a.family==='place_data');
  step('fill-computer6-select',a=>a.family==='choose_target'&&a.target.target==='computer');
  step('end-funded-scan-turn',a=>a.family==='end_turn');
  step('known-free-analysis',a=>a.family==='analyze');
  step('known-amiba-blue4-preinvestment',a=>a.family==='choose_target'&&a.target.choiceId==='trace:1:blue:amiba:4');
  step('take-already-public-amiba9',a=>a.family==='choose_card'&&a.target.choiceId==='amiba:display:9');
  step('end-analysis-turn',a=>a.family==='end_turn');
  r.status='complete';
 }
 save();console.log(JSON.stringify({path,label,status:r.status,acceptedInputs:r.steps.length,newInputs,resources:r.endpoint.resources,income:r.endpoint.income,incomeQuotes:r.incomeQuotes,nextMenu:r.nextMenu.map(a=>({family:a.family,target:a.target,payload:a.payload,summary:a.summary}))}));
}finally{assert(c.lifecycle.restore(root).ok);assert.deepEqual(c.lifecycle.save().envelope,root);r.rootAndRngRestored=true;fs.writeFileSync(path,JSON.stringify(r)+'\n');c.dispose();}
