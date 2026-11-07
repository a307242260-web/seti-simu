from pathlib import Path
from shutil import copyfile
from subprocess import run
import json,sys

root=Path(__file__).resolve().parents[1]
tools=root/'browser-v389-proof-tools';tools.mkdir(exist_ok=False)
copyfile(root/'tools/run_browser_smokes.js',tools/'run_browser_smokes.js')
rows=json.loads(Path(sys.argv[1]).read_text())['policy']
fixture={k:{'envelope':r['origin'],'choice':r['actionId'],'native':r['native'],'value':r['value']} for k,r in rows.items()}
(tools/'fixtures.json').write_text(json.dumps(fixture))
action="""(async()=>{
 const cases=await fetch('/browser-v389-proof-tools/fixtures.json').then(r=>r.json());
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
 window.__v389ProofSmoke=true;
})()"""
spec={'id':'production-v389-capped-sector-task','file':'randomizer/index.html',
 'readyExpression':'Boolean(window.SetiAnalysisPort&&window.SetiDecisionSearch&&window.SetiProductionKernel)',
 'actionExpression':action,'successExpression':'window.__v389ProofSmoke===true',
 'obligation':'Browser and Node agree on capped, uncapped, and task-scoring roots',
 'counterexample':'A restored Browser root selects a different tile, slot, value or Native work count'}
(tools/'browser-smoke-inventory.js').write_text('module.exports='+json.dumps([spec])+';\n')
raise SystemExit(run(['node',str(tools/'run_browser_smokes.js')],cwd=root).returncode)
