# coding: utf-8
import hashlib,json,pathlib,re,subprocess
stage=pathlib.Path.cwd()
sha=lambda p:hashlib.sha256((stage/p).read_bytes()).hexdigest()
corpus_path='reports/ai-foundation-20261023/resource-demand-corpus-20261027-v1.json'
c=json.loads((stage/corpus_path).read_text());assert c['status']=='complete' and len(c['rows'])==8
for p,h in c['sourceHashes'].items():assert sha(p)==h,('source drift',p)
for row in c['rows']:assert row['independentPreparationEdges']==0 and sha(row['rawPath'])==row['rawSha256'] and row['rootUnchanged']
logs={
 'fullNode':'reports/ai-foundation-20261023/resource-demand-node-regression-20261027-v2.log',
 'finalFocusedNode':'reports/ai-foundation-20261023/resource-demand-focused-20261027-v2.log',
 'chrome':'reports/ai-foundation-20261023/resource-demand-browser-20261027-v4.log',
 'valueInputs':'reports/ai-foundation-20261023/resource-demand-value-audit-20261027-v3.log',
 'knownLegacyChromeTimeout':'reports/ai-foundation-20261023/resource-demand-browser-20261027-v2.log'}
assert 'SUMMARY unit passed=140 failed=0 total=140' in (stage/logs['fullNode']).read_text()
assert 'SUMMARY fullFlow passed=1 failed=0 total=1' in (stage/logs['fullNode']).read_text()
assert 'SUMMARY unit passed=4 failed=0 total=4' in (stage/logs['finalFocusedNode']).read_text()
assert 'SUMMARY browserSmoke passed=6 failed=0 total=6' in (stage/logs['chrome']).read_text()
v=(stage/logs['valueInputs']).read_text();fails=[s for s in v.splitlines() if s.startswith('[FAIL]')];assert len(fails)==1 and 'aomomo' in fails[0]
assert '[PASS] independent-resource-goal-preparation' in v
checks=['randomizer/game/production-kernel.js','randomizer/game/ai/resource-demand.js','randomizer/game/ai/resource-demand.test.js','randomizer/game/ai/analysis-port.js','randomizer/game/ai/decision-search.js','randomizer/game/ai/search-agent.js','randomizer/game/ai/search-agent.test.js','randomizer/game/ai/post-main-attainment.test.js','tools/audit_v_state_inputs.js','tools/browser-smoke-inventory.js','tools/node-test-inventory.js','adhoc/audit-resource-demand-final-20261027-v1.js']
for p in checks:subprocess.run(['node','--check',p],cwd=stage,check=True)
pending=[]
for row in c['rows']:
 if row['complete']:continue
 import gzip
 r=json.loads(gzip.decompress((stage/row['rawPath']).read_bytes()))
 pending.append({'caseId':row['caseId'],'graphStates':row['diagnostics']['graphNodes'],'internalStates':row['diagnostics']['certificateNodes'],
  'unresolvedStates':len(r['unresolved']),'unresolvedStatesByStatus':{s:sum(r['lines'][u['node']]['status']==s for u in r['unresolved']) for s in ['stable','decision']},
  'pendingGoalAlternatives':sum(len(u.get('resourceGoals',[])) for u in r['unresolved']),
  'note':'Pending first input entries may be preparation actions owned by a resource goal. They are not independent preparation choices; count states and goal alternatives separately.'})
report={'schemaVersion':'seti-resource-demand-delivery-v1','baseCommit':'8638c71d74cd914f319c9e244a2a83108bd45f53',
 'scope':'ordinary resource exchange/corners/data become purpose-bound greedy native plans, with explicit target-bounded fallback only when greedy preparation cannot preserve the goal or effects observe identities',
 'changes':{'searchVersion':'seti-complete-decision-search-v33','independentPreparationEdgesInFixedCorpus':0,'globalBudgetUnchanged':True,'resourceIntermediatePrefixCertificates':False,'atomicPreparationStableBoundary':'deterministic replan; no persisted long-lived goal'},
 'fixedCorpus':{'path':corpus_path,'sha256':sha(corpus_path),'passed':c['passed'],'failed':c['failed'],'wholeGames':0,'wholeGame180sAccepted':False,
 'rows':[{k:row.get(k) for k in ['caseId','complete','stopReason','rootAndSearchMilliseconds','unresolved','independentPreparationEdges','rawPath','rawSha256']}|{'inputs':row['diagnostics']['transitions']} for row in c['rows']], 'pending':pending},
 'validation':{'fullNode':{'unitPassed':140,'fullFlowPassed':1,'failed':0},'finalFocusedNode':{'passed':4,'failed':0},'chrome':{'passed':6,'failed':0},'syntaxChecked':checks,
 'independentValueInputsPassed':sum(s.startswith('[PASS] independent-') for s in v.splitlines()),'knownLegacyValueFailure':fails,
 'knownLegacyChromeFailure':'production-browser-full-parity: Runtime.evaluate timeout; separate from six passing shared-search/startup/completion checks',
 'logs':{k:{'path':p,'sha256':sha(p)} for k,p in logs.items()}},
 'remaining':['case-062/105/152 remain incomplete under unchanged 256-input/600ms diagnostic budget; no final scores or full-game timing claimed',
 'advanced company-specific/card-internal resource needs and alien special corners do not yet have exhaustive goal catalogs',
 'existing information and other-owner search boundaries remain; stable boundaries replan rather than persist the resource target'],
 'sourceHashes':c['sourceHashes']}
output='reports/ai-foundation-20261023/resource-demand-final-20261027-v1.json';(stage/output).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'report':output,'fixedPassed':c['passed'],'valueInputsPassed':report['validation']['independentValueInputsPassed'],'pending':pending},ensure_ascii=False))
