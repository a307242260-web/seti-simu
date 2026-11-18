"""Read existing SETI evidence only; never run AI, Native inputs or experiments."""
import collections
import gzip
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
D = ROOT / 'reports/ai-foundation-20261117/human405-r3-teacher-repeat-income-20261117-v1'
OUTPUT = ROOT / 'reports/ai-foundation-20261118/methodology-review-20261118-v1.json'
names = ['native-route-facts-point289-comparison-20261118-v1.json.gz',
         'native-route-facts-point289-cpu-20261118-v1.json.gz',
         'native-route-facts-candidate-source-20261118-v1.json',
         'cargo-fair-candidate-findings-20261118-v1.json']
names += ['r4-learning-checkpoint-20261118-v%d.json' % n for n in range(14, 20)]
sources = {name: hashlib.sha256((D / name).read_bytes()).hexdigest() for name in names}
if OUTPUT.exists():
    saved = json.loads(OUTPUT.read_text())
    assert saved['sourceSha256'] == sources, 'Existing audit belongs to different evidence'
    print('Reuse existing read-only methodology audit:', OUTPUT)
    raise SystemExit(0)


def read(name):
    blob = (D / name).read_bytes()
    return json.loads(gzip.decompress(blob) if name.endswith('.gz') else blob)


q = read(names[0])['rows'][1]
profile = read(names[1])
source = read(names[2])
assert q['native'] == 209 and q['complete'] and len(q['lines']) == 1949
assert q['nativeProductionKernelSha256'] == source['paths']['randomizer/game/production-kernel.js']
nodes = {n['id']: n for n in profile['nodes']}
parents = {child: n['id'] for n in profile['nodes'] for child in n.get('children', [])}
selected = {('analysis-port.js', 'identity'), ('analysis-port.js', 'knownCargoFuture'),
            ('analysis-port.js', 'readActions')}
search_us = selected_us = 0
for sample, us in zip(profile['samples'], profile['timeDeltas']):
    stack = set()
    while sample is not None:
        frame = nodes[sample]['callFrame']
        stack.add((frame['url'].split('/')[-1], frame['functionName']))
        sample = parents.get(sample)
    if ('decision-search.js', 'searchDecision') not in stack:
        continue
    search_us += us
    if stack & selected:
        selected_us += us
assert 0 < selected_us < search_us
fraction = selected_us / search_us
optimistic = q['ms'] * (1 - fraction)
assert optimistic > 600
checkpoints = [read('r4-learning-checkpoint-20261118-v%d.json' % n) for n in range(14, 20)]
assert all(c['AIFormalScoreUnchanged'] == 272 for c in checkpoints)
fair = read('cargo-fair-candidate-findings-20261118-v1.json')['fairComparison']
assert fair['bothKnownTaskThenOldCargoFloor'] == 235.5
lines = q['lines']
audit = {
    'date': '2026-11-18', 'kind': 'read-only methodology review; no AI or Native input executed',
    'candidate': source['candidate'], 'sourceSha256': sources,
    'plateau': {'checkpointsReviewed': len(checkpoints), 'formalScore': 272,
                'candidatePromoted': False, 'newGameOutcomeAcrossTheseCheckpoints': False},
    'computation': {
        'completeRuleSubmissions': q['native'], 'graphNodes': len(lines),
        'edges': sum(len(n['edges']) for n in lines),
        'branchingNodes': sum(len(n['edges']) > 1 for n in lines),
        'singleExitNodes': sum(len(n['edges']) == 1 for n in lines),
        'leaves': sum(not n['edges'] for n in lines),
        'statusCounts': dict(collections.Counter(n['status'] for n in lines)),
        'meaning': 'nativeExecutions is submissionCount, incremented after executeCurrent submit. Proven previews and graph/valuation work are not included;209 is not total computation. Single-exit count alone does not prove removable work.',
    },
    'costScreen': {
        'selectedBlocks': sorted([list(v) for v in selected]),
        'searchSampleMilliseconds': search_us / 1000,
        'selectedUnionSampleMilliseconds': selected_us / 1000,
        'selectedUnionFraction': fraction,
        'measuredUninstrumentedMilliseconds': q['ms'],
        'requiredReductionFractionTo600': 1 - 600 / q['ms'],
        'optimisticMillisecondsIfSelectedBlocksFree': optimistic,
        'decision': 'Reject these three hotspots as the main route to600ms. Any secondary micro-optimization must belong to a quantified end-to-end plan.',
        'limit': 'A screening estimate using CPU sample proportions and a separate uninstrumented run; not measured speedup or proof that architecture redesign will meet600ms.',
    },
    'strategyScreen': {
        'sameKnownReachableFloor': fair['bothKnownTaskThenOldCargoFloor'],
        'ordinaryEndWallet': fair['ordinaryEndWallet'],
        'cardEndWallet': fair['cardEndWallet'],
        'cardRetainsNewTransport': fair['cardRetainsNewTransport'],
        'decision': 'Equal current known lower bounds do not establish equal strategic assets. Reclassify the remaining comparison as an unresolved opportunity/valuation question; graph parity cannot answer it.',
        'limit': 'These are controlled reachable floors and assets, not matched autonomous round-end outcomes. Do not price a hidden fossil from its actual seed identity.',
    },
    'methodologyValidation': {
        'retrospectiveScreeningPassed': True,
        'prospectiveCausalPilotPassed': False,
        'AIQualityImprovementProven': False,
        'AIImplementationResumeAllowed': False,
        'next': 'One evidence-first same-start decision dossier: candidate inclusion, greedy funding, comparable boundary, valuation components and actual assets. Reuse known branches, execute only genuinely missing bounded Native controls after the dossier identifies what they distinguish.',
    },
}
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'output': str(OUTPUT), 'selectedUnionFraction': fraction,
                  'optimisticMilliseconds': optimistic, 'implementationResumeAllowed': False}))
