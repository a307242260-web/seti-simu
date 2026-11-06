from pathlib import Path
import json,gzip,hashlib
P=Path(__file__).resolve().parents[1];F=Path('reports/ai-foundation-20261105/third-round-teacher-v1');read=lambda p:json.loads((P/p).read_text());sha=lambda p:hashlib.sha256((P/p).read_bytes()).hexdigest()
rows=[]
for v,label in [(259,'analysis-publicity-post-main'),(259,'actual-v256-148'),(259,'actual-v256-132'),(260,'actual-v256-132'),(261,'actual-v256-132')]:
 p=F/f'v{v}-cold-{label}-20261106-v1.json';q=F/f'v262-cold-{label}-20261106-v1.json';x=read(p);y=read(q);a=json.loads(gzip.decompress((P/x['rawPath']).read_bytes()));b=json.loads(gzip.decompress((P/y['rawPath']).read_bytes()))
 assert a['schemaVersion']==f'seti-complete-decision-search-v{v}' and b['schemaVersion']=='seti-complete-decision-search-v262'
 keys=[k for k in a if k not in ['schemaVersion','diagnostics']];changes=[k for k in keys if a[k]!=b[k]];diagnosticKeys=sorted(set(a['diagnostics'])|set(b['diagnostics']));diagnosticChanges=[k for k in diagnosticKeys if k!='milliseconds' and a['diagnostics'].get(k)!=b['diagnostics'].get(k)]
 rows.append({'before':str(p),'beforeSha256':sha(p),'after':str(q),'afterSha256':sha(q),'beforeSchemaVersion':a['schemaVersion'],'afterSchemaVersion':b['schemaVersion'],'comparedFields':keys,'changes':changes,'diagnosticCountsComparedExceptMilliseconds':True,'diagnosticChanges':diagnosticChanges,'nativeInputs':y['nativeInputs'],'nativeInputsUnchanged':x['nativeInputs']==y['nativeInputs']})
out=F/'v262-paired-failed-candidate-graphs-20261106-v1.json';assert not(P/out).exists();(P/out).write_text(json.dumps({'scope':'Retained cold outputs only: verify their intentionally different search version strings, compare all other full result fields, and all diagnostics except wall time. Graphs, candidates, roots, prefix DAGs, values, realization/debt, plans and unresolved state compared. No new search or experiment.','comparisons':rows,'newAutonomousRuns':0},indent=2)+'\n')
assert all(not r['changes']and not r['diagnosticChanges']and r['nativeInputsUnchanged']for r in rows),[(r['before'],r['changes'],r['diagnosticChanges'])for r in rows]
print(json.dumps({'retainedFullGraphsUnchanged':len(rows),'searchVersionOnlyNormalized':True,'countsUnchanged':True,'newAutonomousRuns':0}))
