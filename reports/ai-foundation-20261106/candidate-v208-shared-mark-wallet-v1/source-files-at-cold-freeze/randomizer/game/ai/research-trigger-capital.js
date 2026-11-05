(function(root,factory){
 'use strict';const common=typeof module==='object'&&module.exports;
 const api=factory(common?require('../cards/effects'):root.SetiCardEffects,common?require('../aliens/amiba'):root.SetiAlienAmiba,
  common?require('../players'):root.SetiPlayers,common?require('../tech/catalog'):root.SetiTechCatalog,common?require('./value-arithmetic'):root.SetiValueArithmetic);
 if(common)module.exports=api;else root.SetiResearchTriggerCapital=api;
})(typeof globalThis!=='undefined'?globalThis:window,function(effects,amiba,players,tech,arithmetic){
 'use strict';
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
 function describe(facts,funding,publicity=funding?.resources?.publicity){
  const rules=[];
  for(const card of facts.reservedCards||[]){
   const model=effects.getCardModel(card);if(!model) return decline('unknown-reserved-model');
   const candidates=researchRules(model);if(!candidates.length)continue;
   if(card.cardEffectState?.modelCardId!==card.cardId||!Array.isArray(card.cardEffectState?.consumedTriggerIds))return decline('missing-trigger-consumption');
   for(const rule of candidates){
    if(card.cardEffectState.consumedTriggerIds.includes(rule.id))continue;
    if(!rule.supported)return decline('unsupported-research-trigger');
    rules.push({cardInstanceId:card.id,ruleId:rule.id,techType:rule.type,region:rule.region});
   }
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
  return {available:true,rules,symbols:facts.researchSymbols,wallet,reason:'known-once-only-research-symbols'};
 }
 const noOutcome=Object.freeze({value:0,dataGain:0});
 const noGain=()=>0;Object.defineProperty(noGain,'outcome',{value:()=>noOutcome});Object.freeze(noGain);
 function gains(context,weights,paidPublicity=0){
  if(!context?.available)return noGain;
  // Only complete pure trigger inputs share numeric reward ledgers, never native nodes.
  const signature=JSON.stringify([context,weights,paidPublicity]);
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
   if(!context.rules.some(rule=>types.includes(rule.techType))){totals.set(key,noOutcome);return noOutcome;}
   const alien={amiba:structuredClone(context.symbols)},wallet={...context.wallet,publicity:Math.max(0,context.wallet.publicity-paidPublicity)},used=new Set();let value=0;
   for(const type of types)for(const rule of context.rules.filter(r=>r.techType===type)){
    const id=rule.cardInstanceId+':'+rule.ruleId;if(used.has(id))continue;used.add(id);
    const choices=amiba.listSymbolsInRegion(alien,rule.region).map(entry=>({entry,value:apply({...wallet},entry.reward)}))
     .sort((a,b)=>b.value-a.value||a.entry.slotId.localeCompare(b.entry.slotId));
    if(!choices.length)continue;
    const resolved=amiba.resolveSymbolAtSlot(alien,choices[0].entry.slotId);if(!resolved.ok)throw Error('RESEARCH_TRIGGER_SYMBOL_QUERY_FAILED');
    value=arithmetic.sum([value,apply(wallet,resolved.reward)],weights);
   }
   const outcome=Object.freeze({value,dataGain:wallet.availableData-context.wallet.availableData});totals.set(key,outcome);return outcome;
  }
  const gain=(id,prior=null)=>{
   const type=tech.getTechType(id),before=prior?[tech.getTechType(prior)]:[];
   return arithmetic.sum([total([...before,type]).value,-total(before).value],weights);
  };
  Object.defineProperty(gain,'outcome',{value:ids=>total(ids.map(tech.getTechType))});return Object.freeze(gain);
 }
 return Object.freeze({describe,gains});
});
