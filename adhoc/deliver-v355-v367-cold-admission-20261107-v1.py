from pathlib import Path
import hashlib, json, os, subprocess, sys

root=Path(__file__).resolve().parents[1]
repo=Path('/Users/bilibili/code/seti-simu')
base='395c36fd3f8c857048c2dff08f4272a1bbf613b6'
tmp=Path('/private/tmp')
index=tmp/'seti-v355-v367-admission-evidence-20261107-v1.index'
receipt=tmp/'seti-v355-v367-admission-evidence-20261107-v1.json'
archive=Path('reports/ai-foundation-20261107')
old=Path('reports/ai-foundation-20261105/third-round-teacher-v1')
date='20261107-v1'
doc='docs/human405-v355-v367-cold-admission-and-amiba5-20261107.md'
progress='adhoc/human405-third-round-progress-20261107-v41.json'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
read=lambda p:json.loads((root/p).read_text())
blob=lambda b:hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
env={**os.environ,'GIT_OPTIONAL_LOCKS':'0','GIT_INDEX_FILE':str(index)}
def git(*args,data=None):return subprocess.check_output(['git',*args],input=data,cwd=repo,env=env)
shared=sha(repo/'.git/index')
assert git('rev-parse','HEAD').decode().strip()==base and git('branch','--show-current').strip()==b'dev'
tracked=set(git('ls-tree','-rz','--name-only',base).decode().split('\0'))
names={doc,'adhoc/'+Path(__file__).name}
report={}
def add_evidence(p,manifest=None):
    e=read(p); raw=e['rawPath']; assert sha(root/raw)==e['rawSha256'],raw
    if manifest:assert e['candidateSourceManifestSha256']==manifest,p
    names.update((str(p),raw))
for version in range(355,368):
    found=list((root/archive).glob(f'v{version}-*-v1'));assert len(found)==1,found
    d=found[0].relative_to(root);tag=d.name[:-3]
    assert (root/d/'source-manifest-20261107-v1.json').is_file()
    names.update(str(p.relative_to(root)) for p in found[0].rglob('*') if p.is_file() and '-cli-' not in p.name)
    names.update(f'adhoc/{kind}-{tag}-{date}.{ext}' for kind,ext in [('freeze','py'),('gate','js')])
    g=d/'serial-cold-gate-20261107-v1.json'
    if version in (365,366):assert not (root/g).exists();continue
    m=read(g); assert not m['candidateAdmitted'] and m['newAutonomousRuns']==0
    assert m['manifestSha256']==sha(root/m['manifest'])
    rows=m['rows']
    for p in {row['evidence'] for row in rows}:add_evidence(p,m['manifestSha256'])
    if version in (364,367):
        assert m['status']=='complete' and m['allClosed'] and len(rows)==1265 and m['measuredUniqueRoots']==825
        assert m['maxNativeInputs']==256 and m['maxMilliseconds']<=600
        assert all(r['complete'] and r['rootAndRngUnchanged'] and r['decisionGatePassed'] for r in rows)
    else:
        assert m['status']=='failed-gate' and m['failure']==rows[-1]
        assert not rows[-1]['decisionGatePassed']
    report[version]={'gate':str(g),'status':m['status'],'rows':len(rows),'failure':m.get('failure'),
                     'maxNativeInputs':m.get('maxNativeInputs'),'maxMilliseconds':m.get('maxMilliseconds')}
for version in (331,332,353,363):add_evidence(old/f'v{version}-cold-actual-v298-r4-venus-late-orbit-{date}.json')
add_evidence(old/f'v353-cold-corpus-actual-v187-074-{date}.json')
for p in (root/'adhoc').glob('*'):
    if p.name.startswith(('capture-v358-', 'measure-v358-', 'review-v358-', 'compare-v364-', 'compare-v367-', 'verify-v364-', 'verify-v365-', 'verify-v367-', 'diagnose-v367-')) and p.is_file():
        names.add('adhoc/'+p.name)
d=archive/'v367-canonical-default-weights-v1'
comparison=read(d/f'v367-first-two-native-roots-{date}.json')
assert comparison['expected']==comparison['compared']==304
assert comparison['graphDifferences']==comparison['actionDifferences']==comparison['valueDifferences']==0
assert sha(root/comparison['current'])==comparison['currentGateSha256']
evidence=read(d/f'v367-canonical-default-native-tail-evidence-{date}.json')
p={'phase':'v367-full-performance-and-first-two-native-graph-passed-functional-admission-pending',
   'production':'V323','baseline':'V41','first3':[15,48,90],'teacherR3':105,'fullRecord':{'version':'V189','score':120},
   'candidate':'V367','candidateAdmitted':False,'newAutonomousRuns':0,'firstTwoGraphsUnchanged':304,
   'gates':report,'nativeProof':evidence,'next':'Complete functional Node and Chrome admission with native controls, then run the unique autonomous first-three-round experiment.',
   'evidence':{n:sha(root/n) for n in sorted(names) if not n.endswith('.raw.json.gz')}}
(root/progress).write_text(json.dumps(p,indent=2)+'\n')
names.add(progress)
names.difference_update(tracked)
assert doc in names and progress in names
for n in names:
    src=root/n; dst=repo/n
    assert src.is_file() and n.startswith(('adhoc/','docs/','reports/')),n
    if n.endswith('.js'):subprocess.run(['node','--check',str(src)],check=True,capture_output=True)
    if n.endswith('.py'):compile(src.read_text(),n,'exec')
    if dst.exists():assert sha(dst)==sha(src),n
if '--stage' not in sys.argv:
    print(json.dumps({'status':'preflight-passed','files':len(names),'bytes':sum((root/n).stat().st_size for n in names),'productionChanged':False}))
    raise SystemExit
assert not index.exists() and not receipt.exists()
git('read-tree',base)
paths=sorted(names)
hashes=git('hash-object','-w','--stdin-paths',data=''.join(str(root/n)+'\n' for n in paths).encode()).decode().splitlines()
assert len(hashes)==len(paths) and all(blob((root/n).read_bytes())==h for n,h in zip(paths,hashes))
git('update-index','--index-info',data=''.join('100644 '+h+'\t'+n+'\n' for n,h in zip(paths,hashes)).encode())
tree=git('write-tree').decode().strip()
for n in ['randomizer','assets','tools','reports/iteration','reports/robot-iteration.html']:
    assert git('rev-parse',tree+':'+n)==git('rev-parse',base+':'+n)
assert set(git('diff','--cached','--name-only','-z',base).decode().strip('\0').split('\0'))==names
assert sha(repo/'.git/index')==shared
for n in paths:
    dst=repo/n;dst.parent.mkdir(parents=True,exist_ok=True)
    if not dst.exists():
        with dst.open('xb') as f:f.write((root/n).read_bytes())
    assert sha(dst)==sha(root/n),n
receipt.write_text(json.dumps({'status':'staged','base':base,'tree':tree,'files':paths,'index':str(index),'sharedIndexSha256':shared},indent=2)+'\n')
print(json.dumps({'status':'staged','tree':tree,'files':len(paths),'productionChanged':False}))
