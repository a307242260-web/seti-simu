"""Bind the single v98 R1 trial and native PASS counterexamples to source."""
import hashlib
import json
import pathlib
import subprocess

stage = pathlib.Path(__file__).resolve().parents[1]
root = pathlib.Path('/Users/bilibili/code/seti-simu')
commit = 'cad56459d9c3e2a04ff433cfc077c28347052564'
folder = 'reports/ai-foundation-20261023/'
sha = lambda b: hashlib.sha256(b).hexdigest()
def read(p): return json.loads((stage/p).read_text())
def write(p, obj): (stage/p).write_text(json.dumps(obj, ensure_ascii=False, indent=2)+'\n')

sources = {}
for row in subprocess.check_output(['git', 'ls-tree', '-r', '-z', commit, '--', 'randomizer', 'tools'], cwd=root).split(b'\0'):
    if not row: continue
    header, name = row.split(b'\t', 1)
    mode, kind, oid = header.decode().split()
    assert kind == 'blob'
    p = name.decode()
    data = (stage/p).read_bytes()
    assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest() == oid, p
    sources[p] = sha(data)
verification_path = folder+'human405-v98-standard-r1-verification-20261031-v2.json'
verification = read(verification_path)
actual = verification['actual']
assert len(actual['sourceCommit']) == 8 and commit.startswith(actual['sourceCommit'])
assert actual['strictNativeReplay'] and actual['exactFinalCommittedStateSessionRng'] and actual['passiveOpponentsOnly']
assert actual['steps'] == 44 and actual['searches'] == 14 and actual['wallMs'] == 913
assert actual['maxNativeInputs'] == 79 and actual['maxMilliseconds'] < 600
for field, checksum in [('recordPath', 'recordSha256'), ('savePath', 'saveSha256'), ('tracePath', 'traceSha256')]:
    assert sha((stage/actual[field]).read_bytes()) == actual[checksum]
for counterexample in verification['counterexamples']:
    assert counterexample['nativePassCompletionPending'] is False
    assert counterexample['nativePassReserveAwaitingWithCommitQueued'] is True
    assert counterexample['currentTie'] is True
    for prefix in ['before', 'after']:
        assert sha((stage/counterexample[prefix+'Path']).read_bytes()) == counterexample[prefix+'Sha256']
registry, versions = read('reports/iteration/registry.json'), read('reports/iteration/versions.json')
own = 'ai-search-v98-white-r1-20261031'
v = next(v for v in versions['versions'] if v['id'] == own)
entry = next(v for v in registry['versions'] if v['id'] == own)
assert v['baselineEligible'] is False and entry['baselineEligible'] is False and entry['isHead'] is False
assert entry['aiGeneration'] == 'v2' and registry['currentBaseline'] == 'ai-search-v41-baseline-20261029'
result = entry['results'][0]
assert result['recordPath'] == actual['recordPath'] and result['steps'] == 44 and result['scores']['player-white'] == 8
assert result['reportExists'] and (stage/result['reportPath']).exists()
html = (stage/result['reportPath']).read_text()
assert pathlib.Path(actual['savePath']).name in html and pathlib.Path(actual['recordPath']).name in html
source_path = folder+'human405-v98-trial-runtime-source-check-20261031-v1.json'
write(source_path, {'schemaVersion': 'seti-trial-runtime-source-check-v1', 'sourceCommit': commit,
    'allTrackedRuntimeAndToolFilesMatchGitBlobs': True, 'verifiedFiles': len(sources), 'sourceHashes': sources,
    'verification': verification_path, 'registrySaveReportConsistent': True,
    'reportPath': result['reportPath'], 'reportSha256': sha((stage/result['reportPath']).read_bytes()),
    'scope': 'Post-run byte check; one standard autonomous trial, no rerun. Native counterexamples are independent replay, not AI games.'})
progress = {'schemaVersion': 'seti-human405-round1-goal-checkpoint-v2', 'date': '2026-10-31', 'goalStatus': 'active',
    'phase': 'v98-single-standard-R1-verified-native-PASS-window-defect-confirmed',
    'productionSource': commit, 'searchVersion': 'v98', 'valueModel': verification['valueModel'],
    'baseline': registry['currentBaseline'], 'baselineEligible': False, 'strategicAlignmentComplete': False,
    'sourceCheck': source_path, 'admission': folder+'human405-v98-admission-20261031-v1.json',
    'pointGates': {'roots': 44, 'allComplete': True, 'nativeInputLimit': 256, 'millisecondLimit': 600,
        'maxNativeInputs': 235, 'maxMilliseconds': 492.2941659999999, 'scope': 'One cold sample per root; not full-game acceptance.'},
    'validation': {'unitPassed': 151, 'fullFlowPassed': 1, 'chromePassed': 7, 'numericSources': 183,
        'typedPlanSources': 111, 'freshNativeRoots': 8, 'soleKnownAuditFailure': 'legacy frozen aomomo'},
    'latestTrial': {k: actual[k] for k in ['recordPath', 'savePath', 'tracePath', 'steps', 'searches', 'wallMs',
        'maxNativeInputs', 'maxMilliseconds', 'planReuseHits', 'whiteActions']},
    'endpointComparison': {k: verification[k] if k == 'teacher' else verification[k]['final'] for k in ['actual', 'control', 'teacher']},
    'verification': verification_path,
    'findings': verification['findings'],
    'nativePassWindow': {'nativeCompletionFlag': False, 'formalPassedIdsExcludeWhite': True,
        'evidence': 'Native PASS reserve choice is awaiting with PASS_COMMIT queued. Completion flags alone do not express this window.',
        'autonomousPassAndInvestValue': 57, 'teacher58PassAndInvestValue': 59.5,
        'proposedNextRoundTermsOnly': [54.5, 57.5], 'productionFixed': False},
    'remainingInOrder': [
        'Expose the actual native PASS-chain planning boundary, including reward/discard phases before PASS_COMMIT. Do not change rules, passedPlayerIds or completion flags.',
        'Price both held and paid technology investment in the next-round window after PASS starts; use the same window in canonical fixed-plan opportunity costs. Write native counterexample tests before fixing.',
        'Revalidate cold44roots, native bounds/typed plans, full Node, Chrome and evaluation input paths before another single standard autonomous R1.',
        'Review remaining teacher differences and funded planet/probe purposes using native evidence; no fixed B117 or teacher-score bonus. Stage points alone do not establish full-game strength.'],
    'completionNote': 'Goal active. R1 trial and evidence are verified; PASS planning-window defect remains unfixed. Baseline v41 unchanged.'}
write('adhoc/human405-round1-progress-20261031-v22.json', progress)
print(json.dumps({'sourceFiles': len(sources), 'verifiedTrial': verification_path, 'goalStatus': 'active', 'baselineEligible': False}))
