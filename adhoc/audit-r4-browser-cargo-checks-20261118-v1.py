"""Verify saved Browser result and overlay; no AI, browser or Native execution."""
from pathlib import Path
import gzip
import hashlib
import json
import subprocess

R = Path(__file__).resolve().parents[1]
M = R / 'reports/ai-foundation-20261118'
out = M / 'r4-browser-cargo-checks-findings-20261118-v1.json'
sha = lambda blob: hashlib.sha256(blob).hexdigest()
source_path = M / 'r4-browser-cargo-checks-source-20261118-v1.json'
source = json.loads(source_path.read_text())
parent_path = R / source['parentManifest']
assert sha(parent_path.read_bytes()) == source['parentManifestSha256']
parent = json.loads(parent_path.read_text())
browser = 'tools/browser-smoke-inventory.js'
assert source['unchangedParentPaths'] == {p: h for p, h in parent['paths'].items() if p != browser}
assert len(source['unchangedParentPaths']) == 48
patch = R / source['incrementalPatch']
assert sha(patch.read_bytes()) == source['patchSha256']
fixture_path = R / next(iter(source['fixtureMapping'].values()))
fixture_bytes = fixture_path.read_bytes()
fixture = json.loads(gzip.decompress(fixture_bytes))
assert sha(fixture_bytes) == source['changedPaths'][next(iter(source['fixtureMapping']))]
assert len(fixture['actions']) == 12 and fixture['firstClaimInput'] == 5
assert fixture['goal']['fossilId'] == 'fossil_07' and fixture['goal']['cardId'] == 'alien-chong-6-16'
assert fixture['actions'][4]['target']['cardInstanceId'] == fixture['goal']['cardId']
for name, h in fixture['provenance'].items():
    assert sha((M / name).read_bytes()) == h
assert sha(source['helperSource'].encode()) == source['helperSha256']
inventory_path = Path(source['runtime']) / browser
assert sha(inventory_path.read_bytes()) == source['changedPaths'][browser]
probe = """const s=require(process.argv[1]),h=process.argv[2];
const a=s.find(x=>x.id==='production-known-post-main-cargo');
const b=s.find(x=>x.id==='production-known-post-main-cargo-native-replay');
if(!a?.actionExpression.includes(h)||!b?.actionExpression.includes(h)
 ||!a.actionExpression.includes('selectedGoal=selected.goal')
 ||b.actionExpression.includes('createSearchAgent'))throw Error('Corrected checks do not share the actual invariant');
process.stdout.write('SOURCE_CHECK_OK');"""
assert subprocess.check_output(['node', '-e', probe, str(inventory_path), source['helperSource']], text=True) == 'SOURCE_CHECK_OK'
log_path = M / 'r4-browser-cargo-checks-20261118-v1.log'
log = log_path.read_text()
assert 'PASS production-known-post-main-cargo-native-replay ' in log
assert 'SUMMARY browserSmoke passed=1 failed=0 total=1' in log
assert 'Error:' not in log
result = {
    'date': '2026-11-18',
    'scope': 'Verification correction only; no AI search, strategy change or new game',
    'sources': {str(p.relative_to(R)): sha(p.read_bytes()) for p in [source_path, parent_path, patch, fixture_path, log_path]},
    'change': 'The original Browser check now binds its selected goal and preserves every initial job for another fossil, instead of requiring the delivered job5 to survive.',
    'browserNativeReplay': {'passed': True, 'nativeInputs': 12,
                            'exactFirstClaimState': True, 'exactFinalState': True,
                            'rngUnchanged': True, 'value': 244,
                            'overwrittenOtherTaskRejected': True,
                            'missingOtherTaskRejected': True,
                            'assertionSourceSharedWithCorrectedAISmoke': True},
    'runtime': {'unchangedParentFiles': 48, 'formalAIChanged': False,
                'candidateAISourceChanged': False, 'promoted': False,
                'newAISearches': 0, 'newGames': 0},
    'limits': ['This is a new saved-input Native replay, not a rerun or PASS claim for the full AI Browser smoke.',
               'Original nine-case batch remains2 PASS,1 stale-invariant failure,6 not run. The new Native-replay check passes separately.',
               'Teacher289 remains69 complete submissions/601 logical nodes/639.7ms. The600ms admission is still unmet.',
               'Formal complete-game score remains272. Whole-goal asset alignment and broader regression remain incomplete.'],
    'workUnitExit': 'Correction and targeted Browser proof complete. No follow-up performance or strategy patch in this work unit.',
    'restore': 'Restore the parent49-file v513 candidate using its archived manifests; apply incrementalPatch with git apply --unidiff-zero; copy fixtureMapping; verify changedPaths and all unchangedParentPaths. Do not promote the AI runtime.'
}
if out.exists():
    assert json.loads(out.read_text()) == result
    print('Reuse existing findings:', out)
else:
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'output': str(out), 'browserNativeReplayPassed': True,
                      'negativeControls': 2, 'newAISearches': 0, 'newGames': 0}))
