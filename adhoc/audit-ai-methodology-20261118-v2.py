"""Audit saved evidence only. Never invoke AI, Native inputs or browsers."""
import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
M = ROOT / 'reports/ai-foundation-20261118'
D = ROOT / 'reports/ai-foundation-20261117/human405-r3-teacher-repeat-income-20261117-v1'
OUTPUT = M / 'methodology-review-20261118-v2.json'
sources = {}


def read(relative):
    path = ROOT / relative
    blob = path.read_bytes()
    sources[relative] = hashlib.sha256(blob).hexdigest()
    if relative.endswith('.gz'):
        blob = gzip.decompress(blob)
    if relative.endswith(('.json', '.json.gz')):
        return json.loads(blob)
    return blob.decode()


def evidence(name):
    return read(str((M / name).relative_to(ROOT)))


previous = evidence('methodology-review-20261118-v1.json')
read(str((D / 'current-strategy-status-data-20261118-v1.json').relative_to(ROOT)))
game = evidence('methodology-formal-game-receipt-20261118-v2.json')
assert game['terminal'] and game['summary']['scores']['player-white'] == 272
old = evidence('r4-cargo-suffix-final-point289-v512-20261118-v1.json.gz')
new = evidence('r4-main-owned-point289-v513-20261118-v1.json.gz')
a, b = old['summary'], new['summary']
assert old['root'] == new['root'], 'Comparison must use the same saved root'
assert old['rootAndRngPreserved'] and new['rootAndRngPreserved']
assert a['native'] == 209 and b['native'] == 69
assert a['logicalNodes'] == 1949 and b['logicalNodes'] == 601
assert a['value'] == b['value'] == 239.5
assert a['action']['actionId'] == b['action']['actionId'] == 'play_card:975c7a35'
assert b['complete'] and not new['gate']['passed'] and b['milliseconds'] > 600
source = evidence('r4-main-owned-v513-source-20261118-v1.json')
patch_name = source['incrementalPatch']
read(patch_name)
assert sources[patch_name] == source['patchSha256']
assert source['sourceFilesVerified'] == 49 and not source['promoted']
assert source['measurementRuntimeUnchanged']
measured = new['sourceFiles']
differences = {p for p in measured if measured[p] != source['paths'][p]}
assert differences == set(source['verificationOnlyRevisionsAfterMeasurement'])
assert all(p.startswith('tools/') for p in differences)
plan = evidence('r4-main-owned-v513-20261118-v1.plan.json')
assert 'not new state equivalence' in plan['kind']
node = {}
for name in ['r4-main-owned-v513-related-20261118-v1.json',
             'r4-main-owned-v513-related-20261118-v2.json']:
    for row in evidence(name)['results']:
        node[row['test']] = row['exitCode']
assert sum(code == 0 for code in node.values()) == 11
assert [k for k, code in node.items() if code] == ['shared-resource-prefix']
control = evidence('r4-main-owned-v512-prefix-control-20261118-v1.json')
assert control['sameFixtureAndTest'] and control['exitCode'] == 1
native = json.loads(evidence('r4-main-owned-v513-sealed-20261118-v1.log'))
assert sum(row['actualInputs'] for row in native['rows']) == 24
assert all(row['endpointAttained'] and row['mainCompleted'] for row in native['rows'])
cargo = json.loads(evidence('r4-main-owned-v513-sealed-cargo-20261118-v1.log'))
payoffs = [row['value'] for row in cargo['rows']]
assert payoffs == [242, 249, 239.5, 239.5, 242, 244]
audit = evidence('r4-main-owned-v513-value-input-audit-20261118-v2.log')
assert audit.count('[PASS]') == 68 and '[FAIL]' not in audit
browser = evidence('r4-main-owned-v513-browser-20261118-v2.log')
assert browser.count('PASS production-') == 2
assert 'first claim overwrote independent cargo' in browser
profile = evidence('r4-main-owned-v513-cpu-summary-20261118-v1.json')
result = {
    'date': '2026-11-18',
    'kind': 'Read-only methodology follow-up; no search, Native input, browser or game executed',
    'sources': sources,
    'formalOutcome': {'version': 'v485/valuev71', 'score': 272,
                      'newCompleteGamesInThisReview': 0,
                      'twentyBoardMeanProven': False},
    'localPilot': {
        'versions': ['v512', 'v513'], 'sameRootAndRng': True,
        'intentionalStrategyChange': True,
        'interpretation': 'Preparations retain the declared beneficiary/purpose. This changes policy coverage; it is not a proof that all removed off-purpose continuations are equivalent.',
        'completeRuleSubmissions': [a['native'], b['native']],
        'logicalNodes': [a['logicalNodes'], b['logicalNodes']],
        'milliseconds': [a['milliseconds'], b['milliseconds']],
        'wallReductionFraction': 1 - b['milliseconds'] / a['milliseconds'],
        'value': b['value'], 'actionId': b['action']['actionId'],
        'nativePurposeControls': 24, 'sixPreservedPayoffs': payoffs,
        'limit': 'One measurement per distinct runtime, not a latency distribution or new game score. Changes to two validation tools after timing are explicitly recorded; measured runtime is unchanged.',
    },
    'admission': {
        'singlePointPassed': False, 'millisecondsOverLimit': b['milliseconds'] - 600,
        'nodeDistinctPassed': 11, 'nodeKnownFailure': control['sameFailure'],
        'valueInputAuditPassed': 68,
        'browserPlanned': 9, 'browserPassed': 2, 'browserFailed': 1, 'browserNotRun': 6,
        'browserFailure': 'production-known-post-main-cargo: first claim overwrote independent cargo',
        'browserFailureClassification': 'Unresolved. Browser has a fixed Ch6/rocket5 assertion, whereas Node checks the actual selected fossil and other remaining job; static discrepancy alone is not proof of a stale test.',
        'fullRegressionPassed': False, 'candidatePromoted': False,
    },
    'methodAssessment': {
        'diagnosisAndRejectionUseful': True,
        'localChangeDemonstrated': True,
        'wholeGameQualityImproved': False,
        'openEndedImplementationAllowed': False,
        'finding': 'Previous process can produce local evidence but does not bound how long local work may postpone whole-goal acceptance. Add an explicit work-unit limit and stop at unresolved admission rather than automatically generating another patch.',
    },
    'nextWorkUnit': {
        'type': 'Validation discrepancy diagnosis only; not a strategy patch',
        'question': 'Do Browser and Node describe the same cargo state, selected plan and independent task at the same Native boundary?',
        'evidenceFirst': 'Reuse the saved six Native endpoints and current source. Identify first state/action mismatch before executing any missing control.',
        'limit': 'At most 60 minutes active work or two falsifiable hypotheses, whichever ends first. No chained follow-up patches; retain unresolved classification if not proved.',
        'success': 'Classify stale expectation versus runtime regression using a concrete matched boundary and state/action evidence.',
        'afterward': 'Return to admission backlog. A classified test does not waive the remaining39.7ms, required coverage, full regression or later whole-game checks.',
    },
    'untouched': ['Native rules', 'runtime budgets', '256-submission/600ms admission',
                  '180s full-game requirement', 'shared AI runtime', 'shared Git index'],
}
assert previous['plateau']['formalScore'] == result['formalOutcome']['score']
if OUTPUT.exists():
    assert json.loads(OUTPUT.read_text()) == result, 'Do not overwrite a different checkpoint'
    print('Reuse existing read-only review:', OUTPUT)
else:
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'output': str(OUTPUT), 'sourceCount': len(sources),
                      'admissionPassed': False, 'newGames': 0}))
