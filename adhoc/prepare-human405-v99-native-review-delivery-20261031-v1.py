"""Preserve historical v99 runtime bindings while delivering the narrow fee fix."""
import hashlib
import json
import os
import pathlib
import subprocess

stage=pathlib.Path(__file__).resolve().parents[1]
root=pathlib.Path('/Users/bilibili/code/seti-simu')
base='67c36b92f0cf684dc8a6c4249205adbc8479c4ea'
old_runtime='0dc7785da8a4dce7bc81eabbb7dc92dcf6faf58f'
sha=lambda p:hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def git(*args,env=None):return subprocess.check_output(['git',*args],cwd=root,env=dict(os.environ,GIT_OPTIONAL_LOCKS='0',**(env or {})))
assert git('rev-parse','HEAD').decode().strip()==base
scan=dict(GIT_DIR=str(root/'.git'),GIT_WORK_TREE=str(stage),GIT_INDEX_FILE='/private/tmp/seti-human405-v99-native-review-scan-20261031.index')
if not pathlib.Path(scan['GIT_INDEX_FILE']).exists():git('read-tree',base,env=scan)
tracked=set(git('ls-tree','-r','--name-only',base).decode().splitlines())
changed=set(git('diff','--name-only',env=scan).decode().splitlines())
files=set(changed)
for pattern in ['reports/ai-foundation-20261023/*v99-native-witness*','reports/ai-foundation-20261023/*v99-paid-move*',
    'reports/ai-foundation-20261023/*v99-corrected-coverage*','reports/ai-foundation-20261023/*v99-native-review*',
    'reports/ai-foundation-20261023/*atplanet*','reports/ai-foundation-20261023/*blue2-native-future-landing*',
    'reports/ai-foundation-20261023/requested-owner*']:
    files.update(str(p.relative_to(stage)) for p in stage.glob(pattern) if p.is_file() and str(p.relative_to(stage)) not in tracked)
files.update(['docs/human405-round1-v99-native-review-20261031.md',
    'adhoc/compare-human405-v99-native-witnesses-20261031-v1.js',
    'adhoc/verify-human405-v99-paid-move-order-20261031-v1.js',
    'adhoc/human405-coverage-review-20261031-v1.js',
    'adhoc/prototype-human405-atplanet-capital-20261031-v1.js',
    'adhoc/verify-human405-atplanet-prototype-20261031-v1.js',
    'adhoc/verify-human405-blue2-future-landing-20261031-v1.js',
    'adhoc/reproduce-requested-owner-land-cost-20261031-v1.js',
    'adhoc/verify-requested-owner-land-cost-fix-20261031-v1.js',
    'adhoc/archive-human405-v99-native-review-20261031-v1.py',
    'adhoc/human405-atplanet-capital-integration-design-20261031-v1.json',
    'adhoc/human405-round1-progress-20261031-v26.json','adhoc/human405-round1-progress-20261031-v27.json',
    'adhoc/deliver-human405-round1-v99-native-review-20261031-v1.py',str(pathlib.Path(__file__).relative_to(stage))])
manifest_path='adhoc/human405-round1-v99-native-review-snapshot-20261031.json'
check_path='reports/ai-foundation-20261023/human405-round1-v99-native-review-snapshot-check-20261031-v1.json'
files.discard(manifest_path);files.discard(check_path)
files.discard('reports/ai-foundation-20261023/human405-atplanet-prototype-verification-20261031-v1.log')
files.discard('reports/ai-foundation-20261023/human405-blue2-native-future-landing-20261031-v1.log')
bound=[];bindings={}
for p in sorted(files):
    if not p.endswith('.json'):continue
    r=json.loads((stage/p).read_text())
    if not isinstance(r,dict) or not r.get('sourceHashes'):continue
    bound.append(p)
    if r.get('sourceCommit')==old_runtime:bindings[p]={'baseCommit':old_runtime}
manifest={'baseCommit':base,'snapshot':str(stage),'sharedIndexSha256Before':sha(root/'.git/index'),
    'sharedIndexEntriesSha256Before':hashlib.sha256(git('ls-files','--stage','-z')).hexdigest(),
    'files':{p:sha(stage/p) for p in sorted(files)},'sourceBoundReports':bound,'sourceBindings':bindings,
    'validation':{'nativeCurrentSourceComparisons':9,'coverageAuditRoots':32,'prototypeOrbitGain':5.5,
        'nativePrototypeLandingGain':8.5,'prototypeAdmitted':False,
        'feeFix':'reports/ai-foundation-20261023/requested-owner-land-cost-fix-validation-20261031-v1.json',
        'relatedNodePassed':5,'chromePassed':1,'nativeFeeFixInputs':9,
        'fullNodeRepeated':False,'newAutonomousRun':False,'valueModelUnchanged':'V4','goalStatus':'active'}}
(stage/manifest_path).write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'manifest':manifest_path,'files':len(files),'changedTracked':sorted(changed),
    'sourceBoundReports':len(bound),'historicalRuntimeBindings':len(bindings)}))
