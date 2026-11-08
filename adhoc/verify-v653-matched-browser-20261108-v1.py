from pathlib import Path
from shutil import copyfile
from subprocess import run
import gzip,json

root=Path.cwd()
tools=root/'browser-v653-matched-proof-tools'
tools.mkdir(exist_ok=True)
copyfile(root/'tools/run_browser_smokes.js',tools/'run_browser_smokes.js')
q=root/'randomizer/game/ai/fixtures/blue-transport-r3-20261108-v1.json.gz'
cases=json.loads(gzip.decompress(q.read_bytes()))
fields=('beforeMatchedAnalysisScan','afterMatchedPurple1')
(tools/'fixture.json').write_text(json.dumps({n:cases[n] for n in fields}))
action="""(async()=>{
 const f=await fetch('/browser-v653-matched-proof-tools/fixture.json').then(r=>r.json());
 const origin=f.beforeMatchedAnalysisScan,seed=JSON.parse(origin.committedState).meta.seed,seat='player-white';
 const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),
  activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>window.SetiRuleObservation.buildRuleObservation(s,seed,w?.playerId)});
 k.newGame({seed});const c=k.composition,save=()=>c.lifecycle.save().envelope,match=e=>JSON.stringify(save())===JSON.stringify(e);
 const q=(checkpoint)=>{
  const port=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
  try{
   const before=save(),menu=c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
   const agent=window.SetiSearchAgent.createSearchAgent({seatId:seat,analysisPort:port});if(checkpoint)agent.loadCheckpoint(checkpoint);
   const r=agent.decide({seatId:seat,legalActions:menu}).search,a=menu.find(x=>x.actionId===r.actionId);
   if(!r.complete||r.unresolved.length||r.diagnostics.nativeExecutions>256||!a||!match(before))throw Error('decision scope or restore');
   return {a,checkpoint:structuredClone(agent.createCheckpoint()),search:r};
  }finally{port.close();}
 };
 const apply=(a)=>{
  const d=c.inspect().session?.decision;
  const result=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):c.inputPort.submitAction(a);
  if(!result.ok)throw Error('native decision rejected');
 };
 try{
  if(!c.lifecycle.restore(origin).ok)throw Error('restore');
  const research=q();
  if(research.a.family!=='research_tech'||research.search.value!==160||research.search.diagnostics.nativeExecutions!==105)throw Error('matched order');
  const totals=research.search.lines.flatMap(l=>l.matchedAnalysisScan?[[l.matchedAnalysisScan.order,l.matchedAnalysisScan.value]]:[]).sort();
  if(JSON.stringify(totals)!==JSON.stringify([['analysis',160],['research',160],['scan',157]]))throw Error('matched scopes');
  apply(research.a);const menu=q(research.checkpoint);
  if(menu.a.target.tileId!=='purple1')throw Error('matched research tile');
  apply(menu.a);const end=q(menu.checkpoint);if(end.a.family!=='end_turn')throw Error('unfunded post research');
  apply(end.a);if(!match(f.afterMatchedPurple1))throw Error('same Native wallet');
  const analyze=q();
  if(analyze.a.family!=='analyze'||analyze.search.value!==160||analyze.search.diagnostics.nativeExecutions!==183)throw Error('matched continuation');
  window.__v653Ok=true;
 }finally{c.dispose();}
})()"""
spec={'id':'production-v653-matched-analysis-scan',
      'file':'randomizer/index.html','readyExpression':'Boolean(window.SetiAnalysisPort&&window.SetiSearchAgent&&window.SetiProductionKernel)',
      'actionExpression':action,'successExpression':'window.__v653Ok===true',
      'obligation':'Browser and Node compare the same public analysis, research and scan and preserve the plan through a cold restart.',
      'counterexample':'Browser picks immediate card discard instead of the matched plan, or mutates the original RNG.'}
(tools/'browser-smoke-inventory.js').write_text('module.exports='+json.dumps([spec])+';\n')
raise SystemExit(run(['node',str(tools/'run_browser_smokes.js')],cwd=root).returncode)
