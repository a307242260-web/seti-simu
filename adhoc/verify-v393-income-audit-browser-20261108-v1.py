from pathlib import Path
from shutil import copyfile
from subprocess import run
import json
root=Path(__file__).resolve().parents[1]
tools=root/'browser-v393-income-proof-tools'
tools.mkdir()
copyfile(root/'tools/run_browser_smokes.js',tools/'run_browser_smokes.js')
action="""(async()=>{
 const folder='/reports/ai-foundation-20261105/third-round-teacher-v1/';
 const read=async p=>{const r=await fetch(folder+p);if(!r.ok)throw Error(p);return r.json();};
 const [factor,visible]=await Promise.all([read('v208-income-factor-prefixes-20261106-v1.checkpoint.json'),read('v204-actual-safety-choice-native-20261106-v1.json')]);
 const e=factor.common.prefixes[1],seed=JSON.parse(e.committedState).meta.seed,seat='player-white';
 const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,
   trustedProjectionReader:true,projectCounterfactualState:(s,w)=>window.SetiRuleObservation.buildRuleObservation(s,seed,w?.playerId)});
 k.newGame({seed});const c=k.composition,v=window.SetiStateValue,probe=window.SetiProbeCapital;
 const mask=x=>window.SetiRuleComposition.sanitizeHiddenInformationObservation(visible.branches.safety.observation,x,{code:'hidden_card_reveal'});
 const assess=e=>{
   if(!c.lifecycle.restore(e).ok)throw Error('income restore');
   const before=JSON.stringify(c.lifecycle.save().envelope),opts={role:'player',playerId:seat};
   const view=mask(c.projection(opts).state),compact=mask(c.projection({...opts,valueOnly:true}).state);
   const value=v.evaluateStateValue(view,seat);
   if(JSON.stringify(value)!==JSON.stringify(v.evaluateStateValue(compact,seat)))throw Error('compact income differs');
   const facts={...probe.factsFromObservation(view,seat),supply:view.publicState.board.techSupply,researchCost:6,analyzeEnergyCost:0};
   if(JSON.stringify(c.lifecycle.save().envelope)!==before)throw Error('income mutated source or RNG');
   return{value:value.total,hand:view.selfState.hand,plan:v.purposeCapital(facts).analysisPlan.selected};
 };
 try{
   const start=assess(e),paid=assess(factor.branches['energy-B48'].envelope),credit=assess(factor.branches.credit.envelope),other=assess(factor.branches['energy-Amiba3'].envelope);
   if(start.plan?.incomeCardId!=='card-18-0'||start.plan.preparationPlacements!==3||start.plan.position!==4||
      start.value!==paid.value||!(paid.value>credit.value&&paid.value>other.value)||paid.hand.some(card=>card.id===start.plan.incomeCardId))
      throw Error('known income quote failed to realize selected Native B48 wallet');
   window.__v393IncomeAudit=true;
 }finally{c.dispose();}
})()"""
spec={'id':'production-v393-income-portfolio-audit','file':'randomizer/index.html',
 'readyExpression':'Boolean(window.SetiRuleComposition&&window.SetiStateValue&&window.SetiProductionKernel)',
 'actionExpression':action,'successExpression':'window.__v393IncomeAudit===true',
 'obligation':'Current Browser full and compact views realize the selected masked Native income endpoint and order both alternatives',
 'counterexample':'A lost or double-counted use shifts the quoted value, or opaque hand slots select an unavailable income'}
(tools/'browser-smoke-inventory.js').write_text('module.exports='+json.dumps([spec])+';\n')
raise SystemExit(run(['node',str(tools/'run_browser_smokes.js')],cwd=root).returncode)
