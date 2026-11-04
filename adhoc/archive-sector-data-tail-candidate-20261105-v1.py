import pathlib,json,hashlib,subprocess
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='ba59a814e8bd829c8ee1a71a56ce1a6a9edffccf';folder='reports/ai-foundation-20261104/two-rounds-teacher-v2/';out=stage/'reports/ai-foundation-20261104/candidate-v185-sector-data-tail-20261105-v1'
assert not out.exists()
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
source=['randomizer/game/ai/state-value.js','randomizer/game/ai/sector-card-capital.test.js','randomizer/game/ai/decision-search.js','adhoc/benchmark-human405-decision-20261105-v8.js','adhoc/benchmark-human405-current-first2-20261105-v9.js','adhoc/witness-v185-round2-purpose-realization-20261105-v1.js']
gate=json.loads((stage/(folder+'v185-current-teacher-serial-gate-20261105-v1.json')).read_text());assert gate['status']=='complete' and len(gate['rows'])==225 and gate['uniqueRoots']==189 and not gate['overruns'] and gate['maxInputs']<=256 and gate['maxMilliseconds']<=600
full=(stage/(folder+'v185-node-full-20261105-v1.log')).read_text();assert 'SUMMARY unit passed=170 failed=0 total=170' in full and 'SUMMARY fullFlow passed=1 failed=0 total=1' in full
assert 'actual: 0.4166666666666667' in (stage/(folder+'v185-data-tail-regression-before-20261105-v1.log')).read_text()
assert '"nativeInputs":13' in (stage/(folder+'v185-data-tail-regression-after-20261105-v1.log')).read_text()
witness=json.loads((stage/(folder+'v185-round2-purpose-realization-native-20261105-v1.json')).read_text());assert witness['status']=='complete' and witness['nativeInputs']==21 and witness['rootAndRngRestored']
assert [r['endpoint']['score'] for r in witness['rows']]==[25,29,30,34]
assert len({r['endpoint']['value']['total'] for r in witness['rows']})==1
loaded={}
for row in gate['rows']:
 e=json.loads((stage/row['evidence']).read_text());assert e['baseCommit']=='c4098165e3d5a1be83c4d31fb82257a98942c4c6' and e['complete'] and e['rootAndRngUnchanged'];assert sha(stage/e['rawPath'])==e['rawSha256']
 for p,h in e['sourceHashes'].items():assert sha(stage/p)==h,p;assert p not in loaded or loaded[p]==h;loaded[p]=h
for p in source:
 dest=out/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes((stage/p).read_bytes())
for p,h in loaded.items():
 b=(out/p).read_bytes() if p in source else subprocess.check_output(['git','show',base+':'+p],cwd=root);assert hashlib.sha256(b).hexdigest()==h,p
manifest={'baseCommit':base,'measurementChildDeclaredBaseCommit':'c4098165e3d5a1be83c4d31fb82257a98942c4c6','measurementDriver':'adhoc/benchmark-human405-current-first2-20261105-v9.js','measurementChild':'adhoc/benchmark-human405-decision-20261105-v8.js','metadataNote':'Driver used unchanged childv8 with stale c409 base label. Original reports retained; all loaded modules verified against actual ba59 base plus these overlays. No resampling.','searchVersion':gate['searchVersion'],'valueModel':gate['valueModel'],'overlayFiles':{p:sha(stage/p) for p in source},'allLoadedRuntimeHashes':loaded,'coldGate':folder+'v185-current-teacher-serial-gate-20261105-v1.json','coldNamedCases':225,'uniqueColdRoots':189,'maxNativeInputs':gate['maxInputs'],'maxMilliseconds':gate['maxMilliseconds'],'fullUnitPassed':170,'fullFlowPassed':1,'nativeRegressionInputs':13,'controlledWitnessInputs':21,'controlledScores':[25,29,30,34],'nativeControlsAreNotAutonomousResults':True,'inputAuditLegacyFailureUnchanged':True,'currentIndependentAuditPasses':45,'admitted':False,'officialRuns':0,'scope':'One data-tail after-capital fix; no search ranking, equivalence, candidates, pruning or budget changes. Actual root91 remains PASS on scalar ties. Production remainsV184/V18; autonomous15/25 not overwritten; V41baseline preserved.','goalStatus':'active','goalAchieved':False};(out/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'candidate':str(out.relative_to(stage)),'overlayFiles':len(source),'sourceModules':len(loaded),'admitted':False}))
