from pathlib import Path
import hashlib, json, os, subprocess, sys

run=Path(__file__).resolve().parents[1]
repo=Path('/Users/bilibili/code/seti-simu')
base='de90ae747caf3f586b7f2aa1b3d49e2e21ada3f7'
d=Path('reports/ai-foundation-20261107/v375-known-research-data-v1')
registry='reports/iteration/registry.json'
versions='reports/iteration/versions.json'
page='reports/robot-iteration.html'
generated={registry,versions,page}
index=Path('/private/tmp/seti-v375-autonomous-first3-20261107-v1.index')
env={**os.environ,'GIT_INDEX_FILE':str(index),'GIT_OPTIONAL_LOCKS':'0'}
def git(*a,data=None):
    return subprocess.check_output(['git',*a],cwd=repo,env=env,input=data)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
read=lambda p:json.loads((run/p).read_text())
blob=lambda b:hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
shared=sha(repo/'.git/index')
assert shared=='d01a449eea57aa1efd899d9490d7560eb2045de4b16d8c9627c4505a254a51bb'
assert git('rev-parse','HEAD').decode().strip()==base

proof=d/'v375-first3-native-development-20261107-v1.json'
compare=d/'v375-v372-actual-first3-comparison-20261107-v1.json'
n=read(proof);delta=read(compare);r=read(n['record'])
assert n['sourceCommit']==base and n['completed'] and n['newInputsAfterOpening']==195
assert n['wallMilliseconds']==9281 and n['maxNativeInputs']==256 and n['maxMilliseconds']<600
assert n['nativeRoundAndFinalStateSessionRngExact']
assert [x['ai']['assets']['boardScore'] for x in n['compare']]==[15,48,101]
assert [x['teacher']['assets']['boardScore'] for x in n['compare']]==[15,34,105]
assert delta['equalInitialActions']==181 and delta['afterSha256']==sha(run/proof) and delta['newAutonomousRuns']==0
assert all(not x['changedFields'] for x in delta['comparisons'][:2])
for name in ('record','save','trace','checkpoint'):assert sha(run/n[name])==n[name+'Sha256']

old=json.loads(git('show',base+':'+registry));new=read(registry)
oldv=json.loads(git('show',base+':'+versions));newv=read(versions)
key='ai-search-v375-white-first3-20261107'
assert [x for x in newv['versions'] if x['id']!=key]==oldv['versions']
assert [x for x in new['versions'] if x['id']!=key]==old['versions']
assert new['generations']['v1']==old['generations']['v1']
v2=new['generations']['v2'];prior=old['generations']['v2']
assert v2['currentBaseline']==prior['currentBaseline']=='ai-search-v41-baseline-20261029'
assert v2['bestOf']==prior['bestOf'] and v2['recordCount']==prior['recordCount']+1 and v2['versionCount']==prior['versionCount']+1
entry=next(x for x in new['versions'] if x['id']==key)
assert entry['aiGeneration']=='v2' and not entry['baselineEligible']
z=entry['results'][0]
assert z['recordFile']==Path(n['record']).name and z['scoreSource']=='record-summary' and not z['terminal'] and z['reportExists']
assert z['comparisonScope']=='white-only-first-three-rounds' and z['scores']['player-white']==101
assert z['scenarioResult']['completedRoundEnds']==[1,2,3]
assert '自主前三轮 · 轮末盘面' in (run/page).read_text()
assert '13798912.de90ae74.quick-400' in (run/z['reportPath']).read_text()
files={registry,versions,page,n['record'],n['trace'],n['save'],n['checkpoint'],str(proof),str(compare),
       z['reportPath'],r['roundEndsPath'],*(x['checkpointPath'] for x in r['roundEnds']),
       str(d/'autonomous-first3-registry-reconciliation-20261107-v1.json'),str(d/'autonomous-first3-robot-iterate-20261107-v1.log'),
       str(d/'earlier-third-analysis-20261107-v2.checkpoint.json'),'adhoc/control-v375-earlier-third-analysis-20261107-v1.js',
       'docs/human405-v375-autonomous-first3-20261107.md'}
files.update('adhoc/'+x for x in ['verify-v375-autonomous-first3-20261107-v1.js','compare-v375-v372-actual-first3-20261107-v1.js',
    'merge-v375-iteration-center-20261107-v1.js','deliver-v375-autonomous-first3-20261107-v1.py'])
for p in files:
    f=run/p
    assert f.is_file(),p
    if p.endswith('.js'):subprocess.run(['node','--check',str(f)],check=True)
    if p.endswith('.py'):compile(f.read_text(),p,'exec')
    if p not in generated and (repo/p).exists():assert sha(repo/p)==sha(f),p
if '--stage' not in sys.argv:
    print(json.dumps({'preflight':'passed','paths':len(files),'retainedRows':len(old['versions']),'score':101}));raise SystemExit(0)
assert not index.exists()
git('read-tree',base)
names=sorted(files)
oids=git('hash-object','-w','--stdin-paths',data=''.join(str(run/p)+'\n' for p in names).encode()).decode().splitlines()
assert len(oids)==len(names)
for p,oid in zip(names,oids):assert blob((run/p).read_bytes())==oid,p
git('update-index','--index-info',data=''.join('100644 '+oid+'\t'+p+'\n' for p,oid in zip(names,oids)).encode())
tree=git('write-tree').decode().strip()
for p,oid in zip(names,oids):assert git('rev-parse',tree+':'+p).decode().strip()==oid
for p in ('randomizer','tools','assets'):assert git('rev-parse',tree+':'+p)==git('rev-parse',base+':'+p)
assert set(git('diff','--cached','--name-only','-z',base).decode().strip('\0').split('\0'))==files
assert sha(repo/'.git/index')==shared
for p in files-generated:
    target=repo/p;target.parent.mkdir(parents=True,exist_ok=True)
    if not target.exists():
        with target.open('xb') as f:f.write((run/p).read_bytes())
    assert sha(target)==sha(run/p),p
print(json.dumps({'status':'staged','tree':tree,'paths':len(files),'retainedRows':len(old['versions']),'score':101}))
