from pathlib import Path
from shutil import copyfile
from subprocess import run
import gzip,json

root=Path.cwd()
tools=root/'browser-v661-chong-end-tools'
tools.mkdir(exist_ok=True)
copyfile(root/'tools/run_browser_smokes.js',tools/'run_browser_smokes.js')
fixture=root/'randomizer/game/ai/fixtures/chong-quiet-end-r3-20261109-v1.json.gz'
(tools/'fixture.json').write_bytes(gzip.decompress(fixture.read_bytes()))
action="""(async()=>{
 const f=await fetch('/browser-v661-chong-end-tools/fixture.json').then(r=>r.json());
 const seed=JSON.parse(f.root.committedState).meta.seed,seat='player-white';
 const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),
  activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>window.SetiRuleObservation.buildRuleObservation(s,seed,w?.playerId)});
 k.newGame({seed});const c=k.composition,save=()=>JSON.stringify(c.lifecycle.save().envelope);
 const open=()=>window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
 try{
  if(!c.lifecycle.restore(f.root).ok)throw Error('restore');
  const p=open();
  try{
   const before=save(),agent=window.SetiSearchAgent.createSearchAgent({seatId:seat,analysisPort:p});
   const q=agent.decide({seatId:seat,legalActions:c.inputPort.enumerateActions({})}).search;
   const rank={actionId:q.actionId,value:q.value,realization:q.realization,preparationDebt:q.preparationDebt,
    roots:q.roots.map(r=>[r.actionId,r.value,r.realization,r.preparationDebt])};
   if(!q.complete||q.unresolved.length||q.diagnostics.nativeExecutions>256||save()!==before
    ||JSON.stringify(rank)!==JSON.stringify(f.baseline)
    ||!q.lines.some(l=>l.edges?.some(x=>x.turnTailPlanValue?.publicChongPlainEnd)))throw Error('quiet native ranking or scope changed');
  }finally{p.close();}
  if(!c.lifecycle.restore(f.cargo).ok)throw Error('restore cargo');
  const p2=open();
  try{
   p2.setResourcePlanning(true);p2.setMovementPlanning(true);p2.setCardPickPlanning(true);
   p2.setDecisionPlanning({finalMarkPlanning:true,scanPlanning:true});
   if(p2.turnTailSummary(p2.openRoot(),'end-turn')!==null)throw Error('transport requires Native');
  }finally{p2.close();}
  window.__v661Ok=true;
 }finally{c.dispose();}
})()"""
spec={'id':'production-v661-chong-quiet-end','file':'randomizer/index.html',
      'readyExpression':'Boolean(window.SetiAnalysisPort&&window.SetiSearchAgent&&window.SetiProductionKernel)',
      'actionExpression':action,'successExpression':'window.__v661Ok===true',
      'obligation':'Browser has the same exact quiet value and preserves a native live cargo end.',
      'counterexample':'Ranking differs, or live cargo is treated as quiet.'}
(tools/'browser-smoke-inventory.js').write_text('module.exports='+json.dumps([spec])+';\n')
raise SystemExit(run(['node',str(tools/'run_browser_smokes.js')],cwd=root).returncode)
