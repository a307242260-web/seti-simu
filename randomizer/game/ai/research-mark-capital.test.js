'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const values=require('./state-value'),probe=require('./probe-capital'),demand=require('./resource-demand'),end=require('../end-game-scoring');
const {createSimulationRuleComposition}=require('../../training/simulation-rule-composition'),{createSeededRandom}=require('../random'),{buildRuleObservation}=require('../../app/rule-observation');
const read=p=>JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../..',p)));
const cp=read('reports/ai-foundation-20261105/third-round-teacher-v1/teacher-before-input-127-20261105-v1.checkpoint.json'),envelope=cp.coreState.compositionEnvelope,state=JSON.parse(envelope.committedState),seatId='player-white',p=state.players.players.find(p=>p.id===seatId),seed=state.meta.seed;
const mark=state.finalScoring.tiles.d.marks.find(m=>m.playerId===seatId),formulaId=end.getFormulaId('d',state.finalScoring.tileVariants.d);
assert(mark);assert.equal(formulaId,'d2');
const funding={resources:p.resources,income:p.income,startingIncome:0,researchMarks:[{formulaId,multiplier:end.getSlotMultiplier(formulaId,mark.slotIndex)}]};
const params={hand:[],techState:p.techState,supply:{stacks:{purple2:state.tech.stacks.purple2}},round:3,publicity:p.resources.publicity,researchCost:6,funding};
assert.equal(values.researchCapital(params),6.5,'the funded fourth technology includes D2 gain7, native score2 and net5 publicity spent after the public1 publicity reward');
const k=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});k.newGame({seed});const c=k.composition;
function apply(id){const d=c.inspect().session?.decision,a=(d?.choices||c.inputPort.enumerateActions({})).find(a=>a.actionId===id);assert(a,id);const result=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):c.inputPort.submitAction(a);assert(result.ok);}
try{
 assert(c.lifecycle.restore(envelope).ok);const original=c.lifecycle.save().envelope,before=c.projection({role:'player',playerId:seatId}).state,teacher=read('seti-saves/seti-save-537-merged.json');
 for(const i of [126,127])apply(teacher.replaySteps[i].action.actionId);
 const after=c.projection({role:'player',playerId:seatId}).state,own=o=>o.publicState.players.find(p=>p.playerId===seatId),b=own(before),a=own(after);
 const secured=(a.finalScore-a.score)-(b.finalScore-b.score);assert.equal(secured,7);assert.equal(a.score-b.score,2);assert.equal(a.publicity-b.publicity,-5);
 assert.equal(secured+a.score-b.score+(a.publicity-b.publicity)*values.DEFAULT_WEIGHTS.publicity,values.researchCapital(params));
 assert.equal(values.researchCapital({...params,publicity:5}),0);assert.equal(values.researchCapital({...params,round:4}),0);assert.equal(values.researchCapital({...params,passed:true}),0);
 const bare={...funding,researchMarks:[]};assert.equal(values.researchCapital({...params,funding:bare}),0,'an unclaimed marker is not forecast');
 const noFirst={...params,supply:{stacks:{purple2:{...params.supply.stacks.purple2,firstTakeClaimedBy:'other',bonusHidden:true}}}};
 assert.equal(values.researchCapital(noFirst),4,'only the existing final mark gain remains after the native research fee');
 const freeWeights={...values.DEFAULT_WEIGHTS,credits:0,energy:0,publicity:0,handSize:0,availableData:0,additionalPublicScan:0};
 const held=p.hand.find(c=>c.cardId==='b_101.webp');assert(held);
 const shared={...params,hand:[held],supply:{stacks:{purple2:state.tech.stacks.purple2,orange2:state.tech.stacks.orange2}}};
 const portfolio=(input,w=freeWeights)=>values.sumValueParts([values.handCapital(input.hand,input.techState,input.supply,input.round,w,input.funding),values.researchCapital(input,w)],w);
 assert.equal(portfolio(shared)-portfolio({...shared,funding:bare}),7,'two technologies from3 to5 grow D2 once, not twice');
 const four={...p.techState,ownedTiles:{...p.techState.ownedTiles,orange1:true}};
 assert.equal(portfolio({...shared,techState:four})-portfolio({...shared,techState:four,funding:bare}),7,'from4 to6, only the second technology crosses D2');
 const d1={...funding,researchMarks:[{formulaId:'d1',multiplier:11}]};
 const d1Tech={...p.techState,ownedTiles:{...p.techState.ownedTiles,purple4:false}};
 assert.equal(portfolio({...shared,techState:d1Tech,funding:d1})-portfolio({...shared,techState:d1Tech,funding:bare}),11,'purple plus orange reaches the missing-color minimum only as a joint purpose');
 const unfunded={...shared,publicity:0,funding:{...funding,resources:{credits:0,energy:0},income:{credits:0,energy:0}}};
 assert.equal(portfolio(unfunded,values.DEFAULT_WEIGHTS),0,'unfunded research cannot carry a future marker reward');
 const facts=probe.factsFromState(state,p),actualFunding=values.researchFunding(facts,{resources:p.resources,income:p.income,startingIncome:0});
 assert.deepEqual(actualFunding.researchMarks,funding.researchMarks);
 const viewFunding=values.researchFunding(probe.factsFromObservation(before,seatId),{resources:b,income:b.income,startingIncome:0});
 assert.deepEqual(viewFunding.researchMarks,funding.researchMarks);
 const other=structuredClone(state);other.finalScoring.tiles.d.marks[0].playerId='other';
 assert.equal(values.researchFunding(probe.factsFromState(other,p),bare).researchMarks.length,0);
 const changing=structuredClone(facts),mutableFunding={resources:p.resources,income:p.income,startingIncome:0};
 assert.equal(values.researchFunding(changing,mutableFunding).researchMarks[0].multiplier,7);changing.board.finalScoring.tileVariants.d=1;
 assert.equal(values.researchFunding(changing,mutableFunding).researchMarks[0].formulaId,'d1','mutable native previews cannot reuse a stale mark quote');
 const mutableTech=structuredClone(p.techState),mutableMarks=structuredClone(funding.researchMarks),mutableParams={...params,techState:mutableTech,funding:{...funding,researchMarks:mutableMarks}};
 assert.equal(values.researchCapital(mutableParams),6.5);mutableTech.ownedTiles.orange1=true;assert.equal(values.researchCapital(mutableParams),0,'same mutable technology object must invalidate the raw D2 delta');delete mutableTech.ownedTiles.orange1;mutableMarks[0].multiplier=5;assert.equal(values.researchCapital(mutableParams),4.5,'same mutable mark object with a changed slot multiplier must use its new complete scalar key');mutableMarks[0].multiplier=7;assert.equal(values.researchCapital(mutableParams),6.5,'restoring the full original scalar inputs recovers their exact formal gain');
 const full=values.evaluateStateValue(before,seatId),purpose=values.sumValueParts(['handPotential','researchPotential','probePotential','analysisPotential','researchIncomePotential','dataPotential','finalMarkPotential'].map(k=>full.components[k]));
 assert.equal(demand.planningCapital(state,p),purpose,'native preparation and observation must use the same final-marker facts');
 // Current-funded research can earn a new mark; use preserved native endpoints,
 // not the historical score or a fabricated observation.
 const actual=read('reports/ai-foundation-20261105/third-round-teacher-v1/v204-actual-safety-choice-native-20261106-v1.json'),follow=read('reports/ai-foundation-20261105/third-round-teacher-v1/v204-safety-research-followup-prefix-20261106-v1.checkpoint.json');
 assert(c.lifecycle.restore(actual.branches.safety.envelope).ok);const safetyObservation=c.projection({role:'player',playerId:seatId}).state,safetyState=JSON.parse(actual.branches.safety.envelope.committedState),safetyPlayer=safetyState.players.players.find(p=>p.id===seatId);
 assert.equal(values.evaluateStateValue(safetyObservation,seatId).total,109.75,'eight currently attained B points must be retained before a funded known research crosses50');
 const safetyFacts={...probe.factsFromObservation(safetyObservation,seatId),supply:safetyObservation.publicState.board.techSupply},wallet={resources:safetyFacts.player,income:safetyFacts.player.income,startingIncome:0},withNew=values.researchFunding(safetyFacts,wallet),withoutNew={...withNew,newFinalMark:null};
 assert.equal(withNew.newFinalMark.currentValue,8);assert.equal(withNew.newFinalMark.threshold,50);
 const researchCard=safetyObservation.selfState.hand.find(c=>c.cardId==='b_101.webp'),supply={stacks:{orange1:safetyState.tech.stacks.orange1,purple2:safetyState.tech.stacks.purple2}};
 const heldNew=f=>values.handCapital([researchCard],safetyPlayer.techState,supply,3,values.DEFAULT_WEIGHTS,f);
 assert.equal(heldNew(withNew)-heldNew(withoutNew),8);
 const dataWeights={...values.DEFAULT_WEIGHTS,availableData:2};
 const dataHand=f=>values.handCapital([researchCard],safetyPlayer.techState,{stacks:{orange1:safetyState.tech.stacks.orange1}},3,dataWeights,f);
 assert.equal(dataHand(withNew),dataHand(withoutNew),'the visible data symbol enabling fourth-slot income invalidates the static mark-policy floor');
 const nativeFactsOnly=end.describeNextFinalMark({...safetyState,cardEffects:require('../cards/effects')},safetyPlayer);
 assert.equal(Math.max(...nativeFactsOnly.options.map(x=>x.currentValue)),follow.finalScoring.tileScoresById.b,'forecast current mark floor matches the later native first B mark');
 const rightmost={...safetyPlayer,reservedCards:[...safetyPlayer.reservedCards,{id:'coupled-mark-card',cardId:'b_115.webp'}]};
 assert.equal(end.describeNextFinalMark({...safetyState,cardEffects:require('../cards/effects')},rightmost).valuationSafe,false,'mark-coupled Type3 scoring cannot be replaced by raw tile value');

 const joint=f=>values.sumValueParts([values.handCapital([researchCard],safetyPlayer.techState,supply,3,freeWeights,f),values.researchCapital({hand:[researchCard],techState:safetyPlayer.techState,supply,round:3,publicity:6,researchCost:6,funding:f},freeWeights)],freeWeights);
 assert.equal(joint(withNew)-joint(withoutNew),8,'held and paid research share one new mark');
 // Direct quote counterexample: paying6energy now versus3 future credits must
 // keep each funding window coupled to its own mark eligibility.
 const oneTarget={stacks:{orange1:safetyState.tech.stacks.orange1}},futureFunding={...withNew,resources:{...withNew.resources,credits:0,energy:6},income:{...withNew.income,credits:3}},futureBare={...futureFunding,newFinalMark:null};
 const futureHand=f=>values.handCapital([researchCard],safetyPlayer.techState,oneTarget,2,values.DEFAULT_WEIGHTS,f);
 assert.equal(futureHand(futureFunding)-futureHand(futureBare),5,'current mark8 pays the real3 extra exchange loss, not future3credit cost plus current mark8');
 const sharedWindows=f=>values.sumValueParts([values.handCapital([researchCard],safetyPlayer.techState,supply,2,values.DEFAULT_WEIGHTS,f),values.researchCapital({hand:[researchCard],techState:safetyPlayer.techState,supply,round:2,publicity:6,researchCost:6,funding:f})]);
 assert.equal(sharedWindows(futureFunding)-sharedWindows(futureBare),8,'after a paid first crossing, held research can keep its cheaper future window and must not charge a second mark');
 const laterOnly={...futureFunding,resources:{...futureFunding.resources,energy:0}};
 assert.equal(futureHand(laterOnly),futureHand({...laterOnly,newFinalMark:null}),'future income cannot earn a current uncontested mark');
 const unclaimedBefore=structuredClone(safetyState),endInputs={...unclaimedBefore,cardEffects:require('../cards/effects'),getCardTypeCode:c=>c.cardTypeCode};
 assert.deepEqual(end.describeNextFinalMark(endInputs,safetyPlayer),safetyObservation.selfState.nextFinalMark);assert.deepEqual(unclaimedBefore,safetyState,'describing mark options cannot allocate marks or mutate rules');

 const partialWallet={...wallet,resources:{credits:9,energy:1,publicity:4,availableData:0}};assert.equal(values.researchFunding(safetyFacts,partialWallet).newFinalMark,null,'balances without a score ledger cannot forecast a new mark');
 assert.equal(values.researchFunding({...safetyFacts,uncontestedRound:false},wallet).newFinalMark,null);
 const contestedState=structuredClone(safetyState);contestedState.turn.passedPlayerIds=[];const contestedPlayer=contestedState.players.players.find(p=>p.id===seatId),contestedContext={...contestedState,cardEffects:require('../cards/effects')};
 const contestedObservation=buildRuleObservation(contestedState,seed,seatId);assert.deepEqual(contestedObservation.selfState.nextFinalMark,end.describeNextFinalMark(contestedContext,contestedPlayer),'native metrics must remain available for future known-purpose score gains even while below threshold');
 const projectedFacts=probe.factsFromObservation(contestedObservation,seatId);projectedFacts.player={...projectedFacts.player,score:50};assert.equal(probe.pendingFinalMarkCapital(projectedFacts),8,'a pure known score ledger can cross the original native threshold without a fabricated successor observation');
 const noScoreLedger={...projectedFacts,player:{...projectedFacts.player}};delete noScoreLedger.player.score;assert.equal(probe.pendingFinalMarkCapital(noScoreLedger),0,'a balances-only wallet cannot create an earned mark');
 assert.equal(values.researchFunding({...safetyFacts,pendingNativeEffects:true},wallet).newFinalMark,null);
 const nativeFunding=values.researchFunding({...probe.factsFromState(safetyState,safetyPlayer),supply:safetyState.tech},{resources:safetyPlayer.resources,income:safetyPlayer.income,startingIncome:0});assert.deepEqual(nativeFunding.newFinalMark,withNew.newFinalMark);
 const compact=c.projection({role:'player',playerId:seatId,valueOnly:true}).state;assert.equal(values.evaluateStateValue(compact,seatId).total,109.75);assert.deepEqual(compact.selfState.nextFinalMark,safetyObservation.selfState.nextFinalMark);
 assert.equal(demand.planningCapital(safetyState,safetyPlayer),['handPotential','researchPotential','probePotential','analysisPotential','researchIncomePotential','dataPotential','finalMarkPotential'].reduce((n,k)=>n+values.evaluateStateValue(safetyObservation,seatId).components[k],0));
 assert(c.lifecycle.restore(follow.envelope).ok);const realized=c.projection({role:'player',playerId:seatId}).state;assert.equal(values.evaluateStateValue(realized,seatId).total,112.5,'the claimed B mark and known computer/income analysis plan share the wallet, without another latent8');
 assert.equal(values.researchFunding(probe.factsFromObservation(realized,seatId),{resources:realized.publicState.players.find(p=>p.playerId===seatId),income:realized.publicState.players.find(p=>p.playerId===seatId).income,startingIncome:0}).newFinalMark,null,'70 is not attainable by one ordinary research here');
 assert(c.lifecycle.restore(original).ok);assert.deepEqual(c.lifecycle.save().envelope,original);
 console.log(JSON.stringify({nativeResearchInputs:2,claimedFinalMarkGain:secured,nativeNetValue:6.5,jointD2OddEvenAndD1:true,unfundedAndUnclaimedRejected:true,stateObservationParity:true,mutableQuoteInvalidation:true,rootAndRngUnchanged:true}));
}finally{c.dispose();}
