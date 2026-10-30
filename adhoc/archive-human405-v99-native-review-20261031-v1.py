"""Verify the current-source native review and preserve the next admission contract."""
import hashlib
import json
import pathlib
import subprocess

stage = pathlib.Path(__file__).resolve().parents[1]
root = pathlib.Path('/Users/bilibili/code/seti-simu')
source = '0dc7785da8a4dce7bc81eabbb7dc92dcf6faf58f'
folder = 'reports/ai-foundation-20261023/'
sha = lambda p: hashlib.sha256((stage/p).read_bytes()).hexdigest()
def read(p): return json.loads((stage/p).read_text())
def write(p, v): (stage/p).write_text(json.dumps(v, ensure_ascii=False, indent=2)+'\n')
reports = [folder+f'human405-v99-native-witness-comparison-step{s}-20261031-v1.json' for s in [24,35,36,38,39,43,62]]
reports += [folder+'human405-v99-native-witness-comparison-step56-fixed-prefix-20261031-v1.json',
    folder+'human405-v99-paid-move-order-20261030-v1.json', folder+'human405-v99-corrected-coverage-review-20261031-v1.json',
    folder+'human405-atplanet-full-reward-prototype-20261031-v1.json', folder+'human405-blue2-native-future-landing-20261031-v1.json']
hashes = {}
for p in reports:
    r = read(p)
    assert r['sourceCommit'] == source
    for name, expected in r['sourceHashes'].items():
        assert sha(name) == expected, (p, name)
        if name in hashes: assert hashes[name] == expected
        hashes[name] = expected
    if r.get('rawPath'): assert sha(r['rawPath']) == r['rawSha256']
for p in reports[:8]:
    r = read(p)
    assert all(x['sourceRootAndRngUnchanged'] and x['independentNativeReplayMatchesPolicyObservationAndValue'] for x in r['rows'])
fixed = read(reports[7])
assert fixed['sameFormalState'] and fixed['sameWorkingRuleState'] and fixed['sameSession']
move = read(reports[8])
assert move['sameRuleStateExcludingInputRevision'] and move['sameActionsExcludingInputRevision']
coverage = read(reports[9])
assert sha('adhoc/human405-coverage-review-20261031-v1.js') == coverage['classifierSha256']
assert next(r for r in coverage['rows'] if r['step'] == 24)['immediateSuccessorCut']['upperBound'] == 54
proto = read(reports[10])
assert sha(proto['prototype']) == proto['prototypeSha256'] and proto['productionAdmitted'] is False
assert proto['continuity']['before']['total'] + proto['continuity']['forecast']['value'] == proto['continuity']['afterActualNativeWitness']['total'] == 57.5
landing = read(reports[11])
assert landing['sourceRootAndRngUnchanged'] and landing['missionInputs'] == 3
assert landing['before']['total'] + landing['forecast']['value'] == landing['afterNativeMission']['total'] == 62
assert landing['afterBlue']['total'] == 62.5
runtime = {}
for row in subprocess.check_output(['git','ls-tree','-r','-z',source,'--','randomizer','tools'],cwd=root).split(b'\0'):
    if not row: continue
    header,name=row.split(b'\t',1)
    oid=header.decode().split()[2]; p=name.decode(); data=(stage/p).read_bytes()
    assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==oid,p
    runtime[p]=hashlib.sha256(data).hexdigest()
check = folder+'human405-v99-native-review-source-check-20261031-v1.json'
write(check, {'sourceCommit':source,'sourceHashes':runtime,'all370RuntimeToolGitBlobsUnchanged':len(runtime)==370,
    'reports':reports,'reportSha256':{p:sha(p) for p in reports},'prototypeAdmitted':False,
    'scope':'Read-only native source review and isolated controls; no production behavior change or autonomous rerun.'})
progress=read('adhoc/human405-round1-progress-20261031-v25.json')
progress.update({'phase':'v99-all-remaining-native-differences-rechecked-full-mission-prototype-validated',
    'review':'docs/human405-round1-v99-native-review-20261031.md','nativeClassification':reports[9],
    'nativeCurrentSourceComparisons':reports[:9],'nativeReviewSourceCheck':check,
    'probePrototype':reports[10],'probePrototypeAdmitted':False,'probePrototypeNativeLanding':reports[11],
    'nextDesign':'adhoc/human405-atplanet-capital-integration-design-20261031-v1.json',
    'completedThisTurn':['All7 remaining strategic roots independently continued and natively replayed under currentV4, with numeric and typed shortcuts disabled.',
        'Repeated current-source25/56 native controls: only input concurrency revision differs for25; complete rule state/session/RNG identical for56.',
        'Fixed coverage classifier: a directly entered root is not an internal preparation; expose attained lower bounds separately from exact native continuation values.',
        'Unadmitted full-mission prototype52+5.5=57.5 passes native orbit continuity; blue2 funded future landing53.5+8.5=62 passes3actual native inputs, with consumed-probe forecast0 and source/RNG isolated. Subsequent blue data yields62.5.',
        'All370 runtime/tool files still exactly match committedv99; no new autonomous run or baseline promotion.'],
    'remaining':['Deliver this reviewed evidence and classifier correction, preserving productionv99 andv41baseline.',
        'Implement shared public native at-planet mission capital without route BFS, align canonical greedy opportunity costs and native requested-owner cost queries.',
        'Prove or decline affected numeric/typed shortcuts. Complete all45cold roots and related correctness/input/browser gates before one new-source standard autonomous R1.',
        'Reclassify remaining teacher choices after the new value. Do not force raw point matching or infer full-game strength from the saved-witness prototype.'],
    'completionNote':'Goal active. Teacher path causes now have current native evidence and a concrete tested missing mission term. Prototype is not admitted and strategy remains productionv99.'})
write('adhoc/human405-round1-progress-20261031-v26.json',progress)
print(json.dumps({'sourceCheck':check,'runtimeFiles':len(runtime),'currentNativeComparisons':9,'prototypeOrbitGain':5.5,'prototypeLandingGain':8.5,'goalStatus':'active'}))
