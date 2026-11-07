from pathlib import Path
import hashlib,json,os,subprocess,sys
root=Path(__file__).resolve().parents[1]
repo=Path('/Users/bilibili/code/seti-simu')
base='7b5af9d1b5d022901c1245d94968432ee75e79f6'
D=Path('reports/ai-foundation-20261107/v324-held-landing-route-v1')
index=Path('/private/tmp/seti-v324-held-landing-delivery-20261107-v1.index')
receipt=Path('/private/tmp/seti-v324-held-landing-delivery-20261107-v1.json')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
blob=lambda b:hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
read=lambda p:json.loads((root/p).read_text())
shared=sha(repo/'.git/index')
env={**os.environ,'GIT_OPTIONAL_LOCKS':'0','GIT_INDEX_FILE':str(index)}
def git(*args,data=None):return subprocess.check_output(['git',*args],input=data,cwd=repo,env=env)
assert git('rev-parse','HEAD').decode().strip()==base
assert git('branch','--show-current').strip()==b'dev'
g=read(D/'serial-cold-gate-20261107-v1.json')
assert g['status']=='failed-gate' and len(g['rows'])==4 and g['failure']['nativeInputs']==256 and g['failure']['milliseconds']>600
paths={str(p.relative_to(root)) for p in (root/D).rglob('*') if p.is_file()}
paths.add('docs/human405-v324-held-landing-route-20261107.md')
for p in ['freeze-v324-held-landing','gate-v324-held-landing','review-v324-held-landing-timing','replay-v324-held-landing-winning-plan','verify-v324-held-landing-controls','deliver-v324-held-landing']:
 matches=list((root/'adhoc').glob(p+'-20261107-v1.*'));assert len(matches)==1
 paths.add(str(matches[0].relative_to(root)))
for row in g['rows']:
 e=read(row['evidence']);assert e['rawSha256']==sha(root/e['rawPath']);assert e['candidateSourceManifestSha256']==g['manifestSha256']
 paths.update((row['evidence'],e['rawPath']))
assert sha(root/g['manifest'])==g['manifestSha256']
progress='adhoc/human405-third-round-progress-20261107-v30.json'
p={'phase':'v324-held-landing-native-complete-historical-gate-failed','production':'V323','baseline':'V41','first3':[15,48,90],'fullRecord':{'version':'V189','score':120},'candidate':'V324','candidateAdmitted':False,'newAutonomousRuns':0,'gate':g['failure'],'next':'Reduce unconditional R4 call overhead and profile the unchanged 256-input case. Preserve exact live root, graph and paid known landing before any new official game.','evidence':{n:sha(root/n) for n in sorted(paths)}}
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
