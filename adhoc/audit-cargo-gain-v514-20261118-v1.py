"""Check frozen source, single admission result and existing validation logs."""
from pathlib import Path
import gzip
import hashlib
import json
import re
import subprocess
import sys

R = Path(__file__).resolve().parents[1]
M = R / 'reports/ai-foundation-20261118'
out = M / 'cargo-gain-v514-findings-20261118-v1.json'
sources = {}


def read(name):
    data = (M / name).read_bytes()
    sources[name] = hashlib.sha256(data).hexdigest()
    if name.endswith('.gz'):
        data = gzip.decompress(data)
    return json.loads(data) if name.endswith(('.json', '.json.gz')) else data.decode()


source = read('cargo-gain-v514-source-20261118-v1.json')
point = read('cargo-gain-v514-point289-20261118-v1.json.gz')
old = read('r4-main-owned-point289-v513-20261118-v1.json.gz')
assert point['manifestSha256'] == sources['cargo-gain-v514-source-20261118-v1.json']
assert point['sourceFiles'] == source['paths'] and len(source['paths']) == 52
assert point['root'] == old['root'] and point['rootAndRngPreserved']
assert point['gate']['passed'] and point['summary']['milliseconds'] <= 600
assert point['summary']['native'] == 69 and point['summary']['value'] == 239.5
assert point['summary']['graphExact'] and point['summary']['rootsExact']
probe = """const fs=require('node:fs'),z=require('node:zlib'),c=require('node:crypto'),a=require('node:assert/strict');
const load=p=>JSON.parse(z.gunzipSync(fs.readFileSync(p))),x=load(process.argv[1]),y=load(process.argv[2]),sha=v=>c.createHash('sha256').update(JSON.stringify(v)).digest('hex');
a.equal(sha(x.search.lines),sha(y.search.lines));a.equal(sha(x.search.roots),sha(y.search.roots));process.stdout.write('EXACT');"""
assert subprocess.check_output(['node', '-e', probe,
    str(M / 'cargo-gain-v514-point289-20261118-v1.json.gz'),
    str(M / 'r4-main-owned-point289-v513-20261118-v1.json.gz')], text=True) == 'EXACT'
stats = point['summary']['cargoGainReuse']
assert stats['hits'] == 141 and stats['entries'] == 36 and stats['evictions'] == 0
diag1 = read('cargo-compact-reuse-diagnostic-20261118-v1.json.gz')
diag2 = read('cargo-compact-reuse-diagnostic-20261118-v2.json.gz')
phase = read('cargo-main-phase-scope-20261118-v1.json')
assert len(phase['rows']) == 3 and all(x['rawResultExact'] for x in phase['rows'])
assert diag1['summary']['optimisticNetMilliseconds'] < 39.702459
assert diag2['summary']['consistent'] and diag2['summary']['rebaseExact']
assert diag2['summary']['optimisticNetMilliseconds'] > 39.702459 + 5
failed1 = read('cargo-gain-v514-controls-20261118-v1.log')
failed2 = read('cargo-gain-v514-controls-20261118-v2.log')
assert 'AssertionError' in failed1 and 'assert(key)' in failed2
controls = json.loads(read('cargo-gain-v514-controls-20261118-v3.log'))
assert controls['cargoGainReuse'] == 'passed' and len(controls['examples']) == 3
node = read('cargo-gain-v514-related-20261118-v1.log')
assert 'SUMMARY unit passed=12 failed=0 total=12' in node
cargo = next(json.loads(line) for line in node.splitlines() if line.startswith('{"knownPostMainCargo"'))
assert [r['value'] for r in cargo['rows']] == [242, 249, 239.5, 239.5, 242, 244]
audit = read('cargo-gain-v514-value-input-audit-20261118-v1.log')
assert audit.count('[PASS]') == 68 and '[FAIL]' not in audit
browser = read('cargo-gain-v514-browser-20261118-v1.log')
related1 = read('cargo-gain-v514-browser-related-20261118-v1.log')
related2 = read('cargo-gain-v514-browser-related-20261118-v2.log')
assert 'SUMMARY browserSmoke passed=1 failed=0 total=1' in browser
assert 'Not found' in related1 and 'SUMMARY browserSmoke passed=3 failed=0 total=3' in related2
browser_ids = re.findall(r'^PASS (\S+) ', browser + '\n' + related1 + '\n' + related2, re.M)
assert len(browser_ids) == len(set(browser_ids)) == 11
dependencies = read('cargo-gain-v514-browser-dependencies-20261118-v1.json')
assert len(dependencies['restored']) == 3 and not dependencies['runtimeSourceChanged']
runtime = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(source['sealedRoot'])
for p, h in source['paths'].items():
    assert hashlib.sha256((runtime / p).read_bytes()).hexdigest() == h, p
result = {
    'date': '2026-11-18', 'sources': sources,
    'candidate': 'v514', 'promoted': False, 'kind': 'Exact cargo value-delta reuse, no Native-state merge or policy branch omission',
    'admission': {'sameRoot': True, 'rootAndRngExact': True,
                  'milliseconds': [old['summary']['milliseconds'], point['summary']['milliseconds']],
                  'native': 69, 'logicalNodes': 601, 'value': 239.5,
                  'completeGraphAndRootsExact': True, 'passed': True,
                  'millisecondsHeadroom': 600 - point['summary']['milliseconds'],
                  'limit': 'One independent measurement per runtime; not a latency distribution or proof of whole-game speedup.'},
    'cache': stats,
    'scope': 'Round4 known fixed Worm/Amiba cargo; preserve wallet, exact cards, tech, jobs/fossils, collision/solar geometry, gold board and forbidden coordinate. Rebase the actual full current score. Unsupported rules, unknown cards, relevant triggers, invalid pool or incomplete gold marks execute the original function.64-entry eviction recomputes; source and Native successors are never cached.',
    'controls': {'examples': 3, 'controlsPerExample': 15, 'resultMutationSafe': True,
                 'rootReopenClearsCache': True, 'sixNativePayoffs': [242, 249, 239.5, 239.5, 242, 244]},
    'validation': {'relatedNodePassed': 12, 'relatedNodeFailed': 0,
                   'valueInputAuditPassed': 68, 'browserDistinctPassed': 11,
                   'browserCriticalPointWithin600ms': True,
                   'browserExactMillisecondsRecorded': False,
                   'independentlyRestoredSourceFiles': 52, 'fullNodeSuiteRun': False},
    'retainedFailures': [
        'Compact diagnostic v1 incorrectly excluded pre-main/turn-boundary contexts; three pure Native controls justified dropping that redundant eligibility condition while retaining the actual phase in the key.',
        'Prototype trigger control exposed that listPendingTriggerKeys is not a test for every unconsumed trigger; the first correction then rejected harmless researchTech triggers, including a still-active blue trigger. Final guard rejects unconsumed non-researchTech triggers; a real Native visitPlanet card is the negative control. Both failed logs retained.',
        'Browser income-recovery initially failed on missing historical inputs; restored three exact files from fixed Git base, then ran only the affected/unexecuted three checks. Frozen source/timing manifest unchanged.'
    ],
    'remaining': ['Integrate/review the independently archived candidate against the shared working tree without overwriting unrelated changes.',
                  'Validate the fixed23-input opening, first-two-round assets and unique autonomous full game through the registered experiment path.',
                  'Compare round-end score, technology, income, wallet and preinvestment; register/sync only reproducible completed outcomes.',
                  'Broader integration and historical regression failures remain outside these12 related checks.'],
    'formal': {'version': 'v485/valuev71', 'completeGameScore': 272,
               'newGamesThisUnit': 0, 'newWholeGameQualityClaim': False},
    'workUnitExit': 'One isolated prototype, required scoped checks and one final-source admission measurement complete. No game/batch or further optimization in this unit.'
}
if out.exists():
    assert json.loads(out.read_text()) == result
    print('Reuse existing findings:', out)
else:
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'output': str(out), 'admissionPassed': True,
                      'relatedNodePassed': 12, 'browserPassed': 11, 'newGames': 0}))
