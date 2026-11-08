from pathlib import Path
from shutil import copyfile
from subprocess import run
import gzip,json

root=Path.cwd()
tools=root/'browser-v652-chong-proof-tools'
tools.mkdir(exist_ok=True)
copyfile(root/'tools/run_browser_smokes.js',tools/'run_browser_smokes.js')
q=root/'randomizer/game/ai/fixtures/blue-transport-r3-20261108-v1.json.gz'
cases=json.loads(gzip.decompress(q.read_bytes()))
fields=('beforeChongTraceAtPublicityCap','beforeChongPickAtPublicityCap','afterChongPickAtPublicityCap')
(tools/'fixture.json').write_text(json.dumps({n:cases[n] for n in fields}))
action="""(async()=>{
 const f=await fetch('/browser-v652-chong-proof-tools/fixture.json').then(r=>r.json());
 const origin=f.beforeChongTraceAtPublicityCap,seed=JSON.parse(origin.committedState).meta.seed,seat='player-white';
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
  const trace=q();if(trace.a.target.choiceId!=='trace:2:blue:chong:9')throw Error('trace');
  apply(trace.a);if(!match(f.beforeChongPickAtPublicityCap))throw Error('pick native root changed');
  const pick=q(trace.checkpoint),cold=q();if(pick.a.target.choiceId!=='chong:display:9'||cold.a.actionId!==pick.a.actionId
    ||pick.search.diagnostics.nativeExecutions!==0||pick.search.value!==145.5)throw Error('nested display order');
  apply(pick.a);if(!match(f.afterChongPickAtPublicityCap))throw Error('post-pick native root changed');
  const wait=q();if(wait.a.family!=='end_turn')throw Error('did not keep publicity slot');
  apply(wait.a);const research=q();if(research.a.family!=='research_tech'||research.search.value!==156)throw Error('funded research');
  window.__v652Ok=true;
 }finally{c.dispose();}
})()"""
spec={'id':'production-v652-chong-tie-and-publicity',
      'file':'randomizer/index.html','readyExpression':'Boolean(window.SetiAnalysisPort&&window.SetiSearchAgent&&window.SetiProductionKernel)',
      'actionExpression':action,'successExpression':'window.__v652Ok===true',
      'obligation':'A known tied displayed Chong reward wins inside the retained Browser plan and on cold recovery; the unused capped publicity slot survives to research.',
      'counterexample':'Nested search takes a tied blind card, advances the original RNG, or cashes publicity at its cap.'}
(tools/'browser-smoke-inventory.js').write_text('module.exports='+json.dumps([spec])+';\n')
raise SystemExit(run(['node',str(tools/'run_browser_smokes.js')],cwd=root).returncode)
