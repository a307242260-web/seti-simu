import pathlib,json,hashlib,subprocess,os
root=pathlib.Path('/Users/bilibili/code/seti-simu');stage=pathlib.Path.cwd();read=lambda p:json.loads((stage/p).read_text());sha=lambda p:hashlib.sha256((stage/p).read_bytes()).hexdigest();mp='adhoc/unbounded-snapshot-20261029.json';m=read(mp)
corpus_path='reports/ai-foundation-20261023/unbounded-corpus-20261029-v4.json';corpus=read(corpus_path)
assert corpus['passed']==10 and corpus['failed']==0 and all(v is None for v in corpus['budget'].values())
assert all(x['sameAction'] and x['sameValue'] for x in corpus['comparison'][:8])
for p,h in corpus['sourceHashes'].items():assert sha(p)==h,p
for row in corpus['rows']:
 assert row['complete'] and row['rootUnchanged'] and row['unresolved']==0
 assert all(v is None for v in row['diagnostics']['limits'].values())
 assert sha(row['rawPath'])==row['rawSha256'] and sha(row['fixture'])==row['fixtureSha256']
logs={}
for name,src in {'node':'/private/tmp/seti-unbounded-full-node-20261029-v1.log','browser':'/private/tmp/seti-unbounded-browser-20261029-v1.log','valueAudit':'/private/tmp/seti-unbounded-value-audit-20261029-v1.log','paymentBefore':'/private/tmp/seti-unbounded-payment-before-20261029-v1.log'}.items():
 p='reports/ai-foundation-20261023/unbounded-'+name+'-20261029-v1.log';(stage/p).write_bytes(pathlib.Path(src).read_bytes());logs[name]={'path':p,'sha256':sha(p)}
assert 'SUMMARY unit passed=145 failed=0 total=145' in (stage/logs['node']['path']).read_text()
assert 'SUMMARY browserSmoke passed=3 failed=0 total=3' in (stage/logs['browser']['path']).read_text()
report={'schemaVersion':'seti-ai-unbounded-validation-v1','status':'passed','budget':corpus['budget'],'decisionGate':{'passed':10,'failed':0,'rows':corpus['comparison']},'strategy':'same production goal/value policies, v39 adds null budget and corrects same-owner cross-turn expansion','wholeGame':'not started at validation; run to terminal after committing this code snapshot','sourceHashes':corpus['sourceHashes'],'knownValueAuditFailure':'pre-existing decisionObs aomomo frozen-object write; independent search V checks pass','logs':logs}
out='reports/ai-foundation-20261023/unbounded-validation-20261029-v1.json';(stage/out).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
s=(stage/'adhoc/deliver-budget1024-20261029-v1.py').read_text()
for a,b in {'/private/tmp/seti-budget1024-20261029-3oqamvjx':str(stage),'adhoc/budget1024-snapshot-20261029.json':mp,'budget1024-snapshot-check-20261029-v1.json':'unbounded-snapshot-check-20261029-v1.json','SETI_DELIVER_BUDGET1024':'SETI_DELIVER_UNBOUNDED','seti-budget1024-private-20261029.index':'seti-unbounded-private-20261029.index','budget1024-commit-message-20261029.txt':'unbounded-commit-message-20261029.txt','将搜索单局试跑额度调整为1024次和2秒':'取消搜索试跑输入节点前沿和时间硬上限'}.items():assert a in s,a;s=s.replace(a,b)
(stage/'adhoc/deliver-unbounded-20261029-v1.py').write_text(s)
base_files=set(subprocess.check_output(['git','ls-tree','-r','--name-only',m['baseCommit']],cwd=root,text=True).splitlines());files=[]
new_files=[
 'adhoc/finalize-unbounded-validation-20261029-v1.py','adhoc/deliver-unbounded-20261029-v1.py',
 'adhoc/audit-unbounded-corpus-20261029-v4.js','adhoc/observe-unbounded-baseline-20261029-v1.cjs','adhoc/finalize-unbounded-baseline-20261029-v1.js',
 'adhoc/unbounded-payment-failure-20261029-v1.json','docs/ai-search-unbounded-20261029.md',
 'reports/ai-foundation-20261023/unbounded-corpus-20261029-v4.json','reports/ai-foundation-20261023/unbounded-validation-20261029-v1.json',
 'reports/ai-foundation-20261023/unbounded-node-20261029-v1.log','reports/ai-foundation-20261023/unbounded-browser-20261029-v1.log',
 'reports/ai-foundation-20261023/unbounded-valueAudit-20261029-v1.log','reports/ai-foundation-20261023/unbounded-paymentBefore-20261029-v1.log',
]
files.extend(new_files)
files.extend(row['rawPath'] for row in corpus['rows'])
env=dict(os.environ,GIT_DIR=str(root/'.git'),GIT_WORK_TREE=str(stage),GIT_INDEX_FILE='/private/tmp/seti-unbounded-review-20261029.index',GIT_OPTIONAL_LOCKS='0');files.extend(subprocess.check_output(['git','diff','--name-only'],cwd=stage,env=env,text=True).splitlines());files=sorted(set(files));m['files']={p:sha(p) for p in files};m['sourceBoundReports']=[corpus_path,out];m['scope']='Explicit null budgets remove all four global caps and the full-game 4000-step stop for this search mode. Validate ten cold roots, keep other policy options unchanged, then run to native terminal.';(stage/mp).write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'files':len(files),'gatePassed':10,'previousFailureInputs':corpus['rows'][-1]['diagnostics']['transitions'],'previousFailureMs':corpus['rows'][-1]['rootAndSearchMilliseconds']}))
