from pathlib import Path
from shutil import copyfile
from subprocess import run
import json,sys
root=Path(__file__).resolve().parents[1]; tools=root/'browser-v368-diagnostic-tools'; tools.mkdir(exist_ok=True)
copyfile(root/'tools/run_browser_smokes.js',tools/'run_browser_smokes.js')
action="""(async()=>{
 const base='/reports/ai-foundation-20261107/v367-blue1-dlc19-native-v1/',
 f=await fetch(base+'v367-r3-blue1-before-dlc19-root-20261107-v1.json').then(r=>r.json()),
 native=await fetch(base+'v367-blue1-dlc19-research-20261107-v1.json').then(r=>r.json()),
 seed=f.source.seed,seat=f.seatId,k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>window.SetiRuleObservation.buildRuleObservation(s,seed,w?.playerId)});
 k.newGame({seed});const c=k.composition;
 try{
  if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw Error('Native root restore');
  const before=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
  try{
   p.setCardPickPlanning(true);p.setResourcePlanning(true);const root=p.openRoot(),spec=p.cardPickSpec(root),swap=spec.companySwap;
   if(window.SetiCardPickPlanning.VERSION!=='seti-purpose-card-pick-policy-v16'||swap?.goal?.kind!=='sector-task-swap'||swap.goal.sectorId!=='sector-1-b'||swap.selection.cardId!=='card-63-0'||swap.goal.task.ruleId!=='dlc9-three-sector-wins')throw Error('public card purpose missing or stale browser module');
   const cut=p.expandWithCardPick(root,spec.selectedActionId,n=>n===1?'native-budget':null);if(cut.complete||cut.submissions!==1)throw Error('budget did not stop before second input');
   const result=p.expandWithCardPick(root,spec.selectedActionId,()=>null);
   if(!result.complete||result.submissions!==3||JSON.stringify(result.prefixes.map(x=>x.action.actionId))!==JSON.stringify(native.knownPrefix.slice(0,3).map(x=>x.id)))throw Error('wrong fixed company sequence');
   const hand=p.valueObservation(result.node).selfState.hand;
   if(!hand.some(x=>x.id==='card-63-0'&&x.cardId==='dlc_19.png')||hand.some(x=>x.id==='alien-amiba-9-8'))throw Error('wrong Native hand');
   if(JSON.stringify(c.lifecycle.save().envelope)!==before)throw Error('root/RNG changed');
  }finally{p.close();}
  window.__sectorTaskSwapSmoke={ok:true};
 }finally{c.dispose();}
})()"""
smoke={'id':'production-known-sector-task-swap','file':'randomizer/index.html','readyExpression':'Boolean(window.SetiAnalysisPort&&window.SetiCardPickPlanning&&window.SetiProductionKernel)','actionExpression':action,'successExpression':'window.__sectorTaskSwapSmoke?.ok===true','obligation':'Known public two-signal supplier opens a fixed three-input swap for a guaranteed held task, with native budget and source preserved','counterexample':'A stale page silently passes, replaces the card, spends an extra input or mutates original Native state'}
base=(root/'tools/browser-smoke-inventory.js').read_text()
(tools/'browser-smoke-inventory.js').write_text(base+'\nmodule.exports=Object.freeze([...module.exports,'+json.dumps(smoke,ensure_ascii=False)+']);\n')
args=['node',str(tools/'run_browser_smokes.js')]
for case in ['production-search-agent-entry','production-known-sector-task-swap']:args.extend(['--match',case])
sys.exit(run(args,cwd=root).returncode)
