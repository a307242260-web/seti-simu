"""Read saved CPU and identity evidence; do not run AI or Native inputs."""
from pathlib import Path
import collections
import gzip
import hashlib
import json
import subprocess

R = Path(__file__).resolve().parents[1]
M = R / 'reports/ai-foundation-20261118'
out = M / 'v513-cost-screen-findings-20261118-v1.json'
sources = {}


def read(name):
    data = (M / name).read_bytes()
    sources[name] = hashlib.sha256(data).hexdigest()
    if name.endswith('.gz'):
        data = gzip.decompress(data)
    return json.loads(data)


old = read('r4-main-owned-point289-v513-20261118-v1.json.gz')
profile = read('r4-main-owned-v513-cpu-20261118-v1.json.gz')['profile']
diagnostic = read('v513-quiet-reuse-diagnostic-20261118-v1.json.gz')
assert diagnostic['referenceSha256'] == sources['r4-main-owned-point289-v513-20261118-v1.json.gz']
assert diagnostic['graphAndRootsExact'] and diagnostic['search']['complete']
assert diagnostic['search']['native'] == old['summary']['native'] == 69
assert diagnostic['search']['value'] == old['summary']['value'] == 239.5
assert diagnostic['search']['graphNodes'] == old['summary']['logicalNodes'] == 601
probe = """const fs=require('node:fs'),z=require('node:zlib'),c=require('node:crypto'),a=require('node:assert/strict');
const load=p=>JSON.parse(z.gunzipSync(fs.readFileSync(p))),old=load(process.argv[1]),d=load(process.argv[2]);
const sha=x=>c.createHash('sha256').update(JSON.stringify(x)).digest('hex');
a.equal(d.search.wireGraphSha256,sha(old.search.lines));a.equal(d.search.wireRootsSha256,sha(old.search.roots));
process.stdout.write('FULL_GRAPH_AND_ROOTS_EXACT');"""
assert subprocess.check_output(['node', '-e', probe,
    str(M / 'r4-main-owned-point289-v513-20261118-v1.json.gz'),
    str(M / 'v513-quiet-reuse-diagnostic-20261118-v1.json.gz')], text=True) == 'FULL_GRAPH_AND_ROOTS_EXACT'
driver = R / 'adhoc/diagnose-v513-quiet-reuse-20261118-v1.cjs'
assert hashlib.sha256(driver.read_bytes()).hexdigest() == diagnostic['driverSha256']
assert len(diagnostic['rows']) == 285
for kind in ['exactSummary', 'rawSummary']:
    assert diagnostic[kind]['calls'] == diagnostic[kind]['unique'] == 285
    assert diagnostic[kind]['repeatedCalls'] == 0 and diagnostic[kind]['consistent']
nodes = {n['id']: n for n in profile['nodes']}
parents = {child: n['id'] for n in profile['nodes'] for child in n.get('children', [])}
cost = collections.Counter()
for sample, us in zip(profile['samples'], profile['timeDeltas']):
    stack = set()
    while sample is not None:
        frame = nodes[sample]['callFrame']
        stack.add((frame['url'].split('/')[-1], frame['functionName']))
        sample = parents.get(sample)
    if ('decision-search.js', 'searchDecision') in stack:
        cost['search'] += us
    if ('resource-demand.js', 'incomeTailEndpoint') not in stack:
        continue
    cost['income'] += us
    for name, function in [('capital', ('resource-demand.js', 'planningCapital')),
                           ('prepare', ('probe-capital.js', 'prepareFinalRoundSwapMission')),
                           ('quote', ('probe-capital.js', 'quote'))]:
        if function in stack:
            cost[name] += us
assert cost['search'] == 615500 and cost['income'] == 49914 and cost['prepare'] == 4458
ms = old['summary']['milliseconds']
optimistic_prepare = ms * (1 - cost['prepare'] / cost['search'])
optimistic_capital = ms * (1 - cost['capital'] / cost['search'])
assert optimistic_prepare > 600 and optimistic_capital > 600
result = {
    'date': '2026-11-18', 'sources': sources,
    'hypothesisOne': {
        'proposal': 'Share the post-income prepared mission among suppliers',
        'sampleMilliseconds': {k: v / 1000 for k, v in cost.items()},
        'optimisticRootMillisecondsIfPreparationFree': optimistic_prepare,
        'optimisticRootMillisecondsIfAllIncomeCapitalFree': optimistic_capital,
        'decision': 'Reject as sole600ms path before implementation; the whole49.914ms income block is not shareable preparation.',
        'limit': 'A proportional CPU-sample screening estimate, not a measured speedup or a universal lower bound. This does not reject all future income evaluation changes.'
    },
    'hypothesisTwo': {
        'proposal': 'Cache quiet value on the exact immutable Native envelope and evaluation context',
        'calls': 285, 'exactObjectContextRepeats': 0, 'exactSerializedContextRepeats': 0,
        'availableQuotes': diagnostic['exactSummary']['availableCalls'],
        'decision': 'Reject before implementation; neither cheap exact identity nor full exact source equality offers reuse at this point.',
        'limit': 'Equal output values do not establish equal relevant inputs. Narrower dependency-based reuse would require a separate read/write and value-decomposition proof.'
    },
    'diagnostic': {
        'newDiagnosticSearches': 1, 'nativeSubmissions': 69,
        'completeGraphAndRootsExact': True, 'rootAndRngPreservedByHarness': True,
        'value': 239.5, 'logicalNodes': 601, 'newAdmissionTiming': False,
        'timingInterpretation': 'Wrapper serialization and identity bookkeeping perturb runtime. Do not substitute its timing for the existing639.702459ms gate failure.'
    },
    'workUnitExit': 'Both predeclared hypotheses screened and rejected; no cache or other AI patch follows in this unit.',
    'formal': {'runtime': 'v485/valuev71', 'completeGameScore': 272,
               'candidate': 'v513', 'candidatePromoted': False,
               'candidateMilliseconds': ms, 'singlePointPassed': False,
               'newGames': 0},
    'nextQuestion': 'Can the fixed known cargo continuation be evaluated more cheaply while preserving exact Native outcomes for all six fossils and every distinct wallet/hand? First audit its read/write dependencies and attainable benefit; do not assume distinct states or equal values are equivalent.'
}
if out.exists():
    assert json.loads(out.read_text()) == result
    print('Reuse existing cost screen:', out)
else:
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'output': str(out), 'hypothesesRejected': 2,
                      'newAIPatches': 0, 'newGames': 0}))
