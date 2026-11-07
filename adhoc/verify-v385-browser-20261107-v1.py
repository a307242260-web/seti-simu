from pathlib import Path
from shutil import copyfile
from subprocess import run
import json,sys

root=Path(__file__).resolve().parents[1]
tools=root/'browser-v385-proof-tools';tools.mkdir(exist_ok=False)
copyfile(root/'tools/run_browser_smokes.js',tools/'run_browser_smokes.js')
sources=json.loads(Path(sys.argv[1]).read_text())['decisionRoots']
rows=json.loads(Path(sys.argv[2]).read_text())
fixture={k:{'envelope':sources[k]['envelope'],'choice':rows[k]['actionId'],'native':rows[k]['native'],'value':rows[k]['value']} for k in sources if k!='early-A0-first'}
source=json.loads(Path(sys.argv[3]).read_text())['decisionRoots']['post-analysis-unfunded']
r=json.loads(Path(sys.argv[4]).read_text())['post-analysis-unfunded']
fixture['income-with-known-data-corner']={'envelope':source['envelope'],'choice':r['actionId'],'native':r['native'],'value':r['value']}
(tools/'fixtures.json').write_text(json.dumps(fixture))
action="""(async()=>{
 const cases=await fetch('/browser-v385-proof-tools/fixtures.json').then(r=>r.json());
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
 window.__v385ProofSmoke=true;
})()"""
spec={'id':'production-v385-known-data-and-income','file':'randomizer/index.html',
 'readyExpression':'Boolean(window.SetiAnalysisPort&&window.SetiDecisionSearch&&window.SetiProductionKernel)',
 'actionExpression':action,'successExpression':'window.__v385ProofSmoke===true',
 'obligation':'Browser and Node agree on fixed blue reward and exact known income funding',
 'counterexample':'A restored Browser root selects a different tile, slot, value or Native work count'}
(tools/'browser-smoke-inventory.js').write_text('module.exports='+json.dumps([spec])+';\n')
raise SystemExit(run(['node',str(tools/'run_browser_smokes.js')],cwd=root).returncode)
