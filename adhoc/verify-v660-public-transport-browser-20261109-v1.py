from pathlib import Path
from shutil import copyfile
from subprocess import run
import gzip,json

root=Path.cwd()
tools=root/'browser-v660-public-transport-tools'
tools.mkdir(exist_ok=True)
copyfile(root/'tools/run_browser_smokes.js',tools/'run_browser_smokes.js')
fixture=root/'randomizer/game/ai/fixtures/public-displayed-transport-r3-20261109-v1.json.gz'
(tools/'fixture.json').write_bytes(gzip.decompress(fixture.read_bytes()))
action="""(async()=>{
 const f=await fetch('/browser-v660-public-transport-tools/fixture.json').then(r=>r.json());
 const origin=f.launch,seed=JSON.parse(origin.committedState).meta.seed,seat='player-white';
 const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),
  activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>window.SetiRuleObservation.buildRuleObservation(s,seed,w?.playerId)});
 k.newGame({seed});const c=k.composition,save=()=>c.lifecycle.save().envelope;
 function search(checkpoint){
  const port=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
  try{
   const before=JSON.stringify(save()),agent=window.SetiSearchAgent.createSearchAgent({seatId:seat,analysisPort:port});
   if(checkpoint)agent.loadCheckpoint(checkpoint);
   const menu=c.inspect().session?.decision?.choices||c.inputPort.enumerateActions({});
   const r=agent.decide({seatId:seat,legalActions:menu}).search,a=menu.find(x=>x.actionId===r.actionId);
   if(!r.complete||r.unresolved.length||r.diagnostics.nativeExecutions>256||!a||JSON.stringify(save())!==before)throw Error('decision scope or restore');
   return {a,r,checkpoint:structuredClone(agent.createCheckpoint())};
  }finally{port.close();}
 }
 function apply(a){
  const d=c.inspect().session?.decision;
  const result=d?c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a})
   :a.phase==='quick'?c.inputPort.submitQuickAction(a):c.inputPort.submitAction(a);
  if(!result.ok)throw Error('native decision rejected');
 }
 try{
  if(!c.lifecycle.restore(origin).ok)throw Error('restore');
  let checkpoint,settled=false;
  for(let i=0;i<80;i++){
   const q=search(checkpoint),a=q.a;
   if(i===0&&!q.r.lines.some(x=>x.knownResearchTransport?.kind==='known-launch-and-displayed-transport'))throw Error('missing transport quote');
   if(i===1&&a.actionId!==f.expected.launchMain)throw Error('wrong launch');
   if(a.family==='pass'){settled=true;break;}
   apply(a);checkpoint=q.checkpoint;
  }
  if(!settled)throw Error('failed to close controlled round');
  const st=JSON.parse(save().committedState),player=st.players.players.find(p=>p.id===seat);
  if(player.resources.score!==127||player.resources.credits!==1||!st.pieces.rockets.some(p=>p.playerId===seat&&p.fossilId==='fossil_01'))
   throw Error('different settled transport assets');
  window.__v660Ok=true;
 }finally{c.dispose();}
})()"""
spec={'id':'production-v660-public-displayed-transport','file':'randomizer/index.html',
      'readyExpression':'Boolean(window.SetiAnalysisPort&&window.SetiSearchAgent&&window.SetiProductionKernel)',
      'actionExpression':action,'successExpression':'window.__v660Ok===true',
      'obligation':'Browser follows the visible launch and cash-column transport to the same pre-PASS assets as Node.',
      'counterexample':'Browser cannot recover the fixed route or reaches an incorrect native endpoint.'}
(tools/'browser-smoke-inventory.js').write_text('module.exports='+json.dumps([spec])+';\n')
raise SystemExit(run(['node',str(tools/'run_browser_smokes.js')],cwd=root).returncode)
