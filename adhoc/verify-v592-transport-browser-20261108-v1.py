from pathlib import Path
from shutil import copyfile
from subprocess import run
import gzip,json,sys
root=Path.cwd()
tools=root/'browser-v592-route-proof-tools';tools.mkdir(exist_ok=True)
copyfile(root/'tools/run_browser_smokes.js',tools/'run_browser_smokes.js')
r=json.loads(Path(sys.argv[1]).read_bytes())['rows'][0]
f={'source':{'seed':json.loads(r['end']['committedState'])['meta']['seed']},'compositionEnvelope':r['end'],'seatId':'player-white'}
n=r['quote']
def key(r):
 return [r.get(k) for k in ['actionId','goal','value','realization','preparationDebt']]
(tools/'fixture.json').write_text(json.dumps({'fixture':f,'expected':{'actionId':n['actionId'],'native':n['n'],'value':n['value'],'rank':[key(r) for r in n['graph']['roots']]}}))
action="""(async()=>{
 const {fixture:f,expected:e}=await fetch('/browser-v592-route-proof-tools/fixture.json').then(r=>r.json());
 const seed=f.source.seed,k=window.SetiProductionKernel.createSimulationRuleComposition({seed,
  random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(s,w)=>window.SetiRuleObservation.buildRuleObservation(s,seed,w?.playerId)});
 k.newGame({seed});const c=k.composition;let port;
 try{
  if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw Error('native restore');
  const before=JSON.stringify(c.lifecycle.save().envelope),agent=window.SetiSearchAgent,v=window.SetiStateValue.createStateValueEvaluator(f.seatId);
  port=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:f.seatId,maxCacheEntries:0});
  const r=window.SetiDecisionSearch.searchDecision({port,root:port.openRoot(),evaluate:v,modelKey:v.modelKey,budget:agent.BUDGET,...agent.OPTIONS});
  const key=r=>[r.actionId,r.goal,r.value,r.realization,r.preparationDebt];
  if(!r.complete||r.unresolved.length||r.actionId!==e.actionId||r.value!==e.value||r.diagnostics.nativeExecutions!==e.native||
     JSON.stringify(r.roots.map(key))!==JSON.stringify(e.rank)||!window.SetiDecisionSearch.VERSION.endsWith("v410")||before!==JSON.stringify(c.lifecycle.save().envelope))throw Error('browser ranking or Native graph differs');
  window.__v592Transport=true;
 }finally{port?.close();c.dispose();}
})()"""
spec={'id':'production-v592-known-chong-transport','file':'randomizer/index.html',
 'readyExpression':'Boolean(window.SetiAnalysisPort&&window.SetiDecisionSearch&&window.SetiProductionKernel)',
 'actionExpression':action,'successExpression':'window.__v592Transport===true',
 'obligation':'The same known two-step transport with hidden fossils must agree in Browser and Node',
 'counterexample':'A browser ranks a different movement or reveals the hidden offer or mutates the original RNG'}
(tools/'browser-smoke-inventory.js').write_text('module.exports='+json.dumps([spec])+';\n')
raise SystemExit(run(['node',str(tools/'run_browser_smokes.js')],cwd=root).returncode)
