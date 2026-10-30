"""Bind the one v93 run to committed runtime and compare exact native paths."""
import hashlib
import json
import pathlib
import subprocess

stage=pathlib.Path(__file__).resolve().parents[1]
root=pathlib.Path('/Users/bilibili/code/seti-simu')
commit='f2cde3d2f7005df3944e66b15ee73bcda6ec22dc'
folder='reports/ai-foundation-20261023/'
sha=lambda b:hashlib.sha256(b).hexdigest()
def read(p): return json.loads((stage/p).read_text())
def write(p,o): (stage/p).write_text(json.dumps(o,ensure_ascii=False,indent=2)+'\n')
sources={}
tree=subprocess.check_output(['git','ls-tree','-r','-z',commit,'--','randomizer','tools'],cwd=root)
for row in tree.split(b'\0'):
    if not row: continue
    header,name=row.split(b'\t',1)
    mode,kind,oid=header.decode().split()
    assert kind=='blob'
    p=name.decode();data=(stage/p).read_bytes()
    assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()==oid,p
    sources[p]=sha(data)
source_report=folder+'human405-v93-trial-runtime-source-check-20261030-v1.json'
write(source_report,{'schemaVersion':'seti-trial-runtime-source-check-v1','sourceCommit':commit,
 'allTrackedRuntimeAndToolFilesMatchGitBlobs':True,'verifiedFiles':len(sources),'sourceHashes':sources,
 'scope':'Post-run byte check of every committed runtime/tool file. No new simulation; generated artifacts account for the standard-runner dirty warning.'})
before_path=folder+'human405-white-r1-9d707d66-verification-20261030-v1.json'
after_path=folder+'human405-white-r1-f2cde3d2-verification-20261030-v1.json'
before,after=read(before_path),read(after_path)
assert before['openingSha256']==after['openingSha256']
assert all(after[k] for k in ['strictNativeReplay','exactFinalCommittedStateAndSession','firstRoundSettled','allSearchesComplete'])
assert not after['formalTerminal'] and after['searches']==18 and after['wallMs']==1005
records=[read(x['recordPath']) for x in [before,after]]
for x in [before,after]: assert sha((stage/x['recordPath']).read_bytes())==x['recordSha256']
saves=[read(r['savePath']) for r in records]
assert saves[0]['committedState']==saves[1]['committedState']
assert saves[0]['session']==saves[1]['session']
assert [e['action'] for e in saves[0]['replaySteps']]==[e['action'] for e in saves[1]['replaySteps']]
registry,versions=read('reports/iteration/registry.json'),read('reports/iteration/versions.json')
own='ai-search-v93-white-r1-20261030'
v=next(v for v in versions['versions'] if v['id']==own)
entry=next(v for v in registry['versions'] if v['id']==own)
assert v['baselineEligible'] is False and entry['baselineEligible'] is False
assert entry['isHead'] is False and entry['aiGeneration']=='v2'
assert registry['currentBaseline']=='ai-search-v41-baseline-20261029'
result=entry['results'][0]
assert result['recordPath']==after['recordPath'] and result['steps']==48
assert result['scores']['player-white']==13 and result['reportExists']
html=(stage/result['reportPath']).read_text()
assert '5f529430.f2cde3d2.quick-200' in html and 'R1·T5' in html
assert pathlib.Path(result['savePath']).name in html and pathlib.Path(result['recordPath']).name in html
rows=[]
for name,p,x in [('v92',before_path,before),('v93',after_path,after)]:
    rows.append({'version':name,'verification':p,'verificationSha256':sha((stage/p).read_bytes()),
      'record':x['recordPath'],'sourceCommit':x['sourceCommit'],'whiteScore':x['white']['resources']['score'],
      'technology':sorted(x['white']['technology']['ownedTiles']),'income':x['white']['income'],
      'whiteInputs':x['searches'],'wallMs':x['wallMs'],'maxNativeInputs':x['maxNativeInputs'],
      'maxMilliseconds':x['maxMilliseconds'],'planReuseHits':x['planReuseHits'],'nativePath':x['whiteActions']})
comparison_path=folder+'human405-white-r1-v92-v93-comparison-20261030-v1.json'
write(comparison_path,{'schemaVersion':'seti-human405-round-comparison-v1','sameConfirmedOpening':True,
 'openingSha256':after['openingSha256'],'passiveOpponentsOnly':True,'strictNativeReplays':True,
 'sameNativeActionSequence':True,'sameFinalCommittedStateAndSession':True,'rows':rows,'teacher':after['teacher'],
 'scoreScope':after['scoreScope'],'formalTerminal':False,'baselineEligible':False,'strategyAligned':False,
 'acceptedBaseline':registry['currentBaseline'],'runtimeSourceCheck':source_report,
 'reportPath':result['reportPath'],'reportSha256':sha((stage/result['reportPath']).read_bytes()),
 'recordSaveReportRegistryConsistent':True,
 'findings':['Teacher40 queued-income fixed pick is repaired, but the autonomous opening never enters that teacher orbit line; the exact v92/v93 native paths and final states remain identical.',
 'White13points/blue1+purple4 versus teacher15/blue2+purple4 remains unresolved; no autonomous score improvement claim.',
 'Teacher25 pay-then-move and move-then-pay native two-input prefixes differ only by input concurrency revision, not game facts or RNG; separate proof retains the difference explicitly.',
 'All18 actual decisions complete under256native inputs/600ms. This is R1 stage evidence, not180s full-game acceptance.']})
progress=read('adhoc/human405-round1-progress-20261030-v14.json')
progress['completed'] += ['v93 source committed/pushed asf2cde3d2f7005df3944e66b15ee73bcda6ec22dc.',
 'Exactly one standard v93 white-only R1 completed:48inputs/1005ms,18white searches,13points/blue1+purple4; strict replay and369committed runtime/tool blobs verified.',
 'v92/v93 autonomous standardized input sequences and final committed state/session are exactly identical; no score improvement claimed.',
 'Teacher25 native two-input alternatives differ only at match.decisionVersion; complete rule facts/RNG, public observation and legal action descriptors excluding that authority version match.']
progress['latestTrial']={'record':after['recordPath'],'verification':after_path,'comparison':comparison_path,
 'sourceCommit':commit,'wallMs':after['wallMs'],'steps':48,'searches':after['searches'],
 'maxInputs':after['maxNativeInputs'],'maxMs':after['maxMilliseconds'],'planReuseHits':after['planReuseHits'],
 'whiteScore':13,'whiteTech':['blue1','purple4'],'teacherScore':15,'teacherTech':['blue2','purple4'],
 'searchVersion':'v93','formalTerminal':False,'baselineEligible':False,'strategyAligned':False}
progress['currentRevisionAutonomouslyRun']=True
progress['sourceCheck']=source_report
progress['paidMovePrefixControl']=folder+'human405-v93-paid-move-order-20261030-v1.json'
progress['remainingTeacherDifferenceSteps']=[24,36,37,38,39,43,56,62]
progress['remainingInOrder']=[
 'Audit root24 probe and later-funded purpose value natively; do not add a teacher-imitation bonus. Numeric bounds and typed proofs must be revalidated if V changes.',
 'Review teacher36 blue1/blue2 conditional resource demand and teacher37 free pick purpose from current native facts, not stage-score attribution.',
 'Classify teacher38/39/43/56 order and resource-plan differences through native counterfactual continuations; scalar ties or internal use alone are insufficient.',
 'Compare teacher62 DLC4/DLC5 future known purposes; current scalar tie is not strategic equivalence.']
progress['remaining']=progress['remainingInOrder']
progress['phase']='v93-admitted-and-standard-R1-verified-8teacher-differences-unresolved'
progress['completionNote']='Goal remains active. Productionv93, autonomous13points and unchanged v92 path, teacher15; narrow greedy repair is verified without autonomous strength claim. Full-game baselinev41 unchanged.'
write('adhoc/human405-round1-progress-20261030-v15.json',progress)
print(json.dumps({'runtimeFilesVerified':len(sources),'comparison':comparison_path,'sameNativeSequenceAndFinalState':True,'baseline':registry['currentBaseline'],'goalStatus':'active'},ensure_ascii=False))
