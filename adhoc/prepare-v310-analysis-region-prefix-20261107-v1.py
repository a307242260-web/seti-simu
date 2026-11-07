from pathlib import Path
import json,hashlib
P=Path(__file__).resolve().parents[1];D=P/'reports/ai-foundation-20261107/analysis-region-prefix-v1';p=P/'randomizer/game/ai/amiba-analysis-capital.js';s=p.read_text();m=json.loads((P/'reports/ai-foundation-20261107/research-single-window-v1/source-manifest-20261107-v1.json').read_text());assert hashlib.sha256(p.read_bytes()).hexdigest()==m['sourceHashes'][str(p.relative_to(P))]
ref=D/'amiba-analysis-v309-reference-20261107-v1.js';assert not ref.exists();ref.write_text(s)
def replace(a,b):
 global s
 assert s.count(a)==1,(a,s.count(a));s=s.replace(a,b)
replace('function analysisAliens(source,copySymbols=true){','function analysisAliens(source){')
replace('// Only blue occupancy/counts and symbol slot locations are written below.','// Trace candidates own their blue occupancy/counts; regional symbols\n  // below are a separate private read-only prepared result.')
replace('amiba:{...(copySymbols?amiba.copyPublicSymbolState(source.amiba):source.amiba),','amiba:{...source.amiba,')
replace('  for(const choice of choices){\n   const context=analysisAliens(originalAliens,Boolean(choice.reward.region)),wallet={...paid};', '''  // Every blue position resolves the same original symbol layout. Execute
  // that Native prefix once per region, then apply its rewards to each wallet.
  // Only privately copied symbol maps are shared, recursively read-only; each
  // candidate still owns its traces, draw counts, wallet and result wrappers.
  const regionalPlans=new Map();
  function regionalPlan(region){
   if(regionalPlans.has(region))return regionalPlans.get(region);
   const alien={amiba:amiba.copyPublicSymbolState(originalAliens.amiba)},result=amiba.resolveRegionReward(alien,region,readOnlyRewards);
   if(!result.ok)throw Error('AMIBA_ANALYSIS_REGION_QUERY_FAILED');
   Object.values(alien.amiba.symbolsById).forEach(Object.freeze);
   const plan={result,symbolSlots:Object.freeze(alien.amiba.symbolSlots),symbolsById:Object.freeze(alien.amiba.symbolsById)};
   regionalPlans.set(region,plan);return plan;
  }
  for(const choice of choices){
   const context=analysisAliens(originalAliens),wallet={...paid};''')
replace("if(choice.reward.region){region=amiba.resolveRegionReward(context,choice.reward.region,readOnlyRewards);if(!region.ok)throw Error('AMIBA_ANALYSIS_REGION_QUERY_FAILED');let valid=true;",'''if(choice.reward.region){
    const plan=regionalPlan(choice.reward.region);context.amiba.symbolSlots=plan.symbolSlots;context.amiba.symbolsById=plan.symbolsById;
    region={...plan.result,results:plan.result.results.map(r=>({...r,move:r.move&&{...r.move}}))};let valid=true;''')
out=D/'amiba-analysis-regional-prefix-prototype-20261107-v1.js';assert not out.exists();out.write_text(s)
