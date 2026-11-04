import pathlib,subprocess,os,tempfile,json,hashlib
root=pathlib.Path('/Users/bilibili/code/seti-simu');stage=pathlib.Path(__file__).resolve().parents[1];base='26a583b4b9f73a66fb5fc4dab5ee336343346301';folder='reports/ai-foundation-20261104/two-rounds-teacher-v2/'
def git(*a,data=None,env=None):return subprocess.check_output(['git',*a],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def read(p):return json.loads((stage/p).read_text())
assert git('rev-parse','HEAD').decode().strip()==base
shared=sha(root/'.git/index');assert shared=='fc85f92edd341768801c684278718c809b0da7092d9c1eba78bf6fd978304e49';entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest();foreign={p:sha(root/p)for p in ['reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html']}
files={'adhoc/analyze-v148-round-capital-20261104-v1.js','adhoc/witness-v148-research-analysis-order-20261104-v1.js','adhoc/prototype-v149-ready-analysis-capital-20261104-v1.js','adhoc/verify-v149-ready-analysis-capital-20261104-v1.js','adhoc/deliver-ready-analysis-prototype-20261104-v1.py','docs/ai-ready-analysis-capital-20261104.md','adhoc/human405-two-rounds-progress-20261104-v10.json'}
for name in ['v148-round-capital-native-20261104-v1','v148-research-analysis-order-native-20261104-v1','v149-ready-analysis-capital-native-controls-20261104-v1']:
 files.update([folder+name+'.json',folder+name+'.log']);r=read(folder+name+'.json')
 assert r['goalStatus']=='active'and not r['goalAchieved']
 for p,h in r['sourceHashes'].items():assert sha(stage/p)==h and hashlib.sha256(git('show',base+':'+p)).hexdigest()==h,p
files.update(folder+name for name in ['v149-ready-analysis-controlled-wallet-attribution-error-20261104-v1.log','v149-ready-analysis-optional-negative-plan-error-20261104-v1.log'])
r=read(folder+'v149-ready-analysis-capital-native-controls-20261104-v1.json');assert r['controls']==192 and r['funded']==176 and r['unfunded']==16 and r['nativeInputs']==824 and r['maxNativeInputs']==11;assert r['prototypeOnly']and r['productionUnchanged']and r['allExactNativeValueParity']and r['allRootsAndRngUnchanged'];assert sha(stage/r['prototype'])==r['prototypeSha256'];assert sha(stage/r['witness'])==r['witnessSha256'];assert sum(x.get('planNetGain',0)<0 for x in r['rows'])==16
v=read(folder+'v148-round-capital-native-20261104-v1.json');assert v['originalRootAndRngUnchanged'];assert [x['ai']['value']['total']for x in v['rounds']]==[60.5,79.5]and[x['teacher']['value']['total']for x in v['rounds']]==[59.5,90]
old={}
for entry in git('ls-tree','-rz',base).split(b'\0'):
 if not entry:continue
 meta,name=entry.split(b'\t',1);p=name.decode();old[p]=meta.decode().split()[2]
 if p.startswith(('randomizer/','tools/','assets/')):
  b=(stage/p).read_bytes();assert hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()==old[p],p
for p in files:
 if(root/p).exists()and(root/p).read_bytes()!=(stage/p).read_bytes():assert p in old and(root/p).read_bytes()==git('show',base+':'+p),p
 if p.endswith('.js'):subprocess.run(['node','--check',p],cwd=stage,check=True)
manifest='adhoc/ready-analysis-prototype-delivery-20261104-v1.json';(stage/manifest).write_text(json.dumps({'baseCommit':base,'productionSourceCommit':'7da81a85e675bd08abe393108450a6d0cb7510c7','files':{p:sha(stage/p)for p in sorted(files)},'sharedIndexSha256':shared,'foreignRegistryHashes':foreign,'productionUnchanged':True,'goalStatus':'active','goalAchieved':False},indent=2)+'\n');files.add(manifest)
if os.environ.get('SETI_DELIVER_ANALYSIS_PROTOTYPE')!='1':print(json.dumps({'preflight':True,'files':len(files),'nativeControls':192,'runtimeUnchanged':True}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-ready-analysis-prototype-index-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(files):
 b=(stage/p).read_bytes();blob=git('hash-object','-w','--stdin',data=b,env=env).decode().strip();git('update-index','--add','--cacheinfo','100644',blob,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==files;git('diff','--cached','--check',env=env)
for p in files:
 dest=root/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes((stage/p).read_bytes())
git('commit','-m','定位已就绪分析估值缺口并验证192组原生控制，保持生产策略不变',env=env);commit=git('rev-parse','HEAD').decode().strip();print(git('show','--name-only','--stat','--format=short','HEAD').decode());assert set(git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines())==files;assert sha(root/'.git/index')==shared and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for p,h in foreign.items():assert sha(root/p)==h
result={'commit':commit,'privateIndex':private,'files':len(files),'runtimeUnchanged':True,'sharedIndexUnchanged':True,'foreignRegistryUnchanged':True,'goalStatus':'active'};pathlib.Path('/private/tmp/seti-ready-analysis-prototype-delivery-20261104-v1.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
