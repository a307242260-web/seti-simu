"""Bind the single v67 trial to committed sources and prior native controls."""
import hashlib
import json
import pathlib
import subprocess

stage = pathlib.Path(__file__).resolve().parents[1]
root = pathlib.Path('/Users/bilibili/code/seti-simu')
commit = '7e3fc7573af1e2594116e3714ad176a9a1f992b2'
folder = 'reports/ai-foundation-20261023/'
sha = lambda b: hashlib.sha256(b).hexdigest()
def read(p): return json.loads((stage/p).read_text())
def write(p, o): (stage/p).write_text(json.dumps(o, ensure_ascii=False, indent=2)+'\n')
def git(*args): return subprocess.check_output(['git', *args], cwd=root)

# Artifact generation does not change the already executed runtime. Compare actual
# bytes with committed Git blobs, including all tracked browser and tool files.
sources = {}
for row in git('ls-tree', '-r', '-z', commit, '--', 'randomizer', 'tools').split(b'\0'):
    if not row: continue
    header, name = row.split(b'\t', 1)
    mode, kind, oid = header.decode().split()
    assert kind == 'blob'
    p = name.decode()
    data = (stage/p).read_bytes()
    actual = hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
    assert actual == oid, ('committed runtime differs', p)
    sources[p] = sha(data)
source_report = folder+'human405-v67-trial-runtime-source-check-20261030-v1.json'
write(source_report, {'schemaVersion':'seti-trial-runtime-source-check-v1',
    'sourceCommit':commit, 'allTrackedRuntimeAndToolFilesMatchGitBlobs':True,
    'verifiedFiles':len(sources), 'sourceHashes':sources,
    'scope':'Post-run byte verification; no new simulation. The standard runner dirty-worktree warning includes generated artifacts and scratch scripts, not a runtime source difference.'})

before_path=folder+'human405-white-r1-692bdf03-verification-20261030-v1.json'
after_path=folder+'human405-white-r1-7e3fc757-verification-20261030-v1.json'
before, after = read(before_path), read(after_path)
assert before['openingSha256'] == after['openingSha256']
assert after['strictNativeReplay'] and after['exactFinalCommittedStateAndSession'] and after['firstRoundSettled']
assert after['allSearchesComplete'] and not after['formalTerminal']
record=read(after['recordPath'])
assert sha((stage/after['recordPath']).read_bytes()) == after['recordSha256']
assert record['steps'] == 48 and record['wallMs'] == 1013
registry=read('reports/iteration/registry.json')
versions=read('reports/iteration/versions.json')
own='ai-search-v67-white-r1-20261030'
version=next(v for v in versions['versions'] if v['id']==own)
entry=next(v for v in registry['versions'] if v['id']==own)
assert version['baselineEligible'] is False and entry['baselineEligible'] is False
assert entry['isHead'] is False and entry['aiGeneration']=='v2'
assert registry['currentBaseline']=='ai-search-v41-baseline-20261029'
result=entry['results'][0]
assert result['recordPath']==after['recordPath'] and result['steps']==48
assert result['scores']['player-white']==11 and result['reportExists']
html=(stage/result['reportPath']).read_text()
assert '448ff0e0.7e3fc757.quick-200' in html and '48' in html
assert pathlib.Path(result['savePath']).name in html
assert pathlib.Path(result['recordPath']).name in html
assert 'R1·T5' in html
rows=[]
for name,o in [('v53',before),('v67',after)]:
    rows.append({'version':name,'verification':before_path if name=='v53' else after_path,
        'verificationSha256':sha((stage/(before_path if name=='v53' else after_path)).read_bytes()),
        'record':o['recordPath'],'sourceCommit':o['sourceCommit'],
        'whiteScore':o['white']['resources']['score'],
        'technology':sorted(o['white']['technology']['ownedTiles']),
        'income':o['white']['income'],'whiteInputs':o['searches'],'wallMs':o['wallMs'],
        'maxNativeInputs':o['maxNativeInputs'],'maxMilliseconds':o['maxMilliseconds'],
        'planReuseHits':o['planReuseHits'],'nativePath':o['whiteActions']})
comparison_path=folder+'human405-white-r1-v53-v67-comparison-20261030-v1.json'
write(comparison_path, {'schemaVersion':'seti-human405-round-comparison-v1',
    'sameConfirmedOpening':True,'openingSha256':after['openingSha256'],
    'passiveOpponentsOnly':True,'strictNativeReplays':True,'scoreScope':after['scoreScope'],
    'rows':rows,'teacher':after['teacher'],
    'strategyAligned':False,'formalTerminal':False,'baselineEligible':False,
    'acceptedBaseline':registry['currentBaseline'],
    'findings':['v67 changes the admitted comparison window; different actions and stage scores do not establish strategic improvement.',
    'v67 swaps B117 out, corners B2, researches orange3 and puts DLC9 into income; teacher retains B117/DLC9 and acquires blue2 plus purple4.',
    'All actual decisions complete inside 256 native simulations / 600ms; this first-round trial is not full-game acceptance.',
    'Root24 existing witness attribution identifies missing deployed-probe capability input in current value; do not tune a bonus merely to imitate the teacher.'],
    'runtimeSourceCheck':source_report,'reportPath':result['reportPath'],
    'reportSha256':sha((stage/result['reportPath']).read_bytes()),
    'recordSaveReportRegistryConsistent':True})

progress=read('adhoc/human405-round1-progress-20261030-v8.json')
progress['completed'] += ['One committed-v67 standard white-only first-round trial completed; all native inputs replay exactly, same23-input opening and PASS-only opponents verified.',
    'Both recorded root24 winning/teacher witnesses independently replayed; deployed-probe projection sensitivity is zero under current V.']
progress['latestTrial']={'record':after['recordPath'],'verification':after_path,
    'comparison':comparison_path,'wallMs':after['wallMs'],'steps':record['steps'],
    'searches':after['searches'],'maxInputs':after['maxNativeInputs'],'maxMs':after['maxMilliseconds'],
    'planReuseHits':after['planReuseHits'],'whiteScore':11,'whiteTech':['orange3'],
    'teacherScore':15,'teacherTech':['blue2','purple4'],'strategyAligned':False,
    'searchVersion':'v67','sourceCommit':commit,'formalTerminal':False,'baselineEligible':False}
progress['remainingInOrder']=[
    'Derive deployed-probe and technology capability values from native reachable purposes; root24 B117 is searched but its deployed probe contributes no value. Preserve exact income-proof validity.',
    'Review income/hand/company fixed-choice purpose and beneficiary retention: B117 swapped out and DLC9 put into income remain unresolved; assess opportunity cost without enumerating all card combinations.',
    'Audit whether unknown new owned cards actually affect the remaining decision; conservative window closure remains explicit.',
    'After each concrete fix, audit all32 teacher roots and12 legacy point gates before the next standard autonomous white first-round comparison; do not promote a stage score to full-game baseline.']
progress['candidateSource']={'sourceCommit':commit,'snapshotManifest':'adhoc/human405-round1-v67-snapshot-20261030.json'}
progress['currentRevisionAutonomouslyRun']=True
progress['sourceCheck']=source_report
progress['root24Attribution']=folder+'human405-v67-opening-value-attribution-20261030-v1.json'
write('adhoc/human405-round1-progress-20261030-v9.json',progress)
print(json.dumps({'runtimeFilesVerified':len(sources),'comparison':comparison_path,'recordSaveReportRegistryConsistent':True,'goalStatus':'active'},ensure_ascii=False))
