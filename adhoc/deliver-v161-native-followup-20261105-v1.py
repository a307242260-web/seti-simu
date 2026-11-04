import pathlib,subprocess,os,tempfile,json,hashlib
stage=pathlib.Path(__file__).resolve().parents[1];root=pathlib.Path('/Users/bilibili/code/seti-simu');base='04689326c581ccdb50ab8a2512b0be0cf6d5eebf';folder='reports/ai-foundation-20261104/two-rounds-teacher-v2/'
def git(*a,data=None,env=None):return subprocess.check_output(['git',*a],cwd=root,input=data,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
def sha(p):return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def read(p):return json.loads((stage/p).read_text())
assert git('rev-parse','HEAD').decode().strip()==base
shared=sha(root/'.git/index');assert shared=='fc85f92edd341768801c684278718c809b0da7092d9c1eba78bf6fd978304e49'
entries=hashlib.sha256(git('ls-files','--stage','-z')).hexdigest();foreign={p:sha(root/p) for p in ['reports/iteration/versions.json','reports/iteration/registry.json','reports/robot-iteration.html']}
files={'docs/human405-first2-v161-progress-20261105.md','adhoc/human405-two-rounds-progress-20261105-v4.json','adhoc/deliver-v161-native-followup-20261105-v1.py'}
for pattern in ['adhoc/witness-v161-actual075-development-20261105-v*.js','adhoc/witness-v161-purple4-current-scan-20261105-v1.js','adhoc/compare-v161-development-orders-20261105-v1.js','adhoc/revalue-v161-known-first-round-plans-20261105-v1.js',folder+'v161-actual075-development-native-20261105-v*',folder+'v161-purple4-current-scan-native-20261105-v1.*',folder+'v161-development-order-comparison-20261105-v1.json',folder+'v161-known-first-round-plans-revalued-20261105-v1.*']:
 files.update(str(p.relative_to(stage)) for p in stage.glob(pattern) if p.is_file())
sources={};native=0
for name,inputs in [('v161-actual075-development-native-20261105-v1',5),('v161-actual075-development-native-20261105-v2',10),('v161-purple4-current-scan-native-20261105-v1',5)]:
 r=read(folder+name+'.json');assert r['status']=='complete' and r['nativeInputs']==inputs and r['originalRootAndRngRestored'];native+=inputs
 for p,h in r['sourceHashes'].items():assert sha(stage/p)==h,p;sources[p]=h
 assert sha(stage/r['source'])==r['sourceSha256']
order=read(folder+'v161-development-order-comparison-20261105-v1.json');assert not order['fullStateEquivalenceProved'] and not order['permissionToMergeSearchStates'] and order['finalValues']==[74,74] and order['allOtherCanonicalFieldsAndEnvelopeRngEqual'];assert len(order['remainingDifferences'])==2
q=read(folder+'v161-known-first-round-plans-revalued-20261105-v1.json');assert q['status']=='complete' and len(q['rows'])==8 and q['newNativeInputs']==0
for p,h in q['sources'].items():assert sha(stage/p)==h
for p,h in q['sourceHashes'].items():assert sha(stage/p)==h,p;sources[p]=h
known=[x for x in q['rows'] if x['plan']=='orbit-both-income-blue-and-funded-purple4'];assert [x['currentV11']['total'] for x in known]==[64.5,61.5]
old={};modes={};unchanged=0
for entry in git('ls-tree','-rz',base).split(b'\0'):
 if not entry:continue
 meta,name=entry.split(b'\t',1);p=name.decode();mode,kind,blob=meta.decode().split();old[p]=blob;modes[p]=mode
 if p.startswith(('randomizer/','tools/','assets/')):
  b=(stage/p).read_bytes();assert hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()==blob,p;unchanged+=1
for p,h in sources.items():assert hashlib.sha256(git('show',base+':'+p)).hexdigest()==h,p
for p in files:
 if (root/p).exists() and (root/p).read_bytes()!=(stage/p).read_bytes():assert p in old and (root/p).read_bytes()==git('show',base+':'+p),p
 if p.endswith('.js'):subprocess.run(['node','--check',str(stage/p)],check=True)
manifest='adhoc/human405-v161-native-followup-manifest-20261105-v1.json';(stage/manifest).write_text(json.dumps({'baseCommit':base,'sourceCommit':'b961ce2911a08573f11ed04ad975935ec594c253','files':{p:sha(stage/p) for p in sorted(files)},'newNativeInputs':native,'existingEndpointsRevalued':8,'newSearchOrGameplay':False,'runtimeToolsAssetsUnchanged':unchanged,'runtimeSourceHashes':sources,'sharedIndexSha256':shared,'sharedIndexEntriesSha256':entries,'foreignRegistryHashes':foreign,'goalStatus':'active','goalAchieved':False},indent=2)+'\n');files.add(manifest)
if os.environ.get('SETI_DELIVER_V161_FOLLOWUP')!='1':print(json.dumps({'preflight':True,'files':len(files),'nativeInputs':native,'runtimeUnchanged':True,'goalStatus':'active'}));raise SystemExit(0)
private=str(pathlib.Path(tempfile.mkdtemp(prefix='seti-v161-followup-index-'))/'index');env={'GIT_INDEX_FILE':private};git('read-tree',base,env=env)
for p in sorted(files):
 blob=git('hash-object','-w','--stdin',data=(stage/p).read_bytes(),env=env).decode().strip();git('update-index','--add','--cacheinfo',modes.get(p,'100644'),blob,p,env=env)
assert set(git('diff','--cached','--name-only',base,env=env).decode().splitlines())==files;git('diff','--cached','--check',env=env)
for p in sorted(files):
 dest=root/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes((stage/p).read_bytes())
git('commit','-m','补充v161研究发射顺序与首轮筹资链原生证据，收窄下一步估值排查',env=env);commit=git('rev-parse','HEAD').decode().strip();print(git('show','--name-only','--stat','--format=short','HEAD').decode());assert set(git('diff-tree','--no-commit-id','--name-only','-r',commit).decode().splitlines())==files
assert sha(root/'.git/index')==shared and hashlib.sha256(git('ls-files','--stage','-z')).hexdigest()==entries
for p,h in foreign.items():assert sha(root/p)==h,p
result={'commit':commit,'privateIndex':private,'files':len(files),'sharedIndexUnchanged':True,'foreignRegistryUnchanged':True,'goalStatus':'active'};pathlib.Path('/private/tmp/seti-v161-native-followup-delivery-20261105-v1.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
