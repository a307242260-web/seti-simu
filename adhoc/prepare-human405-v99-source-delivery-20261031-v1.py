"""Prepare the explicit admitted source overlay without touching shared index."""
import hashlib
import json
import os
import pathlib
import subprocess

stage = pathlib.Path(__file__).resolve().parents[1]
root = pathlib.Path('/Users/bilibili/code/seti-simu')
base = '88af65dbc83aa69092ebd8500218bba0371f12d5'
sha = lambda p: hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def git(*args, env=None):
    return subprocess.check_output(['git', *args], cwd=root, env=dict(os.environ, GIT_OPTIONAL_LOCKS='0', **(env or {})))
assert git('rev-parse','HEAD').decode().strip() == base
admission = json.loads((stage/'reports/ai-foundation-20261023/human405-v99-admission-20261031-v1.json').read_text())
assert admission['candidateAdmitted'] and admission['all45CompleteWithin256NativeInputs600ms']
scan = dict(GIT_DIR=str(root/'.git'), GIT_WORK_TREE=str(stage), GIT_INDEX_FILE='/private/tmp/seti-human405-v99-source-scan-20261031.index')
tracked = set(git('ls-tree','-r','--name-only',base).decode().splitlines())
changed = set(git('diff','--name-only',env=scan).decode().splitlines())
files = set(changed)
for pattern in ['reports/ai-foundation-20261023/*v99*',
    'adhoc/ai-decision-corpus-20261029-unbounded-v1/*v99*', 'adhoc/*v99*']:
    files.update(str(p.relative_to(stage)) for p in stage.glob(pattern) if p.is_file() and str(p.relative_to(stage)) not in tracked)
files.update(['adhoc/human405-pass-investment-window-design-20261031-v1.json',
    'adhoc/capture-human405-pass-discard-20261031-v1.js',
    'adhoc/ai-decision-corpus-20261031-v98-pass-boundary-v1/green-before-pass-discard-20261031-v1.json',
    'adhoc/human405-round1-progress-20261031-v23.json', 'adhoc/human405-round1-progress-20261031-v24.json'])
manifest_path = 'adhoc/human405-round1-v99-source-snapshot-20261031.json'
check_path = 'reports/ai-foundation-20261023/human405-round1-v99-source-snapshot-check-20261031-v1.json'
files.discard(manifest_path)
files.discard(check_path)
bound_reports = []
for p in sorted(files):
    if not p.endswith('.json'): continue
    data = json.loads((stage/p).read_text())
    if isinstance(data,dict) and data.get('sourceHashes'): bound_reports.append(p)
manifest = {'baseCommit':base,'snapshot':str(stage),
    'sharedIndexSha256Before':sha(root/'.git/index'),
    'sharedIndexEntriesSha256Before':hashlib.sha256(git('ls-files','--stage','-z')).hexdigest(),
    'files':{p:sha(stage/p) for p in sorted(files)},'sourceBoundReports':bound_reports,'sourceBindings':{},
    'validation':{'admission':'reports/ai-foundation-20261023/human405-v99-admission-20261031-v1.json',
        'all45CompleteWithin256NativeInputs600ms':True,'fullNodeUnit':151,'fullFlow':1,'chrome':7,
        'numericSources':201,'typedSources':134,'freshNativeRoots':9,
        'soleKnownLegacyAuditFailure':'frozen aomomo; all independent current-model and PASS-window paths pass',
        'baselineEligible':False,'autonomousCurrentRevisionRun':False,'goalStatus':'active'}}
(stage/manifest_path).write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'manifest':manifest_path,'ownedFiles':len(files),'changedTracked':sorted(changed),'sourceBoundReports':len(bound_reports)}))
