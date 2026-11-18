"""Freeze this admission without treating failed or unexecuted checks as passes."""
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
sha = lambda data: hashlib.sha256(data).hexdigest()
window_path = directory / 'blue-income-admission-20261119-v1.window.json'
window = read(window_path.name)
assert window['status'] == 'open' and time.time() < window['deadlineEpochSeconds']
m = read('blue-income-forecast-prototype-preflight-20261119-v2.json')
runtime = Path(m['runtime'])
for name, digest in m['sourceFiles'].items():
    assert sha((runtime / name).read_bytes()) == m['candidateChangedFiles'].get(name, digest), name
    assert sha((Path(m['sourceRuntime']) / name).read_bytes()) == digest, name

inventory = json.loads(subprocess.check_output(['node', '-e',
    "const x=require('./tools/node-test-inventory');console.log(JSON.stringify({unit:x.unit.map(t=>t.file),fullFlow:x.fullFlow.map(t=>t.file)}));"], cwd=runtime))
initial = read('blue-income-admission-node-20261119-v1.json')
retest = read('blue-income-admission-retest-20261119-v1.json')
per_test = read('blue-income-admission-per-test-20261119-v1.json')
baseline = read('blue-income-admission-baseline-comparison-20261119-v1.json')
related = read('blue-income-admission-related-inputs-20261119-v1.json')
computer = read('blue-income-admission-computer-preinvestment-20261119-v1.json')
initial_failed = {line.split()[1] for line in initial['summary'] if line.startswith('FAIL ')}
status = {name: name not in initial_failed for name in inventory['unit']}
for name in initial['previousExactSourcePassingTestsReused']:
    status[name] = True
failed = {line.split()[1] for line in retest['summary'] if line.startswith('FAIL ')}
for name in retest['tests']:
    status[name] = name not in failed
for name, row in per_test['tests'].items():
    status[name] = row['exitCode'] == 0
for name, pair in baseline['tests'].items():
    if 'candidate' in pair:
        status[name] = pair['candidate']['exitCode'] == 0
for name, row in related['tests'].items():
    if row['attempts']:
        status[name] = row['attempts'][-1]['exitCode'] == 0
status['randomizer/game/ai/computer-preinvestment.test.js'] = computer['exitCode'] == 0
assert len(status) == 250 and sum(status.values()) == 236
assert 'SUMMARY fullFlow passed=1 failed=0 total=1' in '\n'.join(initial['summary'])
controls = [read('blue-income-admission-bound-controls-20261119-v1.json'),
            read('blue-income-admission-bound-controls-20261119-v2.json')]
assert all(record['passed'] for record in controls)
pairs = read('blue-income-admission-agent-root-comparison-20261119-v1.json')['cases'][:3]
pairs += read('blue-income-admission-agent-root-comparison-20261119-v2.json')['cases']
assert len(pairs) == 4 and all(row['sameNativeRoot'] and row['sameAction'] for row in pairs)
assert all(source['gate'] for row in pairs for source in row['sources'])
assert pairs[2]['sources'][0]['search']['value'] == pairs[2]['sources'][1]['search']['value'] == 58.5

now = time.time()
result = {
    'date': '2026-11-19', 'sourceCommit': m['sourceCommit'],
    'candidateChangedFiles': m['candidateChangedFiles'],
    'decision': 'frozen-not-admitted-for-autonomous-game',
    'productionChanged': False, 'formalCompletedScoreUnchanged': 272,
    'previouslyMeasuredFormalGameSeconds': 16.1, 'newAutonomousGames': 0,
    'unitRegression': {'registered': 250, 'passed': 236, 'notPassed': 14,
                       'failures': sorted(name for name, passed in status.items() if not passed),
                       'fullFlowPassed': True, 'allGreen': False},
    'newEvidence': {
        'computerPreinvestmentPassed': True,
        'computerPreinvestmentNativeInputs': 6,
        'boundControlRoots': 12, 'boundControlRootsWithin256And600ms': True,
        'boundControlsAreNotAFullDomainProof': True,
        'fourExistingAgentRootsSameNativeStateAndSameActionUnderV71AndV72': True,
        'fourAgentPairsAllWithin256And600ms': True,
        'outdatedScanExpectation': {'actualGoal': 'move toward Venus orbit',
                                   'actualValueBothSources': 58.5,
                                   'scanValueBothSources': 56.666666666666664,
                                   'passValueBothSources': 57,
                                   'notANewCandidateRegression': True},
        'initialMissingInputsDoNotCountAsBehaviorFailures': True,
        'sameFailedAssertionDoesNotCountAsPassingTheRemainingTest': True},
    'notPassedClassification': {
        'historicalPortfolioReference': ['analysis-region-prefix', 'final-round-probe-window', 'probe-replacement-witness'],
        'finalPassOrHistoricalAbsoluteValueContractNeedsReview': ['known-card-money', 'pre-main-data-plan', 'funded-movement-tail'],
        'historicalExecutionOrRootCountNeedsBehavioralReplacement': ['scan-income-after-free-move', 'stationary-cargo-income', 'shared-resource-prefix'],
        'logicalTransitionBudgetConfusedWithNativeSubmissions': ['probe-travel-tail'],
        'sourceCommentFalsePositive': ['host-architecture-audit'],
        'outdatedSpecificActionExpectationFreshlyCompared': ['search-agent'],
        'archivedInputOrReportingDataNotComplete': ['research-human405-r4', 'robot-ai-generation']},
    'unresolvedAdmission': [
        'The general post-main capital ceiling for the added public-income closure is not proved by the twelve controls.',
        'Required validation still contains failed historical assertions and incomplete archived inputs; later assertions were not waived or silently bypassed.',
        'No autonomous game, per-round asset improvement or twenty-board gain has been established.'
    ],
    'nextOnlyAction': 'Review the current validation contract and its exact input manifest against the green behavioral requirements before any new strategy iteration; in particular, source-drift rejection for frozen R4 continuations must not depend on loading obsolete archives first.',
    'method': {'previousGoalTurnClassification': 'progress: isolated forecast patch and root104 decision change',
               'thisGoalTurnClassification': 'progress: actual frozen-source regression, per-test input recovery, exact baseline comparisons and twelve bound controls; admission refused rather than claiming an AI improvement',
               'startedEpochSeconds': window['startedEpochSeconds'],
               'closedEpochSeconds': now, 'originalDeadlineEpochSeconds': window['deadlineEpochSeconds'],
               'wallMinutes': (now - window['startedEpochSeconds']) / 60,
               'priorRouteMinutesConservative': window['priorRouteMinutesConservative'],
               'cumulativeRouteMinutesConservative': window['priorRouteMinutesConservative'] + (now - window['startedEpochSeconds']) / 60,
               'deadlineNotReset': True, 'noStrategyOrCachePatchInThisUnit': True},
    'wholeGoalComplete': False,
}
outcome = directory / 'blue-income-admission-outcome-20261119-v1.json'
assert not outcome.exists()
outcome.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
logs = {str(file.relative_to(repo)): file.read_text(errors='replace')
        for file in directory.glob('blue-income-admission-*.log')}
archive = directory / 'blue-income-admission-evidence-20261119-v1.json.gz'
assert not archive.exists()
archive.write_bytes(gzip.compress(json.dumps(logs, ensure_ascii=False).encode(), mtime=0))
assert json.loads(gzip.decompress(archive.read_bytes())) == logs
window.update(status='closed', closedEpochSeconds=now,
              closeReason='Required regression not green and general proof incomplete; candidate frozen, no autonomous game or replacement strategy patch.',
              evidenceArchive=str(archive.relative_to(repo)), evidenceArchiveSha256=sha(archive.read_bytes()))
window_path.write_text(json.dumps(window, ensure_ascii=False, indent=2) + '\n')

scripts = ['adhoc/' + name for name in [
    'admit-blue-income-candidate-20261119.py', 'restore-blue-income-test-inputs-20261119.py',
    'recheck-blue-income-admission-20261119.py', 'compare-blue-income-admission-baseline-20261119.py',
    'check-blue-income-bound-domain-20261119.cjs', 'compare-blue-income-search-agent-roots-20261119.cjs',
    'close-blue-income-admission-20261119.py']]
owned = scripts + [str(file.relative_to(repo)) for file in directory.glob('blue-income-admission-*.json')]
owned.append(str(archive.relative_to(repo)))
protected = json.loads(Path('/private/tmp/seti-blue-income-forecast-20261119-manifest-published.json').read_text())
assert sha((repo / '.git/index').read_bytes()) == protected['sharedIndexSha256']
for name, digest in protected['sharedCoreSha256'].items():
    assert sha((repo / name).read_bytes()) == digest, name
head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=repo, text=True).strip()
assert head == protected['commit']
snapshot = Path(tempfile.mkdtemp(prefix='seti-blue-income-admission-frozen-20261119-', dir='/private/tmp'))
paths = {}
for name in owned:
    data = (repo / name).read_bytes()
    target = snapshot / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    paths[name] = sha(data)
    if name.endswith('.json'):
        json.loads(data)
    if name.endswith('.py'):
        compile(data, name, 'exec')
    if name.endswith('.cjs'):
        subprocess.run(['node', '--check', str(target)], check=True)
    if not name.endswith('.gz'):
        assert all(line.rstrip(b' \t') == line for line in data.splitlines()), name
publication = {'parent': head, 'snapshot': str(snapshot), 'paths': paths,
               'sharedIndexSha256': protected['sharedIndexSha256'],
               'sharedCoreSha256': protected['sharedCoreSha256'],
               'deadlineEpochSeconds': window['deadlineEpochSeconds'],
               'candidatePatchReconstructionVerified': protected['candidatePatchReconstructionVerified'],
               'evidenceAssertionsPassed': True, 'productionChanged': False, 'newAutonomousGames': 0}
Path('/private/tmp/seti-blue-income-admission-20261119-manifest.json').write_text(json.dumps(publication, indent=2) + '\n')
print(json.dumps({'files': len(paths), 'decision': result['decision'], 'unitPassed': 236,
                  'unitNotPassed': 14, 'fullFlowPassed': True, 'newAutonomousGames': 0,
                  'wallMinutes': result['method']['wallMinutes']}))
