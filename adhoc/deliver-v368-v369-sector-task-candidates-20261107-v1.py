from pathlib import Path
import gzip,hashlib,json,os,re,subprocess,sys
root=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu');base='360424b4166bae7f07ffa44e58eaf705cff305b5'
tmp=Path('/private/tmp');index=tmp/'seti-v368-v369-sector-task-20261107-v1.index';receipt=tmp/'seti-v368-v369-sector-task-20261107-v1.stage.json'
D=Path('reports/ai-foundation-20261107')
tags=['v368-sector-task-swap','v369-validated-research-layout-pair']
read=lambda p:json.loads((root/p).read_text());sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
env={**os.environ,'GIT_INDEX_FILE':str(index),'GIT_OPTIONAL_LOCKS':'0'}
git=lambda *a,data=None:subprocess.check_output(['git',*a],input=data,env=env,cwd=repo)
shared=sha(repo/'.git/index');assert git('rev-parse','HEAD').decode().strip()==base and git('branch','--show-current').strip()==b'dev'
files={'docs/human405-v368-v369-known-sector-swap-20261107.md','adhoc/'+Path(__file__).name}
for n in ['profile-v368-income-before-amiba','verify-v368-sector-task-swap','measure-v368-research-shape-reuse','verify-v369-layout-pair']:files.add(f'adhoc/{n}-20261107-v1.js')
files.add('adhoc/verify-v368-sector-task-browser-20261107-v1.py')
graphs=[]
def norm(v):
    if isinstance(v,dict):return {k:norm(x) for k,x in v.items() if k!='milliseconds'}
    if isinstance(v,list):return [norm(x) for x in v]
    if isinstance(v,str):return re.sub(r'seti-complete-decision-search-v36[789]|seti-purpose-card-pick-policy-v1[56]','version',v)
    return v
for tag in tags:
    d=D/(tag+'-v1');m=d/'source-manifest-20261107-v1.json';g=read(d/'serial-cold-gate-20261107-v1.json')
    assert g['manifestSha256']==sha(root/m) and not g['candidateAdmitted'] and g['newAutonomousRuns']==0
    assert g['status']=='failed-gate' and g['failure']==g['rows'][1] and len(g['rows'])==2
    a,b=g['rows'];assert a['actionId']=='industry:e887dc52' and a['nativeInputs']==57 and a['value']==159.5 and a['decisionGatePassed']
    assert b['actionId']=='play_card:cb499bba' and b['value']==127.5 and b['nativeInputs']==106 and b['milliseconds']>600 and not b['decisionGatePassed']
    files.update(str(n.relative_to(root)) for n in (root/d).rglob('*') if n.is_file() and n.name!='seti-v368-sector-task-node-20261107-v1.log')
    files.update(f'adhoc/{kind}-{tag}-20261107-v1.{ext}' for kind,ext in [('freeze','py'),('gate','js')])
    selected=[]
    for row in g['rows']:
        assert row['complete'] and row['rootAndRngUnchanged']
        e=read(row['evidence']);p=e['rawPath'];assert e['rawSha256']==sha(root/p)
        assert e['fixtureSha256']==sha(root/e['fixture']);assert e['candidateSourceManifestSha256']==g['manifestSha256']
        graph=norm(json.loads(gzip.decompress((root/p).read_bytes())))
        selected.append(graph);files.update((row['evidence'],p))
    assert selected[0]['lines'][0]['cardPickPolicy']['companySwap']['goal']['sectorId']=='sector-1-b'
    assert len(selected[1]['lines'])==98
    graphs.append(selected)
assert graphs[0]==graphs[1]
reference=read('reports/ai-foundation-20261105/third-round-teacher-v1/v367-cold-income-before-amiba-20261107-v1.json')
assert graphs[0][1]==norm(json.loads(gzip.decompress((root/reference['rawPath']).read_bytes())))
d=D/(tags[-1]+'-v1')
for suffix,check in [('layout-pair-verification','"fullPortfolios":1536'),('sector-task-node','"sectorTaskSwap":"passed"'),('sector-task-browser','SUMMARY browserSmoke passed=2 failed=0'),('related-node','SUMMARY unit passed=5 failed=0')]:
    assert check in (root/d/f'seti-v369-{suffix}-20261107-v1.log').read_text()
for n in files:
    p=root/n;dest=repo/n;assert p.is_file() and not git('ls-tree',base,'--',n),n
    if dest.exists():assert sha(p)==sha(dest),n
    if n.endswith('.js'):subprocess.run(['node','--check',str(p)],check=True,capture_output=True)
    if n.endswith('.py'):compile(p.read_text(),n,'exec')
if '--stage' not in sys.argv:
    print(json.dumps({'status':'preflight-passed','files':len(files),'bytes':sum((root/n).stat().st_size for n in files),'productionChanged':False}));sys.exit(0)
assert not index.exists() and not receipt.exists()
git('read-tree',base)
names=sorted(files);hashes=git('hash-object','-w','--stdin-paths',data=''.join(str(root/n)+'\n' for n in names).encode()).decode().splitlines()
assert len(hashes)==len(names)
for n,h in zip(names,hashes):
    b=(root/n).read_bytes();assert h==hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
git('update-index','--index-info',data=''.join('100644 '+h+'\t'+n+'\n' for n,h in zip(names,hashes)).encode())
tree=git('write-tree').decode().strip()
for n in ['randomizer','tools','assets','reports/iteration','reports/robot-iteration.html']:assert git('rev-parse',tree+':'+n)==git('rev-parse',base+':'+n)
assert set(git('diff','--cached','--name-only','-z',base).decode().strip('\0').split('\0'))==files and sha(repo/'.git/index')==shared
for n in names:
    t=repo/n;t.parent.mkdir(parents=True,exist_ok=True)
    if not t.exists():
        with t.open('xb') as f:f.write((root/n).read_bytes())
    assert sha(t)==sha(root/n)
receipt.write_text(json.dumps({'status':'staged','base':base,'tree':tree,'files':names,'index':str(index),'sharedIndexSha256':shared},indent=2)+'\n')
print(json.dumps({'status':'staged','tree':tree,'files':len(names),'productionChanged':False}))
