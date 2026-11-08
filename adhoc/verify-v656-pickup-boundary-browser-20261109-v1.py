from pathlib import Path
from shutil import copyfile
from subprocess import run
import gzip,json

root=Path.cwd()
tools=root/'browser-v656-pickup-boundary-tools'
tools.mkdir(exist_ok=True)
copyfile(root/'tools/run_browser_smokes.js',tools/'run_browser_smokes.js')
fixture=root/'randomizer/game/ai/fixtures/chong-pickup-fossil-r3-20261109-v1.json.gz'
(tools/'fixture.json').write_bytes(gzip.decompress(fixture.read_bytes()))
action="""(async()=>{
 const f=await fetch('/browser-v656-pickup-boundary-tools/fixture.json').then(r=>r.json());
 const origin=f.beforeLandingTrace,seed=JSON.parse(origin.committedState).meta.seed,seat='player-white';
 const k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),
  activePlayerCount:4,trustedProjectionReader:true,projectCounterfactualState:(s,w)=>window.SetiRuleObservation.buildRuleObservation(s,seed,w?.playerId)});
 k.newGame({seed});const c=k.composition,save=()=>c.lifecycle.save().envelope;
 const menu=()=>c.inspect().session.decision.choices;
 const search=()=>{
  const port=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});
  try{
   const before=JSON.stringify(save()),agent=window.SetiSearchAgent.createSearchAgent({seatId:seat,analysisPort:port});
   const r=agent.decide({seatId:seat,legalActions:menu()}).search,a=menu().find(x=>x.actionId===r.actionId);
   if(!r.complete||r.unresolved.length||r.diagnostics.nativeExecutions>256||!a||JSON.stringify(save())!==before)throw Error('decision scope or restore');
   return {a,r};
  }finally{port.close();}
 };
 const apply=a=>{
  const d=c.inspect().session.decision;
  if(!c.inputPort.submitDecision({decisionId:d.decisionId,decisionVersion:d.decisionVersion,ownerId:d.ownerId,choice:a}).ok)throw Error('native decision rejected');
 };
 try{
  if(!c.lifecycle.restore(origin).ok)throw Error('restore');
  const trace=search();
  if(trace.a.target.choiceId!=='trace:2:yellow:chong:4'||!trace.r.lines.some(x=>x.boundary==='hidden_chong_fossil_offer'))throw Error('missing information boundary');
  apply(trace.a);
  apply(menu().find(a=>a.target.source==='display'&&a.target.cardIndex===3));
  apply(menu().find(a=>a.target.ruleId==='amiba0-yellow-data'));
  const fossil=search().a;
  if(!fossil.target.fossilId)throw Error('known fossil is not selectable');
  apply(fossil);
  const st=JSON.parse(save().committedState);
  if(!st.pieces.rockets.some(p=>p.playerId===seat&&p.fossilId===fossil.target.fossilId))throw Error('native transport not started');
  window.__v656Ok=true;
 }finally{c.dispose();}
})()"""
spec={'id':'production-v656-chong-pickup-boundary','file':'randomizer/index.html',
      'readyExpression':'Boolean(window.SetiAnalysisPort&&window.SetiSearchAgent&&window.SetiProductionKernel)',
      'actionExpression':action,'successExpression':'window.__v656Ok===true',
      'obligation':'Browser selects the same landing trace without reading undisclosed fossil IDs and can pick one once offered.',
      'counterexample':'Browser explores hidden cargo or cannot submit the actual fossil choice.'}
(tools/'browser-smoke-inventory.js').write_text('module.exports='+json.dumps([spec])+';\n')
raise SystemExit(run(['node',str(tools/'run_browser_smokes.js')],cwd=root).returncode)
