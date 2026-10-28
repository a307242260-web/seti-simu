# coding: utf-8
import hashlib,json,pathlib,subprocess,gzip
stage=pathlib.Path.cwd();sha=lambda p:hashlib.sha256((stage/p).read_bytes()).hexdigest()
corpus_path='reports/ai-foundation-20261023/shared-prefix-corpus-20261028-v1.json';micro_path='reports/ai-foundation-20261023/shared-prefix-twenty-goals-20261028-v1.json';single_path='reports/ai-foundation-20261023/shared-prefix-case105-20261028-v1.json'
c=json.loads((stage/corpus_path).read_text());m=json.loads((stage/micro_path).read_text());assert c['status']=='complete' and len(c['rows'])==8
for report in [c,m,json.loads((stage/single_path).read_text())]:
 for p,h in report['sourceHashes'].items():assert sha(p)==h,('runtime source drift',p)
 for row in report['rows']:assert sha(row['rawPath'])==row['rawSha256'] and row['rootUnchanged']
for row in m['rows']:
 d=row['diagnostics'];assert row['complete'] and d['transitions']==d['nativeExecutions']==27 and d['nodes']==28 and d['logicalResourceInputs']==160 and d['sharedResourceInputHits']==133
assert m['rows'][0]['leafObservationHashes']==m['rows'][1]['leafObservationHashes']
for row in c['rows']:
 assert row['independentPreparationEdges']==0
 assert row['diagnostics']['transitions']<=256 and row['diagnostics']['nativeExecutions']<=row['diagnostics']['transitions'] and row['diagnostics']['nodes']<=257
logs={'node':'reports/ai-foundation-20261023/shared-prefix-node-regression-20261028-v1.log','focused':'reports/ai-foundation-20261023/shared-prefix-focused-20261028-v1.log','browser':'reports/ai-foundation-20261023/shared-prefix-browser-20261028-v1.log','valueInputs':'reports/ai-foundation-20261023/shared-prefix-value-audit-20261028-v1.log'}
assert 'SUMMARY unit passed=141 failed=0 total=141' in (stage/logs['node']).read_text();assert 'SUMMARY fullFlow passed=1 failed=0 total=1' in (stage/logs['node']).read_text();assert 'SUMMARY browserSmoke passed=7 failed=0 total=7' in (stage/logs['browser']).read_text()
v=(stage/logs['valueInputs']).read_text();fail=[s for s in v.splitlines() if s.startswith('[FAIL]')];assert len(fail)==1 and 'aomomo' in fail[0];assert '[PASS] independent-shared-resource-prefix' in v
syntax=['randomizer/game/ai/analysis-port.js','randomizer/game/ai/decision-search.js','randomizer/game/ai/shared-resource-prefix.test.js','tools/node-test-inventory.js','tools/browser-smoke-inventory.js','tools/audit_v_state_inputs.js','adhoc/benchmark-shared-prefix-20261028-v1.js','adhoc/audit-shared-prefix-case105-20261028-v1.js','adhoc/audit-shared-prefix-corpus-20261028-v1.js']
for p in syntax:subprocess.run(['node','--check',p],cwd=stage,check=True)
root_tech=[]
for row in c['rows']:
 raw=json.loads(gzip.decompress((stage/row['rawPath']).read_bytes()));root=raw['lines'][0];tech=[e for e in root['edges'] if e.get('resourcePlan',{}).get('goal',{}).get('kind')=='research_tech']
 if tech:root_tech.append({'caseId':row['caseId'],'rootExpanded':root['expanded'],'techGoalsExecuted':len(tech),'logicalPathInputs':sum(e['cost'] for e in tech),'newBudgetedInputs':sum(e['newInputs'] for e in tech)})
report={'schemaVersion':'seti-shared-resource-prefix-delivery-v1','baseCommit':'b7e7cde2eeb8c430de53e8b3cc06e071b7cc0ad5','searchVersion':'seti-complete-decision-search-v34',
 'scope':'Search-local DAG of exact immutable-node/native-input transitions; resource goal paths keep independent choice, protection, full length and values. Shared native edges/internal states are charged once; conservative accounting of other old macros is retained.',
 'globalBudget':{'transitions':256,'nodes':257,'frontier':256,'milliseconds':600},
 'twentyGoals':{'path':micro_path,'sha256':sha(micro_path),'goals':20,'eachPathLength':8,'uniqueBudgetedInputs':27,'actualNativeInputs':27,'states':28,'logicalPathInputs':160,'sharedInputHits':133,'allOriginalPathsAndLeafValuesRetained':True,'allLeafObservationsEqualAcrossCacheModes':True,'rows':[{'legacyCacheEntries':r['cache'],'complete':r['complete'],'milliseconds':r['rootAndSearchMilliseconds']} for r in m['rows']],'timingNote':'Fresh roots in the same sequential Node process; second run benefits from process/JIT warming. These are twenty-goal tests, not the full decision.'},
 'fixedCorpus':{'path':corpus_path,'sha256':sha(corpus_path),'passed':c['passed'],'failed':c['failed'],'case105ReusedCheckpoint':single_path,'rows':[{'caseId':r['caseId'],'complete':r['complete'],'stopReason':r['stopReason'],'milliseconds':r['rootAndSearchMilliseconds'],'budgetedInputs':r['diagnostics']['transitions'],'nativeExecutions':r['diagnostics']['nativeExecutions'],'logicalResourceInputs':r['diagnostics']['logicalResourceInputs'],'reusedResourceInputs':r['diagnostics']['sharedResourceInputHits'],'states':r['diagnostics']['nodes'],'pendingStates':r['unresolved'],'rawPath':r['rawPath'],'rawSha256':r['rawSha256']} for r in c['rows']]},
 'validation':{'nodeUnitPassed':141,'nodeFullFlowPassed':1,'nodeFailed':0,'browserPassed':7,'browserFailed':0,'independentValueInputsPassed':sum(s.startswith('[PASS] independent-') for s in v.splitlines()),'knownLegacyValueFailure':fail,'syntaxChecked':syntax,'logs':{k:{'path':p,'sha256':sha(p)} for k,p in logs.items()}},
 'remaining':['Full case-062/105/152 decisions still stop at the watchdog; twenty-goal completion is not full-decision acceptance.','Global nativeExecutions is reported independently from transitions; non-resource legacy macros may charge conservatively.','Existing information/other-owner boundaries, incomplete advanced goal catalogs and stable-boundary deterministic replan remain.'],
 'rootTechnologyCoverage':root_tech,'wholeGames':0,'wholeGame180sAccepted':False,'sourceHashes':c['sourceHashes']}
output='reports/ai-foundation-20261023/shared-prefix-final-20261028-v1.json';(stage/output).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'report':output,'fixedCorpusPassed':c['passed'],'independentValueInputsPassed':report['validation']['independentValueInputsPassed'],'twentyGoals':report['twentyGoals']['rows']},ensure_ascii=False))
