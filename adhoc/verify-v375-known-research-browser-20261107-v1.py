from pathlib import Path
from shutil import copyfile
from subprocess import run
import json,sys

root=Path(__file__).resolve().parents[1]
fixture=Path(sys.argv[1]);tools=root/'browser-v375-research-tools';tools.mkdir(exist_ok=False)
copyfile(root/'tools/run_browser_smokes.js',tools/'run_browser_smokes.js')
copyfile(fixture,tools/'known-research-data-actual-192.json')
base=(root/'browser-v372-landing-tools/browser-smoke-inventory.js').read_text()
action="""(async()=>{
 const f=await fetch('/browser-v375-research-tools/known-research-data-actual-192.json').then(r=>{if(!r.ok)throw Error('Native fixture unavailable');return r.json();});
 if(window.SetiDecisionSearch.VERSION!=='seti-complete-decision-search-v375')throw Error('Stale browser search module');
 const seed=f.source.seed,seatId=f.seatId,k=window.SetiProductionKernel.createSimulationRuleComposition({seed,
  random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,trustedProjectionReader:true,
  projectCounterfactualState:(s,w)=>window.SetiRuleObservation.buildRuleObservation(s,seed,w?.playerId)});
 k.newGame({seed});const c=k.composition;
 try{
  if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw Error('Native fixture restore');
  const before=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
  try{
   const root=p.openRoot(),a=window.SetiSearchAgent,v=window.SetiStateValue.createStateValueEvaluator(seatId);
   const r=window.SetiDecisionSearch.searchDecision({port:p,root,evaluate:v,modelKey:v.modelKey,budget:a.BUDGET,...a.OPTIONS});
   const quotes=r.lines.filter(x=>x.researchData).map(x=>x.researchData);
   if(!r.complete||r.unresolved.length||r.value!==178.5||r.diagnostics.nativeExecutions!==123
    ||r.roots.find(x=>x.actionId===r.actionId)?.goal.tileId!=='purple1'||quotes.length!==4
    ||!quotes.every(x=>x.publicityAfterPlacement===4&&x.dataAfterPlacement===2))throw Error('Browser research result differs from Native Node');
   if(JSON.stringify(c.lifecycle.save().envelope)!==before)throw Error('Browser root/RNG changed');
  }finally{p.close();}
 }finally{c.dispose();}
 window.__v375ResearchSmoke={ok:true};
})()"""
smoke={'id':'production-v375-known-research-data','file':'randomizer/index.html',
 'readyExpression':'Boolean(window.SetiAnalysisPort&&window.SetiDecisionSearch&&window.SetiProductionKernel)',
 'actionExpression':action,'successExpression':'window.__v375ResearchSmoke?.ok===true',
 'obligation':'Browser selects the same shared native research purpose and restores root/RNG',
 'counterexample':'Browser source, cards, or research options differ from Node'}
(tools/'browser-smoke-inventory.js').write_text(base+'\nmodule.exports=Object.freeze([...module.exports,'+json.dumps(smoke,ensure_ascii=False)+']);\n')
args=['node',str(tools/'run_browser_smokes.js')]
for n in ['production-search-agent-entry','production-v375-known-research-data','production-analysis-lazy-explanations','production-amiba-currency-tail-value','production-known-postdraw-tail','production-blue-data-analysis']:
 args.extend(['--match',n])
raise SystemExit(run(args,cwd=root).returncode)
