# coding: utf-8
"""Finalize already-recorded v37 evidence; no reruns or whole games."""
import collections,gzip,hashlib,json,pathlib,subprocess
stage=pathlib.Path.cwd();sha=lambda p:hashlib.sha256((stage/p).read_bytes()).hexdigest();prefix='reports/ai-foundation-20261023/'
corpus_path=prefix+'six-greedy-plans-corpus-20261028-v1.json';single_path=prefix+'six-greedy-plans-case062-20261028-v1.json'
corpus=json.loads((stage/corpus_path).read_text());single=json.loads((stage/single_path).read_text())
for report in [corpus,single]:
 for p,h in report['sourceHashes'].items():assert sha(p)==h,('source drift',p)
 for row in report['rows']:assert row['rootUnchanged'] and sha(row['rawPath'])==row['rawSha256'] and sha(row['fixture'])==row['fixtureSha256']
assert corpus['status']=='complete' and len(corpus['rows'])==8
reused=dict(next(r for r in corpus['rows'] if r['caseId']=='case-062'));assert reused.pop('reusedCheckpoint')==single_path and reused==single['rows'][0]
fixtures_path='adhoc/six-greedy-plan-fixtures-20261028-v1.json';captured=json.loads((stage/fixtures_path).read_text())
for f in captured['cases'].values():assert sha(f['source']['rawPath'])==f['source']['rawSha256']
rows=[]
for row in corpus['rows']:
 d=row['diagnostics'];assert d['limits']=={'transitions':256,'nodes':257,'frontier':256,'milliseconds':600}
 assert d['transitions']<=256 and d['nodes']<=257 and d['peakFrontier']<=256 and d['postMainBorrowMacros']==0
 raw=json.loads(gzip.decompress((stage/row['rawPath']).read_bytes()));acts=raw['diagnosticActions'];graph=raw['sharedPrefixGraph'];assert len(graph['edges'])==d['nativeExecutions']
 counts=collections.Counter()
 for edge in graph['edges']:
  a=acts[edge['actionId']];assert (a.get('target')or{}).get('abilityId')!='turing_borrow_tech';counts[a['family']]+=1
 for line in raw['lines']:
  fixed_count_ok=line['alternatives']==1 or line['alternatives']==0 and line['completion']=='proof-pruned' and not line['edges']
  policy=line.get('decisionPolicy',{})
  if policy.get('kind') in ['fixed-paid-repeat','fixed-pass-discard','fixed-positive-optional']:assert fixed_count_ok
  if line.get('movementPolicy',{}).get('forceExecution'):assert fixed_count_ok
  if line.get('resourcePolicy',{}).get('incomeTail',{}).get('selected') and not line.get('movementPolicy',{}).get('forceExecution') and line['status']=='stable':assert fixed_count_ok
  if policy.get('kind')=='greedy-blue-slots':
   kept=[acts[id] for id in policy['retainedActionIds']];assert len(kept)==len(set(a['target']['tileId'] for a in kept))
 if not row['complete']:assert row['actionId'] is None and row['value'] is None
 root=raw['lines'][0];tech=[e['resourcePlan']['goal'] for e in root['edges'] if e.get('resourcePlan',{}).get('goal',{}).get('kind')=='research_tech'];paid=[e['resourcePlan']['goal'] for e in root['edges'] if e.get('resourcePlan',{}).get('goal',{}).get('paidRewardPolicy')]
 if row['caseId']=='case-105':assert len(tech)==11 and len(paid)==1 and paid[0]['paidRewardBudget']==4
 rows.append({'caseId':row['caseId'],'complete':row['complete'],'stopReason':row['stopReason'],'milliseconds':row['rootAndSearchMilliseconds'],'nativeInputs':d['nativeExecutions'],'states':d['nodes'],'searchGraphNodes':d['graphNodes'],'macroInternalStates':d['certificateNodes'],'branchingStatesIncludingUnexpanded':d['branchingStates'],'rootAlternatives':root['alternatives'],'pendingStates':row['unresolved'],'inputFamilies':dict(counts),'rawPath':row['rawPath'],'rawSha256':row['rawSha256']})
logs={'node':prefix+'six-greedy-plans-node-regression-20261028-v1.log','focused':prefix+'six-greedy-plans-focused-20261028-v4.log','browser':prefix+'six-greedy-plans-browser-20261028-v1.log','value':prefix+'six-greedy-plans-value-audit-20261028-v2.log'}
assert 'SUMMARY unit passed=144 failed=0 total=144' in (stage/logs['node']).read_text();assert 'SUMMARY fullFlow passed=1 failed=0 total=1' in (stage/logs['node']).read_text()
assert 'SUMMARY unit passed=8 failed=0 total=8' in (stage/logs['focused']).read_text();assert '"stages":6,"globalBudgetPreserved":true' in (stage/logs['focused']).read_text()
assert 'SUMMARY browserSmoke passed=10 failed=0 total=10' in (stage/logs['browser']).read_text()
v=(stage/logs['value']).read_text();fail=[s for s in v.splitlines() if s.startswith('[FAIL]')];assert len(fail)==1 and 'aomomo' in fail[0];independent=sum(s.startswith('[PASS] independent-') for s in v.splitlines());assert independent==38
syntax=['randomizer/game/ai/analysis-port.js','randomizer/game/ai/decision-search.js','randomizer/game/ai/resource-demand.js','randomizer/game/ai/local-decision-plans.js','randomizer/game/ai/six-greedy-plans.test.js','randomizer/game/ai/shared-resource-prefix.test.js','randomizer/game/effects/residual-domain-session.js','tools/node-test-inventory.js','tools/browser-smoke-inventory.js','tools/audit_v_state_inputs.js','adhoc/capture-six-greedy-plan-fixtures-20261028-v1.js','adhoc/audit-six-greedy-plans-case062-20261028-v1.js','adhoc/audit-six-greedy-plans-corpus-20261028-v1.js']
for p in syntax:subprocess.run(['node','--check',p],check=True)
report={'schemaVersion':'seti-six-greedy-plans-delivery-v1','baseCommit':'8fe2875343ee99207047f00fecbf34b3eaa52799','searchVersion':'seti-complete-decision-search-v37','scope':['one positive-marginal paid-repeat budget and fixed native payments','execute chosen advance-before-rotation prefix','local post-main income net-value choice becomes fixed tail','greedy PASS hand-limit combination','one blue board slot per technology kind','greedy nonnegative resource-only trigger confirmation'],'policyIsEquivalence':False,'budget':corpus['budget'],'passed':corpus['passed'],'failed':corpus['failed'],'rows':rows,'checkpoints':[{'path':p,'sha256':sha(p)} for p in [corpus_path,single_path]],'capturedNativeFixtures':{'path':fixtures_path,'sha256':sha(fixtures_path)},'validation':{'nodeUnitPassed':144,'nodeFullFlowPassed':1,'focusedPassed':8,'browserPassed':10,'independentValueInputsPassed':independent,'knownLegacyValueFailure':fail,'syntaxChecked':syntax,'logs':{k:{'path':p,'sha256':sha(p)} for k,p in logs.items()}},'remaining':['Case-105/152 still hit the unchanged 600ms watchdog; pending-state reduction does not imply acceptance.','Fixed native execution and observation generation still incur time; all fixed input costs remain charged.','Greedy policies can sacrifice future value; advanced unsupported reward bodies remain ordinary choices.'],'countingNote':'Single sequential timed checkpoints, not matched full-game samples. Native inputs include fixed clicks; branching-state counts include allocated but unexpanded states. No universal speed or strength ratio is claimed.','wholeGames':0,'wholeGame180sAccepted':False,'sourceHashes':corpus['sourceHashes']}
out=prefix+'six-greedy-plans-final-20261028-v1.json';(stage/out).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'report':out,'passed':report['passed'],'failed':report['failed'],'rows':rows},ensure_ascii=False))
