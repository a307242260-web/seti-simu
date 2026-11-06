from pathlib import Path
import json,gzip
P=Path(__file__).resolve().parents[1];F=Path('reports/ai-foundation-20261105/third-round-teacher-v1');read=lambda n:json.loads((P/n).read_text());old={r['identity']:r for r in read(F/'v274-current-source-serial-gate-20261106-v1.json')['rows']};new={r['identity']:r for r in read(F/'v276-current-source-serial-gate-20261106-v2.json')['rows']};keys=['actionId','value','selectionPlan','selectionContinuation','planContinuation','planEvidence','roots','lines','sharedPrefixGraph','candidates','unresolved'];changes=[];count=0
normalize=lambda x:json.loads(json.dumps(x).replace('seti-complete-decision-search-v276','seti-complete-decision-search-v274'))
for identity,r in new.items():
 f=read(r['fixture']);round=json.loads(f['compositionEnvelope']['committedState'])['turn']['roundNumber']
 if round not in [1,2]:continue
 count+=1;o=old[identity];a=read(o['evidence']);b=read(r['evidence']);x=json.loads(gzip.decompress((P/a['rawPath']).read_bytes()));y=json.loads(gzip.decompress((P/b['rawPath']).read_bytes()));changed=[k for k in keys if normalize(x.get(k))!=normalize(y.get(k))]
 if changed:changes.append({'label':r['label'],'round':round,'fields':changed})
out=F/'v276-first-two-graph-regression-20261106-v1.json';assert not(P/out).exists();result={'roots':count,'fields':keys,'labelsNormalizedOnly':['search-v276 to v274'],'changes':changes,'claim':'Compare serialized full roots, candidate list, action lines, shared-prefix graph and planEvidence as well as selected scalar/plan contracts. This validates the stored fresh-root search structure; it does not prove identical future autonomous trajectories.','newAutonomousRuns':0};(P/out).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'roots':count,'graphOrContractChanges':len(changes),'changes':changes}))
