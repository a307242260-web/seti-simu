from pathlib import Path
import json,gzip,hashlib
w=Path(__file__).resolve().parents[1];f=Path('reports/ai-foundation-20261105/third-round-teacher-v1');out=w/f/'v214-critical-root-value-review-20261106-v1.json';assert not out.exists();sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();rows=[]
for label in ['teacher-r3-before-safety-protocol','teacher-r3-after-amiba-reveal','actual-v203-123']:
 byversion={}
 for version in [208,214]:
  p=f/f'v{version}-cold-{label}-20261106-v1.json';entry=json.loads((w/p).read_text());assert sha(w/entry['rawPath'])==entry['rawSha256'];raw=json.loads(gzip.decompress((w/entry['rawPath']).read_bytes()));assert raw['complete']and not raw['unresolved'];actions={a['actionId']:a for a in entry['rootActions']};choices=[]
  for root in raw['roots']:
   if not isinstance(root.get('value'),(int,float)):continue
   a=actions.get(root['actionId'],{});choices.append({'actionId':root['actionId'],'family':a.get('family'),'summary':a.get('summary'),'target':a.get('target'),'value':root['value'],'completion':root['completion']})
  byversion[str(version)]={'evidence':str(p),'evidenceSha256':sha(w/p),'selectedActionId':entry['actionId'],'value':entry['value'],'nativeInputs':entry['nativeInputs'],'milliseconds':entry['milliseconds'],'choices':sorted(choices,key=lambda r:-r['value'])}
 rows.append({'label':label,'versions':byversion})
result={'status':'reviewed','scope':'Read existing complete cold-search evidence only. No new native execution, simulation or autonomous game; values are model comparisons, not actual board score. Every action retains its real native identity.','newNativeInputs':0,'newAutonomousRuns':0,'remaining':'Teacher safety-protocol choice is still valued below immediate B101 or Amiba3 region play; do not force teacher action or claim third-round development alignment. Assess next from actual autonomous R3 or more controlled original-prefix evidence.','rows':rows};out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
for r in rows:
 print(r['label'])
 for version,data in r['versions'].items():print(version,[(a['summary'],a['value'])for a in data['choices'][:4]])
