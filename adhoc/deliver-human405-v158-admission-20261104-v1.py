import pathlib,subprocess,os,tempfile,json,hashlib,gzip,re
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='d2c62aad60760b6ce02c6bee4bea8de7423876ab';folder='reports/ai-foundation-20261104/two-rounds-teacher-v2/'
def git(*args,data=None,env=None):return subprocess.check_output(['git',*args],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def read(p):return json.loads((stage/p).read_text())
assert git('rev-parse','HEAD').decode().strip()==base
before=json.loads(pathlib.Path('/private/tmp/seti-v158-stage-code-deltas-20261104-v1.json').read_text());assert before['baseCommit']==base
shared=sha(root/'.git/index');assert shared==before['sharedIndexSha256'];entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()
for p,h in before['foreignHashes'].items():assert sha(root/p)==h,p
core=set(before['paths']);files=set(core)|{'adhoc/deliver-human405-v158-admission-20261104-v1.py','adhoc/human405-two-rounds-progress-20261104-v12.json','adhoc/archive-human405-rejected-runtime-20261104-v1.py'}
for version in range(153,159):
 for pattern in [f'adhoc/*v{version}*20261104*.js',folder+f'v{version}-*',f'reports/ai-foundation-20261023/human405-v{version}-cold-*-20261104-v1.*']:
  files.update(str(p.relative_to(stage))for p in stage.glob(pattern)if p.is_file()and p.suffix!='.cpuprofile')
archives={}
for version in range(154,158):
 directory=stage/f'reports/ai-foundation-20261104/rejected-v{version}-runtime-20261104-v1';m=read(str(directory.relative_to(stage))+'/manifest.json');assert m['baseCommit']==base and not m.get('admitted',False);archives[version]=(directory,m)
 for p,h in m['overlayFiles'].items():assert sha(directory/p)==h,p
 for p,h in m.get('allLoadedRuntimeHashes',{}).items():assert hashlib.sha256((directory/p).read_bytes()if p in m['overlayFiles']else git('show',base+':'+p)).hexdigest()==h,(version,p)
 files.update(str(p.relative_to(stage))for p in directory.rglob('*')if p.is_file())
# These complete loaded samples are retained even when a performance or
# regression gate failed. Their source archives, rather than current code,
# are authoritative for reproduction.
for version in range(154,157):
 for p in stage.glob(f'reports/ai-foundation-20261023/human405-v{version}-cold-*-20261104-v1.json'):
  r=read(str(p.relative_to(stage)));d,m=archives[version];assert sha(stage/r['rawPath'])==r['rawSha256']
  for src,h in r['sourceHashes'].items():assert hashlib.sha256((d/src).read_bytes()if src in m['overlayFiles']else git('show',base+':'+src)).hexdigest()==h,(version,src)
full=(stage/(folder+'v158-node-full-20261104-v2.log')).read_text();assert 'SUMMARY unit passed=164 failed=0 total=164'in full and 'SUMMARY fullFlow passed=1 failed=0 total=1'in full
chrome=(stage/(folder+'v158-chrome-ai-sixteen-20261104-v1.log')).read_text();assert 'SUMMARY browserSmoke passed=16 failed=0 total=16'in chrome
fails=[x for x in(stage/(folder+'v158-value-input-audit-20261104-v1.log')).read_text().splitlines()if x.startswith('[FAIL]')]
prior=[x for x in(stage/(folder+'v151-value-input-audit-20261104-v1.log')).read_text().splitlines()if x.startswith('[FAIL]')];assert fails==prior and len(fails)==1 and 'aomomo'in fails[0]
proof=read(folder+'v156-movement-tail-native-controls-20261104-v3.json');assert proof['status']=='complete'and proof['available']==20 and proof['nativeInputs']==117
for name,count in [('paid-income-plan-reuse-20261104-v2',13),('free-launch-plan-reuse-20261104-v1',4)]:
 r=read(folder+'v158-'+name+'.json');assert r['status']=='complete'and r['originalRootAndRngRestored']and len(r['rows'])==count
 assert all(x['reuse']=='hit'and x['nativeInputs']==0 for x in r['rows'][1:])
 for p,h in r['sourceHashes'].items():assert sha(stage/p)==h,p
cold=[];sources={}
def check(p):
 r=read(p);assert r['searchVersion'].endswith('v158')and r['complete']and r['rootAndRngUnchanged'];assert r['nativeInputs']<=256 and r['milliseconds']<=600
 assert sha(stage/r['rawPath'])==r['rawSha256']and sha(stage/r['fixture'])==r['fixtureSha256'];raw=json.loads(gzip.decompress((stage/r['rawPath']).read_bytes()));assert raw['complete']and not raw['unresolved']and raw['diagnostics']['nativeExecutions']==r['nativeInputs']and all(v is None for v in raw['diagnostics']['limits'].values())
 for src,h in r['sourceHashes'].items():assert sha(stage/src)==h,src;sources[src]=h
 cold.append(r);files.update([p,r['rawPath']])
g=read(folder+'v158-current-teacher-serial-gate-20261104-v1.json');assert g['status']=='complete'and len(g['rows'])==81 and not g['overruns']and all(v is None for v in g['productionBudgets'].values())
for row in g['rows']:check(row['evidence'])
for label in ['actual044-funding','actual050-funding','actual-v148-077-ready-analysis']:check(f'reports/ai-foundation-20261023/human405-v158-cold-{label}-20261104-v1.json')
assert len(cold)==84
first=next(x for x in g['rows']if x['label']=='teacher-024');assert first['actionId']==first['teacherActionId']and first['value']==60
old={};unchanged=0
for entry in git('ls-tree','-rz',base).split(b'\0'):
 if not entry:continue
 meta,name=entry.split(b'\t',1);p=name.decode();old[p]=meta.decode().split()[2]
 if p.startswith(('randomizer/','tools/','assets/'))and p not in core:
  b=(stage/p).read_bytes();assert hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()==old[p],p;unchanged+=1
for p in files:
 if p.endswith('.js'):subprocess.run(['node','--check',str(stage/p)],cwd=stage,check=True,stdout=subprocess.DEVNULL)
proofPath=folder+'v158-admission-source-check-20261104-v1.json';(stage/proofPath).write_text(json.dumps({'baseCommit':base,'runtimeSourceHashes':sources,'unchangedCodeDataFiles':unchanged,'coldRoots':84,'maxInputs':max(r['nativeInputs']for r in cold),'maxMilliseconds':max(r['milliseconds']for r in cold),'unitPassed':164,'fullFlowPassed':1,'chromePassed':16,'knownUnchangedLegacyAuditFailure':fails,'nativeMovementControls':20,'nativeMovementInputs':117,'nativeResearchIncomePlans':408,'researchIncomeNativeInputs':4896,'paidIncomeColdSteps':13,'freeLaunchColdSteps':4,'productionBudgets':g['productionBudgets'],'roundEnd':'before-PASS-card-and-next-income','baselineUnchanged':'ai-search-v41-baseline-20261029','newAutonomousRunPending':True,'goalStatus':'active','goalAchieved':False},indent=2)+'\n');files.add(proofPath)
deltas=set()
for p in files:
 b=(stage/p).read_bytes()
 if old.get(p)!=hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest():deltas.add(p)
manifest='adhoc/human405-v158-admission-manifest-20261104-v1.json';(stage/manifest).write_text(json.dumps({'baseCommit':base,'files':{p:sha(stage/p)for p in sorted(files)},'changedFiles':sorted(deltas),'sharedIndexSha256':shared,'sharedIndexEntriesSha256':entries,'foreignRegistryHashes':before['foreignHashes'],'byteExactArchiveWhitespaceExclusions':list(archives),'goalStatus':'active','goalAchieved':False},indent=2)+'\n');deltas.add(manifest)
for p in deltas:
 if(root/p).exists()and(root/p).read_bytes()!=(stage/p).read_bytes():assert p in old and(root/p).read_bytes()==git('show',base+':'+p),('overlap',p)
if os.environ.get('SETI_DELIVER_V158')!='1':print(json.dumps({'preflight':True,'files':len(deltas),'coldRoots':84,'maxInputs':max(r['nativeInputs']for r in cold),'maxMilliseconds':max(r['milliseconds']for r in cold),'runtimeSources':len(sources)}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-v158-admission-index-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(deltas):
 b=(stage/p).read_bytes();blob=git('hash-object','-w','--stdin',data=b,env=env).decode().strip();git('update-index','--add','--cacheinfo','100644',blob,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==deltas
git('diff','--cached','--check','--','.',*[':(exclude)'+str(d.relative_to(stage))+'/**'for d,m in archives.values()],env=env)
for p in sorted(deltas):
 dest=root/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes((stage/p).read_bytes())
git('commit','-m','补计已知研究收入用途并验证固定移动尾部与严格计划恢复',env=env);commit=git('rev-parse','HEAD').decode().strip();assert set(git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines())==deltas
print(git('show','--name-only','--stat','--format=short','HEAD').decode());assert sha(root/'.git/index')==shared and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for p,h in before['foreignHashes'].items():assert sha(root/p)==h,p
result={'commit':commit,'baseCommit':base,'privateIndex':private,'files':len(deltas),'sharedIndexUnchanged':True,'foreignRegistryUnchanged':True,'goalStatus':'active','newAutonomousRunPending':True};pathlib.Path('/private/tmp/seti-v158-admission-result-20261104-v1.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
