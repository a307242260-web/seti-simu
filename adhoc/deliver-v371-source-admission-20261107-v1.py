from pathlib import Path
from functools import lru_cache
import collections,gzip,hashlib,json,os,subprocess,sys
root=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='485e8fcfe57f99980c2bc8dd3ec8b78542c6940b'
temp=Path('/private/tmp');index=temp/'seti-v371-source-admission-20261107-v1.index';receipt=temp/'seti-v371-source-admission-20261107-v1.stage.json'
D=Path('reports/ai-foundation-20261107/v371-spent-swap-offer-v1');prev=Path('reports/ai-foundation-20261107/v370-spent-swap-offer-v1')
mp=D/'source-manifest-20261107-v1.json';proof=D/'source-admission-proof-20261107-v1.json'
rawsha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
sha=lru_cache(maxsize=None)(rawsha)
read=lambda n:json.loads((root/n).read_text())
blob=lambda b:hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
env={**os.environ,'GIT_INDEX_FILE':str(index),'GIT_OPTIONAL_LOCKS':'0'}
def git(*args,data=None):return subprocess.check_output(['git',*args],input=data,env=env,cwd=repo)
shared=rawsha(repo/'.git/index');assert git('rev-parse','HEAD').decode().strip()==base and git('branch','--show-current').strip()==b'dev'
manifest=read(mp);overlay=read(D/'seti-v371-validation-overlay-20261107-v1.json')
assert overlay['sourceManifest']==str(mp) and overlay['sourceManifestSha256']==sha(root/mp) and not overlay['runtimeChanged']
allowed=overlay['validationSourceHashes'];assert len(allowed)==16 and all(n.endswith('.test.js') or n=='tools/audit_v_state_inputs.js' for n in allowed)
expected={**manifest['baseRuntimeHashes'],**manifest['sourceHashes'],**allowed}
for n,h in expected.items():assert sha(root/n)==h,n
g=read(D/'serial-cold-gate-20261107-v1.json')
assert g['status']=='complete' and g['allClosed'] and len(g['rows'])==1268 and g['measuredUniqueRoots']==828
assert g['manifestSha256']==sha(root/mp) and g['maxNativeInputs']==256 and g['maxMilliseconds']<=600
evidence={str(p.relative_to(root)) for d in [D,prev] for p in (root/d).rglob('*') if p.is_file() and (d==prev or '-cli-' not in p.name)}
assert read(prev/'serial-cold-gate-20261107-v1.json')['status']=='failed-execution'
evidence.add('adhoc/'+Path(__file__).name)
for n in ['freeze-v370-spent-swap-offer','freeze-v371-spent-swap-offer','gate-v370-spent-swap-offer','gate-v371-spent-swap-offer',
          'compare-v371-first-two-native-roots','verify-v371-spent-swap-native-parity','prepare-v371-validation-overlay','review-v371-r4-three-tech-native','review-v369-funded-research-native']:
    ext='py' if n.startswith(('freeze','compare')) else 'js';evidence.add(f'adhoc/{n}-20261107-v1.{ext}')
evidence.add('docs/human405-v371-spent-swap-and-r4-20261107.md')
unique={}
for row in g['rows']:
    assert row['complete'] and row['decisionGatePassed'] and row['rootAndRngUnchanged'] and row['nativeInputs']<=256 and row['milliseconds']<=600
    if row['identity'] in unique:
        assert row['evidence']==unique[row['identity']];continue
    e=read(row['evidence']);q=e['rawPath']
    assert e['candidateSourceManifestSha256']==g['manifestSha256'] and e['rawSha256']==sha(root/q) and e['fixtureSha256']==sha(root/e['fixture'])
    assert len(e['diagnostics']['limits'])==4 and all(v is None for v in e['diagnostics']['limits'].values())
    assert all(expected.get(n,h)==h and sha(root/n)==h for n,h in e['sourceHashes'].items())
    raw=json.loads(gzip.decompress((root/q).read_bytes()))
    assert raw['complete'] and not raw['unresolved'] and raw['actionId']==row['actionId'] and raw['value']==row['value'] and raw['diagnostics']['nativeExecutions']==row['nativeInputs']
    evidence.update((row['evidence'],q));unique[row['identity']]=row['evidence']
assert len(unique)==828
first=read(D/'v371-first-two-native-roots-20261107-v1.json')
assert first['compared']==304 and first['graphDifferences']==first['actionDifferences']==first['valueDifferences']==0
test=lambda n:(root/D/n).read_text()
node=test('seti-v371-overlay-full-node-20261107-v1.log');audit=test('seti-v371-overlay-audit-20261107-v1.log')
assert 'SUMMARY unit passed=228 failed=0 total=228' in node and 'SUMMARY fullFlow passed=1 failed=0 total=1' in node and '\nFAIL ' not in node
assert audit.count('[PASS]')==66 and '[FAIL]' not in audit
assert 'SUMMARY browserSmoke passed=4 failed=0 total=4' in test('seti-v371-browser-native-parity-20261107-v1.log')
assert 'SUMMARY browserSmoke passed=2 failed=0 total=2' in test('seti-v371-sector-task-browser-20261107-v1.log')
assert read(D/'seti-v371-spent-swap-native-parity-20261107-v1.json')['inputs']==27
assert read(D/'seti-v371-r4-three-tech-native-20261107-v1.json')['inputs']==44
tracked={}
for row in git('ls-tree','-r','-z',base).decode().split('\0'):
    if row:
        info,n=row.split('\t');mode,kind,oid=info.split(' ');tracked[n]=(mode,kind,oid)
runtime={}
for n,(mode,kind,oid) in tracked.items():
    if not n.startswith(('randomizer/','assets/','tools/')):continue
    assert kind=='blob' and (root/n).is_file(),n
    if blob((root/n).read_bytes())!=oid:
        assert n in expected,n;runtime[n]=mode
for n in expected:
    if n.startswith(('randomizer/','assets/','tools/')) and n not in tracked:runtime[n]='100644'
assert runtime and not (evidence&runtime.keys())
assert all((root/n).is_file() for n in evidence)
evidence.difference_update(tracked)
for n in sorted(evidence|set(runtime)):
    if n.endswith('.js'):subprocess.run(['node','--check',str(root/n)],check=True,capture_output=True)
    if n.endswith('.py'):compile((root/n).read_text(),n,'exec')
    t=repo/n
    if n in evidence and t.exists():assert sha(t)==sha(root/n),n
if '--stage' not in sys.argv:
    print(json.dumps({'status':'preflight-passed','evidenceFiles':len(evidence),'runtimeFiles':len(runtime),'nativeRoots':828,'firstTwoExact':304}));sys.exit(0)
assert not index.exists() and not receipt.exists()
git('read-tree',base)
def stage(names):
    paths=sorted(names)
    hashes=git('hash-object','-w','--stdin-paths',data=''.join(str(root/n)+'\n' for n in paths).encode()).decode().splitlines()
    assert len(hashes)==len(paths)
    for n,h in zip(paths,hashes):assert h==blob((root/n).read_bytes())
    git('update-index','--index-info',data=''.join(runtime.get(n,'100644')+' '+h+'\t'+n+'\n' for n,h in zip(paths,hashes)).encode())
stage(runtime)
tree=git('write-tree').decode().strip()
scopes={n:git('rev-parse',tree+':'+n).decode().strip() for n in ('randomizer','assets','tools')}
verification={'status':'source-admitted','sourceAdmitted':True,'runtime':'V371','baseCommit':base,'snapshotTree':tree,
 'runtimeSubtrees':scopes,'manifest':str(mp),'manifestSha256':sha(root/mp),'validationOverlay':str(D/'seti-v371-validation-overlay-20261107-v1.json'),
 'validationOverlaySha256':sha(root/D/'seti-v371-validation-overlay-20261107-v1.json'),'runtimeFiles':{n:sha(root/n) for n in sorted(runtime)},
 'completeNamedColdCases':1268,'uniqueNativeRoots':828,'maxNativeInputs':g['maxNativeInputs'],'maxMilliseconds':g['maxMilliseconds'],
 'coldGateSha256':sha(root/D/'serial-cold-gate-20261107-v1.json'),'nativeRootAndRngPreserved':True,'oldFailureHistoryPreserved':True,
 'firstTwoFullGraphsUnchanged':304,'fullNodeUnitPassed':228,'fullNodeFlowPassed':1,'browserRelevantPassed':6,'inputAuditPassed':66,
 'fourRuntimeBudgetsStillNull':True,'baseline':'V41','developmentAligned':False,'newAutonomousRuns':0}
with (root/proof).open('x') as f:json.dump(verification,f,ensure_ascii=False,indent=2);f.write('\n')
evidence.add(str(proof));stage(evidence)
final=git('write-tree').decode().strip();names=evidence|set(runtime)
for n,h in scopes.items():assert git('rev-parse',final+':'+n).decode().strip()==h
for n in ('reports/iteration','reports/robot-iteration.html'):assert git('rev-parse',final+':'+n)==git('rev-parse',base+':'+n)
assert set(git('diff','--cached','--name-only','-z',base).decode().strip('\0').split('\0'))==names and rawsha(repo/'.git/index')==shared
for n in evidence:
    t=repo/n;t.parent.mkdir(parents=True,exist_ok=True)
    if not t.exists():
        with t.open('xb') as f:f.write((root/n).read_bytes())
    assert sha(t)==sha(root/n)
receipt.write_text(json.dumps({'status':'staged','base':base,'tree':final,'sourceProof':str(proof),'sourceProofSha256':sha(root/proof),'runtime':sorted(runtime),'files':sorted(names),'index':str(index),'sharedIndexSha256':shared},indent=2)+'\n')
print(json.dumps({'status':'staged','tree':final,'files':len(names),'runtimeFiles':len(runtime),'sourceProof':str(proof)}))
