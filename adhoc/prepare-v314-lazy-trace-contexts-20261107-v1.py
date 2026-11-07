from pathlib import Path
import json,hashlib
P=Path(__file__).resolve().parents[1];D=P/'reports/ai-foundation-20261107/analysis-lazy-trace-contexts-v1';p=P/'randomizer/game/ai/amiba-analysis-capital.js';s=p.read_text();m=json.loads((P/'reports/ai-foundation-20261107/analysis-lazy-regions-v1/source-manifest-20261107-v1.json').read_text());assert hashlib.sha256(p.read_bytes()).hexdigest()==m['sourceHashes'][str(p.relative_to(P))]
ref=D/'amiba-analysis-v313-reference-20261107-v1.js';assert not ref.exists();ref.write_text(s)
def replace(a,b):
 global s
 assert s.count(a)==1,(a,s.count(a));s=s.replace(a,b)
needle='  function materialize(candidate){'
replace(needle,'''  // Fixed secured score without blue-data observers does not inspect the
  // new face marker while ranking. Snapshot its original blue grid once;
  // selected portfolio/explanation still gets the complete owned context.
  const deferFaces=scope.fixed&&choices.some(choice=>choice.position),faceGrid=deferFaces?originalAliens.amiba.traceSlotsByAlienSlotId[String(id)]:null;
  const faceSource=deferFaces?{...originalAliens,amiba:{...originalAliens.amiba,traceSlotsByAlienSlotId:{...originalAliens.amiba.traceSlotsByAlienSlotId,[String(id)]:{...faceGrid,blue:{...faceGrid.blue}}}}}:null;
  const actor={playerId:initial.id,playerColor:initial.color};
'''+needle)
replace('   const {plan,context,traceCounts,triggerProgress,wallet,required,ordinaryLeft}=candidate;', '''   const {plan,traceCounts,triggerProgress,wallet,required,ordinaryLeft}=candidate;
   let context=candidate.context;
   if(!context){
    context=analysisAliens(faceSource,{slot:{slotId:plan.slotId},position:plan.position});
    context.amiba.traceSlotsByAlienSlotId[String(id)].blue[plan.position]={traceType:'blue',position:plan.position,...actor};
    context.amiba.blindCardCount=candidate.blindCardCount;context.amiba.displayedCardAvailable=candidate.displayedCardAvailable;
    if(plan.region){const prepared=regionalPlans.get(plan.region.region);context.amiba.symbolSlots=prepared.symbolSlots;context.amiba.symbolsById=prepared.symbolsById;}
   }''')
replace('   const context=analysisAliens(originalAliens,choice),wallet={...paid};let unknownCards=0,ordinaryLeft=facts.board.ordinaryDrawCount;', '''   const deferredFace=scope.fixed&&Boolean(choice.position),context=deferredFace?null:analysisAliens(originalAliens,choice),wallet={...paid};let unknownCards=0,ordinaryLeft=facts.board.ordinaryDrawCount;
   let blindCardCount=originalAliens.amiba.blindCardCount,displayedCardAvailable=originalAliens.amiba.displayedCardAvailable;''')
replace("    context.amiba.traceSlotsByAlienSlotId[String(id)].blue[choice.position]={traceType:'blue',position:choice.position,playerId:initial.id,playerColor:initial.color};", "    if(context)context.amiba.traceSlotsByAlienSlotId[String(id)].blue[choice.position]={traceType:'blue',position:choice.position,playerId:initial.id,playerColor:initial.color};")
replace('     if(context.amiba.blindCardCount>0)context.amiba.blindCardCount--;else if(context.amiba.displayedCardAvailable)context.amiba.displayedCardAvailable=false;else continue;', '     if(blindCardCount>0)blindCardCount--;else if(displayedCardAvailable)displayedCardAvailable=false;else continue;\n     if(context){context.amiba.blindCardCount=blindCardCount;context.amiba.displayedCardAvailable=displayedCardAvailable;}')
replace('    const plan=regionalPlan(choice.reward.region);context.amiba.symbolSlots=plan.symbolSlots;context.amiba.symbolsById=plan.symbolsById;', '    const plan=regionalPlan(choice.reward.region);if(context){context.amiba.symbolSlots=plan.symbolSlots;context.amiba.symbolsById=plan.symbolsById;}')
replace('   candidates.push({plan,context,traceCounts,triggerProgress,wallet:best.wallet,required:best.required,ordinaryLeft,materialized:false});', '   candidates.push({plan,context,traceCounts,triggerProgress,wallet:best.wallet,required:best.required,ordinaryLeft,blindCardCount,displayedCardAvailable,materialized:false});')
out=D/'amiba-analysis-lazy-trace-prototype-20261107-v1.js';assert not out.exists();out.write_text(s)
