"""Bind the single v99 R1 trial and native PASS counterexamples to source."""
import hashlib
import json
import pathlib
import subprocess

stage = pathlib.Path(__file__).resolve().parents[1]
root = pathlib.Path('/Users/bilibili/code/seti-simu')
commit = '0dc7785da8a4dce7bc81eabbb7dc92dcf6faf58f'
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
verification_path = folder+'human405-v99-standard-r1-verification-20261031-v1.json'
verification = read(verification_path)
actual = verification['actual']
assert len(actual['sourceCommit']) == 8 and commit.startswith(actual['sourceCommit'])
assert actual['strictNativeReplay'] and actual['exactFinalCommittedStateSessionRng'] and actual['passiveOpponentsOnly']
assert actual['steps'] == 47 and actual['searches'] == 17 and actual['wallMs'] == 1105
assert actual['maxNativeInputs'] == 94 and actual['maxMilliseconds'] < 600
assert verification['sameNativePrefixThrough42'] and verification['exactBeforeChangedChoiceStateSessionRng']
assert actual['final']['value']['total'] == verification['control']['final']['value']['total'] == 53.5
for field, checksum in [('recordPath', 'recordSha256'), ('savePath', 'saveSha256'), ('tracePath', 'traceSha256')]:
    assert sha((stage/actual[field]).read_bytes()) == actual[checksum]
registry, versions = read('reports/iteration/registry.json'), read('reports/iteration/versions.json')
own = 'ai-search-v99-white-r1-20261031'
v = next(v for v in versions['versions'] if v['id'] == own)
entry = next(v for v in registry['versions'] if v['id'] == own)
assert v['baselineEligible'] is False and entry['baselineEligible'] is False and entry['isHead'] is False
assert entry['aiGeneration'] == 'v2' and registry['currentBaseline'] == 'ai-search-v41-baseline-20261029'
result = entry['results'][0]
assert result['recordPath'] == actual['recordPath'] and result['steps'] == 47 and result['scores']['player-white'] == 13
assert result['reportExists'] and (stage/result['reportPath']).exists()
html = (stage/result['reportPath']).read_text()
assert pathlib.Path(actual['savePath']).name in html and pathlib.Path(actual['recordPath']).name in html
source_path = folder+'human405-v99-trial-runtime-source-check-20261031-v1.json'
write(source_path, {'schemaVersion': 'seti-trial-runtime-source-check-v1', 'sourceCommit': commit,
    'allTrackedRuntimeAndToolFilesMatchGitBlobs': True, 'verifiedFiles': len(sources), 'sourceHashes': sources,
    'verification': verification_path, 'registrySaveReportConsistent': True,
    'reportPath': result['reportPath'], 'reportSha256': sha((stage/result['reportPath']).read_bytes()),
    'scope': 'Post-run byte check; exactly one standard autonomous trial. Comparison records are natively replayed, not rerun.'})
progress = read('adhoc/human405-round1-progress-20261031-v24.json')
progress.update({'phase': 'v99-single-standard-R1-verified-PASS-timing-corrected-strategy-gap-remains',
    'productionSource': commit, 'searchVersion': 'v99', 'autonomousCurrentCandidateRun': True,
    'sourceCheck': source_path, 'verification': verification_path,
    'latestTrial': {k: actual[k] for k in ['recordPath', 'savePath', 'tracePath', 'steps', 'searches', 'wallMs',
        'maxNativeInputs', 'maxMilliseconds', 'planReuseHits', 'whiteActions']},
    'endpointComparison': {k: verification[k] if k == 'teacher' else verification[k]['final'] for k in ['actual', 'control', 'prior', 'teacher']},
    'sameNativePrefixThrough42': True, 'exactBeforeChangedChoiceStateSessionRng': True,
    'findings': verification['findings'], 'baseline': registry['currentBaseline'], 'baselineEligible': False,
    'strategicAlignmentComplete': False,
    'remaining': ['Deliver the trial records/save/report/V2 registry with the unrelated shared V1 experiment preserved.',
        'Continue native teacher differences24/35/36/38/39/43/62 as applicable under current policy. The corrected58 is no longer a PASS tie; old25/56 order proofs remain specifically scoped.',
        'Derive known funded probe/planet and held conditional-card purposes from native evidence; current endpoint value53.5 still trails teacher56. Equal V and increased stage score do not establish native equivalence or full-game strength.'],
    'completionNote': 'Goal active. v99 realizes the funded research before PASS, increasing native stage points8to13 while common endpoint V4 stays53.5. Teacher15points/56V remains. No new full game or baseline promotion.'})
write('adhoc/human405-round1-progress-20261031-v25.json', progress)
print(json.dumps({'sourceFiles': len(sources), 'verifiedTrial': verification_path, 'goalStatus': 'active', 'baselineEligible': False}))
