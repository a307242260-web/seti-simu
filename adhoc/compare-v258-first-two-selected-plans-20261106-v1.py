from pathlib import Path
import json,gzip,hashlib
P=Path(__file__).resolve().parents[1];F=Path('reports/ai-foundation-20261105/third-round-teacher-v1');read=lambda n:json.loads((P/n).read_text())
old={r['identity']:r for r in read(F/'v256-current-source-serial-gate-20261106-v1.json')['rows']};new={r['identity']:r for r in read(F/'v258-current-source-serial-gate-20261106-v1.json')['rows']};keys=['actionId','value','selectionPlan','selectionContinuation','planContinuation'];changes=[];count=0
normalize=lambda x:json.loads(json.dumps(x).replace('seti-goal-resource-preparation-v21','seti-goal-resource-preparation-v19'))
for identity,r in new.items():
 f=read(r['fixture']);round=json.loads(f['compositionEnvelope']['committedState'])['turn']['roundNumber']
 if round not in [1,2]:continue
 count+=1;o=old[identity];a=read(o['evidence']);b=read(r['evidence']);x=json.loads(gzip.decompress((P/a['rawPath']).read_bytes()));y=json.loads(gzip.decompress((P/b['rawPath']).read_bytes()))
 delta={k:{'before':x.get(k),'after':y.get(k)}for k in keys if normalize(x.get(k))!=normalize(y.get(k))}
 if delta:changes.append({'label':r['label'],'round':round,'fields':delta})
out=F/'v258-first-two-selected-plan-regression-20261106-v1.json';assert not(P/out).exists();result={'roots':count,'fields':keys,'policyVersionNormalizationOnly':True,'changes':changes,'claim':'Fresh Native-only roots preserve first action, scalar value and selected plan/continuation contracts. This is not a proof that complete branch graphs or Native asset endpoints are equivalent; inherited intent is not imported.','newAutonomousRuns':0};(P/out).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'roots':count,'selectedContractChanges':len(changes)}))
