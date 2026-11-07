from pathlib import Path
import hashlib,json,os,subprocess,sys
root=Path(__file__).resolve().parents[1]
repo=Path('/Users/bilibili/code/seti-simu')
base='55974f4079fa398746c91e9fa35f8d3a6b21a6e5'
D=[Path('reports/ai-foundation-20261107')/p for p in ['v330-trace-quote-v1','v331-paid-research-v1','v332-known-alien-tail-v1']]
index=Path('/private/tmp/seti-v330-v332-known-alien-tail-delivery-20261107-v1.index')
receipt=Path('/private/tmp/seti-v330-v332-known-alien-tail-delivery-20261107-v1.json')
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
assert [len(g['rows']) for g in gates]==[1,1,3] and all(r['decisionGatePassed'] for r in gates[2]['rows'][:2])
v=read(D[1]/'verification-20261107-v1.json');assert v['quoteCases']==1024 and v['modelCases']==818 and v['graphExact']==[329,330,331]
q=read(D[2]/'verified-known-alien-tail-20261107-v1.json');assert q['worlds']==6 and q['rootAndRngUnchanged'] and q['selected']=='choose_target:06ca6510'
t=read(D[2]/'actual-r3-tech-and-known-card-development-20261107-v1.json');assert [v['score'] for v in t['endpoints'].values()]==[90,90,91] and t['controlledNativeInputs']==233
assert 'passed=6 failed=0' in (root/D[1]/'related-node-20261107-v1.log').read_text()
assert 'passed=4 failed=0' in (root/D[2]/'related-node-20261107-v1.log').read_text()
paths={str(p.relative_to(root)) for d in D for p in (root/d).rglob('*') if p.is_file()}
paths.add('docs/human405-v330-v332-known-alien-tail-20261107.md')
for p in ['freeze-v330-trace-quote','gate-v330-trace-quote','freeze-v331-paid-research','gate-v331-paid-research','freeze-v332-known-alien-tail','gate-v332-known-alien-tail','measure-v329-mission-reward-shapes','measure-v330-paid-research-quote-reuse','verify-v330-v331-reuse-and-tech-controls','verify-v332-known-alien-tail','capture-v323-actual-r3-known-alien-roots','review-v323-r3-tech-native-counterfactuals','review-v323-r3-tech-native-repair','review-v323-r3-tech-blue-trace','review-v323-r3-tech-trace-cards','review-v323-r3-purple2-known-amiba7','review-v323-r3-purple1-known-amiba7','deliver-v330-v332-known-alien-tail']:
 matches=list((root/'adhoc').glob(p+'-20261107-v1.*'));assert len(matches)==1,p
 paths.add(str(matches[0].relative_to(root)))
for g in gates:
 for row in g['rows']:
  e=read(row['evidence']);assert e['rawSha256']==sha(root/e['rawPath']);assert e['candidateSourceManifestSha256']==g['manifestSha256']
  paths.update((row['evidence'],e['rawPath']))
 assert sha(root/g['manifest'])==g['manifestSha256']
progress='adhoc/human405-third-round-progress-20261107-v33.json'
p={'phase':'v332-actual-known-alien-tail-fixed-purple2-native-91-gate-still-failed','production':'V323','baseline':'V41','first3':[15,48,90],'fullRecord':{'version':'V189','score':120},'candidate':'V332','candidateAdmitted':False,'newAutonomousRuns':0,'gates':[g['failure'] for g in gates],'next':'Keep verified visible alien continuation. Profile remaining slow income window and compare cost of repeated native/shared portfolio quotes; then expose one affordable follow-up analysis/card/data purpose at the real step187 root so Purple2 can be valued on the same planned endpoint.', 'evidence':{n:sha(root/n) for n in sorted(paths)}}
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
