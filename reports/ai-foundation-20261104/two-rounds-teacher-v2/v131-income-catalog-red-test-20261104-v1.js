'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),values=require('./state-value'),demand=require('./resource-demand'),probe=require('./probe-capital'),effects=require('../cards/effects'),{createSimulationEnv}=require('../../app/simulation-env');
const read=p=>JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../..',p))),record=read('reports/research/35f648b3.28f4e95c.quick-400.json'),save=read(record.savePath),env=createSimulationEnv(),seatId='player-white';
try{const checkpoint=read(record.roundEnds[0].checkpointPath);env.loadCheckpoint({...checkpoint,config:{...checkpoint.config,agentType:'completion'}});const original=env.createCheckpoint(),before=env.observe(seatId),p=before.publicState.players.find(p=>p.playerId===seatId),card=before.selfState.hand.find(c=>c.cardId==='dlc_9.png');assert(card);assert.equal(p.credits,0);assert.equal(p.energy,0);assert.deepEqual(effects.getCardPlayCost(card),{credits:3});assert(!env.legalActions().some(a=>a.family==='play_card'&&a.target.cardInstanceId===card.id),'native wallet cannot pay DLC9 this round');
 const beforeValue=values.evaluateStateValue(before,seatId);
 for(let i=record.roundEnds[0].beforeInput-1;i<73;i++){const e=save.replaySteps[i],a=env.legalActions().find(a=>a.actionId===e.action.actionId&&a.actorId===e.actorPlayerId);assert(a);assert(env.step(a).ok);}
 const next=env.observe(seatId),n=next.publicState.players.find(p=>p.playerId===seatId);assert.equal(next.publicState.roundNumber,2);assert(env.legalActions().some(a=>a.family==='play_card'&&a.target.cardInstanceId===card.id));const nextValue=values.evaluateStateValue(next,seatId);
 assert.equal(beforeValue.components.handPotential,nextValue.components.handPotential,'an unaffordable held technology must not claim the extra current-round capability window');
 assert.equal(beforeValue.components.handPotential,2.5);
 env.loadCheckpoint(original);assert.deepEqual(env.createCheckpoint().coreState.compositionEnvelope,original.coreState.compositionEnvelope);
 const state=JSON.parse(original.coreState.committedState),native=state.players.players.find(p=>p.id===seatId),supply=before.publicState.board.techSupply;
 const quote=(resources,income=p.income,startingIncome=0)=>values.handCapital([card],p.techState,supply,1,values.DEFAULT_WEIGHTS,{resources,income,startingIncome});
 assert.equal(quote({credits:3,energy:0}),4.5);assert.equal(quote({credits:2,energy:2}),3.5,'current native exchange loss is charged');assert.equal(quote({credits:0,energy:0}),2.5);assert.equal(quote({credits:0,energy:0},{credits:0,energy:0}),0);assert.equal(quote({credits:0,energy:6}),2.5,'waiting for known income may beat expensive current exchanges');
 const held=demand.heldAndResearchCapital(state,native);assert.equal(held,beforeValue.components.handPotential+beforeValue.components.researchPotential);assert.equal(demand.planningCapital(state,native),held+beforeValue.components.probePotential);
 const hidden=structuredClone(before);hidden.publicState.board.publicCards.reverse();assert.equal(values.evaluateStateValue(hidden,seatId).components.handPotential,beforeValue.components.handPotential);assert.deepEqual(env.createCheckpoint().coreState.compositionEnvelope,original.coreState.compositionEnvelope);
 // The generalized native2-to1 funding query includes multi-credit card costs.
 let fundingControls=0;for(const weights of [values.DEFAULT_WEIGHTS,{...values.DEFAULT_WEIGHTS,credits:3,energy:1}])for(let c=0;c<=3;c++)for(let e=0;e<=3;e++)for(let C=0;C<=6;C++)for(let E=0;E<=6;E++){
  const options=[];for(let x=0;x<=c;x++)for(let y=0;y<=e+2*x;y++){const spend={credits:c-x+2*y,energy:e-y+2*x};if(spend.credits<=C&&spend.energy<=E)options.push(spend.credits*weights.credits+spend.energy*weights.energy);}
  const expected=options.length?Math.min(...options):null,actual=probe.funding({credits:C,energy:E},{credits:c,energy:e},weights);assert.equal(actual?.value??null,expected);fundingControls++;
 }
 // Both mission branches are exact recorded native inputs from the same
 // AI wallet. Landing spends the funds needed by heldDLC9; orbit keeps them.
 const opening=require('../../../tools/research-human405-round1');env.loadCheckpoint(opening.opening().checkpoint);
 for(let i=23;i<49;i++){const e=save.replaySteps[i],a=env.legalActions().find(a=>a.actionId===e.action.actionId&&a.actorId===e.actorPlayerId);assert(a);assert(env.step(a).ok);}
 const missionRoot=env.createCheckpoint(),joint={};assert.equal(values.evaluateStateValue(env.observe(seatId),seatId).components.handPotential,4.5);
 for(const row of read('reports/ai-foundation-20261104/two-rounds-teacher-v2/v129-orbit-land-native-assets-20261104-v1.json').rows){
  env.loadCheckpoint(missionRoot);for(const step of row.steps){const a=env.legalActions().find(a=>a.actionId===step.actionId);assert(a);assert(env.step(a).ok);}
  assert.deepEqual(env.createCheckpoint().coreState.compositionEnvelope,row.checkpoint);
  const value=values.evaluateStateValue(env.observe(seatId),seatId);joint[row.goal]={hand:value.components.handPotential,value:value.total};
 }
 assert.deepEqual(joint,{orbit:{hand:4.5,value:60},land:{hand:2.5,value:60}});
 env.loadCheckpoint(original);assert.deepEqual(env.createCheckpoint().coreState.compositionEnvelope,original.coreState.compositionEnvelope);
 // A valid visible-card transfer isolates income ranking: both the catalog
 // and the eventual native choice must use the same post-income funding value.
 const incomeFixture=read('adhoc/ai-decision-corpus-20261030-round1-v1/teacher-step-038-20261030-v1.json'),incomeState=JSON.parse(incomeFixture.compositionEnvelope.committedState),incomeOwner=incomeState.players.players.find(p=>p.id===seatId);
 assert(incomeOwner.mainActionCompleted);const publicIndex=incomeState.cards.publicCards.findIndex(c=>c?.cardId==='b_2.webp');assert(publicIndex>=0);incomeOwner.hand.push(incomeState.cards.publicCards[publicIndex]);incomeState.cards.publicCards[publicIndex]=null;incomeOwner.resources.handSize=incomeOwner.hand.length;
 const incomeRank=incomeOwner.hand.map(card=>({card,value:demand.incomeCardValue(incomeState,seatId,card)})).sort((a,b)=>b.value-a.value||(a.card.id<b.card.id?-1:1));
 assert.equal(incomeRank[0].card.cardId,'b_48.webp','energy income improves the preservedDLC9 payment window');
 const incomeGoal=demand.catalog({state:incomeState,seatId,requirements:{bluePlacements:[]}}).find(g=>g.kind==='income');assert(incomeGoal);assert.equal(incomeGoal.incomeCardId,incomeRank[0].card.id,'income catalog must choose the same funded marginal value as native income choice');
 console.log(JSON.stringify({heldResearchFundingTiming:true,oldRound1NativeCannotPay:true,nextRoundNativeCanPay:true,unfundedCurrentValue:beforeValue.components.handPotential,nextRoundValue:nextValue.components.handPotential,fundingControls,jointNativeMissionFunds:joint,rootAndRngUnchanged:true}));
}finally{env.dispose();}
