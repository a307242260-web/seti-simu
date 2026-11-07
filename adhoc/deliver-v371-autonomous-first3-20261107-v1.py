from pathlib import Path
import hashlib,json,os,subprocess,sys
stage=Path(__file__).resolve().parents[1]
repo=Path('/Users/bilibili/code/seti-simu')
run=Path('/private/tmp/seti-v371-autonomous-first3-20261107-v1')
base='fcc35ea2f624e3f63af2125727823b545a435325'
d=Path('reports/ai-foundation-20261107/v371-spent-swap-offer-v1')
registry='reports/iteration/registry.json'
versions='reports/iteration/versions.json'
page='reports/robot-iteration.html'
read=lambda p:json.loads(p.read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
blob=lambda b:hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
shared=sha(repo/'.git/index');assert shared=='d01a449eea57aa1efd899d9490d7560eb2045de4b16d8c9627c4505a254a51bb'
index=Path('/private/tmp/seti-v371-autonomous-first3-20261107-v1.index')
receipt=Path('/private/tmp/seti-v371-autonomous-first3-delivery-20261107-v1.json')
env={**os.environ,'GIT_INDEX_FILE':str(index),'GIT_OPTIONAL_LOCKS':'0'}
def git(*a,data=None):return subprocess.check_output(['git',*a],input=data,env=env,cwd=repo)
assert git('rev-parse','HEAD').decode().strip()==base
native=d/'v371-first3-native-development-20261107-v1.json'
control=d/'v371-v323-actual-first3-comparison-20261107-v1.json'
n=read(run/native);b=read(run/control);r=read(run/n['record'])
assert n['sourceCommit']==base and n['completed'] and n['newInputsAfterOpening']==183 and n['wallMilliseconds']==8332
assert n['maxNativeInputs']==256 and n['maxMilliseconds']<600 and n['nativeRoundAndFinalStateSessionRngExact']
assert r['scenario']['autonomousScope']=='rounds1-3' and not r['terminal'] and not r['scenario']['baselineEligible']
assert [x['ai']['assets']['boardScore'] for x in n['compare']]==[15,48,96]
assert [x['teacher']['assets']['boardScore'] for x in n['compare']]==[15,34,105]
for name in ['record','save','trace','checkpoint']:assert sha(run/n[name])==n[name+'Sha256']
assert b['equalInitialActions']==150 and b['newAutonomousRuns']==0 and b['afterSha256']==sha(run/native)
assert all(not x['changedFields'] for x in b['comparisons'][:2])
old=json.loads(git('show',base+':'+registry));current=read(run/registry)
oldv=json.loads(git('show',base+':'+versions));newv=read(run/versions)
assert current['generations']['v1']==old['generations']['v1']
v2=current['generations']['v2'];p2=old['generations']['v2'];assert v2['currentBaseline']==p2['currentBaseline']=='ai-search-v41-baseline-20261029' and v2['bestOf']==p2['bestOf']
assert v2['versionCount']==p2['versionCount']+1 and v2['recordCount']==p2['recordCount']+1
key='ai-search-v371-white-first3-20261107'
assert [x for x in newv['versions'] if x['id']!=key]==oldv['versions']
assert [x for x in current['versions'] if x['id']!=key]==old['versions']
entry=next(x for x in current['versions'] if x['id']==key);assert entry['aiGeneration']=='v2' and not entry['baselineEligible']
z=entry['results'][0];assert z['recordFile']==Path(n['record']).name and z['scoreSource']=='record-summary' and not z['terminal'] and z['reportExists']
assert z['comparisonScope']=='white-only-first-three-rounds' and z['scores']['player-white']==96
assert z['scenarioResult']['completedRoundEnds']==[1,2,3]
assert '自主前三轮 · 轮末盘面' in (run/page).read_text()
assert '58605414.fcc35ea2.quick-400' in (run/z['reportPath']).read_text()
paths=[registry,versions,page,n['record'],n['trace'],n['save'],n['checkpoint'],str(native),str(control),z['reportPath'],r['roundEndsPath'],*(x['checkpointPath']for x in r['roundEnds']),
 str(d/'seti-v371-independent-first3-json-payload-diagnostic-20261107-v1.log'),str(d/'seti-v371-independent-first3-resume-diagnostic-20261107-v1.log'),str(d/'autonomous-first3-registry-reconciliation-20261107-v1.json'),str(d/'autonomous-first3-robot-iterate-20261107-v1.log')]
files={p:run/p for p in paths}
for p in ['docs/human405-v371-autonomous-first3-20261107.md','adhoc/verify-v371-autonomous-first3-20261107-v1.js','adhoc/compare-v371-v323-actual-first3-20261107-v1.js','adhoc/merge-v371-iteration-center-20261107-v1.js','adhoc/deliver-v371-autonomous-first3-20261107-v1.py']:files[p]=stage/p
for p,f in files.items():
 assert f.is_file(),p
 if p.endswith('.js'):subprocess.run(['node','--check',str(f)],check=True)
 if p.endswith('.py'):compile(f.read_text(),p,'exec')
 if p not in {registry,versions,page} and (repo/p).exists():assert sha(repo/p)==sha(f),p
if '--stage' not in sys.argv:
 print(json.dumps({'status':'preflight-passed','files':len(files),'score':96,'oldVersionsUnchanged':len(old['versions']),'source':base}))
 raise SystemExit(0)
assert not index.exists() and not receipt.exists()
git('read-tree',base)
names=sorted(files)
oids=git('hash-object','-w','--stdin-paths',data=''.join(str(files[p])+'\n'for p in names).encode()).decode().splitlines()
assert len(oids)==len(names)
for p,oid in zip(names,oids):assert blob(files[p].read_bytes())==oid,p
git('update-index','--index-info',data=''.join('100644 '+oid+'\t'+p+'\n'for p,oid in zip(names,oids)).encode())
tree=git('write-tree').decode().strip()
for p,oid in zip(names,oids):assert git('rev-parse',tree+':'+p).decode().strip()==oid
for path in ['randomizer','tools','assets']:assert git('rev-parse',tree+':'+path)==git('rev-parse',base+':'+path)
assert set(git('diff','--cached','--name-only','-z',base).decode().strip('\0').split('\0'))==set(names)
assert sha(repo/'.git/index')==shared
r={'status':'staged-independent-result','sourceCommit':base,'tree':tree,'files':names,'index':str(index),'sharedIndexSha256':shared,'record':n['record'],'rawReplay':str(native),'comparison':str(control),'report':z['reportPath'],'noBaselineOrOtherVersionChange':True,'newAutonomousRuns':1}
receipt.write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
for p,f in files.items():
 if p in {registry,versions,page}:continue
 target=repo/p;target.parent.mkdir(parents=True,exist_ok=True)
 if not target.exists():
  with target.open('xb')as out:out.write(f.read_bytes())
 assert sha(target)==sha(f),p
print(json.dumps({'status':r['status'],'tree':tree,'files':len(names),'sourceCommit':base,'score':96,'report':r['report'],'sharedIndexPreserved':True}))
