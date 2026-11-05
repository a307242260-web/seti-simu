"""Commit reproducible V203 candidate evidence; keep production V189 and the shared index intact."""
from pathlib import Path
import hashlib
import json
import os
import subprocess
import tempfile

stage=Path(__file__).resolve().parents[1];repo=Path('/Users/bilibili/code/seti-simu')
base='b8160e6f7739432b30f978c60e11db999f657fe4';folder=Path('reports/ai-foundation-20261105/third-round-teacher-v1')
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
proof=json.loads((stage/folder/'v203-independent-candidate-verification-20261105-v1.json').read_text())
assert proof['status']=='passed' and not proof['candidateAdmitted'] and not proof['productionChanged']
assert sha(stage/proof['manifest'])==proof['manifestSha256']
for name,digest in proof['logsSha256'].items():assert sha(stage/name)==digest
summary=json.loads((stage/folder/'v203-fixed-analysis-review-20261105-v1.json').read_text())
assert not summary['candidateAdmitted'] and summary['newAutonomousRuns']==0
for name,digest in summary['evidenceSha256'].items():assert sha(stage/name)==digest,name
old={}
for row in git('ls-tree','-rz',base).split(b'\0'):
    if row:
        meta,name=row.split(b'\t',1);old[name.decode()]=meta.decode().split()[2]
files={'adhoc/summarize-v199-cold-profile-20261105-v1.js', 'docs/human405-third-round-fixed-analysis-review-20261105.md', 'adhoc/third-round-v202-investment-cache-contract-20261105-v1.md', 'adhoc/audit-teacher-ready-amiba-analysis-20261105-v1.js', 'adhoc/verify-human405-investment-cache-candidate-20261105-v1.py', 'adhoc/archive-v202-investment-cache-candidate-20261105-v1.py', 'adhoc/profile-v199-cold-failure-20261105-v1.js', 'adhoc/profile-v200-cold-failure-20261105-v1.js', 'adhoc/archive-v199-amiba-analysis-candidate-20261105-v1.py', 'adhoc/benchmark-v199-amiba-analysis-roots-20261105-v1.py', 'docs/human405-third-round-analysis-review-20261105.md', 'adhoc/summarize-human405-fixed-analysis-20261105-v1.py', 'adhoc/profile-v201-investment-repeats-20261105-v1.js', 'adhoc/verify-v200-exact-scalar-caches-20261105-v2.js', 'adhoc/deliver-human405-fixed-analysis-evidence-20261105-v1.py', 'adhoc/archive-v203-fixed-analysis-candidate-20261105-v1.py', 'adhoc/summarize-human405-amiba-analysis-20261105-v1.py', 'docs/ai-design.md', 'adhoc/control-third-probe75-native-20261105-v2.js', 'adhoc/verify-v202-investment-value-parity-20261105-v1.js', 'adhoc/third-round-v203-fixed-analysis-contract-20261105-v1.md', 'adhoc/benchmark-v201-geometry-cache-roots-20261105-v1.py', 'adhoc/verify-human405-amiba-analysis-candidate-20261105-v1.py', 'adhoc/verify-human405-scalar-cache-candidate-20261105-v1.py', 'adhoc/human405-third-round-progress-20261105-v8.json', 'adhoc/attribute-teacher-scan-tech-20261105-v2.js', 'adhoc/benchmark-v200-scalar-cache-roots-20261105-v1.py', 'adhoc/verify-human405-geometry-cache-candidate-20261105-v1.py', 'adhoc/third-round-amiba-analysis-contract-20261105-v1.md', 'adhoc/inspect-third-probe-purpose-20261105-v1.js', 'adhoc/summarize-v200-cold-profile-20261105-v1.js', 'adhoc/human405-third-round-progress-20261105-v7.json', 'adhoc/third-round-v200-scalar-cache-contract-20261105-v1.md', 'adhoc/verify-v200-exact-scalar-caches-20261105-v1.js', 'adhoc/archive-v200-scalar-cache-candidate-20261105-v1.py', 'adhoc/benchmark-v202-investment-cache-roots-20261105-v1.py', 'adhoc/benchmark-v203-fixed-analysis-roots-20261105-v1.py', 'adhoc/attribute-teacher-scan-tech-20261105-v3.js', 'adhoc/archive-v201-geometry-cache-candidate-20261105-v1.py', 'docs/human405-third-round-plan-20261105.md', 'adhoc/verify-human405-fixed-analysis-candidate-20261105-v1.py', 'adhoc/third-round-v201-geometry-cache-contract-20261105-v1.md', 'adhoc/control-third-probe75-native-20261105-v1.js', 'adhoc/profile-v201-purpose-repeats-20261105-v1.js', 'adhoc/attribute-teacher-scan-tech-20261105-v1.js'}
for name in ['candidate-v199-amiba-analysis','candidate-v200-scalar-cache','candidate-v201-geometry-cache','candidate-v202-investment-cache','candidate-v203-fixed-analysis']:
 candidate=stage/('reports/ai-foundation-20261105/'+name+'-20261105-v1')
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
manifest_name='adhoc/human405-fixed-analysis-delivery-manifest-20261105-v1.json'
manifest={'baseCommit':base,'goalStatus':'active','productionRuntime':'V189/V22','candidate':'V203/V27','candidateAdmitted':False,'productionChanged':False,'newAutonomousRuns':0,'sharedIndexSha256':shared,'filesSha256':{name:sha(stage/name)for name in sorted(files)},'scopeOrder':['same-teacher-native-third-round-learning','review-second-round-end-afterwards']}
(stage/manifest_name).write_text(json.dumps(manifest,indent=2)+'\n');files.add(manifest_name)
if os.environ.get('SETI_DELIVER_FIXED_ANALYSIS_EVIDENCE')!='1':
    print(json.dumps({'preflight':'passed','files':len(files),'productionChanged':False,'candidateAdmitted':False}));raise SystemExit(0)
private=str(Path(tempfile.mkdtemp(prefix='seti-fixed-analysis-evidence-index-'))/'index');git('read-tree',base,private=private)
for name in sorted(files):
    digest=git('hash-object','-w','--stdin',data=(stage/name).read_bytes(),private=private).decode().strip()
    git('update-index','--add','--cacheinfo','100644',digest,name,private=private)
assert set(git('diff','--cached','--name-only',base,private=private).decode().splitlines())==files
# Byte-exact archived search retains only two inherited whitespace blank lines.
archives=['reports/ai-foundation-20261105/'+name+'-20261105-v1'for name in ['candidate-v199-amiba-analysis','candidate-v200-scalar-cache','candidate-v201-geometry-cache','candidate-v202-investment-cache','candidate-v203-fixed-analysis']]
blanks=lambda lines:[line for line in lines if line and not line.strip()]
for archive in archives:
 assert blanks((stage/archive/'randomizer/game/ai/decision-search.js').read_text().splitlines())==blanks(git('show',base+':randomizer/game/ai/decision-search.js').decode().splitlines())
# Only byte-exact inherited blank lines and immutable raw logs are excluded.
git('diff','--cached','--check','--','.',*[f':(exclude){archive}/randomizer/game/ai/decision-search.js'for archive in archives],f':(exclude){folder}/*.log',private=private)
assert not git('diff','--cached','--name-only',base,'--','randomizer','tools','assets',private=private).strip()
tree=git('write-tree',private=private).decode().strip()
for name in files:assert git('show',tree+':'+name)==(stage/name).read_bytes(),name
for name in sorted(files):
    target=repo/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((stage/name).read_bytes())
git('commit','-m','修复第三轮免电分析漏估并将固定计划降至门槛内',private=private)
commit=git('rev-parse','HEAD').decode().strip();assert set(git('show','--pretty=format:','--name-only','HEAD').decode().splitlines())==files
assert sha(repo/'.git/index')==shared
for name,digest in reference['runtimeSourceHashes'].items():assert sha(repo/name)==digest,name
assert not git('diff','--name-only',base,commit,'--','randomizer','tools','assets').strip()
result={'commit':commit,'privateIndex':private,'stage':str(stage),'files':len(files),'productionChanged':False,'candidateAdmitted':False,'sharedIndexUnchanged':True,'goalStatus':'active','deliveryManifest':manifest_name}
Path('/private/tmp/seti-human405-fixed-analysis-delivery-20261105-v1.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))
