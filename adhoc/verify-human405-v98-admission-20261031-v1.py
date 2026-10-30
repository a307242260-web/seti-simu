"""Aggregate existing v98 evidence; never launches search or a game."""
import hashlib
import json
import pathlib

stage = pathlib.Path(__file__).resolve().parents[1]
folder = 'reports/ai-foundation-20261023/'
def read(p): return json.loads((stage/p).read_text())
def sha(p): return hashlib.sha256((stage/p).read_bytes()).hexdigest()
def write(p, x): (stage/p).write_text(json.dumps(x, ensure_ascii=False, indent=2)+'\n')
teacher_path = folder+'human405-round1-v98-audit-20261030-v1.json'
legacy_path = folder+'round1-v98-compat-corpus-20261029-v1.json'
teacher, legacy = read(teacher_path), read(legacy_path)
assert len(teacher['rows']) == 32 and not teacher['speedOverruns'] and not teacher['unactionableRoots']
assert legacy['passed'] == 10 and legacy['failed'] == 0
extras = [folder+'round1-v98-compat-'+x+'-20261029-v1.json' for x in ['step317', 'terminal-root']]
controls = [folder+'human405-v98-native-bound-controls-'+kind+'-'+str(n)+'-20261030-v1.json'
    for kind, n in [('teacher',24),('teacher',35),('teacher',36),('teacher',39),('teacher',44),('teacher',58),('legacy',105),('legacy',152)]]
source_reports = [teacher_path, legacy_path]+extras+controls+[r['evidencePath'] for r in teacher['rows']]
sources = {}
for path in source_reports:
    report = read(path)
    for p, expected in report['sourceHashes'].items():
        assert sha(p) == expected, (path, p)
        if p in sources: assert sources[p] == expected
        sources[p] = expected
    for row in report.get('rows', [report]):
        if row.get('rawPath'): assert sha(row['rawPath']) == row['rawSha256']
rows = [{'id':'teacher-'+str(r['step']), 'native':r['evidenceNativeInputs'], 'milliseconds':r['milliseconds'],
    'complete':r['graphClosed'], 'originalAndRngUnchanged':r['rootAndRngUnchanged']} for r in teacher['rows']]
rows += [{'id':r['caseId'], 'native':r['diagnostics']['nativeExecutions'], 'milliseconds':r['rootAndSearchMilliseconds'],
    'complete':r['complete'], 'originalAndRngUnchanged':r['rootUnchanged']} for r in legacy['rows']]
for path in extras:
    r = read(path)
    rows.append({'id':path, 'native':r['diagnostics']['nativeExecutions'], 'milliseconds':r['rootAndSearchMilliseconds'],
        'complete':r['complete'], 'originalAndRngUnchanged':r['rootAndRngUnchanged']})
assert len(rows) == 44 and all(r['complete'] and r['originalAndRngUnchanged'] and r['native'] <= 256 and r['milliseconds'] <= 600 for r in rows)
proofs = [read(p) for p in controls]
assert all(p['sameBestAsFreshNativePolicy'] and p['sourceRootAndRngUnchanged'] for p in proofs)
for p in proofs:
    for c in p['controls']:
        assert c['nativeBestValue'] <= c['upperBound']
        assert c['actualMaximumPublicity'] <= c['bound']['maximumPublicity']
    for c in p['proofControls']: assert c['nativeValue'] == c['predictedValue']
logs = {'fullNode': folder+'human405-v98-full-node-20261031-v1.log',
    'browser': folder+'human405-v98-browser-smokes-20261031-v2.log',
    'valueInputs': folder+'human405-v98-v-input-audit-20261031-v3.log'}
text = {k:(stage/p).read_text() for k,p in logs.items()}
assert 'SUMMARY unit passed=151 failed=0 total=151' in text['fullNode']
assert 'SUMMARY fullFlow passed=1 failed=0 total=1' in text['fullNode']
assert 'SUMMARY browserSmoke passed=7 failed=0 total=7' in text['browser']
failures = [x for x in text['valueInputs'].splitlines() if '[FAIL]' in x]
assert len(failures) == 1 and 'aomomo' in failures[0]
old_teacher = read(folder+'human405-round1-v97-audit-20261030-v1.json')
old_legacy = read(folder+'round1-v97-compat-corpus-20261029-v1.json')
assert all(a['student'] == b['student'] and a['studentValue'] == b['studentValue'] for a,b in zip(teacher['rows'],old_teacher['rows']))
assert all(a['actionId'] == b['actionId'] and a['value'] == b['value'] for a,b in zip(legacy['rows'],old_legacy['rows']))
for path in extras:
    a, b = read(path), read(path.replace('v98', 'v97'))
    assert a['actionId'] == b['actionId'] and a['value'] == b['value']

output = folder+'human405-v98-admission-20261031-v1.json'
report = {'schemaVersion':'seti-human405-funded-research-admission-v1', 'baseCommit':'004c39e1413a3b09c586e3a34bc8f0cbd052c0a9',
    'searchVersion':'seti-complete-decision-search-v98', 'valueModel':'seti-purpose-capital-state-value-v3',
    'sourceHashes':sources, 'sourceReports':source_reports, 'pointRows':rows,
    'all44CompleteWithin256NativeInputs600ms':True, 'maxNativeInputs':max(r['native'] for r in rows),
    'maxMilliseconds':max(r['milliseconds'] for r in rows),
    'nativeControls':{'reports':controls,'numericSources':sum(len(p['controls']) for p in proofs),
        'typedSources':sum(len(p['proofControls']) for p in proofs),'freshNativeRoots':len(proofs),
        'allBestActionsAndValuesPreserved':True,'allPublicityCeilingsChecked':True},
    'validation':{'unit':151,'fullFlow':1,'chrome':7,'logs':logs,'logHashes':{k:sha(p) for k,p in logs.items()},
        'valueInputs':'All independent current-model paths pass. Sole pre-existing frozen-aomomo legacy evaluator failure remains; exit1 retained.',
        'auditContract':'Legacy linear-model attainment stays strict in its supported round4 scope. Early-round native continuations must stay below the capital-aware upper bound, which need not be attained. All raw/standard input comparisons remain.'},
    'teacherFirstInputMatches':teacher['categoryCounts']['same-first-input'],
    'teacherChanges':[24,35,58], 'strategicAlignmentComplete':False,
    'performance':{'v97Case152Milliseconds':next(r['rootAndSearchMilliseconds'] for r in old_legacy['rows'] if r['caseId']=='case-152'),
        'v98Case152Milliseconds':next(r['rootAndSearchMilliseconds'] for r in legacy['rows'] if r['caseId']=='case-152'),
        'v97v98All44BestActionsAndValuesEqual':True,
        'scope':'One cold sample per point; source-bound diagnostic CPU profile found about104ms forced observation under bound query. No statistical or full-game speed claim.'},
    'candidateAdmitted':True, 'autonomousRun':False, 'baselineEligible':False, 'goalStatus':'active',
    'acceptedBaseline':'ai-search-v41-baseline-20261029',
    'remaining':['Deliver exact admitted source, then one standard original23-opening autonomous white R1. Do not count forced B117 inputs as autonomous learning.',
        'Current22/32first-input matches are diagnostic. New35and58choices need native state/continuation classification; equal V is not equivalence.',
        'Probe and held-B117 purpose remain unmodeled. Old25/56native action-order evidence does not settle the new policy re-entry difference at58.',
        'Resource-bound fixed planning still defines the explored policy; review before-main blue preparation plus PASS coverage if new58tie exposes an omitted shorter plan.']}
write(output, report)
print(json.dumps({'output':output,'points':len(rows),'maxNative':report['maxNativeInputs'],'maxMs':report['maxMilliseconds'],
    'nativeControls':report['nativeControls'],'unit':151,'fullFlow':1,'chrome':7,'admitted':True,'autonomousRun':False}))
