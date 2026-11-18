"""Audit saved cargo cost/dependency evidence; no AI, Native or Browser run."""
from pathlib import Path
import collections
import gzip
import hashlib
import json
import subprocess

R = Path(__file__).resolve().parents[1]
M = R / 'reports/ai-foundation-20261118'
out = M / 'cargo-gain-reuse-findings-20261118-v1.json'
sources = {}


def read(name):
    data = (M / name).read_bytes()
    sources[name] = hashlib.sha256(data).hexdigest()
    if name.endswith('.gz'):
        data = gzip.decompress(data)
    return json.loads(data)


old = read('r4-main-owned-point289-v513-20261118-v1.json.gz')
profile = read('r4-main-owned-v513-cpu-20261118-v1.json.gz')['profile']
d = read('cargo-gain-reuse-diagnostic-20261118-v1.json.gz')
rules = read('cargo-read-write-end-rules-20261118-v1.json')
assert d['referenceSha256'] == sources['r4-main-owned-point289-v513-20261118-v1.json.gz']
assert d['graphAndRootsExact'] and d['search']['complete']
assert (d['search']['native'], d['search']['value'], d['search']['graphNodes']) == (69, 239.5, 601)
driver = R / 'adhoc/diagnose-cargo-gain-reuse-20261118-v1.cjs'
assert hashlib.sha256(driver.read_bytes()).hexdigest() == d['driverSha256']
probe = """const fs=require('node:fs'),z=require('node:zlib'),c=require('node:crypto'),a=require('node:assert/strict');
const load=p=>JSON.parse(z.gunzipSync(fs.readFileSync(p))),old=load(process.argv[1]),d=load(process.argv[2]);
const sha=x=>c.createHash('sha256').update(JSON.stringify(x)).digest('hex');
a.equal(d.search.wireGraphSha256,sha(old.search.lines));a.equal(d.search.wireRootsSha256,sha(old.search.roots));
process.stdout.write('EXACT');"""
assert subprocess.check_output(['node', '-e', probe,
    str(M / 'r4-main-owned-point289-v513-20261118-v1.json.gz'),
    str(M / 'cargo-gain-reuse-diagnostic-20261118-v1.json.gz')], text=True) == 'EXACT'
assert not rules['pendingTriggers']
assert {c['rule']['kind'] for c in rules['cards'] if c['rule']} == {'planetLandingPairs', 'amibaTraceCount', 'chongTraceCount'}
summary = d['summary']
assert summary['consistent'] and summary['rebaseExact']
assert summary['positiveRepeats'] == 72
assert all(g['consistent'] for g in d['groups']) and all(r['rebaseExact'] for r in d['rows'])
assert summary['optimisticNetMilliseconds'] == summary['repeatMilliseconds'] - summary['keyMilliseconds'] - summary['rebaseMilliseconds']
assert summary['optimisticNetMilliseconds'] < 0
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
        if any(name == 'Module.require' for file, name in stack):
            cost['moduleResolution'] += us
    if ('analysis-port.js', 'knownCargoFuture') not in stack:
        continue
    cost['cargo'] += us
    if ('state-store.js', 'copyForkData') in stack:
        cost['cargoCopy'] += us
    if ('analysis-port.js', 'finalNoProbeValue') in stack:
        cost['cargoFinalScore'] += us
assert cost['cargo'] == 68499 and cost['cargoCopy'] == 31332
ms = old['summary']['milliseconds']
optimistic_copy = ms * (1 - cost['cargoCopy'] / cost['search'])
assert optimistic_copy > 600
runtime = Path(d['runtime'])
read_write_paths = ['randomizer/game/ai/analysis-port.js',
                    'randomizer/game/end-game-scoring.js',
                    'randomizer/game/abilities/rocket.js',
                    'randomizer/game/cards/play-domain.js',
                    'randomizer/game/cards/deck.js',
                    'randomizer/game/effects/residual-domain-session.js']
read_write_sources = {p: hashlib.sha256((runtime / p).read_bytes()).hexdigest() for p in read_write_paths}
result = {
    'date': '2026-11-18', 'sources': sources, 'readWriteSources': read_write_sources,
    'copyProposal': {'sampleMilliseconds': {k: v / 1000 for k, v in cost.items()},
                     'optimisticRootIfCargoCopiesFree': optimistic_copy,
                     'decision': 'Reject cargo-copy-only work as the sole600ms path.',
                     'limit': 'Proportional CPU sample screen, not a measured lower bound or predicted achieved speedup.'},
    'gainReuseProposal': {
        'dependencyKey': 'Retain the full Native state/knowledge/forbidden coordinate, except owner base score/scoreSources and nebulae/sectorSettlements; guard aliens, triggers and three supported endgame-rule kinds.',
        'observedConsistent': True, 'exactCurrentValueRebasing': True,
        'eligibleCalls': summary['eligibleCalls'], 'uniqueKeys': summary['uniqueKeys'],
        'positiveCalls': summary['positiveCalls'], 'positiveKeys': summary['positiveKeys'],
        'positiveRepeatedCalls': summary['positiveRepeats'],
        'keyMilliseconds': summary['keyMilliseconds'],
        'repeatedUncachedMilliseconds': summary['repeatMilliseconds'],
        'rebasingMilliseconds': summary['rebaseMilliseconds'],
        'optimisticNetMilliseconds': summary['optimisticNetMilliseconds'],
        'decision': 'Reject this cache key before implementation: key construction already costs more than the observed repeated work. Even a free key removes only the24.5ms repeated block in this diagnostic.',
        'limits': 'Diagnostic overhead/GC can perturb block timings. These are screening evidence, not admission or a stable speed comparison. Consistent sampled gains do not replace counterfactual Native proof for a smaller future key.'
    },
    'nativeDependencyFindings': [
        'Arrival rewards from Native moveProbe add publicity/visit events and do not place orbit/landing markers.',
        'Transport task consumption writes the transported fossil/job, removes its rocket/card, applies fixed rewards and updates task count; one-move corner appends discard and removes its card ID from the draw pile.',
        'The observed reserved endgame rules read landing pairs and Amiba/Worm traces. Gold b2 couples planet markers and sector wins, so omitting scan progress requires proving markers stay fixed and no scanning effect executes.',
        'No state merge or cached Native successor is allowed. A value-delta proof must rebase on the current full score/wallet; hidden rewards, trigger observations and unsupported scoring rules require original execution.',
        'A smaller key still needs a complete semantic read/write audit, including data allocation, event augmentation, resource caps, final marks and task/fossil matching. This work unit does not claim that audit complete.'
    ],
    'workUnitExit': 'Two declared proposals screened; neither provides a credible600ms path. No AI cache or clone patch was implemented.',
    'diagnostic': {'newDiagnosticSearches': 1, 'nativeSubmissions': 69,
                   'fullGraphAndRootsExact': True, 'value': 239.5, 'logicalNodes': 601,
                   'newAdmissionTiming': False, 'newGames': 0},
    'formal': {'version': 'v485/valuev71', 'completeGameScore': 272,
               'candidate': 'v513', 'promoted': False, 'candidateMilliseconds': ms,
               'singlePointPassed': False},
    'nextQuestion': 'Can a compact cargo-only dependency key, justified from Native reads/writes rather than heuristic omissions, yield substantially more reuse at lower cost? First finish the audit and quantify whether it can remove the39.7ms gap with margin; otherwise reject it.'
}
if out.exists():
    assert json.loads(out.read_text()) == result
    print('Reuse existing findings:', out)
else:
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'output': str(out), 'proposalsRejected': 2,
                      'newAIPatches': 0, 'newGames': 0}))
