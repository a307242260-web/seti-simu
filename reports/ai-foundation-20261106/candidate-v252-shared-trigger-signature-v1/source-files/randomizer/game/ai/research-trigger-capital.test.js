'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation');
const values=require('./state-value'),probe=require('./probe-capital'),demand=require('./resource-demand'),contract=require('../../app/simulation-contract');
const read=p=>JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../..',p))),folder='reports/ai-foundation-20261105/third-round-teacher-v1/',cp=read(folder+'teacher-before-input-127-20261105-v1.checkpoint.json'),envelope=cp.coreState.compositionEnvelope,state=JSON.parse(envelope.committedState),seatId='player-white',seed=state.meta.seed,teacher=read('seti-saves/seti-save-537-merged.json');
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;assert(c.lifecycle.restore(envelope).ok);
const observe=()=>c.projection({role:'player',playerId:seatId}).state,own=o=>o.publicState.players.find(p=>p.playerId===seatId),native=()=>{const e=c.lifecycle.save().envelope;return e.session?.session?.workingState||JSON.parse(e.committedState);};
function apply(i){const d=c.inspect().session?.decision,a=(d?.choices||c.inputPort.enumerateActions({})).find(a=>a.actionId===teacher.replaySteps[i-1].action.actionId);assert(a,'teacher'+i);assert((d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):c.inputPort.submitAction(a)).ok);}
try{
 const original=c.lifecycle.save().envelope,before=observe();
 assert(before.selfState.reservedCards.find(c=>c.cardId==='amiba_1.webp').cardEffectState,'used research trigger state must survive the common observation');
 assert(before.publicState.board.aliens.amiba?.symbolSlots,'public symbol positions must survive the common observation after reveal');
 const trigger=require('./research-trigger-capital'),facts=o=>probe.factsFromObservation(o,seatId),fund=o=>({resources:own(o),income:own(o).income,startingIncome:0});
 const context=trigger.describe(facts(before),fund(before),own(before).publicity);assert(context.available,context.reason);
 const partial={...fund(before),resources:{credits:own(before).credits,energy:own(before).energy,publicity:own(before).publicity,availableData:own(before).availableData}};
 assert.deepEqual(trigger.describe(facts(before),partial,own(before).publicity),context,'mission investment wallet carries balances; score belongs to the separate additive ledger');
 const gains=trigger.gains(context,values.DEFAULT_WEIGHTS);assert.equal(gains('purple2'),4);assert.equal(gains('orange2'),1);assert.equal(gains('blue3'),0.5);
 assert.equal(gains('blue3','purple2'),4,'second color must see the4score symbol moved from red to blue');
 assert.equal(gains('purple3','purple2'),0,'one color rule is consumed once across both future research purposes');
 assert.equal(gains('orange2','purple2'),1);
 assert.deepEqual(gains.outcome(['purple2']),{value:4,dataGain:0});
 const dataLedger=trigger.gains(context,{...values.DEFAULT_WEIGHTS,availableData:2}).outcome(['orange2']);assert.deepEqual(dataLedger,{value:2,dataGain:1},'same public symbol ledger exposes actual clamped data, not an invented next state');
 assert(Object.isFrozen(dataLedger));assert.deepEqual(trigger.gains(context,values.DEFAULT_WEIGHTS).outcome(['orange2']),{value:1,dataGain:0},'weight-specific choice and memo key preserve the data ledger');

 const capped=structuredClone(context);capped.wallet.publicity=require('../players').RESOURCE_LIMITS.publicity;assert.equal(trigger.gains(capped,values.DEFAULT_WEIGHTS)('blue3'),0,'same symbol at the publicity cap is a distinct complete scalar input');
 assert.equal(trigger.gains(capped,values.DEFAULT_WEIGHTS,1)('blue3'),0.5,'paid publicity changes the cap before the same trigger');
 const Module=require('node:module'),filename=require.resolve('./research-trigger-capital'),loaded=new Module(filename,module);loaded.filename=filename;loaded.paths=module.paths;let serializations=0;globalThis.__setiPreparedTriggerSerializations=()=>{serializations++;};
 try{
  loaded._compile(fs.readFileSync(filename,'utf8').replace('const signature=JSON.stringify([context,weights]);','const signature=(globalThis.__setiPreparedTriggerSerializations(),JSON.stringify([context,weights]));'),filename);
  const beforeInputs=JSON.stringify([context,capped]),prepared=loaded.exports.prepareGains(context,values.DEFAULT_WEIGHTS);
  assert.equal(prepared(0)('purple2'),4);assert.equal(prepared(0)('blue3','purple2'),4);assert.equal(prepared(6)('purple2'),4);assert.equal(serializations,1,'held and paid sibling quotes serialize their complete shared inputs once');
  const caps=loaded.exports.prepareGains(capped,values.DEFAULT_WEIGHTS);assert.equal(caps(0)('blue3'),0);assert.equal(caps(1)('blue3'),0.5);assert.equal(serializations,2,'each different context is prepared separately');
  assert.equal(JSON.stringify([context,capped]),beforeInputs,'different paid reserves change only their private reward wallets');
 }finally{delete globalThis.__setiPreparedTriggerSerializations;}
 assert.equal(trigger.gains(structuredClone(context),{...values.DEFAULT_WEIGHTS,handSize:2})('orange2'),2,'unknown-card weight participates in the scalar memo key');
 assert.equal(trigger.gains(structuredClone(context),values.DEFAULT_WEIGHTS)('orange2'),1,'a later default-weight query cannot reuse the changed-weight total');
 const consumed=structuredClone(context);consumed.rules=consumed.rules.filter(r=>r.techType!=='purple');assert.equal(trigger.gains(consumed,values.DEFAULT_WEIGHTS)('blue3','purple2'),0.5,'different active rules cannot share the purple symbol movement');
 assert.equal(trigger.gains(structuredClone(context),values.DEFAULT_WEIGHTS)('blue3','purple2'),4,'the complete original inputs recover their exact total after distinct contexts');
 assert.equal(values.researchFunding(facts(before),fund(before)).researchTriggers.available,true);
 const p=state.players.players.find(p=>p.id===seatId),nativeFacts=probe.factsFromState(state,p),nativeContext=trigger.describe(nativeFacts,{resources:p.resources,income:p.income,startingIncome:0},p.resources.publicity);
 assert.deepEqual(nativeContext,context,'native preparation and the common observation must expose the same public trigger facts');
 const amiba=require('../aliens/amiba'),borrow=amiba.getPublicSymbolState(state.aliens,{readOnly:true}),snapshot=amiba.getPublicSymbolState(state.aliens),privateSymbols=amiba.copyPublicSymbolState(borrow);assert.equal(borrow.symbolSlots,state.aliens.amiba.symbolSlots);assert.notEqual(snapshot.symbolSlots,borrow.symbolSlots);assert.deepEqual(privateSymbols,snapshot);const publicBefore=JSON.stringify(state.aliens);assert(amiba.resolveSymbolAtSlot({amiba:privateSymbols},Object.keys(borrow.symbolSlots)[0]).ok);assert.equal(JSON.stringify(state.aliens),publicBefore,'private symbol-location writes cannot change borrowed native public facts');assert.deepEqual(amiba.getPublicTraceState(state.aliens,{readOnly:true}),amiba.getPublicTraceState(state.aliens));
 for(const i of [127,128])apply(i);
 const pending=observe();assert(pending.selfState.pendingNativeEffects);assert.equal(trigger.describe(facts(pending),fund(pending),own(pending).publicity).reason,'pending-native-trigger');
 const port=require('./analysis-port').createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
 try{const root=port.openRoot(),compact=port.valueObservation(root);assert(root.observation.selfState.pendingNativeEffects);assert(compact.selfState.pendingNativeEffects);assert.deepEqual(values.evaluateStateValue(compact,seatId),values.evaluateStateValue(root.observation,seatId),'full and compact native projections must keep pending-effect guards');}finally{port.close();}
 const preReward=own(pending).score;
 apply(129);const symbolPending=observe();assert.equal(trigger.describe(facts(symbolPending),fund(symbolPending),own(symbolPending).publicity).reason,'pending-native-trigger','consumed rule must not hide its still-pending symbol movement');
 apply(130);const after=observe();assert.equal(own(after).score-preReward,4);
 assert(after.selfState.reservedCards.find(c=>c.cardId==='amiba_1.webp').cardEffectState.consumedTriggerIds.includes('amiba1-purple-tech'));
 assert.equal(after.publicState.board.aliens.amiba.symbolSlots.blue_1,'symbol_3');
 const afterContext=trigger.describe(facts(after),fund(after),own(after).publicity);assert(afterContext.available,afterContext.reason);const next=trigger.gains(afterContext,values.DEFAULT_WEIGHTS);assert.equal(next('purple3'),0);assert.equal(next('blue3'),4);
 const secrets=structuredClone(state);secrets.aliens.amiba.cardDeck.reverse();secrets.aliens.amiba.initialConfiguration.symbolOrder.reverse();
 const hiddenView=buildRuleObservation(secrets,seed,seatId);assert.deepEqual(trigger.describe(facts(hiddenView),fund(hiddenView),own(hiddenView).publicity),context);
 assert(!Object.hasOwn(before.publicState.board.aliens.amiba,'cardDeck'));assert(!Object.hasOwn(before.publicState.board.aliens.amiba,'initialConfiguration'));
 const hiddenAlien=structuredClone(state.aliens);hiddenAlien.aliens['1'].revealed=false;assert(!contract.sanitizeAlienPublicState(hiddenAlien).amiba,'hidden species must not reveal its configured layout');
 const effectApi=require('../cards/effects'),frozenCard=Object.freeze({id:'readonly-trigger-card',cardId:'amiba_1.webp'}),frozenOwner=Object.freeze({id:seatId,reservedCards:Object.freeze([frozenCard])});
 const keys=effectApi.listPendingTriggerKeys(frozenOwner,{currentPlayerId:seatId,type1TriggerEvents:[{type:'researchTech',techType:'purple'}]});assert.equal(keys.length,1);assert(!Object.hasOwn(frozenCard,'cardEffectState'),'public trigger query must not initialize cards');
 const noFunds={...fund(before),resources:{...own(before),credits:0,energy:0},income:{...own(before).income,credits:0,energy:0}};
 const params={hand:before.selfState.hand,techState:own(before).techState,supply:before.publicState.board.techSupply,round:3,publicity:0,researchCost:6,funding:values.researchFunding(facts(before),noFunds,0)};
 assert.equal(values.handCapital(params.hand,params.techState,params.supply,3,values.DEFAULT_WEIGHTS,params.funding)+values.researchCapital(params),0,'future trigger cannot fund its own prerequisite');
 const bare={...fund(before),researchMarks:[]},single={hand:[],techState:p.techState,supply:{stacks:{purple2:state.tech.stacks.purple2}},round:3,publicity:p.resources.publicity,researchCost:6};
 const marked=values.researchFunding(nativeFacts,{resources:p.resources,income:p.income,startingIncome:0});
 assert.equal(values.researchCapital({...single,funding:marked}),10.5,'same paid research earns the already-owned marker growth6.5 plus one known4score trigger');
 assert.equal(values.researchCapital({...single,funding:{...marked,researchTriggers:null}}),6.5);
 const full=values.evaluateStateValue(before,seatId),capital=values.sumValueParts(['handPotential','researchPotential','probePotential','analysisPotential','researchIncomePotential','dataPotential','finalMarkPotential'].map(k=>full.components[k]));assert.equal(demand.planningCapital(state,p),capital);
 assert(c.lifecycle.restore(original).ok);const launch=c.inputPort.enumerateActions({}).find(a=>a.family==='launch');assert(launch);assert(c.inputPort.submitAction(launch).ok);
 const launched=c.lifecycle.save().envelope;assert(Number.isFinite(values.evaluateStateValue(observe(),seatId).total),'a real launch with active research triggers must support the mission wallet');assert.deepEqual(c.lifecycle.save().envelope,launched);
 assert(c.lifecycle.restore(read(folder+'teacher-before-input-136-20261105-v1.checkpoint.json').coreState.compositionEnvelope).ok);
 apply(136);apply(137);const beforeBlind=observe();apply(138);apply(139);const afterBlind=observe();assert.equal(afterBlind.selfState.hand.length-beforeBlind.selfState.hand.length,1,'ordinary blind reward is quoted as one unknown card, without reading its identity');
 assert(c.lifecycle.restore(original).ok);assert.deepEqual(c.lifecycle.save().envelope,original);
 console.log(JSON.stringify({nativePurpleReward:4,nativeBlindQuantity:1,usedRulesAndMovedSymbolsPublic:true,pendingTriggerDeclines:true,twoColorMovementAndSameColorConsumption:true,nativeObservationParity:true,noHiddenDeckOrSpeciesLeak:true,noRewardFunding:true,rootAndRngUnchanged:true}));
}finally{c.dispose();}
