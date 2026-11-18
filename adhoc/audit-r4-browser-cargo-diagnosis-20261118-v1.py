"""Read-only check of the matched Native cargo boundary and old evidence."""
import gzip
import hashlib
import json
from pathlib import Path

R = Path(__file__).resolve().parents[1]
M = R / 'reports/ai-foundation-20261118'
out = M / 'r4-browser-cargo-findings-20261118-v1.json'
sources = {}


def read(name):
    blob = (M / name).read_bytes()
    sources[name] = hashlib.sha256(blob).hexdigest()
    if name.endswith('.gz'):
        blob = gzip.decompress(blob)
    return json.loads(blob) if name.endswith(('.json', '.json.gz')) else blob.decode()


d = read('r4-browser-cargo-diagnosis-20261118-v1.json.gz')
r = read('r4-browser-cargo-replay-20261118-v1.json.gz')
old = read('r4-cargo-whole-suffix-20261118-v1.receipt.json.gz')
source = read('r4-main-owned-v513-source-20261118-v1.json')
failed_log = read('r4-browser-cargo-diagnosis-20261118-v1.log')
assert 'ANALYSIS_NODE_INVALID' in failed_log
assert r['sourceSha256'] == sources['r4-browser-cargo-diagnosis-20261118-v1.json.gz']
assert d['sourceFiles'] == source['paths']
assert len(d['trace']) == 9 and len(d['expansion']['actions']) == 5
assert r['nativeInputs'] == len(r['trace']) == 5
assert r['root'] == d['root']
assert all(row['action'] == action for row, action in zip(r['trace'], d['expansion']['actions']))
assert r['trace'][-1]['action']['family'] == 'complete_task'
assert r['claimCard'] == 'alien-chong-6-16' and r['deliveredFossil'] == 'fossil_07'
assert r['initialJobs']['5']['fossilId'] == 'fossil_07'
assert r['initialJobs']['7']['fossilId'] == 'fossil_06'
assert '5' not in r['trace'][-1]['afterJobs']
assert r['trace'][-1]['afterJobs']['7'] == r['initialJobs']['7']
assert r['correctOtherJobInvariant'] and not r['oldBrowserInvariant']
assert r['exactExistingSuffixRoot'] and r['final'] == old['root']
assert r['rngUnchanged']
assert old['complete'] and len(old['inputs']) == 7 and old['result']['value'] == 244
assert old['checkpoints'][0]['envelope'] == old['root']
assert all(a['envelope'] != b['envelope'] for a, b in zip(old['checkpoints'], old['checkpoints'][1:]))
result = {
    'date': '2026-11-18', 'sources': sources,
    'question': 'Does the failed Browser invariant preserve the independent second cargo?',
    'classification': 'stale validation invariant; not evidence of a Native overwrite',
    'firstDelivery': {'fossil': 'fossil_07', 'claimCard': 'alien-chong-6-16',
                      'removedJob': '5', 'preservedJob': '7', 'preservedFossil': 'fossil_06'},
    'cause': 'Browser calls job5 independent although job5 is the F07 delivery being completed. Node uses the actual selected fossil and checks the other initial job, job7.',
    'evidence': {'replayedNativeInputs': 5, 'otherTaskExact': True,
                 'rngUnchanged': True, 'exactPriorSuffixRoot': True,
                 'priorSevenInputSuffixReused': True, 'priorSuffixValue': 244},
    'workAccounting': {
        'newAISearches': 0, 'newBrowserRuns': 0, 'newGames': 0,
        'successfulSavedLiveNativeInputs': 14,
        'successfulSavedPrivatePlanSubmissions': 5,
        'firstAttemptFailure': 'Diagnostic serialized lazy analysis nodes after port.close; failed before saving the trace. Subsequent version stores each live input and only copies plain action records.',
        'firstAttemptInferredLiveInputs': 9,
        'firstAttemptInferredPrivateSubmissions': 5,
        'accountingLimit': 'First failed attempt counts are reconstructed from the fixed script path and error location, not a persisted Native counter; they are not excluded from incurred work.',
    },
    'methodTrial': {'newCauseClassified': True, 'secondRuntimeOverwriteHypothesisRejected': True,
                    'followupStrategyPatchStarted': False,
                    'exit': 'Close this diagnostic work unit; retain existing admission failures.'},
    'remaining': ['Correct the Browser invariant to bind the actual selected fossil and other job, then verify it using saved Native actions.',
                  'The old Browser result remains2 passed/1 failed/6 not run; this diagnosis is not a full Browser PASS.',
                  'The candidate teacher289639.7ms remains above600ms; no candidate promotion or full game.',
                  'Formal v485 score272 and the original teaching alignment/asset goal remain unchanged.'],
}
if out.exists():
    assert json.loads(out.read_text()) == result
    print('Reuse existing findings:', out)
else:
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'output': str(out), 'classified': True, 'exactPriorBoundary': True,
                      'newAISearches': 0, 'newGames': 0}))
