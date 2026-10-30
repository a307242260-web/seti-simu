"""Bind the single v92 trial to committed sources and prior native controls."""
import hashlib
import json
import pathlib
import subprocess

stage = pathlib.Path(__file__).resolve().parents[1]
root = pathlib.Path('/Users/bilibili/code/seti-simu')
commit = '9d707d66483d8ec6c5f754be52ac485638442fea'
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
source_report = folder+'human405-v92-trial-runtime-source-check-20261030-v1.json'
write(source_report, {'schemaVersion':'seti-trial-runtime-source-check-v1',
    'sourceCommit':commit, 'allTrackedRuntimeAndToolFilesMatchGitBlobs':True,
    'verifiedFiles':len(sources), 'sourceHashes':sources,
    'scope':'Post-run byte verification; no new simulation. The standard runner dirty-worktree warning includes generated artifacts and scratch scripts, not a runtime source difference.'})

before_path=folder+'human405-white-r1-7e3fc757-verification-20261030-v1.json'
after_path=folder+'human405-white-r1-9d707d66-verification-20261030-v1.json'
before, after = read(before_path), read(after_path)
assert before['openingSha256'] == after['openingSha256']
assert after['strictNativeReplay'] and after['exactFinalCommittedStateAndSession'] and after['firstRoundSettled']
assert after['allSearchesComplete'] and not after['formalTerminal']
record=read(after['recordPath'])
assert sha((stage/after['recordPath']).read_bytes()) == after['recordSha256']
assert record['steps'] == 48 and record['wallMs'] == 1006
registry=read('reports/iteration/registry.json')
versions=read('reports/iteration/versions.json')
own='ai-search-v92-white-r1-20261030'
version=next(v for v in versions['versions'] if v['id']==own)
entry=next(v for v in registry['versions'] if v['id']==own)
assert version['baselineEligible'] is False and entry['baselineEligible'] is False
assert entry['isHead'] is False and entry['aiGeneration']=='v2'
assert registry['currentBaseline']=='ai-search-v41-baseline-20261029'
result=entry['results'][0]
assert result['recordPath']==after['recordPath'] and result['steps']==48
assert result['scores']['player-white']==13 and result['reportExists']
html=(stage/result['reportPath']).read_text()
assert '77dcb58d.9d707d66.quick-200' in html and '48' in html
assert pathlib.Path(result['savePath']).name in html
assert pathlib.Path(result['recordPath']).name in html
assert 'R1·T5' in html
rows=[]
for name,o in [('v67',before),('v92',after)]:
    rows.append({'version':name,'verification':before_path if name=='v67' else after_path,
        'verificationSha256':sha((stage/(before_path if name=='v67' else after_path)).read_bytes()),
        'record':o['recordPath'],'sourceCommit':o['sourceCommit'],
        'whiteScore':o['white']['resources']['score'],
        'technology':sorted(o['white']['technology']['ownedTiles']),
        'income':o['white']['income'],'whiteInputs':o['searches'],'wallMs':o['wallMs'],
        'maxNativeInputs':o['maxNativeInputs'],'maxMilliseconds':o['maxMilliseconds'],
        'planReuseHits':o['planReuseHits'],'nativePath':o['whiteActions']})
comparison_path=folder+'human405-white-r1-v67-v92-comparison-20261030-v1.json'
write(comparison_path, {'schemaVersion':'seti-human405-round-comparison-v1',
    'sameConfirmedOpening':True,'openingSha256':after['openingSha256'],
    'passiveOpponentsOnly':True,'strictNativeReplays':True,'scoreScope':after['scoreScope'],
    'rows':rows,'teacher':after['teacher'],
    'strategyAligned':False,'formalTerminal':False,'baselineEligible':False,
    'acceptedBaseline':registry['currentBaseline'],
    'findings':['The same fixed opening and passive opponents produce v67 11 points/orange3 and v92 13 points/blue1+purple4 after R1 settlement; these are stage scores, not a full-game strength conclusion.',
    'Teacher remains 15 points/blue2+purple4. B117 is swapped out on the autonomous v92 path; do not attribute the whole score gap to blue choice after an already different opening.',
    'All18 actual white decisions complete inside256 native simulations/600ms. The same exact source/config was run once through the standard experiment runner.',
    'Root24 native controls close all26 numeric-pruned branches and8 typed plan sources; a fresh319-input search with all these shortcuts disabled retains the same best action/value. This verifies current-model pruning, not the adequacy of its probe value.'],
    'runtimeSourceCheck':source_report,'reportPath':result['reportPath'],
    'reportSha256':sha((stage/result['reportPath']).read_bytes()),
    'recordSaveReportRegistryConsistent':True})

progress=read('adhoc/human405-round1-progress-20261030-v12.json')
progress['completed'] += ['Source v92 committed and pushed as9d707d66483d8ec6c5f754be52ac485638442fea.',
    'Exactly one standard v92 white-only R1 completed:48inputs/1006ms,18white searches,13points,blue1+purple4; strict native replay, identical opening and passive opponents verified.',
    'Root24 all26 numeric-bound sources and8 typed-plan sources natively continued; fresh no-shortcut full root319inputs retains the best action and value.']
progress['latestTrial']={'record':after['recordPath'],'verification':after_path,
    'comparison':comparison_path,'wallMs':after['wallMs'],'steps':record['steps'],
    'searches':after['searches'],'maxInputs':after['maxNativeInputs'],'maxMs':after['maxMilliseconds'],
    'planReuseHits':after['planReuseHits'],'whiteScore':13,'whiteTech':['blue1','purple4'],
    'teacherScore':15,'teacherTech':['blue2','purple4'],'strategyAligned':False,
    'searchVersion':'v92','sourceCommit':commit,'formalTerminal':False,'baselineEligible':False}
remaining=[
    'Complete native root24 B117/company attribution under current v92 V, including probe routes and retained-card purposes. Covered internal input or equal scalar is not strategic equivalence.',
    'Derive deployed-probe future value from native reachable and funded purposes with movement/resource lower bounds; do not add an arbitrary teacher-imitation bonus. Any changed V must revalidate numeric bounds and typed proofs.',
    'Review remaining fixed pick/income/orbit-land differences at every white teacher root through settlement, separating conditional strategy from different opening causes.',
    'After each concrete source fix pass all32teacher+12legacy point gates before another distinct standard R1; full-game timing/strength and use-count forecasts remain unproved.']
progress['remaining']=remaining
progress['remainingInOrder']=remaining
progress['candidateSource']={'sourceCommit':commit,'snapshotManifest':'adhoc/human405-round1-v92-snapshot-20261030.json'}
progress['currentRevisionAutonomouslyRun']=True
progress['sourceCheck']=source_report
progress['completionNote']='Goal remains active. Admitted production is v92; autonomous R1 is13points versus teacher15, not aligned and not baseline eligible. Four-AI accepted baseline remainsv41.'
progress['phase']='admitted-source-standard-R1-verified-remaining-purpose-gaps'
progress['root24CurrentBoundControl']=folder+'human405-v92-native-bound-controls-teacher-24-20261030-v1.json'
write('adhoc/human405-round1-progress-20261030-v13.json',progress)
print(json.dumps({'runtimeFilesVerified':len(sources),'comparison':comparison_path,'recordSaveReportRegistryConsistent':True,'goalStatus':'active'},ensure_ascii=False))
