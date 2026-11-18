"""Freeze verified HEAD changes and retain the different shared checkout."""
import gzip
import hashlib
import json
from pathlib import Path
import subprocess
import time

repo = Path(__file__).resolve().parents[1]
directory = repo / 'reports/ai-foundation-20261119'
read = lambda name: json.loads((directory / name).read_text())
sha = lambda value: hashlib.sha256(value).hexdigest()
window_path = directory / 'frozen-continuation-validation-20261119-v1.window.json'
window = read(window_path.name)
assert window['status'] == 'open' and time.time() < window['deadlineEpochSeconds']
proof = read('frozen-continuation-validation-20261119-v1.json')
fullflow = read('frozen-continuation-validation-fullflow-20261119-v1.json')
backport = read('frozen-continuation-validation-v72-backport-20261119-v2.json')
assert proof['passed'] and fullflow['exitCode'] == backport['exitCode'] == 0
assert backport['strategyHashesUnchanged'] and backport['originalCandidateNotModified']
snapshot = Path(proof['snapshot'])
for name, digest in proof['ownedHashes'].items():
    assert sha((snapshot / name).read_bytes()) == digest, name
protected = json.loads(Path('/private/tmp/seti-blue-income-admission-20261119-manifest-published.json').read_text())
assert sha((repo / '.git/index').read_bytes()) == protected['sharedIndexSha256']
for name, digest in protected['sharedCoreSha256'].items():
    assert sha((repo / name).read_bytes()) == digest, name
assert subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=repo, text=True).strip() == proof['parent'] == protected['commit']
working = {name: sha((repo / name).read_bytes()) if (repo / name).exists() else None for name in proof['ownedPaths']}
assert working['tools/research-human405-full.js'] == 'b0a2c8c0579fe4910ee647b0d7d1407a01e02ed797bd222be045ce263bfad388'
assert working['tools/node-test-inventory.js'] == '6a2bebb6a05ef5f108965f61b7a819332e28f10e5a0b6f6dcd628b39a82412dc'
now = time.time()
outcome = directory / 'frozen-continuation-validation-outcome-20261119-v1.json'
assert not outcome.exists()
outcome.write_text(json.dumps({
    'date': '2026-11-19', 'parent': proof['parent'],
    'change': 'V123/V189/V661/R4/staged continuations validate runtime identity before archived payloads; retain all later archive and prefix checks.',
    'regression': {'beforeFailedWithMissingArchive': True, 'selfContainedChecksPassed': 21,
                   'existingContinuationTestsPassed': 2, 'uniqueFullFlowPassed': True,
                   'v72OriginalR4FailureNowPassedInValidationOnlyOverlay': True},
    'sourceAndScope': {'headSnapshot': str(snapshot), 'ownedSourceHashes': proof['ownedHashes'],
                       'sharedOldWorkingFilesPreserved': working,
                       'validationOnlyBackportRuntime': backport['runtime'],
                       'newProofMetadataBytes': backport['metadataInput']['bytes'],
                       'noHistoricalGamePayloadNeededForDriftRejection': True},
    'AI': {'strategyChanged': False, 'newAutonomousGames': 0,
           'formalScoreUnchanged': 272, 'previouslyMeasuredFormalGameSeconds': 16.1,
           'publicIncomeCandidateStillFrozen': True},
    'remaining': ['Other historical test contracts and the public-income capital ceiling still need resolution; this maintenance does not admit the candidate or prove a score improvement.'],
    'method': {'previousGoalTurnClassification': 'progress: candidate admission audit and freeze',
               'thisGoalTurnClassification': 'progress: real validation-order bug reproduced before fix and passed in both HEAD and the original research variant',
               'wallMinutes': (now - window['startedEpochSeconds']) / 60,
               'originalDeadlineEpochSeconds': window['deadlineEpochSeconds'],
               'originalStrategyRouteNotReopened': True},
    'wholeGoalComplete': False,
}, ensure_ascii=False, indent=2) + '\n')
logs = {str(file.relative_to(repo)): file.read_text(errors='replace') for file in directory.glob('frozen-continuation-validation-*.log')}
archive = directory / 'frozen-continuation-validation-evidence-20261119-v1.json.gz'
assert not archive.exists()
archive.write_bytes(gzip.compress(json.dumps(logs, ensure_ascii=False).encode(), mtime=0))
assert json.loads(gzip.decompress(archive.read_bytes())) == logs
window.update(status='closed', closedEpochSeconds=now, closeReason='Validation-order fix passed isolated current-source and original research checks; no strategy or autonomous game.', evidenceArchive=str(archive.relative_to(repo)))
window_path.write_text(json.dumps(window, ensure_ascii=False, indent=2) + '\n')
owned = proof['ownedPaths'] + [
    'adhoc/frozen-continuation-identity-test-source-20261119.cjs',
    'adhoc/fix-frozen-continuation-validation-20261119.py',
    'adhoc/close-frozen-continuation-validation-20261119.py',
] + [str(file.relative_to(repo)) for file in directory.glob('frozen-continuation-validation-*.json')] + [str(archive.relative_to(repo))]
paths = {}
for name in owned:
    source = snapshot / name if name in proof['ownedPaths'] else repo / name
    data = source.read_bytes()
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
publication = {'parent': proof['parent'], 'snapshot': str(snapshot), 'paths': paths,
               'sharedIndexSha256': protected['sharedIndexSha256'], 'sharedCoreSha256': protected['sharedCoreSha256'],
               'sharedWorkingSourceHashes': working, 'deadlineEpochSeconds': window['deadlineEpochSeconds'],
               'validationOrderFixVerified': True, 'evidenceAssertionsPassed': True,
               'AIModelChanged': False, 'newAutonomousGames': 0}
Path('/private/tmp/seti-frozen-continuation-validation-20261119-manifest.json').write_text(json.dumps(publication, indent=2) + '\n')
print(json.dumps({'files': len(paths), 'sourceFixPassed': True, 'wallMinutes': (now-window['startedEpochSeconds'])/60, 'sharedOldCheckoutPreserved': True}))
