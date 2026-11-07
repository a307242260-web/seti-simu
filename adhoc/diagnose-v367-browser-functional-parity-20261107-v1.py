from pathlib import Path
from shutil import copyfile
from subprocess import run
import sys
root=Path(__file__).resolve().parents[1]
staging=root/'browser-v367-diagnostic-tools'
staging.mkdir(exist_ok=True)
copyfile(root/'tools/run_browser_smokes.js',staging/'run_browser_smokes.js')
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
(staging/'browser-smoke-inventory.js').write_text(source)
args=['node',str(staging/'run_browser_smokes.js')]
for case in ['production-analysis-lazy-explanations','production-amiba-currency-tail-value','production-known-postdraw-tail','production-blue-data-analysis']:
    args.extend(['--match',case])
sys.exit(run(args,cwd=root).returncode)
