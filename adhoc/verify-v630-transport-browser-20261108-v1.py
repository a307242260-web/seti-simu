from pathlib import Path
from shutil import copyfile
from subprocess import run
import gzip,json,sys
root=Path.cwd()
tools=root/'browser-v630-route-proof-tools';tools.mkdir(exist_ok=True)
copyfile(root/'tools/run_browser_smokes.js',tools/'run_browser_smokes.js')
payload=json.loads(Path(sys.argv[1]).read_bytes())
root_sample=next(r for r in payload['rows'] if r['goal']=='funding-prefix-14')['end']
f={'source':{'seed':json.loads(root_sample['committedState'])['meta']['seed']},'compositionEnvelope':root_sample,'seatId':'player-white'}
n=next(x['q'] for x in json.loads(Path(sys.argv[2]).read_bytes())['rows'] if x['label']=='prepare-with-move')
def key(r):
 return [r.get(k) for k in ['actionId','goal','value','realization','preparationDebt']]
winner=max((x for x in n['roots'] if x['value'] is not None),key=lambda x:x['value'])
(tools/'fixture.json').write_text(json.dumps({'fixture':f,'expected':{'actionId':winner['actionId'],'native':n['n'],'value':winner['value'],'rank':[key(r) for r in n['roots']],'quote':n['quote']}}))
action="""(async()=>{
 const {fixture:f,expected:e}=await fetch('/browser-v630-route-proof-tools/fixture.json').then(r=>r.json());
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
     JSON.stringify(r.lines.flatMap(x=>x.knownResearchTransport?[x.knownResearchTransport]:[]))!==JSON.stringify(e.quote)||JSON.stringify(r.roots.map(key))!==JSON.stringify(e.rank)||!window.SetiDecisionSearch.VERSION.endsWith("v412")||before!==JSON.stringify(c.lifecycle.save().envelope))throw Error('browser ranking or Native graph differs');
  window.__v630Cash=true;
 }finally{port?.close();c.dispose();}
})()"""
spec={'id':'production-v630-blue-cash-for-known-transport','file':'randomizer/index.html',
 'readyExpression':'Boolean(window.SetiAnalysisPort&&window.SetiDecisionSearch&&window.SetiProductionKernel)',
 'actionExpression':action,'successExpression':'window.__v630Cash===true',
 'obligation':'The same known research-to-transport preparation must agree in Browser and Node',
 'counterexample':'A browser chooses a different research-funding move, ranks another action or mutates the original RNG'}
(tools/'browser-smoke-inventory.js').write_text('module.exports='+json.dumps([spec])+';\n')
raise SystemExit(run(['node',str(tools/'run_browser_smokes.js')],cwd=root).returncode)
