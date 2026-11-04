'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {createSimulationRuleComposition}=require('../randomizer/training/simulation-rule-composition');
const {createSeededRandom}=require('../randomizer/game/random');
const {buildRuleObservation}=require('../randomizer/app/rule-observation');
const cards=require('../randomizer/game/cards/deck'),values=require('../randomizer/game/ai/state-value');
const folder='reports/ai-foundation-20261104/two-rounds-teacher-v2/',source=folder+'ai-v165-step039-20261105-v1.json';
const read=p=>JSON.parse(fs.readFileSync(p)),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const fixture=read(source),seatId=fixture.seatId,seed=fixture.source.seed;
const out=folder+'v165-public-refill-funding-native-20261105-v1.json';assert(!fs.existsSync(out),'retain the first observation');
const kernel=createSimulationRuleComposition({seed,random:createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,v)=>buildRuleObservation(s,seed,v?.playerId)});
kernel.newGame({seed});const c=kernel.composition;assert(c.lifecycle.restore(fixture.compositionEnvelope).ok);
const original=c.lifecycle.save().envelope,observe=()=>c.projection({role:'player',playerId:seatId}).state,rootObservation=observe();
const catalog=cards.CARD_CATALOG.filter(c=>!c.set.startsWith('alien:')),counts={};
for(const card of catalog)counts[card.income_code]=(counts[card.income_code]||0)+1;
const report={status:'running',source,sourceSha256:sha(source),sourceCommit:'9854966767cb748a69c69ca0190df378fd3eae25',scope:'Finite native controls, not autonomous search or experiment. Swap the next hidden draw with an existing same-pile card of each income class, preserving the multiset and every visible root fact. Compare one known funding continuation with an optional newly public credit/energy income swap. No unknown identity is passed to a production planner.',catalogCounts:counts,catalogCount:catalog.length,limits:{nativeInputsPerPlan:32,totalNativeInputs:160},nativeInputs:0,plans:[],goalStatus:'active',goalAchieved:false};
const persist=()=>fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
const state=()=>{const e=c.lifecycle.save().envelope;return e.session?.session?.workingState||JSON.parse(e.committedState);};
const legal=()=>c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
function submit(predicate,row){const a=legal().find(predicate);assert(a,'missing native choice; last steps '+JSON.stringify(row.steps.slice(-2)));assert(row.steps.length<32&&report.nativeInputs<160);const d=c.inspect().session?.decision;const result=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);assert(result.ok,JSON.stringify(result));row.steps.push(a);report.nativeInputs++;persist();return a;}
const family=(name,row)=>submit(a=>a.family===name,row);
try{
 for(const code of [0,1,2])for(const useSwap of code===2?[false]:[false,true]){
  const e=structuredClone(original),s=JSON.parse(e.committedState),pile=s.cards.drawPileCardIds;
  const at=pile.findIndex(id=>cards.getCatalogEntryByCardId(id)?.income_code===code);assert(at>=0);
  const replacement=pile[at];[pile[0],pile[at]]=[pile[at],pile[0]];e.committedState=JSON.stringify(s);
  assert(c.lifecycle.restore(e).ok);assert.deepEqual(observe(),rootObservation,'all public/own root information must be identical');
  const start=c.lifecycle.save().envelope,row={incomeCode:code,replacementIdentity:replacement,useSwap,rootEnvelope:start,rootVisibleInformationUnchanged:true,before:values.evaluateStateValue(observe(),seatId),steps:[]};report.pending=row;persist();
  family('orbit',row);submit(a=>a.target?.cardInstanceId==='card-40-0',row);
  submit(a=>a.target?.nebulaId==='sector-4-b',row);submit(a=>a.target?.cardInstanceId==='card-40-0',row);family('end_turn',row);
  const newlyPublic=state().cards.publicCards.find(card=>card?.cardId===replacement);assert(newlyPublic,'the replacement becomes public before any swap choice');row.newlyPublicCardId=newlyPublic.id;
  if(useSwap){submit(a=>a.family==='industry'&&a.target?.abilityId==='deepspace_swap_cards',row);submit(a=>a.target?.cardInstanceId==='card-18-0',row);submit(a=>a.target?.cardInstanceId===newlyPublic.id,row);}
  const supplier=useSwap?newlyPublic.id:'card-18-0';
  for(let n=0;n<4;n++){family('place_data',row);submit(a=>a.target?.target==='computer',row);if(n===3)submit(a=>a.target?.cardInstanceId===supplier,row);}
  family('place_data',row);submit(a=>a.target?.blueSlot===1,row);
  let p=state().players.players.find(p=>p.id===seatId);row.beforeResearchWallet={...p.resources};
  if(p.resources.credits<3)submit(a=>a.family==='quick_trade'&&a.target?.tradeId==='energy-for-credit',row);
  submit(a=>a.family==='play_card'&&a.target?.cardInstanceId==='card-15-0',row);
  submit(a=>a.target?.tileId==='purple4',row);family('end_turn',row);
  assert(legal().some(a=>a.family==='pass'));const endpoint=state();p=endpoint.players.players.find(p=>p.id===seatId);assert.equal(endpoint.turn.roundNumber,1);
  row.after=values.evaluateStateValue(observe(),seatId);row.resources=p.resources;row.income=p.income;row.technology=p.techState;row.nativeInputs=row.steps.length;row.exchangeInputs=row.steps.filter(a=>a.family==='quick_trade').length;row.endpointEnvelope=c.lifecycle.save().envelope;
  assert.equal(row.after.total,code===0&&useSwap?65.5:64.5);assert.deepEqual(Object.keys(p.techState.ownedTiles).sort(),['blue2','purple4']);
  report.plans.push(row);report.pending=null;assert(c.lifecycle.restore(start).ok);assert.deepEqual(c.lifecycle.save().envelope,start);persist();
 }
 const differences=[0,1,2].map(code=>{const rows=report.plans.filter(p=>p.incomeCode===code),base=rows.find(p=>!p.useSwap),alternative=rows.find(p=>p.useSwap);return{incomeCode:code,knownContinuationValue:base.after.total,optionalSwapValue:alternative?.after.total??null,namedContinuationImprovement:Math.max(0,(alternative?.after.total??base.after.total)-base.after.total),sampleCount:rows.length};});
 report.classControls=differences;report.catalogPriorImprovement=differences.reduce((n,r)=>n+counts[r.incomeCode]/catalog.length*r.namedContinuationImprovement,0);
 report.inference='The tested funding chain has a one-unit improvement for a newly public credit-income supplier, zero for the tested energy supplier, and retains the unchanged known chain for card income. Catalog proportions are a public prior, not the conditional remaining-deck distribution or a native guaranteed reward. This does not prove a safe scalar expectation implementation or general optimality.';
 assert(c.lifecycle.restore(original).ok);assert.deepEqual(c.lifecycle.save().envelope,original);report.originalRootAndRngRestored=true;report.sourceHashes=Object.fromEntries(Object.keys(require.cache).filter(p=>p.startsWith(process.cwd()+'/randomizer/')).map(p=>[p.slice(process.cwd().length+1),sha(p)]));report.status='complete';persist();console.log(JSON.stringify({status:report.status,plans:report.plans.length,nativeInputs:report.nativeInputs,classControls:differences,catalogPriorImprovement:report.catalogPriorImprovement,originalRootAndRngRestored:true}));
}catch(error){report.status='failed';report.error=error.stack;persist();throw error;}finally{c.dispose();}
