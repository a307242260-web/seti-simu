from pathlib import Path
from shutil import copyfile
from subprocess import run
import json,sys

root=Path(__file__).resolve().parents[1]
row=json.loads(Path(sys.argv[1]).read_text())['before-research-computer3']
tools=root/'browser-v380-blue-tools';tools.mkdir(exist_ok=False)
copyfile(root/'tools/run_browser_smokes.js',tools/'run_browser_smokes.js')
fixture={'before-research-computer3':{'envelope':json.loads(Path(sys.argv[2]).read_text())['decisionRoots']['before-research-computer3']['envelope'],'choice':row['actionId'],'native':row['native'],'value':row['value']}}
(tools/'fixtures.json').write_text(json.dumps(fixture))
action="""(async()=>{
 const cases=await fetch('/browser-v380-blue-tools/fixtures.json').then(r=>r.json());
 const seed='seti-free-analyze-v1',seatId='player-white',k=window.SetiProductionKernel.createSimulationRuleComposition({seed,
  random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(s,w)=>window.SetiRuleObservation.buildRuleObservation(s,seed,w?.playerId)});
 k.newGame({seed});const c=k.composition;
 try{
  for(const [label,f] of Object.entries(cases)){
   if(!c.lifecycle.restore(f.envelope).ok)throw Error(label+' native fixture restore');
   const before=JSON.stringify(c.lifecycle.save().envelope),port=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
   try{
    const root=port.openRoot(),a=window.SetiSearchAgent,v=window.SetiStateValue.createStateValueEvaluator(seatId);
    const result=window.SetiDecisionSearch.searchDecision({port,root,evaluate:v,modelKey:v.modelKey,budget:a.BUDGET,...a.OPTIONS});
    if(!result.complete||result.unresolved.length||result.value!==f.value||result.diagnostics.nativeExecutions!==f.native||result.actionId!==f.choice)
      throw Error(label+' differs from Node');
    if(JSON.stringify(c.lifecycle.save().envelope)!==before)throw Error(label+' root/RNG changed');
   }finally{port.close();}
  }
 }finally{c.dispose();}
 window.__v380BlueSmoke=true;
})()"""
spec={'id':'production-v380-blue-refill-proof','file':'randomizer/index.html',
 'readyExpression':'Boolean(window.SetiAnalysisPort&&window.SetiDecisionSearch&&window.SetiProductionKernel)',
 'actionExpression':action,'successExpression':'window.__v380BlueSmoke===true',
 'obligation':'Browser and Node agree on Native research/scan and cold data-slot choices',
 'counterexample':'A restored Browser root selects a different tile, slot, value or Native work count'}
(tools/'browser-smoke-inventory.js').write_text('module.exports='+json.dumps([spec])+';\n')
raise SystemExit(run(['node',str(tools/'run_browser_smokes.js')],cwd=root).returncode)
