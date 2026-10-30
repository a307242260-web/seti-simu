"""Publish reproducible rejected-candidate evidence, never its runtime overlay."""
import gzip,hashlib,json,os,pathlib,subprocess
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu')
base='1cd44bde189c9ce26f976bc4c9dd08391ecbde86'
report_path='reports/ai-foundation-20261023/human405-v103-mission-preflight-20261031-v1.json'
report=json.loads((stage/report_path).read_text())
def git(*args,data=None,env=None):return subprocess.check_output(['git',*args],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def digest(data):return hashlib.sha256(data).hexdigest()
def sha(p):return digest(pathlib.Path(p).read_bytes())
assert git('rev-parse','HEAD').decode().strip()==base
assert git('symbolic-ref','--short','HEAD').decode().strip()=='dev'
index_hash=sha(root/'.git/index');entries_hash=digest(git('ls-files','--stage','-z'))
assert index_hash=='fc85f92edd341768801c684278718c809b0da7092d9c1eba78bf6fd978304e49'
assert entries_hash=='9e3d88268694038e1c8b530e6f372baae5a0157d269d9e4e7916841980040c30'
assert report['candidateAdmitted'] is False and report['gatePassed'] is False and len(report['overruns'])==3
assert sha(stage/report['codeArchive'])==report['codeArchiveSha256']
archive=json.loads(gzip.decompress((stage/report['codeArchive']).read_bytes()));assert archive['baseCommit']==base
files=set(report['sourceBoundReports'])|{report_path,report['codeArchive'],report['teacherAudit'],report['compatAudit']}
source_cache={}
for p in report['sourceBoundReports']:
 r=json.loads((stage/p).read_text())
 for source,h in r['sourceHashes'].items():
  if source not in source_cache:source_cache[source]=archive['files'][source].encode() if source in archive['files'] else git('show',base+':'+source)
  assert digest(source_cache[source])==h,(p,source)
 if r.get('rawPath'):assert sha(stage/r['rawPath'])==r['rawSha256'];files.add(r['rawPath'])
files.update(v['path'] for v in report['validation']['logs'].values())
for v in report['validation']['logs'].values():assert sha(stage/v['path'])==v['sha256']
files.update(['adhoc/checkpoint-human405-mission-preflight-20261031-v1.py',
 'adhoc/restore-human405-mission-preflight-20261031-v1.py',str(pathlib.Path(__file__).relative_to(stage)),
 'adhoc/audit-human405-mission-cold-case-20261031-v1.js','adhoc/audit-human405-mission-compat-20261031-v1.js',
 'adhoc/verify-human405-v103-blue2-future-landing-20261031-v1.js',
 'adhoc/human405-round1-progress-20261031-v28.json','docs/human405-round1-v103-mission-preflight-20261031.md',
 'reports/ai-foundation-20261023/human405-v103-blue2-native-future-landing-20261031-v1.log',
 'reports/ai-foundation-20261023/human405-v103-archive-restore-check-20261031-v1.json'])
assert not set(archive['files'])&files,'Never activate the unadmitted runtime or tests'
restore=json.loads((stage/'reports/ai-foundation-20261023/human405-v103-archive-restore-check-20261031-v1.json').read_text())
assert restore['sourceBoundReportsVerified']==46 and restore['newSearches']==0
for p in files:
 if (root/p).exists():assert (root/p).read_bytes()==(stage/p).read_bytes(),('overlapping root artifact',p)
manifest_path='adhoc/human405-v103-preflight-delivery-manifest-20261031-v1.json'
manifest={'baseCommit':base,'candidateAdmitted':False,'productionRuntimeUnchanged':True,'privateIndexRequired':True,
 'sharedIndexSha256Before':index_hash,'sharedIndexEntriesSha256Before':entries_hash,'files':{p:sha(stage/p) for p in sorted(files)},
 'sourceBinding':{'codeArchive':report['codeArchive'],'sha256':report['codeArchiveSha256'],'baseCommit':base,'sourceBoundReports':46},
 'validation':report['validation'],'coldGatePassed':False,'overruns':report['overruns'],'goalStatus':'active'}
(stage/manifest_path).write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');files.add(manifest_path)
if os.environ.get('SETI_DELIVER_MISSION_PREFLIGHT')!='1':
 print(json.dumps({'phase':'preflight','files':len(files),'sourceBoundReportsVerified':46,'runtimeFilesActivated':0,'indexUnchanged':sha(root/'.git/index')==index_hash}));raise SystemExit(0)
assert git('ls-remote','origin','refs/heads/dev').decode().split()[0]==base
private=pathlib.Path('/private/tmp/seti-human405-v103-preflight-delivery-20261031.index');assert not private.exists()
env={'GIT_INDEX_FILE':str(private)};git('read-tree',base,env=env)
for p in sorted(files):
 data=(stage/p).read_bytes();destination=root/p
 if destination.exists():assert destination.read_bytes()==data
 destination.parent.mkdir(parents=True,exist_ok=True);destination.write_bytes(data)
 blob=git('hash-object','-w','--stdin',data=data,env=env).decode().strip();git('update-index','--add','--cacheinfo','100644',blob,p,env=env)
listed=set(git('diff','--cached','--name-only',base,env=env).decode().splitlines());assert listed==files
assert sha(root/'.git/index')==index_hash
message=stage/'adhoc/human405-v103-preflight-commit-message-20261031.txt';message.write_text('归档探测任务估值候选与首轮节点证据，保留未通过的性能门槛\n')
git('commit','--file',str(message),env=env)
commit=git('rev-parse','HEAD').decode().strip();assert set(git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines())==files
print(git('show','--name-only','--stat','--format=short','HEAD').decode())
# Every production file touched by the candidate remains at its original Git
# blob (and the two new candidate modules remain absent from production).
for p in archive['files']:
 assert git('ls-tree',commit,'--',p)==git('ls-tree',base,'--',p),p
assert sha(root/'.git/index')==index_hash
subprocess.run(['git','-c','http.version=HTTP/1.1','-c','http.postBuffer=157286400','push','origin',commit+':refs/heads/dev'],cwd=root,check=True,timeout=50,env=dict(os.environ,**env))
assert git('ls-remote','origin','refs/heads/dev').decode().split()[0]==commit
assert sha(root/'.git/index')==index_hash and digest(git('ls-files','--stage','-z'))==entries_hash
print(json.dumps({'commit':commit,'originDevVerified':True,'files':len(files),'productionRuntimeUnchanged':True,'candidateAdmitted':False,'sharedIndexUnchanged':True,'goalStatus':'active'}))
