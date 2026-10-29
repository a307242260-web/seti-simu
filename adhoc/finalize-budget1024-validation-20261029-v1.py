import pathlib,json,hashlib,subprocess,os
root=pathlib.Path('/Users/bilibili/code/seti-simu');stage=pathlib.Path.cwd();read=lambda p:json.loads((stage/p).read_text());sha=lambda p:hashlib.sha256((stage/p).read_bytes()).hexdigest();mp='adhoc/budget1024-snapshot-20261029.json';m=read(mp)
corpus_path='reports/ai-foundation-20261023/budget1024-corpus-20261029-v1.json';corpus=read(corpus_path)
assert corpus['passed']==9 and corpus['failed']==0
assert corpus['budget']=={'transitions':1024,'nodes':1025,'frontier':1024,'milliseconds':2000}
assert all(x['sameAction'] and x['sameValue'] for x in corpus['comparison'][:8])
for p,h in corpus['sourceHashes'].items():assert sha(p)==h,p
for row in corpus['rows']:
 assert row['complete'] and row['rootUnchanged'] and row['unresolved']==0 and row['rootAndSearchMilliseconds']<=2000
 assert sha(row['rawPath'])==row['rawSha256'] and sha(row['fixture'])==row['fixtureSha256']
logs={}
for name,src in {'node':'/private/tmp/seti-budget1024-node-20261029-v1.log','browser':'/private/tmp/seti-budget1024-browser-20261029-v1.log'}.items():
 p='reports/ai-foundation-20261023/budget1024-'+name+'-20261029-v1.log';(stage/p).write_bytes(pathlib.Path(src).read_bytes());logs[name]={'path':p,'sha256':sha(p)}
assert 'SUMMARY unit passed=3 failed=0 total=3' in (stage/logs['node']['path']).read_text()
assert 'SUMMARY browserSmoke passed=3 failed=0 total=3' in (stage/logs['browser']['path']).read_text()
report={'schemaVersion':'seti-ai-budget1024-validation-v1','status':'passed','budget':corpus['budget'],'decisionGate':{'passed':9,'failed':0,'rows':corpus['comparison']},'strategy':'unchanged v38','wholeGame':'not started at code validation; run one registered full attempt after committing this exact version','sourceHashes':corpus['sourceHashes'],'logs':logs}
out='reports/ai-foundation-20261023/budget1024-validation-20261029-v1.json';(stage/out).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
s=(stage/'adhoc/deliver-search-buffer-20261029-v1.py').read_text()
for a,b in {'/private/tmp/seti-search-buffer-20261029-xjyrfvsf':str(stage),'adhoc/search-buffer-snapshot-20261029.json':mp,'search-buffer-snapshot-check-20261029-v1.json':'budget1024-snapshot-check-20261029-v1.json','SETI_DELIVER_SEARCH_BUFFER':'SETI_DELIVER_BUDGET1024','seti-search-buffer-private-20261029.index':'seti-budget1024-private-20261029.index','search-buffer-commit-message-20261029.txt':'budget1024-commit-message-20261029.txt','保存搜索固定计划并复用完整状态计算扩大决策余量':'将搜索单局试跑额度调整为1024次和2秒'}.items():assert a in s,a;s=s.replace(a,b)
(stage/'adhoc/deliver-budget1024-20261029-v1.py').write_text(s)
base_files=set(subprocess.check_output(['git','ls-tree','-r','--name-only',m['baseCommit']],cwd=root,text=True).splitlines());files=[]
for p in stage.rglob('*'):
 if not p.is_file():continue
 rel=str(p.relative_to(stage))
 if rel==mp or '.bak-' in rel or '-commit-message-' in rel:continue
 if rel not in base_files:files.append(rel)
env=dict(os.environ,GIT_DIR=str(root/'.git'),GIT_WORK_TREE=str(stage),GIT_INDEX_FILE='/private/tmp/seti-budget1024-review-20261029.index',GIT_OPTIONAL_LOCKS='0');files.extend(subprocess.check_output(['git','diff','--name-only'],cwd=stage,env=env,text=True).splitlines());files=sorted(set(files));m['files']={p:sha(p) for p in files};m['sourceBoundReports']=[corpus_path,out];m['scope']='Only authorize 1024/1025/1024/2000ms search budget, keep v38 strategy unchanged, validate nine cold checkpoints before one full attempt.';(stage/mp).write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'files':len(files),'gatePassed':9,'previousFailureInputs':corpus['rows'][-1]['diagnostics']['transitions'],'previousFailureMs':corpus['rows'][-1]['rootAndSearchMilliseconds']},ensure_ascii=False))
