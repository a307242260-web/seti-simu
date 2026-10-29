"""Bind validation artifacts to the exact isolated source snapshot."""
import ast
import hashlib
import json
import os
import re
import shutil
import subprocess
from pathlib import Path

root=Path('/Users/bilibili/code/seti-simu');stage=Path.cwd();prefix='reports/ai-foundation-20261023/reorg-greedy-'
read=lambda p:json.loads(Path(p).read_text())
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
logs={
 'before':'/private/tmp/seti-reorg-before-20261029-v1.log',
 'focused':'/private/tmp/seti-reorg-final-focused-20261029-v1.log',
 'node':'/private/tmp/seti-reorg-full-node-20261029-v1.log',
 'browserSandboxDenied':'/private/tmp/seti-reorg-browser-20261029-v1.log',
 'browser':'/private/tmp/seti-reorg-browser-20261029-v2.log',
 'valueAudit':'/private/tmp/seti-reorg-value-audit-20261029-v1.log',
 'corpus':'/private/tmp/seti-reorg-corpus-20261029-v1.log',
}
node=Path(logs['node']).read_text();assert re.search(r'SUMMARY unit passed=145 failed=0 total=145',node),node[-2000:]
assert re.search(r'SUMMARY fullFlow passed=1 failed=0 total=1',node),node[-2000:]
assert 'SUMMARY browserSmoke passed=3 failed=0 total=3' in Path(logs['browser']).read_text()
assert 'plans.reorganization is not a function' in Path(logs['before']).read_text()
assert 'localFinalMarkAndScan' in Path(logs['focused']).read_text()
assert '[FAIL] decisionObs' in Path(logs['valueAudit']).read_text()
benchmark=read(prefix+'step295-20261029-v1.json');corpus=read(prefix+'corpus-20261029-v1.json')
assert benchmark['diagnostics']['nativeExecutions']==193 and benchmark['sameAction'] and benchmark['sameValue'] and benchmark['rootAndRngUnchanged']
assert corpus['passed']==10 and corpus['failed']==0
assert all(r['sameAction'] and r['sameValue'] for r in corpus['comparison'])
for report in [benchmark,corpus]:
 for path,h in report['sourceHashes'].items():assert sha(path)==h,path
for kind,source in logs.items():
 path=prefix+kind+'-20261029-v1.log';shutil.copyfile(source,path);logs[kind]=path
runtimeFiles=['randomizer/game/ai/local-decision-plans.js','randomizer/game/ai/analysis-port.js','randomizer/game/ai/decision-search.js','randomizer/index.html','randomizer/game/ai/local-decision-plans.test.js']
validation={'schemaVersion':'seti-reorg-greedy-validation-v1','searchVersion':benchmark['searchVersion'],'isolatedSnapshot':str(stage),'sourceHashes':{p:sha(p)for p in runtimeFiles},'behavior':{'beforeTestFailed':True,'nativePositiveRewardChain':True,'zeroAndNegativeStop':True,'pendingRewardsConsumeCapacity':True,'coldRestoreSuffixMatches':True,'canonicalRootAndRngUnchanged':True,'hiddenDrawIdentityIndependent':True,'finiteBudgetInterruption':True},'fullNode':{'unitPassed':145,'unitFailed':0,'fullFlowPassed':1,'fullFlowFailed':0},'browserSmoke':{'passed':3,'failed':0,'sandboxAttempt':'EPERM listening localhost; rerun outside sandbox succeeded'},'valueAudit':{'status':'known-preexisting-failure','message':'decisionObs Cannot add property aomomo, object is not extensible; independent search value checks passed'},'coldCorpus':{'passed':10,'sameActionsAndValues':True},'step295':{'beforeInputs':1095,'afterInputs':193,'beforeCountedStates':698,'afterCountedStates':196,'afterMs':benchmark['rootAndSearchMilliseconds'],'sameAction':True,'sameValue':True},'fullGameRun':False,'logs':logs}
validationPath=prefix+'validation-20261029-v1.json';Path(validationPath).write_text(json.dumps(validation,indent=2)+'\n')
files=runtimeFiles+['docs/ai-design.md','docs/ai-search-agent-contract-20261023.md','docs/ai-reorg-greedy-20261029.md','adhoc/ai-decision-corpus-20261029-reorg-v1/step295-20261029-v1.json','adhoc/capture-reorg-step295-20261029-v1.js','adhoc/benchmark-reorg-step295-20261029-v1.js','adhoc/audit-reorg-greedy-corpus-20261029-v1.js','adhoc/finalize-reorg-greedy-20261029-v1.py','adhoc/deliver-reorg-greedy-20261029-v1.py']
files.extend(str(p)for p in Path('reports/ai-foundation-20261023').glob('reorg-greedy-*20261029-v1*'))
files.extend(r['rawPath']for r in corpus['rows'])
assert len(set(files))==len(files)
context=read('adhoc/reorg-greedy-delivery-context-20261029.json')
manifest={'baseCommit':context['baseCommit'],'snapshot':str(stage),'sharedIndexSha256Before':context['sharedIndexSha256'],'sharedIndexEntriesSha256Before':hashlib.sha256(subprocess.check_output(['git','ls-files','--stage','-z'],cwd=root,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0'))).hexdigest(),'sourceBoundReports':[prefix+'step295-20261029-v1.json',prefix+'corpus-20261029-v1.json'],'files':{p:sha(p)for p in files},'validation':validationPath}
assert sha(root/'.git/index')==context['sharedIndexSha256']
Path('adhoc/reorg-greedy-snapshot-20261029.json').write_text(json.dumps(manifest,indent=2)+'\n')
for p in ['adhoc/deliver-reorg-greedy-20261029-v1.py','adhoc/finalize-reorg-greedy-20261029-v1.py']:ast.parse(Path(p).read_text())
print(json.dumps({'files':len(files),'validation':validationPath,'step295Inputs':193,'fullNode':'145+1','browser':3}))
