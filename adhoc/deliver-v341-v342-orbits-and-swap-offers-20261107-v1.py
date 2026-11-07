from pathlib import Path
import hashlib,json,os,subprocess,sys
root=Path(__file__).resolve().parents[1]
repo=Path('/Users/bilibili/code/seti-simu')
base='cf4e137e2350df3a81753c5777b888280b1fc241'
D=[Path('reports/ai-foundation-20261107')/p for p in ['v341-analysis-invariants-v1','v342-swap-offer-public-context-v1']]
index=Path('/private/tmp/seti-v341-v342-orbits-and-swap-offers-delivery-20261107-v1.index')
receipt=Path('/private/tmp/seti-v341-v342-orbits-and-swap-offers-delivery-20261107-v1.json')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
blob=lambda b:hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
read=lambda p:json.loads((root/p).read_text())
shared=sha(repo/'.git/index')
env={**os.environ,'GIT_OPTIONAL_LOCKS':'0','GIT_INDEX_FILE':str(index)}
def git(*args,data=None):return subprocess.check_output(['git',*args],input=data,cwd=repo,env=env)
assert git('rev-parse','HEAD').decode().strip()==base
assert git('branch','--show-current').strip()==b'dev'
gates=[read(d/'serial-cold-gate-20261107-v1.json') for d in D]
assert all(g['status']=='failed-gate' and g['failure']['label']=='income-before-amiba' and g['failure']['milliseconds']>600 for g in gates)
assert len(gates)==2 and all(len(g['rows'])==1 and g['rows'][0]['complete'] and g['rows'][0]['nativeInputs']==106 and g['newAutonomousRuns']==0 for g in gates)
v=read(D[1]/'verification-20261107-v1.json')
assert v['fullGraphV340V341V342Exact'] and v['rootAndRngRestored'] and v['nativeInputs']==35
assert v['swapOffers']['sourceExact']==177 and v['swapOffers']['maskedRow']==48
assert 'SUMMARY unit passed=7 failed=0' in (root/D[1]/'related-node-20261107-v1.log').read_text()
audit=(root/D[1]/'value-input-audit-20261107-v1.log').read_text().splitlines()
assert sum(s.startswith('[PASS]') for s in audit)==65
assert [s for s in audit if s.startswith('[FAIL]')]==['[FAIL] decisionObs(装配后): schema=true scoring=true progress=true assets=true hand=true V=THROW: Cannot add property aomomo, object is not extensib']
paths={str(p.relative_to(root)) for d in D for p in (root/d).rglob('*') if p.is_file()}
paths.add('docs/human405-v341-v342-swap-offers-and-r4-orbits-20261107.md')
for p in ['freeze-v341-analysis-invariants','gate-v341-analysis-invariants','freeze-v342-swap-offer-public-context','gate-v342-swap-offer-public-context','review-v323-r4-second-turn-mission-roots','review-v323-r4-second-turn-orbits','verify-v342-swap-offer-public-inputs','verify-v341-v342-orbits-and-swap-offers','deliver-v341-v342-orbits-and-swap-offers']:
 matches=list((root/'adhoc').glob(p+'-20261107-v1.*'));assert len(matches)==1,p
 paths.add(str(matches[0].relative_to(root)))
for g in gates:
 for row in g['rows']:
  e=read(row['evidence']);assert e['rawSha256']==sha(root/e['rawPath']);assert e['candidateSourceManifestSha256']==g['manifestSha256']
  paths.update((row['evidence'],e['rawPath']))
 assert sha(root/g['manifest'])==g['manifestSha256']
progress='adhoc/human405-third-round-progress-20261107-v37.json'
p={'phase':'v342-shared-public-swap-context-exact-r4-blue1-converts-energy-gate-open','production':'V323','baseline':'V41','first3':[15,48,90],'teacherR3':105,'fullRecord':{'version':'V189','score':120},'candidate':'V342','candidateAdmitted':False,'newAutonomousRuns':0,'gates':[g['failure'] for g in gates],'nativeControls':v['secondTurn'],'newFixedNativeInputs':35,'next':'Reduce repeated shared-purpose work inside the 177 exact offers (private mission and income keys or audited funding). Keep all unproven branches and 600ms cold gate. Reconcile R3 preinvestment with the new R4 funded Uranus witness.', 'evidence':{n:sha(root/n) for n in sorted(paths)}}
if (root/progress).exists():assert read(progress)==p
else:(root/progress).write_text(json.dumps(p,indent=2)+'\n')
paths.add(progress)
for n in paths:
 src=root/n;dst=repo/n
 assert src.is_file() and n.startswith(('adhoc/','docs/','reports/')),n
 if n.endswith('.js'):subprocess.run(['node','--check',str(src)],check=True,capture_output=True)
 if n.endswith('.py'):compile(src.read_text(),n,'exec')
 if dst.exists():assert sha(dst)==sha(src),n
 assert not git('ls-tree',base,'--',n),n
if '--stage' not in sys.argv:
 print(json.dumps({'status':'preflight-passed','files':len(paths),'bytes':sum((root/n).stat().st_size for n in paths),'productionChanged':False}));raise SystemExit
assert not index.exists() and not receipt.exists()
git('read-tree',base)
names=sorted(paths);hashes=git('hash-object','-w','--stdin-paths',data=''.join(str(root/n)+'\n' for n in names).encode()).decode().splitlines()
assert len(hashes)==len(names) and all(blob((root/n).read_bytes())==h for n,h in zip(names,hashes))
git('update-index','--index-info',data=''.join('100644 '+h+'\t'+n+'\n' for n,h in zip(names,hashes)).encode())
tree=git('write-tree').decode().strip()
for x in ['randomizer','assets','tools','reports/iteration','reports/robot-iteration.html']:assert git('rev-parse',tree+':'+x)==git('rev-parse',base+':'+x)
assert set(git('diff','--cached','--name-only','-z',base).decode().strip('\0').split('\0'))==paths
assert sha(repo/'.git/index')==shared
for n in names:
 dst=repo/n;dst.parent.mkdir(parents=True,exist_ok=True)
 if not dst.exists():
  with dst.open('xb')as f:f.write((root/n).read_bytes())
 assert sha(dst)==sha(root/n),n
receipt.write_text(json.dumps({'status':'staged','base':base,'tree':tree,'files':names,'index':str(index),'sharedIndexSha256':shared},indent=2)+'\n')
print(json.dumps({'status':'staged','tree':tree,'files':len(paths),'productionChanged':False}))
