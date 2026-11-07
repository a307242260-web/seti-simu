from functools import lru_cache
from pathlib import Path
import gzip, hashlib, json, os, subprocess, sys

root=Path(__file__).resolve().parents[1]
repo=Path('/Users/bilibili/code/seti-simu')
validated=Path('/private/tmp/seti-v372-functional-validation-20261107-v1')
base='82470397df884c02c7d86b04829a94992db0ff67'
out=Path('reports/ai-foundation-20261107/v372-blue-landing-supply-v1')
mp=out/'source-manifest-20261107-v2.json'
gp=out/'serial-cold-gate-20261107-v1.json'
pr=out/'source-admission-proof-20261107-v1.json'
index=Path('/private/tmp/seti-v372-source-admission-20261107-v1.index')
env={**os.environ,'GIT_INDEX_FILE':str(index),'GIT_OPTIONAL_LOCKS':'0'}
def git(*a,data=None):
    return subprocess.check_output(['git',*a],cwd=repo,env=env,input=data)
sha=lru_cache(maxsize=None)(lambda p:hashlib.sha256(p.read_bytes()).hexdigest())
read=lambda p:json.loads((root/p).read_text())
blob=lambda b:hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
shared=hashlib.sha256((repo/'.git/index').read_bytes()).hexdigest()
assert shared=='d01a449eea57aa1efd899d9490d7560eb2045de4b16d8c9627c4505a254a51bb'
assert git('rev-parse','HEAD').decode().strip()==base and git('branch','--show-current').strip()==b'dev'
m=read(mp);g=read(gp);o=read(out/'validation-overlay-20261107-v2.json')
fix=m['commentOnlyComparedWith'];previous=read(fix['manifest'])
assert sha(root/fix['manifest'])==fix['sha256']
path=fix['path'];prior=(root/out/'source-snapshot'/path).read_bytes();final=(root/path).read_bytes()
before,after=fix['before'].encode(),fix['after'].encode()
assert before.startswith(b'// ') and after.startswith(b'// ') and len(before)==len(after)
assert prior.count(before)==1 and prior.replace(before,after)==final and (root/fix['sourceSnapshot']).read_bytes()==final
assert hashlib.sha256(prior).hexdigest()==previous['sourceHashes'][path]
assert m['sourceHashes']=={**previous['sourceHashes'],path:hashlib.sha256(final).hexdigest()}
assert m['searchVersion']=='seti-complete-decision-search-v372'
assert g['status']=='complete' and g['allClosed'] and len(g['rows'])==1276 and g['manifestSha256']==fix['sha256']
assert g['maxNativeInputs']<=256 and g['maxMilliseconds']<=600
assert o['sourceManifest']==str(mp) and o['sourceManifestSha256']==sha(root/mp) and not o['runtimeChanged']
runtime=set(m['changedSources'])
assert len(runtime)==5
known={**m['baseRuntimeHashes'],**m['sourceHashes']}
for n,h in known.items():
    assert sha(root/n)==h,n
    assert sha(validated/n)==o['validationSourceHashes'].get(n,h),n
for n,h in o['validationSourceHashes'].items():
    assert n.endswith('.test.js') or n=='tools/audit_v_state_inputs.js'
    assert hashlib.sha256(git('show',base+':'+n)).hexdigest()==h,n
files={n:root/n for n in runtime}
evidence={str(p.relative_to(root)) for p in (root/out).rglob('*') if p.is_file() and '-cli-' not in p.name}
unique={}
for row in g['rows']:
    assert row['complete'] and row['decisionGatePassed'] and row['rootAndRngUnchanged'] and row['nativeInputs']<=256 and row['milliseconds']<=600
    prior=unique.get(row['identity'])
    if prior:
        assert prior==row['evidence'];continue
    p=row['evidence'];r=read(p);q=r['rawPath']
    assert r['candidateSourceManifestSha256']==g['manifestSha256'] and r['rawSha256']==sha(root/q) and r['fixtureSha256']==sha(root/r['fixture'])
    assert len(r['diagnostics']['limits'])==4 and all(x is None for x in r['diagnostics']['limits'].values())
    for n,h in r['sourceHashes'].items():
        if n==path:assert h==previous['sourceHashes'][n]
        else:assert known.get(n,h)==h and sha(root/n)==h,n
    raw=json.loads(gzip.decompress((root/q).read_bytes()))
    assert raw['complete'] and not raw['unresolved'] and raw['actionId']==row['actionId'] and raw['value']==row['value'] and raw['diagnostics']['nativeExecutions']==row['nativeInputs']
    unique[row['identity']]=p
    evidence.update((p,q))
assert len(unique)==g['measuredUniqueRoots']
front=read(out/'first-two-native-roots-20261107-v1.json')
assert front['compared']==304 and front['graphDifferences']==front['actionDifferences']==front['valueDifferences']==0
handoff=read(out/'landing-handoff-20261107-v1.checkpoint.json')
assert handoff['first3AutonomousRuns']==0 and handoff['cycle']==4 and handoff['endpointAndRngExact'] and len(handoff['path'])==38
supply=read(out/'landing-supply-20261107-v1.checkpoint.json')
assert supply['rootAndRngRestored'] and len(supply['chain'])==4
assert supply['rows'][0]['lines'][0]['landingCompanyRetained']==supply['rows'][2]['lines'][0]['landingCompanyRetained']==1
node=(root/out/'full-node-20261107-v1.log').read_text()
assert 'SUMMARY unit passed=227 failed=1 total=228' in node and 'SUMMARY fullFlow passed=1 failed=0 total=1' in node
assert [l for l in node.splitlines() if l.startswith('FAIL ')]==['FAIL randomizer/app/host-architecture-audit.test.js status=1 signal=none']
host=(root/out/'host-architecture-comment-only-20261107-v1.log').read_text()
assert 'SUMMARY unit passed=1 failed=0 total=1' in host
audit=(root/out/'input-audit-20261107-v1.log').read_text()
assert audit.count('[PASS]')==66 and '[FAIL]' not in audit
assert 'SUMMARY browserSmoke passed=6 failed=0 total=6' in (root/out/'browser-20261107-v2.log').read_text()
evidence.update('adhoc/'+p for p in ['deliver-v372-source-admission-20261107-v1.py','freeze-v372-blue-landing-supply-20261107-v1.py',
    'gate-v372-blue-landing-supply-20261107-v1.js','compare-v372-first-two-native-roots-20261107-v1.py',
    'review-v372-blue-landing-handoff-20261107-v1.js','verify-v372-blue-landing-supply-20261107-v1.js'])
evidence.add('docs/human405-v372-blue-landing-admission-20261107.md')
files.update({p:root/p for p in evidence})
files['adhoc/verify-v372-blue-landing-browser-20261107-v1.py']=validated/'adhoc/verify-v372-blue-landing-browser-20261107-v1.py'
for p,f in files.items():
    assert f.is_file(),p
    if p.endswith('.js'):subprocess.run(['node','--check',str(f)],check=True,capture_output=True)
    if p.endswith('.py'):compile(f.read_text(),p,'exec')
    if p not in runtime and (repo/p).exists():assert sha(repo/p)==sha(f),p
if '--stage' not in sys.argv:
    print(json.dumps({'preflight':'passed','cases':len(g['rows']),'roots':len(unique),'firstTwo':304,'paths':len(files)}))
    raise SystemExit(0)
assert not index.exists()
git('read-tree',base)
def add(paths):
    paths=sorted(paths)
    oids=git('hash-object','-w','--stdin-paths',data=''.join(str(files[n])+'\n' for n in paths).encode()).decode().splitlines()
    assert len(oids)==len(paths)
    for n,oid in zip(paths,oids):assert blob(files[n].read_bytes())==oid,n
    git('update-index','--index-info',data=''.join('100644 '+oid+'\t'+n+'\n' for n,oid in zip(paths,oids)).encode())
add(runtime)
sourceTree=git('write-tree').decode().strip()
scopes={n:git('rev-parse',sourceTree+':'+n).decode().strip() for n in ['randomizer','assets','tools']}
for n in ('assets','tools'):assert scopes[n]==git('rev-parse',base+':'+n).decode().strip()
proof={'status':'source-admitted','sourceAdmitted':True,'runtime':'V372','baseCommit':base,'snapshotTree':sourceTree,'runtimeSubtrees':scopes,
       'manifest':str(mp),'manifestSha256':sha(root/mp),'validationOverlay':str(out/'validation-overlay-20261107-v2.json'),
       'validationOverlaySha256':sha(root/out/'validation-overlay-20261107-v2.json'),
       'runtimeFiles':{n:sha(files[n]) for n in sorted(runtime)},'completeNamedColdCases':len(g['rows']),'uniqueNativeRoots':len(unique),
       'maxNativeInputs':g['maxNativeInputs'],'maxMilliseconds':g['maxMilliseconds'],'coldGateSha256':sha(root/gp),
       'commentOnlyBeforeGateArtifact':fix['sha256'],'firstTwoFullGraphsUnchanged':304,'fullNodeUnitPassed':228,'fullNodeFlowPassed':1,'browserRelevantPassed':6,'inputAuditPassed':66,
       'fourRuntimeBudgetsStillNull':True,'baseline':'V41','developmentAligned':False,'newAutonomousRuns':0}
with (root/pr).open('x') as f:json.dump(proof,f,ensure_ascii=False,indent=2);f.write('\n')
files[str(pr)]=root/pr
add(set(files)-runtime)
tree=git('write-tree').decode().strip()
for n,h in scopes.items():assert git('rev-parse',tree+':'+n).decode().strip()==h
for n in ('reports/iteration','reports/robot-iteration.html'):assert git('rev-parse',tree+':'+n)==git('rev-parse',base+':'+n)
assert set(git('diff','--cached','--name-only','-z',base).decode().strip('\0').split('\0'))==set(files)
assert hashlib.sha256((repo/'.git/index').read_bytes()).hexdigest()==shared
for n,f in files.items():
    if n in runtime:continue
    t=repo/n;t.parent.mkdir(parents=True,exist_ok=True)
    if not t.exists():
        with t.open('xb') as fd:fd.write(f.read_bytes())
    assert sha(t)==sha(f),n
print(json.dumps({'status':'staged','tree':tree,'paths':len(files),'sourceProof':str(pr)}))
