"""Prepare exact owned files/source bindings for the admitted v98 snapshot."""
import hashlib
import json
import os
import pathlib
import re
import subprocess

stage = pathlib.Path(__file__).resolve().parents[1]
root = pathlib.Path('/Users/bilibili/code/seti-simu')
base = '004c39e1413a3b09c586e3a34bc8f0cbd052c0a9'
sha = lambda p: hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def git(*args, env=None):
    return subprocess.check_output(['git', *args], cwd=root, env=dict(os.environ, GIT_OPTIONAL_LOCKS='0', **(env or {})))
assert git('rev-parse','HEAD').decode().strip() == base
scan = dict(GIT_DIR=str(root/'.git'), GIT_WORK_TREE=str(stage), GIT_INDEX_FILE='/private/tmp/seti-human405-v98-manifest-scan-20261031.index')
tracked = set(git('ls-tree','-r','--name-only',base).decode().splitlines())
changed = set(git('diff','--name-only',env=scan).decode().splitlines())
files = set(changed)
for pattern in ['reports/ai-foundation-20261023/*v9[5-8]*',
    'adhoc/ai-decision-corpus-20261029-unbounded-v1/*v9[6-8]*',
    'adhoc/human405-v9[5-7]-prototype-source-20261031-v1.json.gz',
    'adhoc/audit-round1-v9[6-8]-compat-*-20261031-v1.js']:
    files.update(str(p.relative_to(stage)) for p in stage.glob(pattern) if p.is_file() and str(p.relative_to(stage)) not in tracked)
files.update(['randomizer/game/ai/funded-research-value.test.js',
    'adhoc/human405-funded-research-design-20261031-v1.json',
    'adhoc/human405-round1-progress-20261031-v21.json',
    'adhoc/profile-human405-funded-research-20261031-v1.js',
    'adhoc/verify-human405-v97-bounds-20261031-v1.js',
    'adhoc/verify-human405-v98-bounds-20261031-v1.js',
    'adhoc/verify-human405-v98-admission-20261031-v1.py',
    'adhoc/deliver-human405-round1-v98-source-20261031-v1.py',
    str(pathlib.Path(__file__).relative_to(stage))])
bound_reports, bindings = [], {}
for p in sorted(files):
    if not p.endswith('.json'): continue
    data = json.loads((stage/p).read_text())
    if not isinstance(data,dict) or not data.get('sourceHashes'): continue
    bound_reports.append(p)
    match = re.search(r'v(95|96|97)(?!\d)',p)
    if match:
        bindings[p] = {'baseCommit':base,'sourceSnapshot':'adhoc/human405-v'+match[1]+'-prototype-source-20261031-v1.json.gz'}
manifest = {'baseCommit':base,'snapshot':str(stage),
    'sharedIndexSha256Before':sha(root/'.git/index'),
    'sharedIndexEntriesSha256Before':hashlib.sha256(git('ls-files','--stage','-z')).hexdigest(),
    'files':{p:sha(stage/p) for p in sorted(files)},'sourceBoundReports':bound_reports,'sourceBindings':bindings,
    'validation':{'admission':'reports/ai-foundation-20261023/human405-v98-admission-20261031-v1.json',
        'all44CompleteWithin256NativeInputs600ms':True,'fullNodeUnit':151,'fullFlow':1,'chrome':7,
        'numericSources':183,'typedSources':111,'freshNativeRoots':8,
        'soleKnownLegacyAuditFailure':'frozen aomomo in old expected-score evaluator; independent current-model paths pass',
        'prototypeHistory':'v95loose bounds;v96wrong passed input;v97case152607ms; all retained as unadmitted source-bound diagnostics, never autonomous trials.',
        'baselineEligible':False,'autonomousCurrentRevisionRun':False,'goalStatus':'active'}}
output = stage/'adhoc/human405-round1-v98-source-snapshot-20261031.json'
output.write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({'manifest':str(output),'ownedFiles':len(files),'changedTracked':sorted(changed),
    'sourceBoundReports':len(bound_reports),'historicalBindings':len(bindings)}))
