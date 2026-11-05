"""Commit reproducible V198 candidate evidence; keep production V189 and the shared index intact."""
from pathlib import Path
import hashlib
import json
import os
import subprocess
import tempfile

stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu')
base='a9646b0361451241e2b2e99ba352d28726701d9e';folder=Path('reports/ai-foundation-20261105/third-round-teacher-v1')
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
proof=json.loads((stage/folder/'v198-independent-candidate-verification-20261105-v1.json').read_text())
assert proof['status']=='passed' and not proof['candidateAdmitted'] and not proof['productionChanged']
assert sha(stage/proof['manifest'])==proof['manifestSha256']
for name,digest in proof['logsSha256'].items():assert sha(stage/name)==digest
summary=json.loads((stage/folder/'v198-symbol-and-target-review-20261105-v1.json').read_text())
assert not summary['candidateAdmitted'] and summary['newAutonomousRuns']==0
for name,digest in summary['evidenceSha256'].items():assert sha(stage/name)==digest,name
old={}
for row in git('ls-tree','-rz',base).split(b'\0'):
    if row:
        meta,name=row.split(b'\t',1);old[name.decode()]=meta.decode().split()[2]
files={'docs/ai-design.md','docs/human405-third-round-plan-20261105.md','docs/human405-third-round-trigger-review-20261105.md','docs/human405-third-round-symbol-review-20261105.md',
 'adhoc/human405-third-round-progress-20261105-v6.json','adhoc/third-round-known-symbol-contract-20261105-v1.md',
 'adhoc/inspect-known-symbol-candidate-20261105-v1.js','adhoc/archive-v198-known-symbol-candidate-20261105-v1.py',
 'adhoc/verify-human405-known-symbol-candidate-20261105-v1.py','adhoc/summarize-human405-known-symbol-20261105-v1.py','adhoc/deliver-human405-known-symbol-evidence-20261105-v1.py',
 'adhoc/audit-v197-actual-research-choice-20261105-v1.js','adhoc/control-v197-actual-line-followups-20261105-v1.js','adhoc/review-actual-third-assets-20261105-v1.js','adhoc/verify-third-followup-restores-20261105-v1.js','adhoc/attribute-third-research-targets-20261105-v1.py'}
candidate=stage/'reports/ai-foundation-20261105/candidate-v198-known-symbol-20261105-v1'
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
manifest_name='adhoc/human405-known-symbol-delivery-manifest-20261105-v1.json'
manifest={'baseCommit':base,'goalStatus':'active','productionRuntime':'V189/V22','candidate':'V198/V25','candidateAdmitted':False,'productionChanged':False,'newAutonomousRuns':0,'sharedIndexSha256':shared,'filesSha256':{name:sha(stage/name)for name in sorted(files)},'scopeOrder':['same-teacher-native-third-round-learning','review-second-round-end-afterwards']}
(stage/manifest_name).write_text(json.dumps(manifest,indent=2)+'\n');files.add(manifest_name)
if os.environ.get('SETI_DELIVER_KNOWN_SYMBOL_EVIDENCE')!='1':
    print(json.dumps({'preflight':'passed','files':len(files),'productionChanged':False,'candidateAdmitted':False}));raise SystemExit(0)
private=str(Path(tempfile.mkdtemp(prefix='seti-known-symbol-evidence-index-'))/'index');git('read-tree',base,private=private)
for name in sorted(files):
    digest=git('hash-object','-w','--stdin',data=(stage/name).read_bytes(),private=private).decode().strip()
    git('update-index','--add','--cacheinfo','100644',digest,name,private=private)
assert set(git('diff','--cached','--name-only',base,private=private).decode().splitlines())==files
# Byte-exact archived search retains only two inherited whitespace blank lines.
archive='reports/ai-foundation-20261105/candidate-v198-known-symbol-20261105-v1'
blanks=lambda lines:[line for line in lines if line and not line.strip()]
assert blanks((stage/archive/'randomizer/game/ai/decision-search.js').read_text().splitlines())==blanks(git('show',base+':randomizer/game/ai/decision-search.js').decode().splitlines())
# Raw test/exception logs are immutable evidence, not formatted source.
git('diff','--cached','--check','--','.',f':(exclude){archive}',f':(exclude){folder}/*.log',private=private)
assert not git('diff','--cached','--name-only',base,'--','randomizer','tools','assets',private=private).strip()
tree=git('write-tree',private=private).decode().strip()
for name in files:assert git('show',tree+':'+name)==(stage/name).read_bytes(),name
for name in sorted(files):
    target=repo/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((stage/name).read_bytes())
git('commit','-m','补齐已持区域牌估值并按真实科技目标修正第三轮归因',private=private)
commit=git('rev-parse','HEAD').decode().strip();assert set(git('show','--pretty=format:','--name-only','HEAD').decode().splitlines())==files
assert sha(repo/'.git/index')==shared
for name,digest in reference['runtimeSourceHashes'].items():assert sha(repo/name)==digest,name
assert not git('diff','--name-only',base,commit,'--','randomizer','tools','assets').strip()
result={'commit':commit,'privateIndex':private,'stage':str(stage),'files':len(files),'productionChanged':False,'candidateAdmitted':False,'sharedIndexUnchanged':True,'goalStatus':'active','deliveryManifest':manifest_name}
Path('/private/tmp/seti-human405-known-symbol-delivery-20261105-v1.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
