from pathlib import Path
import json,gzip
M=Path('reports/ai-foundation-20261119');out=M/'r4-step311-native-plans-20261119-v1.json';assert not out.exists();t=json.loads(gzip.decompress((M/'r4-tech-step311-existing-evidence-20261119-v1.json.gz').read_bytes()))['trace'];q=t['search'];lines={n['node']:n for n in q['lines']};plans=[]
for root in q['roots']:
 if root.get('value') is None or root.get('target') is None or root['actionId'] not in [t['actionId'],'research_tech:806ccfc8']:continue
 edges=[e for e in lines[0]['edges'] if e.get('target')==root['target'] and e['actionId']==root['actionId']];assert len(edges)==1;e=edges[0];actions=list(e.get('steps')or[e['actionId']]);at=e['target'];seen=set();nodes=[at]
 while lines[at].get('distance',0)>0:
  assert at not in seen;seen.add(at);n=lines[at];choices=[e for e in n.get('edges',[]) if e.get('target') in lines and lines[e['target']].get('value')==n.get('value') and lines[e['target']].get('distance',0)+e.get('cost',1)==n.get('distance')];assert choices,(at,n);e=min(choices,key=lambda e:e['actionId']);actions.extend(e.get('steps')or[e['actionId']]);at=e['target'];nodes.append(at)
 plans.append({'root':root,'actions':actions,'nodes':nodes,'leaf':{k:lines[at].get(k) for k in ['node','status','boundary','distance','value','completion']}})
assert len(plans)==2;out.write_text(json.dumps({'input':311,'plans':plans,'newSearches':0,'newNativeInputs':0},ensure_ascii=False,indent=2)+'\n');print(json.dumps(plans,ensure_ascii=False))
m=json.loads((M/'r3-b101-native-control-preflight-20261119-v1.json').read_text());s=json.loads((Path(m['runtime'])/m['savePath']).read_text());print('ORIGINAL',json.dumps([(i+1,x['action']['family'],x['action'].get('target')) for i,x in enumerate(s['replaySteps']) if i+1>=311],ensure_ascii=False))
