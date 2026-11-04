import pathlib,subprocess,os,tempfile,json,hashlib
root=pathlib.Path('/Users/bilibili/code/seti-simu');stage=pathlib.Path(__file__).resolve().parents[1];base='836997878184f1f5d8e0be6b8987eb581b904236';folder='reports/ai-foundation-20261104/two-rounds-teacher-v2/'
def git(*a,data=None,env=None):return subprocess.check_output(['git',*a],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
assert git('rev-parse','HEAD').decode().strip()==base
shared=sha(root/'.git/index');assert shared=='fc85f92edd341768801c684278718c809b0da7092d9c1eba78bf6fd978304e49';entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest();foreign={p:sha(root/p)for p in ['reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html']}
files={'adhoc/audit-v148-teacher-choices-20261104-v2.js','adhoc/witness-v148-first-launch-timing-20261104-v1.js','adhoc/deliver-v148-teacher-audit-20261104-v1.py','adhoc/human405-two-rounds-progress-20261104-v10.json','docs/ai-funded-hand-timing-v148-20261104.md'}
for name in ['v148-teacher-node-choice-audit-20261104-v2.json','v148-teacher-node-choice-audit-20261104-v2.log','v148-first-launch-timing-native-20261104-v1.json','v148-first-launch-timing-native-20261104-v1.log','v148-first-launch-audit-field-error-20261104-v1.log']:files.add(folder+name)
a=json.loads((stage/(folder+'v148-teacher-node-choice-audit-20261104-v2.json')).read_text());assert a['teacherNodes']==67 and a['counts']=={'different-reported-value':9,'teacher-action-policy-excluded':5,'same-native-action':49,'teacher-value-not-established':2,'same-reported-value-different-action':2}
for row in a['rows']:
 for p,h in [(row['evidence'],row['evidenceSha256']),(row['fixture'],row['fixtureSha256'])]:assert sha(stage/p)==h
w=json.loads((stage/(folder+'v148-first-launch-timing-native-20261104-v1.json')).read_text());assert w['originalRootAndRngUnchanged']and not w['goalAchieved']
for p,h in w['sourceHashes'].items():assert sha(stage/p)==h and hashlib.sha256(git('show',base+':'+p)).hexdigest()==h
old={}
for entry in git('ls-tree','-rz',base).split(b'\0'):
 if not entry:continue
 meta,name=entry.split(b'\t',1);p=name.decode();old[p]=meta.decode().split()[2]
 if p.startswith(('randomizer/','tools/','assets/')):
  b=(stage/p).read_bytes();assert hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()==old[p],p
for p in files:
 if(root/p).exists()and(root/p).read_bytes()!=(stage/p).read_bytes():assert p in old and(root/p).read_bytes()==git('show',base+':'+p),p
manifest='adhoc/v148-teacher-audit-delivery-20261104-v1.json';(stage/manifest).write_text(json.dumps({'baseCommit':base,'sourceCommit':w['sourceCommit'],'files':{p:sha(stage/p)for p in sorted(files)},'sharedIndexSha256':shared,'foreignRegistryHashes':foreign,'goalStatus':'active','goalAchieved':False},indent=2)+'\n');files.add(manifest)
if os.environ.get('SETI_DELIVER_V148_AUDIT')!='1':print(json.dumps({'preflight':True,'files':len(files),'teacherNodes':67,'runtimeUnchanged':True}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-v148-audit-index-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(files):
 b=(stage/p).read_bytes();blob=git('hash-object','-w','--stdin',data=b,env=env).decode().strip();git('update-index','--add','--cacheinfo','100644',blob,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==files;git('diff','--cached','--check',env=env)
for p in files:
 dest=root/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes((stage/p).read_bytes())
git('commit','-m','核对教师67处白席决策并补首轮发射与收入时机原生账本',env=env);commit=git('rev-parse','HEAD').decode().strip();print(git('show','--name-only','--stat','--format=short','HEAD').decode());assert set(git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines())==files;assert sha(root/'.git/index')==shared and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for p,h in foreign.items():assert sha(root/p)==h
result={'commit':commit,'privateIndex':private,'files':len(files),'runtimeUnchanged':True,'sharedIndexUnchanged':True,'foreignRegistryUnchanged':True,'goalStatus':'active'};pathlib.Path('/private/tmp/seti-v148-teacher-audit-delivery-20261104-v1.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
