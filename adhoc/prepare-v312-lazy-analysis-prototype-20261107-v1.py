from pathlib import Path
import json,hashlib
P=Path(__file__).resolve().parents[1];D=P/'reports/ai-foundation-20261107/analysis-lazy-explanations-v1';p=P/'randomizer/game/ai/amiba-analysis-capital.js';s=p.read_text();m=json.loads((P/'reports/ai-foundation-20261107/analysis-target-trace-copy-v1/source-manifest-20261107-v1.json').read_text());assert hashlib.sha256(p.read_bytes()).hexdigest()==m['sourceHashes'][str(p.relative_to(P))]
ref=D/'amiba-analysis-v311-reference-20261107-v1.js';assert not ref.exists();ref.write_text(s)
def replace(a,b):
 global s
 assert s.count(a)==1,(a,s.count(a));s=s.replace(a,b)
replace('facts.board.aliens.slots.map(s=>[String(s.slotId),s])','facts.board.aliens.slots.map(s=>[String(s.slotId),{...s}])')
replace('return{...tail,value:Math.max(0,net),selected:', 'return{value:Math.max(0,net),selected:')
replace("planNetGain:net},\n   reason:net>0?'funded-known-income-amiba-analysis'", "planNetGain:net},get candidates(){return tail.candidates;},set candidates(value){tail.candidates=value;},\n   reason:net>0?'funded-known-income-amiba-analysis'")
start=s.index('   const symbols=Object.fromEntries(Object.keys(facts.researchSymbols)');end=s.index('   const securedGain=',start);assert start>0 and end>start
s=s[:start]+'''   // Trigger consumption and final-mark facts are captured now; only their
   // explanatory endpoint container may be built after local ranking.
   const triggerProgress=trigger?{reservedCards:trigger.reservedCards,nextFinalMark:facts.nextFinalMark&&{...facts.nextFinalMark,options:facts.nextFinalMark.options.map(o=>o.tileId==='c'?{...o,currentValue:end.getFormulaBaseValue(o.formulaId,{...wallet,reservedCards:trigger.reservedCards},{})*o.multiplier}:o)}}:null;
'''+s[end:]
replace('let best={value:delta(wallet),wallet,progress:cleared,blueSlot:null};','let best={value:delta(wallet),wallet,required:null,blueSlot:null};')
replace('''    const progress={...cleared,computerSlots:[1,2,3].filter(n=>n<=required),blueSlots:cleared.blueSlots.map(b=>({...b,occupied:b.slot===Number(slot),unlocked:placement.getRequiredComputerSlotForBlueBonus(b.slot)<=required}))},value=delta(after);
    if(value>best.value)best={value,wallet:after,progress,blueSlot:Number(slot)};''','''    const value=delta(after);
    if(value>best.value)best={value,wallet:after,required,blueSlot:Number(slot)};''')
replace('''   candidates.push({slotId:choice.slot.slotId,position:choice.position||null,traceType:'blue',payment,preparationPlacements:needed.length,blueSlot:best.blueSlot,
    planNetGain:null,localPlanValue:best.value,linearGain:delta(best.wallet),securedGain,unknownCards,region,...(trigger?{blueDataTrigger:trigger.trigger}:{}),endpoint:{resources:best.wallet,...best.progress}});''','''   const plan={slotId:choice.slot.slotId,position:choice.position||null,traceType:'blue',payment,preparationPlacements:needed.length,blueSlot:best.blueSlot,
    planNetGain:null,localPlanValue:best.value,linearGain:delta(best.wallet),securedGain,unknownCards,region,...(trigger?{blueDataTrigger:trigger.trigger}:{})};
   candidates.push({plan,context,traceCounts,triggerProgress,wallet:best.wallet,required:best.required,ordinaryLeft,materialized:false});''')
replace('''  candidates.sort((a,b)=>b.localPlanValue-a.localPlanValue||a.slotId-b.slotId||(b.position||0)-(a.position||0));
  const selected=candidates[0];''','''  candidates.sort((a,b)=>b.plan.localPlanValue-a.plan.localPlanValue||a.plan.slotId-b.plan.slotId||(b.plan.position||0)-(a.plan.position||0));
  const selected=candidates.length?materialize(candidates[0]):null;''')
replace('''  return{value:Math.max(0,selected?.planNetGain||0),selected:selected||null,candidates,
''','''  let explanations,explanationsReady=false;
  return{value:Math.max(0,selected?.planNetGain||0),selected:selected||null,
   get candidates(){if(!explanationsReady){explanations=candidates.map(materialize);explanationsReady=true;}return explanations;},
   set candidates(value){explanations=value;explanationsReady=true;},
''')
needle='  // Every blue position resolves the same original symbol layout.'
replace(needle,'''  // Snapshot value-copied metadata at quote time. Lazy explanations never
  // read a later wallet, slot shell, blue progress or final-mark input.
  const symbolKeys=Object.keys(facts.researchSymbols),blueSnapshot=(facts.blueSlots||[]).map(b=>({...b,occupied:false,unlocked:false})),alienSnapshot={...facts.board.aliens},extraUnknownCount=facts.extraUnknownCount;
  function materialize(candidate){
   if(candidate.materialized)return candidate.plan;
   const {plan,context,traceCounts,triggerProgress,wallet,required,ordinaryLeft}=candidate;
   const symbols=Object.fromEntries(symbolKeys.map(k=>[k,context.amiba[k]])),traces={revealedSlotId:id,traceSlotsByAlienSlotId:context.amiba.traceSlotsByAlienSlotId,
    blindCardCount:context.amiba.blindCardCount,displayedCardAvailable:context.amiba.displayedCardAvailable},slots=Object.entries(context.aliens).map(([slotId,s])=>({...s,slotId:Number(slotId)}));
   plan.endpoint={resources:wallet,...(traceCounts?{traceCounts}:{}),computerSlots:required===null?[]:[1,2,3].filter(n=>n<=required),
    blueSlots:blueSnapshot.map(b=>required===null?{...b}:{...b,occupied:b.slot===plan.blueSlot,unlocked:placement.getRequiredComputerSlotForBlueBonus(b.slot)<=required}),researchSymbols:symbols,amibaTraces:traces,
    extraUnknownCount:extraUnknownCount+plan.unknownCards,aliens:{...alienSnapshot,slots,amiba:symbols,amibaTraces:traces},ordinaryDrawCount:ordinaryLeft,...triggerProgress};
   candidate.materialized=true;return plan;
  }
'''+needle)
out=D/'amiba-analysis-lazy-prototype-20261107-v1.js';assert not out.exists();out.write_text(s)
