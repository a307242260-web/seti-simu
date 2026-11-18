"""Verify and freeze this bounded prototype, including failed checks."""
import gzip
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import time

repo = Path(__file__).resolve().parents[1]
directory = repo / 'reports/ai-foundation-20261119'
read = lambda name: json.loads((directory / name).read_text())
sha = lambda value: hashlib.sha256(value).hexdigest()
window_path = directory / 'blue-income-forecast-prototype-20261119-v1.window.json'
window = read(window_path.name)
assert window['status'] in {'open', 'failed', 'closed'}
assert time.time() < window['deadlineEpochSeconds']
assert window['deadlineEpochSeconds'] - window['startedEpochSeconds'] == 1800
manifest = read('blue-income-forecast-prototype-preflight-20261119-v2.json')
runtime = Path(manifest['runtime'])
for name, digest in manifest['sourceFiles'].items():
    assert sha((Path(manifest['sourceRuntime']) / name).read_bytes()) == digest, name
    expected = manifest['candidateChangedFiles'].get(name, digest)
    assert sha((runtime / name).read_bytes()) == expected, name

diagnostics = read('blue-income-forecast-prototype-diagnostics-20261119-v2.json')
benchmark = read('blue-income-forecast-root104-benchmark-20261119-v2.json')
audit = read('blue-income-forecast-input-audit-20261119-v3.json')
ready = read('blue-income-forecast-ready-analysis-check-20261119-v2.json')
routes = read('blue-income-forecast-input-routes-20261119-v1.json')
assert not diagnostics.get('error')
assert diagnostics['targetsMatched'] and diagnostics['blue3Unchanged'] and diagnostics['counterexamplesUnchanged']
assert diagnostics['sourceHashesUnchanged']
assert benchmark['withinGate'] and benchmark['sourceRootPreserved'] and benchmark['officialObservationExact']
winner = next(row for row in benchmark['search']['roots'] if row.get('value') == benchmark['search']['value'])
assert winner['goal']['tileId'] == 'blue1' and winner['goal']['blueSlot'] == 2
assert audit['check']['exitCode'] == ready['exitCode'] == 0
assert routes['passed'] and routes['rootAndRngPreserved']
assert routes['syntheticMoneyGrid']['failures'] == []
assert benchmark['analysis']['submissionCount'] == 38

# Reconstruct every changed file independently from the original bytes and
# the exact archived patch. This proves patch reproducibility, not full-game
# admission or a general correctness proof for the capital ceiling.
reconstruction = Path(tempfile.mkdtemp(prefix='seti-blue-income-patch-proof-20261119-', dir='/private/tmp'))
for name in manifest['candidateChangedFiles']:
    target = reconstruction / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes((Path(manifest['sourceRuntime']) / name).read_bytes())
patch = directory / 'blue-income-forecast-prototype-20261119-v2.patch'
subprocess.run(['git', 'apply', '--check', str(patch)], cwd=reconstruction, check=True)
subprocess.run(['git', 'apply', str(patch)], cwd=reconstruction, check=True)
for name, digest in manifest['candidateChangedFiles'].items():
    assert sha((reconstruction / name).read_bytes()) == digest, name
    subprocess.run(['node', '--check', str(reconstruction / name)], check=True)

archive_entries = {}
for attempt in window['attempts']:
    for key in ['stdout', 'stderr']:
        file = Path(attempt[key])
        if file.exists():
            archive_entries[str(file.relative_to(repo))] = file.read_text()
            attempt[key + 'Sha256'] = sha(file.read_bytes())
for name in ['blue-income-forecast-prototype-diagnostics-20261119-v1.json',
             'blue-income-forecast-root104-benchmark-20261119-v1.json']:
    archive_entries[str((directory / name).relative_to(repo))] = (directory / name).read_text()
archive = directory / 'blue-income-forecast-tooling-evidence-20261119-v1.json.gz'
if not archive.exists():
    archive.write_bytes(gzip.compress(json.dumps(archive_entries, ensure_ascii=False).encode(), mtime=0))
assert json.loads(gzip.decompress(archive.read_bytes())) == archive_entries

now = time.time()
unit_minutes = (now - window['startedEpochSeconds']) / 60
prior_minutes = 22.769860049088795 + 16.11
result = {
    'date': '2026-11-19', 'sourceCommit': manifest['sourceCommit'],
    'classification': 'isolated strategy prototype with causal target, counterexamples, actual decision change, input parity and related checks; not adopted',
    'previousGoalTurnClassification': 'no progress: status verification and restatement only',
    'currentGoalTurnClassification': 'progress: implemented and tested known public-income analysis closure; root104 changes to blue1/slot2',
    'formal': {'completedScoreUnchanged': 272, 'previouslyMeasuredGameSeconds': 16.1,
               'newAutonomousGames': 0, 'new20BoardDistribution': False, 'productionChanged': False},
    'target': {'input': 104, 'oldBlue1Value': 97.75, 'newBlue1Value': 99.5,
               'blue3ValueUnchanged': 98, 'blue1AnalysisPotential': 3.5,
               'knownPreparationIncrement': 1.75,
               'notAFullGameScoreGain': True,
               'winner': winner},
    'singleDecisionGate': {'complete': True, 'nativeSubmissions': 38,
                           'rootAndSearchMilliseconds': benchmark['rootAndSearchMilliseconds'],
                           'limits': benchmark['budget'], 'rootAndRngPreserved': True,
                           'notAStableLatencyDistribution': True},
    'checks': {'sixRecordedNativeStages': True, 'sevenUnavailablePathCounterexamples': True,
               'stateFullFormalCompactParity': True, 'inputAuditPassed': True,
               'readyAnalysisTestPassed': True, 'stateValueTestPassed': True,
               'syntheticWallets': routes['syntheticMoneyGrid']['wallets'],
               'syntheticMonotonicComparisons': routes['syntheticMoneyGrid']['checks'],
               'patchReconstructsChangedFiles': True,
               'original533SourceHashesUnchanged': True},
    'testMigration': manifest['testContractMigration'],
    'remainingAdmission': [
        'Review the changed capital ceiling over its full supported domain; root104 does not exercise post-main bound pruning.',
        'Complete source-specific required regression and unique full-flow admission, classifying every failure rather than inheriting the rejected v514 result.',
        'Only after admission, register one autonomous fixed-opening game and compare every round asset; do not infer a new total score from checkpoint value.',
        'Later R3/R4 alignment and the twenty-board distribution remain part of the full goal.'
    ],
    'nativeAccounting': {'newDecisionSearches': 1, 'decisionSearchSubmissions': 38,
                         'readyAnalysisBehaviorTestSubmissions': 840,
                         'inputAuditIncludesAdditionalNativeControls': True,
                         'inputAuditNativeSubmissionTotalNotInstrumented': True,
                         'checkpointValueAndWalletGridNativeSubmissions': 0,
                         'old89InputCausalExperimentNotReplayed': True},
    'workWindow': {'originalDeadlineEpochSeconds': window['deadlineEpochSeconds'],
                   'unitWallMinutesToClose': unit_minutes,
                   'priorRouteWallMinutes': prior_minutes,
                   'cumulativeRouteWallMinutes': prior_minutes + unit_minutes,
                   'remainingRouteMinutesMaximum': max(0, 120 - prior_minutes - unit_minutes),
                   'deadlineNeverExtended': True,
                   'manualToolingRecoveries': window.get('commandFailureRecoveries', []),
                   'limit': 'Only command launch and execution are mechanically timed; reasoning and manual state recovery are not enforced by the guard.'},
    'wholeGoalComplete': False,
}
outcome = directory / 'blue-income-forecast-prototype-outcome-20261119-v1.json'
if not outcome.exists():
    outcome.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
else:
    result = json.loads(outcome.read_text())
    assert result['singleDecisionGate']['nativeSubmissions'] == 38
window.update(status='closed', closedEpochSeconds=window.get('closedEpochSeconds', now),
              closeReason='Bounded prototype target and related validation completed; retain candidate pending proof-domain and full admission, do not start another strategy patch.',
              evidenceArchive=str(archive.relative_to(repo)), evidenceArchiveSha256=sha(archive.read_bytes()))
window_path.write_text(json.dumps(window, ensure_ascii=False, indent=2) + '\n')

# Preserve exact unified-diff bytes (including blank context prefixes) in a
# compact artifact, rather than treating patch context as source whitespace.
for version in ['v1', 'v2']:
    original = directory / f'blue-income-forecast-prototype-20261119-{version}.patch'
    compressed = original.with_suffix('.patch.gz')
    if not compressed.exists():
        compressed.write_bytes(gzip.compress(original.read_bytes(), mtime=0))
    assert gzip.decompress(compressed.read_bytes()) == original.read_bytes()

names = [
    'blue-income-forecast-prototype-preflight-20261119-v1.json',
    'blue-income-forecast-prototype-preflight-20261119-v2.json',
    'blue-income-forecast-prototype-20261119-v1.patch.gz',
    'blue-income-forecast-prototype-20261119-v2.patch.gz',
    'blue-income-forecast-prototype-diagnostics-20261119-v2.json',
    'blue-income-forecast-root104-benchmark-20261119-v2.json',
    'blue-income-forecast-source-checks-20261119-v1.json',
    'blue-income-forecast-audit-dependency-review-20261119-v1.json',
    'blue-income-forecast-restored-dependency-checks-20261119-v1.json',
    'blue-income-forecast-input-audit-20261119-v2.json',
    'blue-income-forecast-input-audit-20261119-v3.json',
    'blue-income-forecast-ready-analysis-check-20261119-v2.json',
    'blue-income-forecast-input-routes-20261119-v1.json',
    outcome.name, window_path.name, archive.name,
]
scripts = ['adhoc/prototype-blue-income-forecast-20261119.py',
           'adhoc/verify-blue-income-forecast-20261119.cjs',
           'adhoc/benchmark-blue-income-root104-20261119.cjs',
           'adhoc/verify-blue-income-input-routes-20261119.cjs',
           'adhoc/close-blue-income-forecast-20261119.py']
protected = json.loads(Path('/private/tmp/seti-blue-cash-control-20261119-manifest-published.json').read_text())
assert sha((repo / '.git/index').read_bytes()) == protected['sharedIndexSha256']
for name, digest in protected['sharedCoreSha256'].items():
    assert sha((repo / name).read_bytes()) == digest, name
head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=repo, text=True).strip()
assert head == protected['commit']
snapshot = Path(tempfile.mkdtemp(prefix='seti-blue-income-frozen-20261119-', dir='/private/tmp'))
paths = {}
for relative in scripts + [str((directory / name).relative_to(repo)) for name in names]:
    data = (repo / relative).read_bytes()
    target = snapshot / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    paths[relative] = sha(data)
    if relative.endswith('.json'):
        json.loads(data)
    elif relative.endswith('.cjs'):
        subprocess.run(['node', '--check', str(target)], check=True)
    elif relative.endswith('.py'):
        compile(data, relative, 'exec')
    if not relative.endswith('.gz'):
        assert all(line.rstrip(b' \t') == line for line in data.splitlines()), relative
publication = {'parent': head, 'snapshot': str(snapshot), 'paths': paths,
               'sharedIndexSha256': protected['sharedIndexSha256'],
               'sharedCoreSha256': protected['sharedCoreSha256'],
               'deadlineEpochSeconds': window['deadlineEpochSeconds'],
               'candidatePatchReconstructionVerified': True,
               'evidenceAssertionsPassed': True, 'productionChanged': False,
               'newAutonomousGames': 0}
Path('/private/tmp/seti-blue-income-forecast-20261119-manifest.json').write_text(json.dumps(publication, indent=2) + '\n')
print(json.dumps({'files': len(paths), 'root104Blue1Chosen': True,
                  'nativeInputs': 38, 'milliseconds': benchmark['rootAndSearchMilliseconds'],
                  'unitWallMinutes': unit_minutes, 'remainingRouteMinutes': result['workWindow']['remainingRouteMinutesMaximum'],
                  'productionChanged': False, 'adopted': False}))
