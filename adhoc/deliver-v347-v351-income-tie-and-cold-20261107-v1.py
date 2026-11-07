from pathlib import Path
import gzip,hashlib,json,os,re,subprocess,sys
root=Path(__file__).resolve().parents[1]
repo=Path('/Users/bilibili/code/seti-simu')
base='caea2694c8a51f2d321144536f2f2999ee321f1c'
tags=['v347-base-investment-once','v348-swap-existing-income','v349-income-card-printed-type','v350-reserve-analysis-scope','v351-known-income-scan-funding']
D=[Path('reports/ai-foundation-20261107')/(p+'-v1') for p in tags]
index=Path('/private/tmp/seti-v347-v351-income-tie-delivery-20261107-v1.index')
receipt=Path('/private/tmp/seti-v347-v351-income-tie-delivery-20261107-v1.json')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
blob=lambda b:hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
read=lambda p:json.loads((root/p).read_text())
raw=lambda p:json.loads(gzip.decompress((root/p).read_bytes()))
shared=sha(repo/'.git/index')
env={**os.environ,'GIT_OPTIONAL_LOCKS':'0','GIT_INDEX_FILE':str(index)}
def git(*args,data=None):return subprocess.check_output(['git',*args],input=data,cwd=repo,env=env)
def normalize(x):
 if isinstance(x,dict):return {k:normalize(v) for k,v in x.items() if k!='milliseconds'}
 if isinstance(x,list):return [normalize(v) for v in x]
 if isinstance(x,str):return re.sub(r'seti-complete-decision-search-v(34[6-9]|35[01])','seti-complete-decision-search-vXXX',x).replace('seti-purpose-card-pick-policy-v15','seti-purpose-card-pick-policy-v14')
 return x
assert git('rev-parse','HEAD').decode().strip()==base
assert git('branch','--show-current').strip()==b'dev'
gates=[read(d/'serial-cold-gate-20261107-v1.json') for d in D]
assert all(g['status']=='failed-gate' and len(g['rows'])==1 and g['newAutonomousRuns']==0 and not g['candidateAdmitted'] for g in gates)
reference='reports/ai-foundation-20261105/third-round-teacher-v1/v346-cold-income-before-amiba-20261107-v1.raw.json.gz'
ref=normalize(raw(reference)); docs='docs/human405-v347-v351-income-tie-and-cold-20261107.md'
paths={str(p.relative_to(root)) for d in D for p in (root/d).rglob('*') if p.is_file()};paths.add(docs)
patterns=[f'{kind}-{tag}-20261107-v1.*' for tag in tags for kind in ('freeze','gate')]+['review-v323-r3-income-*-20261107-v1.js','measure-v346-*-20261107-v1.js','verify-v351-known-income-scan-funding-20261107-v1.js',Path(__file__).name]
for pattern in patterns:
 matches=list((root/'adhoc').glob(pattern));assert matches,pattern
 paths.update(str(p.relative_to(root)) for p in matches)
for g in gates:
 row=g['rows'][0]; e=read(row['evidence']); assert g['failure']==row and row['label']=='income-before-amiba' and row['nativeInputs']==106 and row['milliseconds']>600 and row['complete'] and row['rootAndRngUnchanged'] and not row['decisionGatePassed']
 assert e['rawSha256']==sha(root/e['rawPath']) and e['candidateSourceManifestSha256']==g['manifestSha256']==sha(root/g['manifest'])
 assert normalize(raw(e['rawPath']))==ref
 paths.update((row['evidence'],e['rawPath']))
assert 'SUMMARY unit passed=10 failed=0' in (root/D[3]/'related-node-20261107-v1.log').read_text()
assert 'SUMMARY unit passed=5 failed=0' in (root/D[4]/'related-node-20261107-v1.log').read_text()
audit=(root/D[4]/'state-input-audit-20261107-v1.log').read_text();assert audit.count('[PASS]')==66 and '[FAIL]' not in audit
sel=read(D[4]/'income-166-selection-verification-20261107-v1.json');assert sel['old']=='choose_card:2db479c6' and sel['candidate']=='choose_card:710b84b9' and len(sel['guards'])==9 and sel['searchNodesAdded']==sel['newAutonomousRuns']==0
assert sel['fixtureSha256']==sha(root/sel['fixture']) and sel['candidateManifestSha256']==gates[-1]['manifestSha256']
control={n:raw(D[4]/f'v323-r3-income-{n}-20261107-v1.raw.json.gz') for n in ('169-root','166-public-energy','energy-purple4')}
assert control['169-root']['steps']==33 and control['166-public-energy']['nativeInputs']==85 and control['energy-purple4']['nativeInputs']==44
assert all(d['newAutonomousRuns']==0 and d.get('sourceAndRngRestored',d.get('rootAndRngRestored')) for d in control.values())
start=control['166-public-energy']['rows'][0]['end']; final=control['energy-purple4']['rows'];assert [x['choice'] for x in final]==['skip','launch']
endpoints=[]
for i,x in enumerate(final):
 s=x['end'];assert x['missing'] is None and s['score']==start['score']==90 and s['projected']==start['projected']==120
 assert set(k for k in s if s[k]!=start[k])==({'wallet','income','envelope'} if i==0 else {'wallet','income','envelope','rockets','model'})
 assert s['income']['credits']==6 and s['income']['energy']==4 and len(s['rockets'])==i
 a,b=[json.loads(z['envelope']['committedState']) for z in (start,s)]; assert a['meta']['rngState']==b['meta']['rngState'];assert a['solarSystem']==b['solarSystem']
 endpoints.append({'option':x['choice'],'score':s['score'],'credits':s['wallet']['credits'],'energy':s['wallet']['energy'],'income':s['income'],'probes':len(s['rockets'])})
progress='adhoc/human405-third-round-progress-20261107-v39.json'
p={'phase':'v351-known-income-pick-fixed-on-native-step-166-candidate-cold-gate-failed','production':'V323','baseline':'V41','first3':[15,48,90],'teacherR3':105,'fullRecord':{'version':'V189','score':120},'candidate':'V351','candidateAdmitted':False,'newAutonomousRuns':0,'gates':[g['failure'] for g in gates],'sameFullColdGraphV346ThroughV351':True,'normalizedColdGraphReference':reference,'v351NativeMenuSelection':{'old':sel['old'],'candidate':sel['candidate'],'negativeGuards':9},'v351StateInputAuditPassed':66,'v351RelatedNodeTestsPassed':5,'nativeControlsInputsIncludingSharedPrefixes':[33,85,44],'nativeControlEndpoints':endpoints,'next':'Preserve V351 as a verified root-specific income tie-break. Reduce structurally repeated analysis / income portfolio work with full fact equivalence and comparison graphs. Run no autonomous first-three or full game before the all-root cold gate.', 'evidence':{n:sha(root/n) for n in sorted(paths)}}
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
