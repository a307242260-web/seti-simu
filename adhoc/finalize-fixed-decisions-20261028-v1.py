# coding: utf-8
"""Verify source-bound checkpoints and summarize this change without rerunning experiments."""
import hashlib
import json
import pathlib
import subprocess

stage = pathlib.Path.cwd()
prefix = 'reports/ai-foundation-20261023/'
sha = lambda p: hashlib.sha256((stage/p).read_bytes()).hexdigest()
paths = {
    'corpus': prefix+'fixed-decisions-corpus-20261028-v4.json',
    'case062': prefix+'fixed-decisions-case062-20261028-v4.json',
    'policy': prefix+'fixed-decisions-policy-controls-20261028-v3.json',
    'restore': prefix+'fixed-restore-twenty-goals-20261028-v3.json',
}
reports = {k: json.loads((stage/p).read_text()) for k, p in paths.items()}
source_hashes = {}
for report in reports.values():
    for p, expected in report['sourceHashes'].items():
        assert sha(p) == expected, ('runtime source drift', p)
        assert p not in source_hashes or source_hashes[p] == expected
        source_hashes[p] = expected
    for row in report['rows']:
        assert row['rootUnchanged']
        assert sha(row['rawPath']) == row['rawSha256'], row['rawPath']
        if row.get('fixture'):
            assert sha(row['fixture']) == row['fixtureSha256']

c, policy, restore = (reports[k] for k in ['corpus', 'policy', 'restore'])
assert c['status'] == 'complete' and len(c['rows']) == 8
assert c['passed'] == 5 and c['failed'] == 3
reused = dict(next(r for r in c['rows'] if r['caseId'] == 'case-062'))
assert reused.pop('reusedCheckpoint') == paths['case062']
assert reused == reports['case062']['rows'][0]
for row in c['rows']:
    d = row['diagnostics']
    assert d['transitions'] <= 256 and d['nodes'] <= 257 and d['peakFrontier'] <= 256
    assert d['limits'] == {'transitions': 256, 'nodes': 257, 'frontier': 256, 'milliseconds': 600}
    assert d['finalMarkPlanning'] and d['scanPlanning']
    assert row['independentPreparationEdges'] == 0
    if not row['complete']:
        assert row['stopReason'] == 'watchdog' and row['actionId'] is None and row['value'] is None

controls = {}
for kind, expected_inputs in [('mark', [4, 1]), ('scan', [8, 6])]:
    rows = [r for r in policy['rows'] if r['kind'] == kind]
    assert [r['policy'] for r in rows] == [False, True]
    assert all(r['complete'] for r in rows) and rows[0]['value'] == rows[1]['value']
    assert [r['nativeInputs'] for r in rows] == expected_inputs
    controls[kind] = rows

baseline_path = prefix+'shared-prefix-twenty-goals-20261028-v1.json'
baseline = json.loads((stage/baseline_path).read_text())
for row in restore['rows']:
    old = next(r for r in baseline['rows'] if r['cache'] == row['cache'])
    d = row['diagnostics']
    assert row['complete'] and row['allOriginalGoalsAndValuesRetained']
    assert row['leafObservationHashes'] == old['leafObservationHashes']
    assert len(row['leafObservationHashes']) == 20
    assert d['transitions'] == d['nativeExecutions'] == 27 and d['nodes'] == 28
    assert d['logicalResourceInputs'] == 160 and d['sharedResourceInputHits'] == 133
    assert not d['finalMarkPlanning'] and not d['scanPlanning']
    assert row['analysis']['stableRestoreSkips'] == 5

logs = {
    'node': prefix+'fixed-decisions-node-regression-20261028-v3.log',
    'browser': prefix+'fixed-decisions-browser-20261028-v3.log',
    'valueInputs': prefix+'fixed-decisions-value-audit-20261028-v4.log',
}
assert 'SUMMARY unit passed=142 failed=0 total=142' in (stage/logs['node']).read_text()
assert 'SUMMARY fullFlow passed=1 failed=0 total=1' in (stage/logs['node']).read_text()
assert 'SUMMARY browserSmoke passed=9 failed=0 total=9' in (stage/logs['browser']).read_text()
value_log = (stage/logs['valueInputs']).read_text()
failures = [s for s in value_log.splitlines() if s.startswith('[FAIL]')]
assert len(failures) == 1 and 'aomomo' in failures[0] and 'decisionObs' in failures[0]
independent = sum(s.startswith('[PASS] independent-') for s in value_log.splitlines())
assert independent == 36
syntax = [
    'randomizer/game/ai/analysis-port.js', 'randomizer/game/ai/decision-search.js',
    'randomizer/game/ai/search-agent.js', 'randomizer/game/ai/local-decision-plans.js',
    'randomizer/game/ai/local-decision-plans.test.js', 'randomizer/game/effects/science-session.js',
    'randomizer/game/effects/session-runtime.js', 'randomizer/game/rule-composition.js',
    'tools/node-test-inventory.js', 'tools/browser-smoke-inventory.js', 'tools/audit_v_state_inputs.js',
    'adhoc/audit-fixed-decisions-corpus-20261028-v4.js',
    'adhoc/audit-fixed-decisions-case062-20261028-v4.js',
    'adhoc/benchmark-fixed-policies-20261028-v3.js',
    'adhoc/benchmark-fixed-restore-20261028-v3.js',
    'adhoc/capture-fixed-decision-fixture-20261028-v1.js',
]
for p in syntax:
    subprocess.run(['node', '--check', p], cwd=stage, check=True)

report = {
    'schemaVersion': 'seti-local-decisions-delivery-v1',
    'baseCommit': '9b872d3a1037258ab8d180ec2dd81915bae3a4ef',
    'searchVersion': 'seti-complete-decision-search-v35',
    'deliverables': [
        'Native full final-score previews, including card synergies and immediately fundable fourth-slot income; execute one fixed mark.',
        'Compare reachable sector purposes; fix the card/sector order within each scan using native legal enumerators and cost checks.',
        'Skip exact loaded stable restores and share only trusted frozen Session roots; retain mutable branch isolation and native inputs.',
    ],
    'policyIsEquivalence': False,
    'globalBudget': {'transitions': 256, 'nodes': 257, 'frontier': 256, 'milliseconds': 600},
    'checkpoints': {k: {'path': p, 'sha256': sha(p)} for k, p in paths.items()},
    'sampledPolicyControls': controls,
    'restoreControl': {
        'baseline': {'path': baseline_path, 'sha256': sha(baseline_path)},
        'goals': 20, 'allBaselineLeafObservationHashesPreserved': True,
        'actualInputs': 27, 'states': 28, 'logicalInputs': 160, 'sharedInputs': 133,
        'stableRestoresSkipped': 5,
        'rows': [{'cache': r['cache'], 'milliseconds': r['rootAndSearchMilliseconds'],
                  'restoreMilliseconds': r['analysis']['milliseconds']['restore']} for r in restore['rows']],
    },
    'timingNote': 'Single sequential Node controls include process/JIT warming and host noise; equal values are sampled window values, not game scores or global policy parity.',
    'fixedCorpus': {
        'passed': c['passed'], 'failed': c['failed'],
        'rows': [{'caseId': r['caseId'], 'complete': r['complete'], 'stopReason': r['stopReason'],
                  'milliseconds': r['rootAndSearchMilliseconds'], 'nativeInputs': r['diagnostics']['nativeExecutions'],
                  'states': r['diagnostics']['nodes'], 'pendingStates': r['unresolved'],
                  'rawPath': r['rawPath'], 'rawSha256': r['rawSha256']} for r in c['rows']],
    },
    'validation': {'nodeUnitPassed': 142, 'nodeFullFlowPassed': 1, 'nodeFailed': 0,
                   'browserPassed': 9, 'browserFailed': 0, 'independentValueInputsPassed': independent,
                   'knownLegacyValueFailure': failures, 'syntaxChecked': syntax,
                   'logs': {k: {'path': p, 'sha256': sha(p)} for k, p in logs.items()}},
    'remaining': [
        'Case-062/105/152 still stop at the watchdog; this is not full-decision performance acceptance.',
        'The fixed mark policy can sacrifice distant growth; fixed scan choices do not prove full action-tree equivalence.',
        'Existing information/other-owner boundaries and incomplete advanced company/alien goal catalogs remain.',
        'No new whole-game final score or 180-second acceptance; do not extrapolate time-limited input counts to speed or strength.',
    ],
    'wholeGames': 0, 'wholeGame180sAccepted': False, 'sourceHashes': source_hashes,
}
output = prefix+'fixed-decisions-final-20261028-v1.json'
(stage/output).write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({'report': output, 'fixedCorpusPassed': c['passed'], 'independentValueInputsPassed': independent}, ensure_ascii=False))
