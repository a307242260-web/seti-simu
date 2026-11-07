(function(root,factory){
 'use strict';const common=typeof module==='object'&&module.exports;
 const api=factory(common?require('../cards/effects'):root.SetiCardEffects,common?require('../aliens/amiba'):root.SetiAlienAmiba,
  common?require('../players'):root.SetiPlayers,common?require('../tech/catalog'):root.SetiTechCatalog,common?require('./value-arithmetic'):root.SetiValueArithmetic);
 if(common)module.exports=api;else root.SetiResearchTriggerCapital=api;
})(typeof globalThis!=='undefined'?globalThis:window,function(effects,amiba,players,tech,arithmetic){
 'use strict';
 const readOnlyRewards=Object.freeze({readOnlyRewards:true});
 const decline=reason=>({available:false,reason}),models=new WeakMap(),gainTotals=new Map();
 function researchRules(model){
  if(models.has(model))return models.get(model);
  const rules=(model.triggers||[]).filter(t=>t.event?.type==='researchTech'||t.event?.types?.includes('researchTech')).map(t=>({
   id:t.id,type:t.event.techType,region:t.effect?.options?.region,
   supported:t.event.type==='researchTech'&&Object.keys(t.event).every(k=>['type','techType'].includes(k))
    &&tech.TECH_TYPES.includes(t.event.techType)&&t.effect?.type==='amiba_choose_symbol_reward'
    &&Object.keys(t.effect.options||{}).every(k=>['region','repeat'].includes(k))&&(t.effect.options?.repeat??1)===1
    &&Object.hasOwn(amiba.REGION_SYMBOL_SLOTS,t.effect.options?.region),
  }));
  if(Object.isFrozen(model))models.set(model,rules);return rules;
 }
 const activeCardRules=new WeakMap(),symbolScoreCeilings=new WeakMap();
 function sameConsumed(ids,snapshot){
  if(ids.length!==snapshot.length)return false;
  for(let i=0;i<ids.length;i++)if(ids[i]!==snapshot[i])return false;
  return true;
 }
 function activeRules(card,model,candidates,consumed){
  const prior=activeCardRules.get(card);
  if(prior?.model===model&&sameConsumed(consumed,prior.consumed))return prior;
  const active=candidates.filter(rule=>!consumed.includes(rule.id));
  const remaining=(model.triggers||[]).filter(t=>!consumed.includes(t.id));
  const group=model.cardType===1&&!model.tasks?.length&&!model.temporaryTasks?.length&&remaining.length
   &&remaining.every(t=>candidates.some(r=>r.id===t.id&&r.supported))?remaining.map(t=>t.id):null;
  const result={model,active,group,unsupported:active.some(rule=>!rule.supported)};
  if(Object.isFrozen(model)&&Object.isFrozen(model.triggers)&&model.triggers.every(Object.isFrozen)
    &&Object.isFrozen(model.tasks)&&Object.isFrozen(model.temporaryTasks)&&consumed.every(id=>typeof id==='string'))activeCardRules.set(card,{...result,consumed:[...consumed]});
  return result;
 }
 function symbolScoreCeiling(layout){
  if(symbolScoreCeilings.has(layout))return symbolScoreCeilings.get(layout);
  const result=Math.max(0,...Object.keys(layout).map(id=>amiba.getSymbolReward(id,readOnlyRewards).gain?.score||0));
  // This query reads only own enumerable keys, never the entries' values.
  if(layout&&typeof layout==='object'&&Object.isFrozen(layout))symbolScoreCeilings.set(layout,result);return result;
 }
 function describe(facts,funding,publicity=funding?.resources?.publicity){
  const rules=[],completionGroups=[];
  for(const card of facts.reservedCards||[]){
   const model=effects.getCardModel(card);if(!model) return decline('unknown-reserved-model');
   const candidates=researchRules(model);if(!candidates.length)continue;
   const state=card.cardEffectState;
   if(state?.modelCardId!==card.cardId||!Array.isArray(state?.consumedTriggerIds))return decline('missing-trigger-consumption');
   const prepared=activeRules(card,model,candidates,state.consumedTriggerIds);
   if(prepared.unsupported)return decline('unsupported-research-trigger');
   for(const rule of prepared.active)rules.push({cardInstanceId:card.id,ruleId:rule.id,techType:rule.type,region:rule.region});
   if(prepared.group)completionGroups.push({cardInstanceId:card.id,ruleIds:[...prepared.group]});
  }
  if(!rules.length)return decline('no-active-research-trigger');
  if(!Array.isArray(facts.pendingCardTriggers))return decline('missing-pending-trigger-facts');
  if(facts.pendingCardTriggers.length||facts.pendingNativeEffects)return decline('pending-native-trigger');
  if(new Set(rules.map(r=>r.techType)).size!==rules.length)return decline('multiple-rules-per-color');
  if(!facts.researchSymbols?.revealInitialized)return decline('no-public-symbol-layout');
  // Mission investment wallets contain balances, not already-booked score.
  // Use a zero-origin score ledger: only future trigger deltas are priced.
  const wallet={score:0,publicity,availableData:funding.resources.availableData};
  if(Object.values(wallet).some(v=>!Number.isFinite(v)))throw TypeError('RESEARCH_TRIGGER_WALLET_INVALID');
  const maximumSingleScoreGain=symbolScoreCeiling(facts.researchSymbols.symbolsById);
  const maximumScoreGain=Math.min(2,rules.length)*maximumSingleScoreGain;
  return {available:true,rules,completionGroups,maximumScoreGain,maximumSingleScoreGain,symbols:facts.researchSymbols,wallet,reason:'known-once-only-research-symbols'};
 }
 const noOutcome=Object.freeze({value:0,dataGain:0});
 const noDevelopment=Object.freeze({scoreGain:0,completedTaskGain:0}),noTotal=Object.freeze({value:0,outcome:noOutcome,development:noDevelopment});
 const noGain=()=>0;Object.defineProperty(noGain,'outcome',{value:()=>noOutcome});Object.defineProperty(noGain,'development',{value:()=>noDevelopment});Object.freeze(noGain);
 const noPreparedGain=Object.freeze(()=>noGain);
 // Sibling held/paid quotes use one read-only context within the same
 // synchronous portfolio calculation. Only their publicity payment differs.
 function prepareGains(context,weights){
  if(!context?.available)return noPreparedGain;
  const signature=JSON.stringify([context,weights]);
  return Object.freeze((paidPublicity=0,paymentAfterFirst=false)=>createGains(context,weights,paidPublicity,paymentAfterFirst,
   signature.slice(0,-1)+','+JSON.stringify(paidPublicity)+','+JSON.stringify(paymentAfterFirst)+']'));
 }
 function gains(context,weights,paidPublicity=0,paymentAfterFirst=false){
  if(!context?.available)return noGain;
  return createGains(context,weights,paidPublicity,paymentAfterFirst,JSON.stringify([context,weights,paidPublicity,paymentAfterFirst]));
 }
 function createGains(context,weights,paidPublicity,paymentAfterFirst,signature){
  // Only complete pure trigger inputs share numeric reward ledgers, never native nodes.
  let totals=gainTotals.get(signature);
  if(!totals){
   if(gainTotals.size>=64)gainTotals.delete(gainTotals.keys().next().value);
   totals=new Map();gainTotals.set(signature,totals);
  }
  function apply(wallet,reward){
   const before={...wallet};players.gainResources({resources:wallet},reward.gain||{});
   if(reward.dataCount)players.gainResources({resources:wallet},{availableData:reward.dataCount});
   return arithmetic.sum([wallet.score-before.score,(wallet.publicity-before.publicity)*weights.publicity,
    (wallet.availableData-before.availableData)*weights.availableData,(reward.drawCards||0)*weights.handSize],weights);
  }
  function total(types){
   const key=types.join(':');if(totals.has(key))return totals.get(key);
   if(!context.rules.some(rule=>types.includes(rule.techType))){totals.set(key,noTotal);return noTotal;}
   const alien={amiba:amiba.copyPublicSymbolState(context.symbols)},wallet={...context.wallet,publicity:Math.max(0,context.wallet.publicity-(paymentAfterFirst?0:paidPublicity))},used=new Set(),consumed=new Set();let value=0;
   for(let index=0;index<types.length;index++){
    if(index===1&&paymentAfterFirst)wallet.publicity=Math.max(0,wallet.publicity-paidPublicity);
    for(const rule of context.rules.filter(r=>r.techType===types[index])){
    const id=rule.cardInstanceId+':'+rule.ruleId;if(used.has(id))continue;used.add(id);
    const choices=amiba.listSymbolsInRegion(alien,rule.region,readOnlyRewards).map(entry=>({entry,value:apply({...wallet},entry.reward)}))
     .sort((a,b)=>b.value-a.value||a.entry.slotId.localeCompare(b.entry.slotId));
    if(!choices.length)continue;
    const resolved=amiba.resolveSymbolAtSlot(alien,choices[0].entry.slotId,readOnlyRewards);if(!resolved.ok)throw Error('RESEARCH_TRIGGER_SYMBOL_QUERY_FAILED');
    value=arithmetic.sum([value,apply(wallet,resolved.reward)],weights);consumed.add(id);
   }
   }
   const outcome=Object.freeze({value,dataGain:wallet.availableData-context.wallet.availableData}),development=Object.freeze({scoreGain:wallet.score-context.wallet.score,
    completedTaskGain:(context.completionGroups||[]).filter(g=>g.ruleIds.every(id=>consumed.has(g.cardInstanceId+':'+id))).length});
   const result=Object.freeze({value,outcome,development});totals.set(key,result);return result;
  }
  const gain=(id,prior=null)=>{
   const type=tech.getTechType(id),previous=prior?tech.getTechType(prior):null;
   // Both dependent ledgers already exist after the first quote. Only the
   // immutable default arithmetic can reuse their normalized difference.
   const key=weights===arithmetic.DEFAULT_WEIGHTS?(prior?'gain2:'+previous+':'+type:'gain1:'+type):null;
   if(key!==null&&totals.has(key))return totals.get(key);
   const before=prior?[previous]:[],value=arithmetic.sum([total([...before,type]).value,-total(before).value],weights);
   if(key!==null)totals.set(key,value);return value;
  };
  Object.defineProperty(gain,'outcome',{value:ids=>total(ids.map(tech.getTechType)).outcome});
  Object.defineProperty(gain,'development',{value:ids=>total(ids.map(tech.getTechType)).development});return Object.freeze(gain);
 }
 return Object.freeze({describe,gains,prepareGains});
});
