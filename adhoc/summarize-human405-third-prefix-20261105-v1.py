"""Aggregate saved evidence; never rerun policy queries or native games."""
from pathlib import Path
import gzip
import hashlib
import json

stage = Path(__file__).resolve().parents[1]
folder = Path('reports/ai-foundation-20261105/third-round-teacher-v1')
output = folder / 'v192-computer-prefix-review-20261105-v1.json'
read = lambda p: json.loads((stage / p).read_text())
sha = lambda p: hashlib.sha256((stage / p).read_bytes()).hexdigest()
evidence = {}

def remember(p):
    evidence[str(p)] = sha(p)
    return read(p)

manifests = []
for version in [190, 191, 192]:
    path = Path(f'reports/ai-foundation-20261105/candidate-v{version}-computer-prefix-20261105-v1/manifest.json')
    manifest = remember(path)
    assert manifest['status'] == 'candidate-unadmitted'
    for name, digest in manifest['sourceHashes'].items():
        assert sha(path.parent / name) == digest, name
    manifests.append(str(path))

roots = []
for version, labels in [(190, ['case-105']), (191, ['case-105', 'teacher-r3-first-white', 'teacher-r3-after-amiba-reveal', 'teacher-r3-before-safety-protocol']), (192, ['case-105', 'teacher-r3-first-white', 'teacher-r3-after-amiba-reveal', 'teacher-r3-before-safety-protocol'])]:
    for label in labels:
        path = folder / f'v{version}-cold-{label}-20261105-v1.json'
        result = remember(path)
        assert result['complete'] and result['rootAndRngUnchanged']
        assert not result['candidateAdmitted']
        assert sha(result['candidateSourceManifest']) == result['candidateSourceManifestSha256']
        assert sha(result['fixture']) == result['fixtureSha256']
        assert sha(result['rawPath']) == result['rawSha256']
        raw = json.loads(gzip.decompress((stage / result['rawPath']).read_bytes()))
        assert raw['complete'] and raw['unresolved'] == []
        if version == 192 and label == 'teacher-r3-before-safety-protocol':
            protocol = next(r for r in raw['roots'] if r['actionId'] == 'play_card:201c00de')
            assert protocol['value'] == 94.5 and result['value'] == 117
        roots.append({k: result[k] for k in ['label', 'searchVersion', 'nativeInputs', 'milliseconds', 'decisionGatePassed', 'actionId', 'value']})

assert [r['decisionGatePassed'] for r in roots if r['searchVersion'].endswith('192')] == [True] * 4
assert not roots[0]['decisionGatePassed']
assert next(r for r in roots if r['searchVersion'].endswith('191') and r['label'] == 'teacher-r3-after-amiba-reveal')['nativeInputs'] == 281
for name in ['v192-prefix-proof-focused-tests-20261105-v1.log', 'v192-amiba-prefix-native-proof-final-20261105-v3.log', 'v192-frozen-continuations-test-clean-20261105-v1.log']:
    path = folder / name
    evidence[str(path)] = sha(path)
assert 'unit passed=14 failed=0 total=14' in (stage / folder / 'v192-prefix-proof-focused-tests-20261105-v1.log').read_text()
assert '"pendingRevealHistoryAndProbeRefuseProof":true' in (stage / folder / 'v192-amiba-prefix-native-proof-final-20261105-v3.log').read_text()
assert 'fatal:' not in (stage / folder / 'v192-frozen-continuations-test-clean-20261105-v1.log').read_text()

native = remember(folder / 'known-amiba-teacher-prefix-value-20261105-v1.json')
rows = {r['input']: r for r in native['rows']}
parts = lambda i, side: rows[i][side]['unknownNewHandIdentityMaskedValue']['components']
assert parts(128, 'after')['currentEndGameBonus'] - parts(128, 'before')['currentEndGameBonus'] == 7
assert parts(130, 'after')['realizedScore'] - parts(130, 'before')['realizedScore'] == 4
assert parts(132, 'after')['currentEndGameBonus'] - parts(132, 'before')['currentEndGameBonus'] == 8
for name in ['randomizer/game/ai/state-value.js', 'randomizer/game/end-game-scoring.js', 'assets/final/final_detail.md']:
    evidence[name] = sha(name)

result = {
    'status': 'active', 'productionRuntime': 'V189/V22', 'candidate': 'V192/V22',
    'candidateAdmitted': False, 'newAutonomousRuns': 0, 'baselineChanged': False,
    'scopeOrder': ['same-teacher-native-third-round-learning', 'review-second-round-end-afterwards'],
    'candidateManifests': manifests, 'coldRoots': roots,
    'focusedBehaviorTestsPassed': 14, 'extendedNativeTailInputControls': [5, 6],
    'nativeComputerPrefixInputs': 4, 'nativeComputerPrefixNetValueGain': 4,
    'nativeKnownContinuationObservations': {'research128CurrentFinalBonusGain': 7, 'protocol130ScoreGain': 4, 'newMark132CurrentFinalBonusGain': 8},
    'remainingIssues': ['funded-continuing-research-and-trace-triggers', 'existing-final-marker-growth-in-delayed-research-quotes', 'continuous-scan-value-of-purple2-and-orange2', 'first113-order-tradeoff', 'full-source-admission-and-same-state-autonomous-third-round'],
    'interpretation': 'Observed native rewards are not an additive future guarantee or a proof that the teacher path is optimal. R2 choices remain unreviewed; do not use future DLC31 or hidden species identity.',
    'evidenceSha256': evidence,
}
payload = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
if (stage / output).exists():
    assert (stage / output).read_text() == payload, 'saved aggregation differs; preserve it and version new evidence'
else:
    (stage / output).write_text(payload)
print(json.dumps({'output': str(output), 'savedColdRoots': len(roots), 'candidate192FourKeyGatesPassed': True, 'productionChanged': False, 'newPolicyQueries': 0}))
