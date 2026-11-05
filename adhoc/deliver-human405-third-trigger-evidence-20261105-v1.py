"""Commit reproducible V197 candidate evidence; keep production V189 and the shared index intact."""
from pathlib import Path
import hashlib
import json
import os
import subprocess
import tempfile

stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu')
base='d80f8330e90e2fd4af9ad907e23ae93041774ea2';folder=Path('reports/ai-foundation-20261105/third-round-teacher-v1')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
blob=lambda b:hashlib.sha1(('blob '+str(len(b))+'\0').encode()+b).hexdigest()
def git(*args,data=None,private=None):
    env=dict(os.environ,GIT_OPTIONAL_LOCKS='0')
    if private:env['GIT_INDEX_FILE']=private
    return subprocess.check_output(['git',*args],cwd=repo,input=data,env=env)
assert git('rev-parse','HEAD').decode().strip()==base
assert git('symbolic-ref','--short','HEAD').decode().strip()=='dev'
shared=sha(repo/'.git/index');assert shared=='fc85f92edd341768801c684278718c809b0da7092d9c1eba78bf6fd978304e49'
reference=json.loads((stage/'reports/ai-foundation-20261104/two-rounds-teacher-v2/v189-first2-result-source-check-20261105-v1.json').read_text())
for name,digest in reference['runtimeSourceHashes'].items():assert sha(repo/name)==digest,name
proof=json.loads((stage/folder/'v197-independent-candidate-verification-20261105-v3.json').read_text())
assert proof['status']=='passed' and not proof['candidateAdmitted'] and not proof['productionChanged']
assert sha(stage/proof['manifest'])==proof['manifestSha256']
for name,digest in proof['logsSha256'].items():assert sha(stage/name)==digest
summary=json.loads((stage/folder/'v197-trigger-and-tail-review-20261105-v1.json').read_text())
assert not summary['candidateAdmitted'] and summary['newAutonomousRuns']==0
for name,digest in summary['evidenceSha256'].items():assert sha(stage/name)==digest,name
old={}
for row in git('ls-tree','-rz',base).split(b'\0'):
    if row:
        meta,name=row.split(b'\t',1);old[name.decode()]=meta.decode().split()[2]
files={'docs/ai-design.md','docs/human405-third-round-plan-20261105.md','docs/human405-third-round-trigger-review-20261105.md',
 'adhoc/human405-third-round-progress-20261105-v4.json','adhoc/third-round-research-trigger-contract-20261105-v1.md','adhoc/third-round-stationary-prefix-contract-20261105-v1.md',
 'adhoc/audit-human405-blue-capacity-20261105-v1.js','adhoc/benchmark-human405-before-research-v193-20261105-v1.py',
 'adhoc/diagnose-stationary-prefix-20261105-v1.js','adhoc/diagnose-stationary-prefix-20261105-v2.js',
 'adhoc/diagnose-browser-full-parity-20261105-v1.js','adhoc/control-human405-third-known-prefix-v197-20261105-v1.js',
 'adhoc/verify-human405-third-trigger-candidate-20261105-v1.py','adhoc/summarize-human405-third-trigger-20261105-v1.py','adhoc/deliver-human405-third-trigger-evidence-20261105-v1.py'}
for version,label in [(194,'research-trigger'),(195,'research-trigger'),(196,'research-trigger'),(197,'stationary-prefix')]:
 files.add(f'adhoc/archive-v{version}-{label}-candidate-20261105-v1.py' if version==197 else f'adhoc/archive-v{version}-research-trigger-candidate-20261105-v1.py')
 candidate=stage/f'reports/ai-foundation-20261105/candidate-v{version}-{label}-20261105-v1'
 files.update(str(p.relative_to(stage))for p in candidate.rglob('*')if p.is_file())
files.update(str(p.relative_to(stage))for p in(stage/folder).iterdir()if p.is_file())
files={name for name in files if old.get(name)!=blob((stage/name).read_bytes())}
assert not any(name.startswith(('randomizer/','tools/','assets/'))for name in files)
for name in files:
    source=stage/name
    if source.suffix in ['.js','.cjs']:subprocess.run(['node','--check',name],cwd=stage,check=True)
    if source.suffix=='.py':compile(source.read_text(),name,'exec')
    if source.suffix=='.json':json.loads(source.read_text())
    target=repo/name
    if target.exists():assert target.read_bytes()==source.read_bytes()or blob(target.read_bytes())==old.get(name),'overlapping foreign edit: '+name
manifest_name='adhoc/human405-third-trigger-delivery-manifest-20261105-v1.json'
manifest={'baseCommit':base,'goalStatus':'active','productionRuntime':'V189/V22','candidate':'V197/V24','candidateAdmitted':False,'productionChanged':False,'newAutonomousRuns':0,'sharedIndexSha256':shared,'filesSha256':{name:sha(stage/name)for name in sorted(files)},'scopeOrder':['same-teacher-native-third-round-learning','review-second-round-end-afterwards']}
(stage/manifest_name).write_text(json.dumps(manifest,indent=2)+'\n');files.add(manifest_name)
if os.environ.get('SETI_DELIVER_THIRD_TRIGGER_EVIDENCE')!='1':
    print(json.dumps({'preflight':'passed','files':len(files),'productionChanged':False,'candidateAdmitted':False}));raise SystemExit(0)
private=str(Path(tempfile.mkdtemp(prefix='seti-third-trigger-evidence-index-'))/'index');git('read-tree',base,private=private)
for name in sorted(files):
    digest=git('hash-object','-w','--stdin',data=(stage/name).read_bytes(),private=private).decode().strip()
    git('update-index','--add','--cacheinfo','100644',digest,name,private=private)
assert set(git('diff','--cached','--name-only',base,private=private).decode().splitlines())==files
# Preserve byte-exact archived sources, including two inherited blank lines.
archives=[f'reports/ai-foundation-20261105/candidate-v{v}-{label}-20261105-v1'for v,label in [(194,'research-trigger'),(195,'research-trigger'),(196,'research-trigger'),(197,'stationary-prefix')]]
blanks=lambda lines:[line for line in lines if line and not line.strip()]
base_search=git('show',base+':randomizer/game/ai/decision-search.js').decode().splitlines()
for archive in archives:
 assert blanks((stage/archive/'randomizer/game/ai/decision-search.js').read_text().splitlines())==blanks(base_search)
raw_logs=[str(folder/f'v197-independent-harness-missing-fixture-20261105-v{n}.log')for n in [1,2]]
for n,name in enumerate(raw_logs,1):assert (stage/name).read_bytes()==Path(f'/private/tmp/seti-v197-clean-verification-20261105-v{n}.log').read_bytes()
git('diff','--cached','--check','--','.',*[f':(exclude){name}'for name in archives+raw_logs],private=private)
assert not git('diff','--cached','--name-only',base,'--','randomizer','tools','assets',private=private).strip()
tree=git('write-tree',private=private).decode().strip()
for name in files:assert git('show',tree+':'+name)==(stage/name).read_bytes(),name
for name in sorted(files):
    target=repo/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((stage/name).read_bytes())
git('commit','-m','完善第三轮研究触发估值候选并压缩固定电脑流程',private=private)
commit=git('rev-parse','HEAD').decode().strip();assert set(git('show','--pretty=format:','--name-only','HEAD').decode().splitlines())==files
assert sha(repo/'.git/index')==shared
for name,digest in reference['runtimeSourceHashes'].items():assert sha(repo/name)==digest,name
assert not git('diff','--name-only',base,commit,'--','randomizer','tools','assets').strip()
result={'commit':commit,'privateIndex':private,'stage':str(stage),'files':len(files),'productionChanged':False,'candidateAdmitted':False,'sharedIndexUnchanged':True,'goalStatus':'active','deliveryManifest':manifest_name}
Path('/private/tmp/seti-human405-third-trigger-delivery-20261105-v1.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
