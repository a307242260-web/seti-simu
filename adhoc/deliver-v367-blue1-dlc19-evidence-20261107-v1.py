from pathlib import Path
import gzip,hashlib,json,os,subprocess,sys
root=Path(__file__).resolve().parents[1]; repo=Path('/Users/bilibili/code/seti-simu'); base='7708ebad07377c223b34dcaf6138e3b8f93822a8'
tmp=Path('/private/tmp'); index=tmp/'seti-v367-blue1-dlc19-evidence-20261107-v1.index'; receipt=tmp/'seti-v367-blue1-dlc19-evidence-20261107-v1.stage.json'
d=Path('reports/ai-foundation-20261107/v367-blue1-dlc19-native-v1')
cold=Path('reports/ai-foundation-20261105/third-round-teacher-v1/v367-cold-r3-blue1-before-dlc19-20261107-v1.json')
read=lambda p:json.loads((root/p).read_text()); sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
env={**os.environ,'GIT_INDEX_FILE':str(index),'GIT_OPTIONAL_LOCKS':'0'}
git=lambda *args,data=None:subprocess.check_output(['git',*args],input=data,env=env,cwd=repo)
shared=sha(repo/'.git/index'); assert git('rev-parse','HEAD').decode().strip()==base and git('branch','--show-current').strip()==b'dev'
names={str(x.relative_to(root)) for x in (root/d).glob('*') if x.is_file()}
names.update(('docs/human405-v367-blue1-dlc19-native-20261107.md',str(cold),'adhoc/'+Path(__file__).name))
for n in ['inspect-v367-blue1-publicity','verify-v367-blue1-dlc19-research','verify-v367-blue1-dlc19-native-replay',
          'review-v367-actual-r3-technology-choices','verify-v367-analysis-source-controls','verify-v367-valuation-source-controls','verify-v367-r4-tail-current-value']:
    names.add('adhoc/'+n+'-20261107-v1.js')
names.add('adhoc/diagnose-v367-browser-functional-parity-20261107-v1.py')
r=read(cold); assert r['decisionGatePassed'] and r['nativeInputs']==1 and r['actionId']=='pass:a1f33c73' and r['rootAndRngUnchanged']
assert r['rawSha256']==sha(root/r['rawPath']); assert r['fixtureSha256']==sha(root/r['fixture']);names.add(r['rawPath'])
raw=json.loads(gzip.decompress((root/r['rawPath']).read_bytes()));assert next(x for x in raw['roots'] if x['actionId']=='industry:e887dc52')['completion']=='excluded-by-card-pick-policy'
v=read(d/'v367-blue1-dlc19-native-replay-20261107-v1.json')
assert v['fixtureSha256']==sha(root/v['fixture']) and v['proofSha256']==sha(root/v['proof'])
assert v['inputs']==12 and v['score']==98 and len(v['technologies'])==5 and 'purple2' in v['technologies']
assert v['bothStateSessionRngExact'] and v['rootAndRngRestored'] and v['newAutonomousRuns']==0
p=read(v['proof']);assert p['sourceSha256']==sha(root/p['source']) and p['funded']['wallet']['publicity']==7 and p['end']['wallet']['publicity']==2
assert p['end']['income']['energy']==3 and p['end']['income']['credits']==7
assert len(list((root/d).glob('*current-control-*.log')))==8
assert all('"passed"' in f.read_text() for f in (root/d).glob('*current-control-*.log'))
assert 'SUMMARY browserSmoke passed=4 failed=0 total=4' in (root/d/'seti-v367-browser-native-parity-20261107-v1.log').read_text()
for n in sorted(names):
    s=root/n; t=repo/n;assert s.is_file() and not git('ls-tree',base,'--',n),n
    if t.exists():assert sha(s)==sha(t),n
    if n.endswith('.js'):subprocess.run(['node','--check',s],check=True,capture_output=True)
    if n.endswith('.py'):compile(s.read_text(),n,'exec')
if '--stage' not in sys.argv:
    print(json.dumps({'status':'preflight-passed','files':len(names),'bytes':sum((root/n).stat().st_size for n in names),'productionChanged':False}));sys.exit(0)
assert not index.exists() and not receipt.exists()
git('read-tree',base)
paths=sorted(names)
hashes=git('hash-object','-w','--stdin-paths',data=''.join(str(root/n)+'\n' for n in paths).encode()).decode().splitlines()
assert len(hashes)==len(paths)
for n,h in zip(paths,hashes):
    b=(root/n).read_bytes()
    assert h==hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
git('update-index','--index-info',data=''.join('100644 '+h+'\t'+n+'\n' for n,h in zip(paths,hashes)).encode())
tree=git('write-tree').decode().strip()
for n in ['randomizer','tools','assets','reports/iteration','reports/robot-iteration.html']:assert git('rev-parse',tree+':'+n)==git('rev-parse',base+':'+n)
assert set(git('diff','--cached','--name-only','-z',base).decode().strip('\0').split('\0'))==names and sha(repo/'.git/index')==shared
for n in paths:
    t=repo/n;t.parent.mkdir(parents=True,exist_ok=True)
    if not t.exists():
        with t.open('xb') as f:f.write((root/n).read_bytes())
    assert sha(t)==sha(root/n)
receipt.write_text(json.dumps({'status':'staged','base':base,'tree':tree,'files':paths,'index':str(index),'sharedIndexSha256':shared},indent=2)+'\n')
print(json.dumps({'status':'staged','tree':tree,'files':len(names),'productionChanged':False}))
