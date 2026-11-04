'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition'),{createSeededRandom}=require('../randomizer/game/random'),{buildRuleObservation}=require('../randomizer/app/rule-observation');
const values=require('../randomizer/game/ai/state-value'),probe=require('../randomizer/game/ai/probe-capital'),rules=require('../randomizer/game/rule-composition'),model=require('./prototype-public-income-option-20261105-v1');
const folder='reports/ai-foundation-20261104/two-rounds-teacher-v2/',source=folder+'v165-public-refill-funding-native-20261105-v2.json',read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'),control=read(source),first=control.plans[0],rootState=JSON.parse(first.rootEnvelope.committedState),seed=rootState.meta.seed,seatId='player-white';
const out=folder+'public-income-option-native-20261105-v1.json';assert(!fs.existsSync(out));
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(first.rootEnvelope).ok);const original=c.lifecycle.save().envelope,rootObservation=c.projection({role:'player',playerId:seatId}).state;
const report={status:'running',source,sourceSha256:sha(source),sourceCommit:'09989ac099a824c3d4b54099072658e670b943b1',prototype:'adhoc/prototype-public-income-option-20261105-v1.js',prototypeSha256:sha('adhoc/prototype-public-income-option-20261105-v1.js'),scope:'Five finite named native continuations and their visible/masked valuation controls; no autonomous experiment and no hidden identity reaches the quote.',limits:{nativeInputsPerPlan:32,totalNativeInputs:160},nativeInputs:0,rows:[],goalStatus:'active',goalAchieved:false};
const persist=()=>fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
const observation=()=>c.projection({role:'player',playerId:seatId}).state;
function facts(o){const p=o.publicState.players.find(p=>p.playerId===seatId);return{...probe.factsFromObservation(o,seatId),companyState:o.selfState.companyState,supply:o.publicState.board.techSupply,researchCost:p.researchPublicityCost,reservedCards:o.selfState.reservedCards};}
function quote(o){const input=facts(o),before=JSON.stringify(input),q=model.quote(input);assert.equal(JSON.stringify(input),before);return{old:values.evaluateStateValue(o,seatId).total,augmented:values.evaluateStateValue(o,seatId).total+q.value,quote:q};}
function submit(a){assert(report.nativeInputs<160);const d=c.inspect().session?.decision,legal=d?.choices||c.inputPort.enumerateActions({}),native=legal.find(n=>n.actionId===a.actionId);assert(native);const r=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:native}):native.phase==='quick'?c.inputPort.submitQuickAction(native):c.inputPort.submitAction(native);assert(r.ok,JSON.stringify(r));report.nativeInputs++;}
try{
 for(const plan of control.plans){
  assert(c.lifecycle.restore(plan.rootEnvelope).ok);assert.deepEqual(observation(),rootObservation);const row={incomeCode:plan.incomeCode,useSwap:plan.useSwap,nativeInputs:0,stablePrefixes:[]};report.pending=row;persist();
  for(let i=0;i<plan.steps.length;i++){
   submit(plan.steps[i]);row.nativeInputs++;assert(row.nativeInputs<=32);
   if(!c.inspect().session?.decision){const known=observation(),masked=rules.sanitizeHiddenInformationObservation(rootObservation,known,{code:'hidden_card_reveal'});const at={inputs:i+1,known:quote(known),masked:quote(masked)};row.stablePrefixes.push(at);if(i===4)row.afterOrbit=at;}
   persist();
  }
  assert.deepEqual(c.lifecycle.save().envelope,plan.endpointEnvelope);row.final=quote(observation());assert.equal(row.final.old,row.final.augmented,'no spent income or data is reused');assert.equal(row.final.old,plan.after.total);assert(row.afterOrbit);
  assert.equal(row.afterOrbit.known.augmented,plan.incomeCode===0?65.5:64.5);assert(Math.abs(row.afterOrbit.masked.augmented-(64.5+62/182))<1e-12);
  report.rows.push(row);report.pending=null;persist();
 }
 const q=report.rows[0].afterOrbit.known.quote,masked=report.rows[0].afterOrbit.masked.quote;
 report.expectedMaskedValue=report.rows.filter(r=>!r.useSwap).reduce((n,r)=>n+(r.incomeCode===0?65.5:64.5)*[62,62,58][r.incomeCode]/182,0);assert(Math.abs(report.expectedMaskedValue-report.rows[0].afterOrbit.masked.augmented)<1e-12);
 // These eligibility controls read only existing visible fields. They do not
 // expose hidden draw-pile length, identities or order to the forecast.
 const raw=read(folder+'v158-known-income-timing-native-20261104-v1.json').plans.find(p=>p.technology==='blue2'&&p.plan==='end-orbit-known-credit-income').rawEndpointEnvelope;assert(c.lifecycle.restore(raw).ok);const o=observation(),f=facts(o),base=model.quote(f);
 const used=model.quote({...f,companyState:{...f.companyState,roundMarkRound:f.round}});assert.equal(used.knownSwapCapital,used.baseline);assert.equal(used.classes.length,0);assert(base.expectedDataCapital>used.expectedDataCapital);
 const other=model.quote({...f,companyState:{...f.companyState,abilityId:'turing_borrow_tech'}});assert.equal(other.knownSwapCapital,other.baseline);
 const missing=model.quote({...f,companyState:undefined});assert.equal(missing.knownSwapCapital,missing.baseline);
 const empty=model.quote({...f,board:{...f.board,publicCards:f.board.publicCards.map(c=>c?.id==='card-41-0'?null:c)}});assert.equal(empty.classes.length,0);assert.equal(empty.knownSwapCapital,empty.baseline);
 const hidden=model.quote({...f,board:{...f.board,publicCards:f.board.publicCards.map(c=>c?.id==='card-41-0'?{hidden:true,faceUp:false}:c)}});assert(hidden.classes.length===3);assert(Math.abs(hidden.expectedDataCapital-masked.expectedDataCapital)<1e-12);
 assert(c.lifecycle.restore(original).ok);assert.deepEqual(c.lifecycle.save().envelope,original);report.originalRootAndRngRestored=true;report.eligibilityControls={usedAbility:true,otherAbility:true,missingCompany:true,emptyVersusConfirmedHiddenSlot:true};report.counts=model.counts;report.status='complete';report.sourceHashes=Object.fromEntries(Object.keys(require.cache).filter(p=>p.startsWith(process.cwd()+'/randomizer/')).map(p=>[p.slice(process.cwd().length+1),sha(p)]));persist();console.log(JSON.stringify({status:report.status,nativeInputs:report.nativeInputs,maskedValue:report.expectedMaskedValue,knownCreditValue:report.rows[0].afterOrbit.known.augmented,knownEnergyValue:report.rows.find(r=>r.incomeCode===1).afterOrbit.known.augmented,originalRootAndRngRestored:true}));
}catch(error){report.status='failed';report.error=error.stack;persist();throw error;}finally{c.dispose();}
