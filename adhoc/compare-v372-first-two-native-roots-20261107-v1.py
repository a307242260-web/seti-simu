from pathlib import Path
import collections,gzip,hashlib,json,re,sys
read=lambda p:json.loads(Path(p).read_bytes())
sha=lambda p:hashlib.sha256(Path(p).read_bytes()).hexdigest()
D='reports/ai-foundation-20261107/committed-computer-recovery-v323-v1/'
original=D+'serial-cold-gate-20261107-v1.json'; earlier=D+'first-two-production-comparison-20261107-v1.json'
current='reports/ai-foundation-20261107/v372-blue-landing-supply-v1/serial-cold-gate-20261107-v1.json';out=Path(sys.argv[1])
base=read(original);scope=read(earlier);new=read(current)
baseBy={r['identity']:r for r in base['rows']};newBy={r['identity']:r for r in new['rows']};assert len(scope['details'])==304
patterns=[(r'seti-complete-decision-search-v(323|372)','seti-complete-decision-search-vBASE'),(r'seti-purpose-card-pick-policy-v1[456]','seti-purpose-card-pick-policy-vBASE'),(r'seti-goal-resource-preparation-v2[56]','seti-goal-resource-preparation-vBASE'),(r'seti-purpose-capital-state-value-v(54|58|59)','seti-purpose-capital-state-value-vBASE')]
def norm(x):
 if isinstance(x,dict):return {k:norm(v) for k,v in x.items() if k!='milliseconds'}
 if isinstance(x,list):return [norm(v) for v in x]
 if isinstance(x,str):
  for p,replace in patterns:x=re.sub(p,replace,x)
 return x
def graph(row):
 p=read(row['evidence']); b=Path(p['rawPath']).read_bytes(); assert hashlib.sha256(b).hexdigest()==p['rawSha256'];return norm(json.loads(gzip.decompress(b)))
rows=[]
for row in scope['details']:
 id=row['identity']; a=baseBy[id];b=newBy.get(id)
 if not b:continue
 assert a['complete'] and b['complete'] and a['rootAndRngUnchanged'] and b['rootAndRngUnchanged']
 x,y=graph(a),graph(b); assert x['complete'] and y['complete'] and not x['unresolved'] and not y['unresolved'];changed=[k for k in x if x[k]!=y[k]]
 rows.append({'identity':id,'label':row['label'],'round':row['round'],'oldAction':a['actionId'],'newAction':b['actionId'],'oldValue':a['value'],'newValue':b['value'],'oldNativeInputs':a['nativeInputs'],'newNativeInputs':b['nativeInputs'],'oldEvidence':a['evidence'],'newEvidence':b['evidence'],'changedFields':changed})
r={'scope':'Archived Native first-two-round historical roots; semantic graph ignores the engine identifier and timings. This comparison is not autonomous asset evidence.', 'original':original,'originalGateSha256':sha(original),'current':current,'currentGateSha256':sha(current),'candidateGateStatus':new['status'],'expected':304,'compared':len(rows),'graphDifferences':sum(bool(x['changedFields']) for x in rows),'actionDifferences':sum(x['oldAction']!=x['newAction'] for x in rows),'valueDifferences':sum(x['oldValue']!=x['newValue'] for x in rows),'changedFields':dict(collections.Counter(k for x in rows for k in x['changedFields'])),'details':rows,'newAutonomousRuns':0}
with out.open('x') as f:json.dump(r,f,ensure_ascii=False,indent=2);f.write('\n')
print(json.dumps({k:v for k,v in r.items() if k!='details'},ensure_ascii=False))
