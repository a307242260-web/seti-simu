import pathlib,json,hashlib,gzip,subprocess,os
stage=pathlib.Path.cwd();sha=lambda p:hashlib.sha256((stage/p).read_bytes()).hexdigest();read=lambda p:json.loads((stage/p).read_text());prefix='reports/ai-foundation-20261023/'
path=prefix+'search-buffer-corpus-20261029-v3.json';corpus=read(path)
assert corpus['passed']==8 and corpus['failed']==0 and corpus['status']=='complete'
for p,h in corpus['sourceHashes'].items():assert sha(p)==h,p
for row in corpus['rows']:
 assert row['complete'] and row['rootUnchanged'] and row['unresolved']==0 and row['rootAndSearchMilliseconds']<=600
 assert row['diagnostics']['limits']=={'transitions':256,'nodes':257,'frontier':256,'milliseconds':600}
 assert sha(row['fixture'])==row['fixtureSha256'] and sha(row['rawPath'])==row['rawSha256']
 assert row['port']['decodedStateCacheEntries']<=64 and row['port']['decodedStateCacheBytes']<=8*1024*1024
 assert row['diagnostics']['transitions']<=256 and row['diagnostics']['nodes']<=257 and row['diagnostics']['peakFrontier']<=256
assert all(c['sameAction'] and c['sameValue'] for c in corpus['comparison'])
variants=[read('adhoc/search-buffer-variants-20261029-v1.json'),read('adhoc/search-buffer-variants-20261029-v2.json')]
for n in [1,2]:
 r=read(prefix+f'search-buffer-corpus-20261029-v{n}.json')
 for p,h in r['sourceHashes'].items():
  if sha(p)!=h:
   found=[m[p] for m in variants if p in m and m[p]['sourceSha256']==h];assert found,(n,p)
   v=found[0];assert sha(v['path'])==v['archiveSha256'];assert hashlib.sha256(gzip.decompress((stage/v['path']).read_bytes())).hexdigest()==h
control=read(prefix+'search-identity-cache-control-20261029-v1.json');assert control['status']=='passed' and control['sourceSha256']==sha('randomizer/game/ai/analysis-port.js')
logs={}
for name,src in {
 'fullNodeBeforeContractUpdates':'/private/tmp/seti-buffer-full-node-20261029-v1.log',
 'contractUpdates':'/private/tmp/seti-buffer-targeted-fixes-20261029-v1.log',
 'attainmentRecovery':'/private/tmp/seti-buffer-attainment-20261029-v3.log',
 'finalTargeted':'/private/tmp/seti-buffer-final-targeted-20261029-v1.log',
 'identityAndHosts':'/private/tmp/seti-buffer-identity-tests-20261029-v1.log',
 'fullNodeFinal':'/private/tmp/seti-buffer-full-node-final-20261029-v2.log',
 'browserAllAttempt':'/private/tmp/seti-buffer-browser-20261029-v1.log',
 'browserFinal':'/private/tmp/seti-buffer-browser-final-20261029-v3.log',
 'valueAudit':'/private/tmp/seti-buffer-value-audit-final-20261029-v2.log',
}.items():
 data=pathlib.Path(src).read_bytes();p=prefix+'search-buffer-'+name+'-20261029-v1.log';(stage/p).write_bytes(data);logs[name]={'path':p,'sha256':sha(p)}
node=(stage/logs['fullNodeFinal']['path']).read_text();assert 'SUMMARY unit passed=145 failed=0 total=145' in node and 'SUMMARY fullFlow passed=1 failed=0 total=1' in node
assert 'SUMMARY browserSmoke passed=11 failed=0 total=11' in (stage/logs['browserFinal']['path']).read_text()
assert 'aomomo' in (stage/logs['valueAudit']['path']).read_text()
report={'schemaVersion':'seti-ai-search-buffer-validation-v1','scope':'Four search optimizations validated before one full-game baseline attempt. No baseline result is inferred from these decision fixtures.','budget':corpus['budget'],'passed':8,'failed':0,'comparison':corpus['comparison'],'sourceHashes':corpus['sourceHashes'],'validation':{'nodeUnit':145,'fullFlow':1,'relatedBrowser':11,'valueAudit':'Known pre-existing decisionObs aomomo frozen-object failure; independent search V checks pass.','browserAllAttempt':'Legacy production-browser-full-parity CDP Runtime.evaluate timed out after first five checks; all eleven related checks passed on final source.','logs':logs},'baselineStatus':'Not started when this code snapshot was validated; run once only after this version is committed.','checkpoints':[prefix+f'search-buffer-corpus-20261029-v{n}.json' for n in [1,2,3]],'identityControl':prefix+'search-identity-cache-control-20261029-v1.json'}
out=prefix+'search-buffer-final-20261029-v1.json';(stage/out).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
# Reuse the private-index snapshot delivery, with an explicit overlay only.
s=(stage/'adhoc/deliver-search-hotpath-20261029-v1.py').read_text()
for a,b in {
 '/private/tmp/seti-search-hotpath-20261029-aiyf1l73':str(stage),
 'adhoc/search-hotpath-snapshot-20261029.json':'adhoc/search-buffer-snapshot-20261029.json',
 'search-hotpath-snapshot-check-20261029-v1.json':'search-buffer-snapshot-check-20261029-v1.json',
 'SETI_DELIVER_SEARCH_HOTPATH':'SETI_DELIVER_SEARCH_BUFFER',
 'seti-search-hotpath-private-20261029.index':'seti-search-buffer-private-20261029.index',
 'search-hotpath-commit-message-20261029.txt':'search-buffer-commit-message-20261029.txt',
 '复用移动时机计算并减少只读预览与观察复制':'保存搜索固定计划并复用完整状态计算扩大决策余量',
}.items():assert a in s,a;s=s.replace(a,b)
(stage/'adhoc/deliver-search-buffer-20261029-v1.py').write_text(s)
manifest_path='adhoc/search-buffer-snapshot-20261029.json';m=read(manifest_path)
# Compare archive paths instead of shared-index status, which contains unrelated staged deletions.
root=pathlib.Path('/Users/bilibili/code/seti-simu');base_files=set(subprocess.check_output(['git','ls-tree','-r','--name-only',m['baseCommit']],cwd=root,text=True).splitlines())
files=[]
for p in stage.rglob('*'):
 if not p.is_file():continue
 rel=str(p.relative_to(stage))
 if rel==manifest_path:continue
 if rel not in base_files:files.append(rel)
 else:
  before=subprocess.check_output(['git','show',m['baseCommit']+':'+rel],cwd=root) if rel in ['randomizer/index.html'] else None
  # Git diff names are obtained once below; avoid opening every tracked blob.
  if before is not None and before!=p.read_bytes():files.append(rel)
env=dict(os.environ,GIT_DIR=str(root/'.git'),GIT_WORK_TREE=str(stage),GIT_INDEX_FILE='/private/tmp/seti-search-buffer-review-20261029.index',GIT_OPTIONAL_LOCKS='0')
files.extend(subprocess.check_output(['git','diff','--name-only'],cwd=stage,env=env,text=True).splitlines())
files=sorted(set(files));m['files']={p:sha(p) for p in files};m['sourceBoundReports']=[path,out];m['scope']=report['scope'];(stage/manifest_path).write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'files':len(files),'validation':report['validation'],'comparison':report['comparison'][-2:]},ensure_ascii=False))
