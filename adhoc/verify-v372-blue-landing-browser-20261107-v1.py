from pathlib import Path
from shutil import copyfile
from subprocess import run
import json

root=Path(__file__).resolve().parents[1]
tools=root/'browser-v372-landing-tools'
tools.mkdir(exist_ok=True)
copyfile(root/'tools/run_browser_smokes.js',tools/'run_browser_smokes.js')
action="""(async()=>{
 const prefix='/reports/ai-foundation-20261107/v372-blue-landing-supply-v1/roots/',
   read=name=>fetch(prefix+name+'.json').then(r=>{if(!r.ok)throw Error('Native fixture unavailable');return r.json();});
 if(window.SetiDecisionSearch.VERSION!=='seti-complete-decision-search-v372')throw Error('Stale browser search module');
 for(const name of ['blue-landing-141','blue-landing-151','blue-landing-overflow-task']){
  const f=await read(name),seed=f.source.seed,seatId=f.seatId,
    k=window.SetiProductionKernel.createSimulationRuleComposition({seed,random:window.SetiRandom.createSeededRandom(seed),activePlayerCount:4,
     trustedProjectionReader:true,projectCounterfactualState:(s,w)=>window.SetiRuleObservation.buildRuleObservation(s,seed,w?.playerId)});
  k.newGame({seed});const c=k.composition;
  try{
   if(!c.lifecycle.restore(f.compositionEnvelope).ok)throw Error('Native root restore');
   const before=JSON.stringify(c.lifecycle.save().envelope),p=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId,maxCacheEntries:0});
   try{
    const root=p.openRoot(),a=window.SetiSearchAgent,v=window.SetiStateValue.createStateValueEvaluator(seatId),
      r=window.SetiDecisionSearch.searchDecision({port:p,root,evaluate:v,modelKey:v.modelKey,budget:a.BUDGET,...a.OPTIONS});
    const expected={'blue-landing-141':'move:ff83c607','blue-landing-151':'card_corner:4c8b60cc',
      'blue-landing-overflow-task':'accept_optional_effect:330c19f6'}[name];
    if(!r.complete||r.unresolved.length||r.actionId!==expected)throw Error('Browser action differs from isolated Node');
    if(name!=='blue-landing-overflow-task'){
      if(r.value!==111.5||r.lines[0].landingCompanyRetained!==1)throw Error('Company option missing from browser comparison');
      const edges=r.lines.flatMap(line=>line.edges.filter(e=>e.resourcePlan?.goal.kind==='blue-landing-supply'));
      if(edges.length!==1||edges[0].steps.length!==4||edges[0].resourcePlan.goal.landing.planetId!=='mars')throw Error('Wrong fixed Native blue plan');
    }
    if(JSON.stringify(c.lifecycle.save().envelope)!==before)throw Error('Browser fork changed root or RNG');
   }finally{p.close();}
  }finally{c.dispose();}
 }
 window.__v372LandingSmoke={ok:true};
})()"""
smoke={'id':'production-v372-blue-landing-supply','file':'randomizer/index.html',
 'readyExpression':'Boolean(window.SetiAnalysisPort&&window.SetiDecisionSearch&&window.SetiProductionKernel)',
 'actionExpression':action,'successExpression':'window.__v372LandingSmoke?.ok===true',
 'obligation':'Browser matches Native landing plan, exact tie and task timing with source RNG unchanged',
 'counterexample':'Browser asset cache, Native phase or shared search differs from tested Node path'}
source=(root/'tools/browser-smoke-inventory.js').read_text()
def replace(old,new):
    global source
    assert source.count(old)==1,old
    source=source.replace(old,new)
replace("source=await fetch('/reports/ai-foundation-20261107/analysis-lazy-explanations-v1/amiba-analysis-v311-reference-20261107-v1.js').then(r=>r.text());new Function('module','globalThis','window',source)(undefined,old,old);",
        "source=await fetch('/randomizer/game/ai/amiba-analysis-capital.js').then(r=>r.text()),pattern='let explanations,explanationsReady=false;';if(source.split(pattern).length!==2)throw Error('missing eager control insertion');new Function('module','globalThis','window',source.replace(pattern,'let explanations=candidates.map(materialize),explanationsReady=true;'))(undefined,old,old);")
replace("lazy snapshot/JSON/clone differs from V311","lazy snapshot/JSON/clone differs from the identical current quote with eager materialization")
replace("if(!r.complete||r.actionId!=='play_card:52a456f8'||r.value!==125.58333333333333||proofs.size<9)throw Error('currency tail choice/value differs');",
        """const q=window.SetiAnalysisPort.createAnalysisPort({composition:c,seatId:seat,maxCacheEntries:0});try{const raw=window.SetiDecisionSearch.searchDecision({port:{...q,turnTailSummary(node,kind){const s=q.turnTailSummary(node,kind);return s?.publicAmibaCurrencyTail?null:s;}},root:q.openRoot(),evaluate,movementPlanning:true,cardPickPlanning:true,resourcePlanning:true,finalMarkPlanning:true,scanPlanning:true,modelKey:evaluate.modelKey,budget:{transitions:null,nodes:null,frontier:null,milliseconds:null}});if(!r.complete||!raw.complete||r.actionId!=='play_card:52a456f8'||r.actionId!==raw.actionId||r.value!==raw.value||r.value!==129.08333333333334||proofs.size!==21||r.diagnostics.nativeExecutions!==97||raw.diagnostics.nativeExecutions!==164)throw Error('currency tail versus current Native: '+JSON.stringify({expected:129.08333333333334,proof:r.value,raw:raw.value,proofs:proofs.size,nativeInputs:r.diagnostics.nativeExecutions,controlInputs:raw.diagnostics.nativeExecutions}));}finally{q.close();}""")
assert source==(root/'browser-v367-diagnostic-tools/browser-smoke-inventory.js').read_text() if (root/'browser-v367-diagnostic-tools/browser-smoke-inventory.js').is_file() else True
base=source
(tools/'browser-smoke-inventory.js').write_text(base+'\nmodule.exports=Object.freeze([...module.exports,'+json.dumps(smoke,ensure_ascii=False)+']);\n')
matches=['production-search-agent-entry','production-v372-blue-landing-supply','production-analysis-lazy-explanations',
         'production-amiba-currency-tail-value','production-known-postdraw-tail','production-blue-data-analysis']
args=['node',str(tools/'run_browser_smokes.js')]
for name in matches:args.extend(['--match',name])
raise SystemExit(run(args,cwd=root).returncode)
