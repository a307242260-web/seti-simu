from functools import lru_cache
from pathlib import Path
import gzip,hashlib,json,os,subprocess,sys

root=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu')
validated=Path('/private/tmp/seti-v375-functional-validation-20261107-v1')
base='1de44065945bcc87f713e02e1ecc3444e10ca49d'
out=Path('reports/ai-foundation-20261107/v375-known-research-data-v1');mp=out/'source-manifest-20261107-v1.json';gp=out/'serial-cold-gate-20261107-v1.json';pr=out/'source-admission-proof-20261107-v1.json'
index=Path('/private/tmp/seti-v375-known-research-admission-20261107-v1.index')
env={**os.environ,'GIT_INDEX_FILE':str(index),'GIT_OPTIONAL_LOCKS':'0'}
def git(*a,data=None):return subprocess.check_output(['git',*a],cwd=repo,env=env,input=data)
sha=lru_cache(maxsize=None)(lambda p:hashlib.sha256(p.read_bytes()).hexdigest())
read=lambda p:json.loads((root/p).read_bytes())
blob=lambda b:hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
shared=sha(repo/'.git/index');assert shared=='d01a449eea57aa1efd899d9490d7560eb2045de4b16d8c9627c4505a254a51bb'
assert git('rev-parse','HEAD').decode().strip()==base and git('branch','--show-current').strip()==b'dev'
m,g=read(mp),read(gp);runtime=set(m['changedSources']);assert len(runtime)==5
assert m['searchVersion']=='seti-complete-decision-search-v375' and m['candidateAdmitted'] is False
assert sha(root/m['parentManifest'])==m['parentManifestSha256'] and sha(root/m['previousGate'])==m['previousGateSha256']
assert g['status']=='complete' and g['allClosed'] and len(g['rows'])==1281 and g['manifestSha256']==sha(root/mp)
assert g['maxNativeInputs']<=256 and g['maxMilliseconds']<=600
known={**m['baseRuntimeHashes'],**m['sourceHashes']}
for n,h in known.items():assert sha(root/n)==h,n
for p in (root/'randomizer').rglob('*'):
 if p.is_file() and p.name.endswith(('.js','.html','.css')) and '.test.' not in p.name and '.browser-smoke.' not in p.name:
  assert sha(validated/p.relative_to(root))==sha(p),p
for n in runtime:assert sha(root/m['changedSourceSnapshot']/n)==sha(root/n)
files={n:root/n for n in runtime};evidence={str(p.relative_to(root)) for p in (root/out).rglob('*') if p.is_file() and '-cli-' not in p.name}
unique={}
for row in g['rows']:
 assert row['complete'] and row['decisionGatePassed'] and row['rootAndRngUnchanged'] and row['nativeInputs']<=256 and row['milliseconds']<=600
 if row['identity'] in unique:
  assert unique[row['identity']]==row['evidence'];continue
 p=row['evidence'];r=read(p);q=r['rawPath']
 assert r['candidateSourceManifestSha256']==g['manifestSha256'] and r['rawSha256']==sha(root/q) and r['fixtureSha256']==sha(root/r['fixture'])
 assert len(r['diagnostics']['limits'])==4 and all(x is None for x in r['diagnostics']['limits'].values())
 for n,h in r['sourceHashes'].items():assert known.get(n,h)==h and sha(root/n)==h,n
 raw=json.loads(gzip.decompress((root/q).read_bytes()));assert raw['complete'] and not raw['unresolved'] and raw['actionId']==row['actionId'] and raw['value']==row['value'] and raw['diagnostics']['nativeExecutions']==row['nativeInputs']
 unique[row['identity']]=p;evidence.update((p,q))
assert len(unique)==g['measuredUniqueRoots']==840
front=read(out/'first-two-native-roots-20261107-v1.json');assert front['compared']==304 and front['graphDifferences']==front['actionDifferences']==front['valueDifferences']==0
h=read(out/'red-task-handoff-20261107-v1.checkpoint.json');assert h['first3AutonomousRuns']==0 and h['endpointAndRngExact'] and len(h['path'])==35
assert h['end']['wallet']['score']==101 and len(h['end']['tech']['ownedTiles'])==6 and len(h['end']['probes'])==1
pair=read(out/'known-research-data-20261107-v1.checkpoint.json')['rows'];assert [r['selected']['tileId'] for r in pair]==['blue1','purple1','purple1']
assert [r['raw']['value'] for r in pair]==[171,178.5,178.5] and all(r['raw']['diagnostics']['nativeExecutions']==123 for r in pair)
assert pair[0]['physical']==pair[1]['physical'] and pair[1]['quotes']==pair[2]['quotes']
node=(root/out/'full-node-20261107-v1.log').read_text();assert 'SUMMARY unit passed=228 failed=0 total=228' in node and 'SUMMARY fullFlow passed=1 failed=0 total=1' in node
browser=(root/out/'browser-20261107-v2.log').read_text();assert 'SUMMARY browserSmoke passed=6 failed=0 total=6' in browser
au=(root/out/'input-audit-20261107-v1.log').read_text();assert au.count('[PASS]')==66 and '[FAIL]' not in au

evidence.update('adhoc/'+p for p in ['deliver-v375-known-research-admission-20261107-v1.py','freeze-v375-known-research-data-20261107-v1.py','gate-v375-known-research-data-20261107-v1.js','compare-v375-first-two-native-roots-20261107-v1.py','control-v374-third-research-funding-20261107-v1.js','diagnose-v374-third-research-portfolio-20261107-v1.js','verify-v375-known-research-data-20261107-v1.js'])
evidence.add('docs/human405-v375-known-research-data-admission-20261107.md')
files.update({p:root/p for p in evidence});files['adhoc/verify-v375-known-research-browser-20261107-v1.py']=validated/'adhoc/verify-v375-known-research-browser-20261107-v1.py'
for p,f in files.items():
 assert f.is_file(),p
 if p.endswith('.js') and ('/source-snapshot/' not in p):subprocess.run(['node','--check',str(f)],check=True,capture_output=True)
 if p.endswith('.py'):compile(f.read_text(),p,'exec')
 if p not in runtime and (repo/p).exists():assert sha(repo/p)==sha(f),p
if '--stage' not in sys.argv:print('preflight',len(files),'paths');raise SystemExit(0)
assert not index.exists();git('read-tree',base)
def add(paths):
 paths=sorted(paths);oids=git('hash-object','-w','--stdin-paths',data=''.join(str(files[n])+'\n' for n in paths).encode()).decode().splitlines();assert len(oids)==len(paths)
 for n,oid in zip(paths,oids):assert blob(files[n].read_bytes())==oid,n
 git('update-index','--index-info',data=''.join('100644 '+oid+'\t'+n+'\n' for n,oid in zip(paths,oids)).encode())
add(runtime);sourceTree=git('write-tree').decode().strip();scopes={n:git('rev-parse',sourceTree+':'+n).decode().strip() for n in ['randomizer','assets','tools']}
for n in ('assets','tools'):assert scopes[n]==git('rev-parse',base+':'+n).decode().strip()
proof={'status':'source-admitted','sourceAdmitted':True,'runtime':'V375','baseCommit':base,'snapshotTree':sourceTree,'runtimeSubtrees':scopes,
       'manifest':str(mp),'manifestSha256':sha(root/mp),'runtimeFiles':{n:sha(files[n]) for n in sorted(runtime)},'completeNamedColdCases':len(g['rows']),'uniqueNativeRoots':len(unique),
       'maxNativeInputs':g['maxNativeInputs'],'maxMilliseconds':g['maxMilliseconds'],'coldGateSha256':sha(root/gp),'firstTwoFullGraphsUnchanged':304,
       'fullNodeUnitPassed':228,'fullNodeFlowPassed':1,'browserRelevantPassed':6,'inputAuditPassed':66,'fourRuntimeBudgetsStillNull':True,'baseline':'V41','developmentAligned':False,'newAutonomousRuns':0}
with (root/pr).open('x') as f:json.dump(proof,f,ensure_ascii=False,indent=2);f.write('\n')
files[str(pr)]=root/pr;add(set(files)-runtime);tree=git('write-tree').decode().strip()
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
