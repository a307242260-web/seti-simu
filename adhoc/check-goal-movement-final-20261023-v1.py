"""Verify the final frozen source and checkpoint bytes before isolated delivery."""
import hashlib
import json
import pathlib
import subprocess

stage = pathlib.Path('.')
sha = lambda p: hashlib.sha256((stage/p).read_bytes()).hexdigest()
changed = json.loads((stage/'adhoc/goal-movement-base-changes-20261023-v1.json').read_text())
extra = ['randomizer/game/ai/goal-movement.js', 'randomizer/game/ai/goal-movement.test.js',
    'adhoc/benchmark-goal-movement-20261023-v3.js', 'adhoc/audit-goal-movement-corpus-20261023-v5.js',
    'adhoc/profile-goal-movement-case062-20261023-v4.js', 'adhoc/find-goal-movement-timing-cases-20261023-v1.js',
    'adhoc/verify-goal-movement-costs-20261023-v3.js']
syntax = []
for p in changed + extra:
    if p.endswith('.js'):
        subprocess.run(['node', '--check', p], check=True, capture_output=True)
        syntax.append(p)
reports = ['reports/ai-foundation-20261023/goal-movement-dlc40-v3.json',
    'reports/ai-foundation-20261023/goal-movement-corpus-v5.json',
    'reports/ai-foundation-20261023/goal-movement-case062-v4.json']
checks = 0
for p in reports:
    report = json.loads((stage/p).read_text())
    for source, expected in report['sourceHashes'].items():
        assert sha(source) == expected, source
        checks += 1
    for row in report.get('rows', [report]):
        assert sha(row['rawPath']) == row['rawSha256'], row['rawPath']
        assert row['rootUnchanged']
        assert not row.get('error'), row
logs = ['adhoc/goal-movement-full-node-20261023-v3.log',
    'adhoc/goal-movement-browser-20261023-v3.log',
    'adhoc/goal-movement-v-input-20261023-v3.log',
    'adhoc/goal-movement-targeted-20261023-v5.log']
full, browser, audit, targeted = [(stage/p).read_text() for p in logs]
assert 'SUMMARY unit passed=138 failed=0 total=138' in full
assert 'SUMMARY fullFlow passed=1 failed=0 total=1' in full
assert 'SUMMARY browserSmoke passed=4 failed=0 total=4' in browser
assert 'SUMMARY unit passed=3 failed=0 total=3' in targeted
assert sum(line.startswith('[PASS] independent-') for line in audit.splitlines()) == 31
failures = [line for line in audit.splitlines() if line.startswith('[FAIL]')]
assert len(failures) == 1 and 'decisionObs' in failures[0] and 'aomomo' in failures[0]
result = {'syntaxChecked': syntax, 'runtimeSourceHashChecks': checks, 'reportHashesMatchFinalSource': True,
    'rawHashesVerified': True, 'fullNode': '138 unit + 1 fullFlow passed', 'chromeSmokes': '4 passed',
    'targeted': 'goal-movement/search-agent/post-main-borrow passed', 'independentVInputs': 31,
    'legacyVAuditFailure': failures[0], 'logs': {p: sha(p) for p in logs},
    'scope': 'Goal movement policy and native execution; no claim of exhaustive goals, turn-end coverage or full-game 180s acceptance.'}
(stage/'reports/ai-foundation-20261023/goal-movement-final-validation-v2.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps(result, ensure_ascii=False))
