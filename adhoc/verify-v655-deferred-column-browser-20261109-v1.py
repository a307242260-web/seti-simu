from pathlib import Path
from shutil import copyfile
from subprocess import run
import gzip,json

root=Path.cwd()
tools=root/'browser-v655-deferred-blue-column-tools'
tools.mkdir(exist_ok=True)
copyfile(root/'tools/run_browser_smokes.js',tools/'run_browser_smokes.js')
q=root/'randomizer/game/ai/fixtures/deferred-computer-blue-column-r3-20261109-v1.json.gz'
cases=json.loads(gzip.decompress(q.read_bytes()))
fields=('post-orange','actions','after-cash')
(tools/'fixture.json').write_text(json.dumps({n:cases[n] for n in fields}))
action="""(async()=>{
 const f=await fetch('/browser-v655-deferred-blue-column-tools/fixture.json').then(r=>r.json());
 const origin=f['post-orange'],seed=JSON.parse(origin.committedState).meta.seed,seat='player-white';
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
  const result=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}):a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
  if(!result.ok)throw Error('native decision rejected');
 };
 try{
  if(!c.lifecycle.restore(origin).ok)throw Error('restore');
  let checkpoint;
  for(const [i,expected] of f.actions.entries()){
   const chosen=q(checkpoint);
   if(chosen.a.actionId!==expected.actionId)throw Error('different Native input '+(i+1));
   if(i===0&&(!chosen.search.lines[0]?.resourcePolicy?.deferredBlueColumn||chosen.a.family!=='end_turn'))throw Error('missing deferred blue column');
   apply(chosen.a);
   checkpoint=chosen.checkpoint;
  }
  if(!match(f['after-cash']))throw Error('different Native landing state or RNG');
  window.__v655Ok=true;
 }finally{c.dispose();}
})()"""
spec={'id':'production-v655-deferred-blue-column',
      'file':'randomizer/index.html','readyExpression':'Boolean(window.SetiAnalysisPort&&window.SetiSearchAgent&&window.SetiProductionKernel)',
      'actionExpression':action,'successExpression':'window.__v655Ok===true',
      'obligation':'Browser and Node reach the same cash slot and preserve the deferred blue column reward.',
      'counterexample':'Browser places data before research, changes the paid move, or mutates the original RNG.'}
(tools/'browser-smoke-inventory.js').write_text('module.exports='+json.dumps([spec])+';\n')
raise SystemExit(run(['node',str(tools/'run_browser_smokes.js')],cwd=root).returncode)
