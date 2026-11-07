from pathlib import Path
P=Path(__file__).resolve().parents[1];p=P/'randomizer/game/ai/local-decision-plans.js';s=p.read_text()
def replace(a,b,n=1):
 global s
 assert s.count(a)==n,(a,s.count(a));s=s.replace(a,b)
replace(' function incomeCompletion({state,seatId,goal}){',' function previewIncomeCompletion({state,seatId,goal}){')
replace("placements:preview.placements,assumption:preview.assumption};","placements:preview.placements,assumption:preview.assumption,capital};")
replace(' // Data plans write only these player fields.', ' function incomeCompletion(input){const {capital,...result}=previewIncomeCompletion(input);return result;}\n // Data plans write only these player fields.')
replace(' function previewBlueCompletion({state,seatId,goal}){',' function previewBlueCompletion({state,seatId,goal,beforeCapital=null}){')
replace('  const option=demand.planningCapital(state,copy)-demand.planningCapital(state,p);','  const capital={afterCapital:demand.planningCapital(state,copy),beforeCapital:beforeCapital??demand.planningCapital(state,p)};\n  const option=capital.afterCapital-capital.beforeCapital;')
replace('immediateScoreGain:copy.resources.score-p.resources.score,player:copy,assumption:', 'immediateScoreGain:copy.resources.score-p.resources.score,player:copy,capital,assumption:',2)
replace('function blueCompletion(input){const {player,...result}', 'function blueCompletion(input){const {player,capital,...result}')
replace(' function previewComputerCompletion({state,seatId,goal}){',' function previewComputerCompletion({state,seatId,goal,beforeCapital=null}){')
replace('  const net=stateValue.sumValueParts([score,resources,demand.planningCapital(state,copy),-demand.planningCapital(state,p)]);','  const capital={afterCapital:demand.planningCapital(state,copy),beforeCapital:beforeCapital??demand.planningCapital(state,p)};\n  const net=stateValue.sumValueParts([score,resources,capital.afterCapital,-capital.beforeCapital]);')
replace('function computerCompletion(input){const {player,...result}', 'function computerCompletion(input){const {player,capital,...result}')
replace('  let current=state;const plans=[];let netGain=0,requiredNativeInputs=1,immediateScoreGain=0;','''  let current=state;const plans=[];let netGain=0,requiredNativeInputs=1,immediateScoreGain=0;
  let sourceCapital=null,currentCapital=null;
  // Private scalars from the selected typed preview only. Installing that same
  // player leaves all value facts unchanged; the audited callbacks are pure.
  // No value survives this call or attaches to a mutable state/player object.
  function retainCapital(capital){
   if(!plans.length)sourceCapital=capital?.beforeCapital??null;
   currentCapital=capital?.afterCapital??null;
  }''')
replace('   const {player,...summary}=preview;','   const {player,capital,...summary}=preview;retainCapital(capital);',2)
replace('previewComputerCompletion({state:current,seatId,goal})','previewComputerCompletion({state:current,seatId,goal,beforeCapital:currentCapital})')
replace('   const incomeTail=income&&(sameIncome&&initialIncomeTail||incomeCompletion({state:current,seatId,goal:income}));','   const reusedIncome=sameIncome&&initialIncomeTail;\n   const incomeTail=income&&(reusedIncome||previewIncomeCompletion({state:current,seatId,goal:income}));')
replace('    const {goal,preview}=prefixes[0],{player,...summary}=preview;','    const {goal,preview}=prefixes[0],{player,capital,...summary}=preview;retainCapital(capital);')
replace('    const inputs=preview.placements*2+1;','''    // The public initial policy has no trusted private capital packet. Its
    // existing quote is keyed by the complete immutable source, or recomputed
    // for a mutable source; arbitrary extra caller fields are never evidence.
    retainCapital(reusedIncome?(trackPurposeDelta?demand.incomeTailCapital({state:current,seatId,goal:income}):null):incomeTail.capital);
    const inputs=preview.placements*2+1;''')
replace('   const preview=previewBlueCompletion({state:current,seatId,goal});','   const preview=previewBlueCompletion({state:current,seatId,goal,beforeCapital:currentCapital});')
replace('demand.planningCapital(current,owner(current,seatId)),-demand.planningCapital(state,initialOwner),end.purposeDelta','currentCapital??demand.planningCapital(current,owner(current,seatId)),-(sourceCapital??demand.planningCapital(state,initialOwner)),end.purposeDelta')
p.write_text(s)
p=P/'randomizer/game/ai/decision-search.js';s=p.read_text();assert 'seti-complete-decision-search-v306' in s;p.write_text(s.replace('seti-complete-decision-search-v306','seti-complete-decision-search-v307'))
p=P/'randomizer/index.html';s=p.read_text().replace('decision-search.js?read-only-rewards-v306','decision-search.js?capital-carry-v307').replace('local-decision-plans.js?r4-company-tail-v301','local-decision-plans.js?capital-carry-v307');p.write_text(s)
p=P/'tools/node-test-inventory.js';s=p.read_text();line='    entry("randomizer/game/ai/fixed-tail-capital-carry.test.js", "policy/decision-search", "固定尾部只复用本次已报价端点，完整公开结果及可变状态更新保持，与原生尾部兑现一致", "重复整组估值、信任外部标量、跨可变来源缓存或丢弃最终标记价值"),\n';needle='    entry("randomizer/game/ai/local-preview-copy.test.js"';assert needle in s;s=s.replace(needle,line+needle);p.write_text(s)
