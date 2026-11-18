"""Read existing Native controls and candidate logs; never run AI or a game."""
import difflib,gzip,hashlib,json,pathlib,subprocess,tempfile
R=pathlib.Path(__file__).resolve().parents[1]
M=R/'reports/ai-foundation-20261118'
D=R/'reports/ai-foundation-20261117/human405-r3-teacher-repeat-income-20261117-v1'
base=pathlib.Path('/private/tmp/seti-native-route-facts-sealed-20261118-392l0igs')
candidate=pathlib.Path('/private/tmp/seti-cargo-task-match-20261118-7tsm5tvm')
out=M/'r4-task-assignment-method-20261118-v1.json'
sha=lambda b:hashlib.sha256(b).hexdigest()
inputs=[D/'native-route-facts-related-node-check-20261118-v1.log',M/'r4-task-assignment-six-identities-20261118-v1.log',M/'r4-task-assignment-candidate-20261118-v2.log',M/'r4-task-assignment-baseline-20261118-v1.log',M/'r4-task-assignment-candidate-20261118-v1.log',M/'r4-task-assignment-pilot-20261118-v1.receipt.json.gz',M/'r4-task-assignment-pilot-20261118-v1.restore-check.json']
sourceHashes={str(p.relative_to(R)):sha(p.read_bytes()) for p in inputs}
if out.exists():
 old=json.loads(out.read_text());assert old['sources']==sourceHashes;print('CHECKPOINT_REUSED',out);raise SystemExit
parse=lambda p,key:next(json.loads(s) for s in p.read_text().splitlines() if s.startswith('{') and key in s)
a=parse(inputs[0],'knownPostMainCargo');b=parse(inputs[1],'knownPostMainCargo');single=parse(inputs[2],'cargoTaskAssignment')
control=json.loads(gzip.decompress(inputs[5].read_bytes()));assert control['complete'] and control['actualSubmissions']==38
for case in control['cases']:
 assert case['result']['actualScoreDelta']==3 and case['result']['creditDelta']==1 and case['result']['valuationDelta']==4
 x=case['branches'][1]['end']['envelope'];s=(x.get('session') or {}).get('session',{}).get('workingState') or json.loads(x['committedState']);p=next(p for p in s['players']['players'] if p['id']=='player-white');jobs=list(s['aliens']['chong']['transportTasksByRocketId'].values())
 assert len(jobs)==1 and jobs[0]['cardId']=='alien-chong-6-16';assert all(c['id']!=jobs[0]['cardId'] for c in p['reservedCards'])
rows=[]
for old,new in zip(a['rows'],b['rows']):
 assert old['newFossil']==new['newFossil'];rows.append({'newFossil':old['newFossil'],'beforeValue':old['value'],'afterValue':new['value'],'delta':new['value']-old['value'],'beforeDelivery':old['delivered'],'afterDelivery':new['delivered']})
regressed=[r for r in rows if r['delta']<0];assert len(regressed)==3 and single['value']==239.5
# Preserve rejected prototype as a small incremental patch; production stays untouched.
files=['randomizer/game/ai/analysis-port.js','randomizer/game/ai/decision-search.js','tools/node-test-inventory.js','randomizer/game/ai/cargo-task-assignment.test.js']
patch=[];filesProof={}
for rel in files:
 p=base/rel;q=candidate/rel;old=p.read_bytes() if p.exists() else b'';new=q.read_bytes();filesProof[rel]={'baseSha256':sha(old) if p.exists() else None,'candidateSha256':sha(new)}
 patch.extend(difflib.unified_diff(old.decode().splitlines(True),new.decode().splitlines(True),fromfile='a/'+rel if p.exists() else '/dev/null',tofile='b/'+rel,n=0))
pp=M/'rejected-cargo-task-assignment-20261118-v1.patch';pp.write_text(''.join(patch))
restored=pathlib.Path(tempfile.mkdtemp(prefix='seti-rejected-task-match-restore-20261118-'))
for rel in files:
 if (base/rel).exists():(restored/rel).parent.mkdir(parents=True,exist_ok=True);(restored/rel).write_bytes((base/rel).read_bytes())
subprocess.run(['git','apply','--unidiff-zero',str(pp)],cwd=restored,check=True)
for rel in files:assert sha((restored/rel).read_bytes())==filesProof[rel]['candidateSha256']
result={'schemaVersion':'seti-method-prospective-pilot-v1','sources':sourceHashes,'methodOutcome':'Root cause found; narrow prototype rejected by predeclared non-regression criterion. Open-ended AI implementation remains on hold.','nativeControl':{'cases':2,'actualSubmissions':38,'noSearch':True,'actualBoardScoreDelta':3,'creditsDelta':1,'currentWindowValueDelta':4,'notWholeGameScore':True},'rootCause':'Planner binds a fossil to its originating task despite Native destination-based matching. Existing raw task matching code is correct.','candidate':'v511 isolated, rejected; no production promotion','newTargetedTest':single,'comparison':rows,'regressions':regressed,'whyOldTestsDidNotFail':'Existing six-case assertions require reachable value>=235.5, Native consistency and budgets; they do not protect each prior best value. Successful test exit is not non-regression evidence.','remainingCauseEvidence':'After Ch6 claims old F07, the remaining job still has cardId=Ch6 but Ch6 is absent from reservedCards. visibleEarthCargo requires the originating card to remain reserved, so the suffix omits a potentially fulfillable other task. Greedy immediate claim gain therefore does not establish whole-plan superiority.','prototypeFaults':['First target run reached the intended Native payoff but the test asserted a nonexistent resource field credit; corrected to credits, retaining the failed log.','Counterfactual fixture serialization required canonical key ordering; initial harness mismatch and corrected control provenance retained.'],'next':'No further AI run. First define task/fossil ownership and compare complete known suffixes while retaining old feasible plans; quantify work before another implementation. Do not enumerate moves or all task permutations.','archive':{'baseSourceManifest':str((D/'native-route-facts-candidate-source-20261118-v1.json').relative_to(R)),'patch':str(pp.relative_to(R)),'patchSha256':sha(pp.read_bytes()),'files':filesProof,'restoredFilesByteExact':True},'formalScoreUnchanged':272,'newGames':0,'newBatches':0,'teacher289Reruns':0,'sharedAIRuntimeChanged':False}
out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'decision':'reject','comparison':rows,'nativeControlInputs':38,'noWholeGame':True,'sourceRestore':True},ensure_ascii=False))
