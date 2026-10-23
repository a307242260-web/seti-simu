"""Package completed diagnostic checkpoints; does not run or repeat experiments."""
import gzip
import hashlib
import json
import pathlib
import statistics
import subprocess

stage = pathlib.Path.cwd()
output = stage / 'reports/ai-foundation-20261023/identity-copy-validation-v1.json'
if output.exists():
    raise SystemExit('Reuse existing validation checkpoint')

def sha(data):
    return hashlib.sha256(data).hexdigest()

def load(path):
    return json.loads((stage / path).read_text())

def dump(path, value):
    (stage / path).write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')

def behavior(value):
    value = json.loads(json.dumps(value))
    value['diagnostics'].pop('milliseconds')
    value['diagnostics']['limits'].pop('milliseconds')
    return value

def package_raw(report):
    raw = report['rawPath']
    data = (stage / raw).read_bytes()
    assert sha(data) == report['rawSha256']
    target = raw + '.gz'
    packed = gzip.compress(data, mtime=0)
    (stage / target).write_bytes(packed)
    assert gzip.decompress(packed) == data
    report.update(rawPath=target, rawSha256=sha(packed), rawEncoding='gzip', rawUncompressedSha256=sha(data))
    artifacts.add(target)

artifacts = {'reports/ai-foundation-20261023/identity-copy-syntax-v1.json',
    'reports/ai-foundation-20261023/preparation-witness-experiment-outcomes-v1.json'}
witness = load('reports/ai-foundation-20261023/preparation-witness-experiment-outcomes-v1.json')
for p, expected in witness['artifacts'].items():
    assert sha((stage/p).read_bytes()) == expected
    artifacts.add(p)
syntax = load('reports/ai-foundation-20261023/identity-copy-syntax-v1.json')
assert all(row['exitCode'] == 0 for row in syntax['rows'])
rows = []
raws = {}
for variant in ['original', 'combined', 'parity']:
    for case_id, count in [('008', 1 if variant == 'parity' else 2), ('062', 1 if variant == 'parity' else 3)]:
        for run in range(count):
            path = f'reports/ai-foundation-20261023/turn-copy-search-{variant}-{case_id}-{run}-v2.json'
            report = load(path)
            assert report['rootUnchanged']
            assert report['onDiskAnalysisPortSha256'] == sha((stage / 'randomizer/game/ai/analysis-port.js').read_bytes())
            for source_path, expected in report['sourceHashes'].items():
                assert sha((stage/source_path).read_bytes()) == expected
            raw = load(report['rawPath'])
            raws[(variant, case_id, run)] = behavior(raw)
            package_raw(report)
            dump(path, report)
            artifacts.add(path)
            rows.append({key: report[key] for key in ['variant', 'caseId', 'run', 'milliseconds', 'complete', 'actionId', 'value', 'distance', 'unresolved', 'parityCalls']})
for (variant, case_id, run), raw in raws.items():
    assert raw == raws[('original', case_id, 0)], (variant, case_id, run)

corpus_path = 'reports/ai-foundation-20261023/decision-corpus-audit-v22.json'
corpus, old = load(corpus_path), load('reports/ai-foundation-20261023/decision-corpus-audit-v20.json')
assert len(corpus['rows']) == 8
for row, reference in zip(corpus['rows'], old['rows']):
    assert row['caseId'] == reference['caseId'] and row['rootUnchanged']
    assert behavior(load(row['rawPath'])) == behavior(load(reference['rawPath']))
    package_raw(row)
dump(corpus_path, corpus)
artifacts.add(corpus_path)

summary = {}
for case_id in ['008', '062']:
    a = [r['milliseconds'] for r in rows if r['caseId'] == case_id and r['variant'] == 'original']
    b = [r['milliseconds'] for r in rows if r['caseId'] == case_id and r['variant'] == 'combined']
    summary[case_id] = {'originalMilliseconds': a, 'combinedMilliseconds': b,
        'originalMedianMilliseconds': statistics.median(a), 'combinedMedianMilliseconds': statistics.median(b),
        'medianReductionPercent': 100 * (1-statistics.median(b)/statistics.median(a)),
        'limitation': 'Small development sample at one fixed diagnostic window; no statistical generalization or whole-game acceptance.'}

node_path = 'reports/ai-foundation-20261023/identity-copy-full-node-v2.log'
browser_path = 'reports/ai-foundation-20261023/identity-copy-browser-v3.log'
node_log, browser_log = (stage / node_path).read_text(), (stage / browser_path).read_text()
assert 'SUMMARY unit passed=130 failed=0 total=130' in node_log
assert 'SUMMARY fullFlow passed=1 failed=0 total=1' in node_log
assert 'SUMMARY browserSmoke passed=3 failed=0 total=3' in browser_log
assert '"turnPreviewCases":1104' in node_log
artifacts.update([node_path, browser_path, 'reports/ai-foundation-20261023/identity-micro-v2.json'])
changed = ['randomizer/game/ai/analysis-port.js', 'randomizer/game/ai/turn-preview.test.js',
    'randomizer/index.html', 'tools/node-test-inventory.js', 'docs/ai-identity-copy-cost-20261023.md',
    'docs/ai-search-agent-contract-20261023.md', 'docs/ai-implementation-20261022.md',
    'adhoc/benchmark-ai-identity-20261023-v2.js', 'adhoc/benchmark-ai-identity-search-20261023-v2.js',
    'adhoc/benchmark-ai-turn-copy-search-20261023-v2.js', 'adhoc/audit-ai-decision-corpus-20261023-v22.js',
    'adhoc/finalize-ai-identity-copy-20261023-v1.py', 'adhoc/deliver-ai-identity-copy-20261023-v1.py']
artifacts.update(changed)
report = {'schemaVersion': 'seti-ai-identity-copy-validation-v1', 'date': '2026-10-23',
    'baseCommit': '1947bdae80fae26a31770232d142b910fbb92a9a', 'snapshot': str(stage),
    'scope': 'Byte-identical identity and turn-only preview copy. Search v25, same boundaries, ordering, proofs, budgets and complete/failed semantics.',
    'rows': rows, 'timingSummary': summary,
    'graphParity': {'all12ResultsMatchIgnoringOnlyDiagnosticTimeAndWatchdogMetadata': True, 'fixedEightMatchPrevious': True,
        'identityCallsWithExactByteParity': [r['parityCalls'] for r in rows if r['variant'] == 'parity']},
    'turnPreviewCases': 1104, 'syntaxPath': 'reports/ai-foundation-20261023/identity-copy-syntax-v1.json',
    'rejectedWitnessPath': 'reports/ai-foundation-20261023/preparation-witness-experiment-outcomes-v1.json', 'node': {'unitPassed': 130, 'fullFlowPassed': 1, 'logPath': node_path},
    'browser': {'passed': 3, 'logPath': browser_path, 'sandboxAttempt': 'Initial v1 run could not bind 127.0.0.1 (EPERM); local Chrome run succeeded with sandbox escalation.'},
    'fixedGate': {'path': corpus_path, 'passed': corpus['passed'], 'failed': corpus['failed'], 'budget': corpus['budget']},
    'newSearchFullGames': 0, 'newSearchFinalScores': None, 'fullGame180SecondAcceptance': 'Not run; necessary decision coverage remains incomplete.',
    'stateValueInputAudit': 'No new evaluation input path or evaluator change; previous audit v24 independent inputs passed, legacy aomomo failure remains. No new all-audit-pass claim.',
    'nextAction': 'Address duplicate resource preparation and reachable reward upper bounds in complex main-action windows; preserve shortest-input and deterministic root selection as well as V.',
    'sourceHashes': {p: sha((stage/p).read_bytes()) for p in changed},
    'evidenceHashes': {p: sha((stage/p).read_bytes()) for p in sorted(artifacts) if p not in changed}}
dump(str(output.relative_to(stage)), report)
artifacts.add(str(output.relative_to(stage)))
dump('adhoc/ai-identity-stage35-snapshot-20261023.json', {'baseCommit': report['baseCommit'], 'snapshot': str(stage),
    'validationPath': str(output.relative_to(stage)), 'files': {p: sha((stage/p).read_bytes()) for p in sorted(artifacts)},
    'notes': 'Final isolated snapshot, explicit own files only. Earlier prototype diagnostics and the shared worktree/index are excluded.'})
print(json.dumps({'timingSummary': summary, 'gate': report['fixedGate'], 'files': len(artifacts)}, ensure_ascii=False))
