from pathlib import Path
import json,gzip,hashlib
M=Path('reports/ai-foundation-20261119');out=M/'r4-chong7-existing-plans-20261119-v1.json';assert not out.exists();x=json.loads(gzip.decompress((M/'r4-tech-step311-existing-evidence-20261119-v1.json.gz').read_bytes()));q=x['trace']['search'];nodes={n['node']:n for n in q['lines']};card=next(r for r in q['roots'] if r['actionId']=='play_card:6b72c0d5');first=next(e for e in nodes[0]['edges'] if e.get('target')==card['target']);plans=[]
for edge in nodes[card['target']]['edges']:
 actions=list(first['steps'])+list(edge['steps']);at=edge['target'];seen=set()
 while nodes[at].get('distance',0)>0:
  assert at not in seen;seen.add(at);n=nodes[at];es=[e for e in n.get('edges',[]) if e.get('target') in nodes and nodes[e['target']].get('value')==n.get('value') and nodes[e['target']].get('distance',0)+e.get('cost',1)==n.get('distance')];assert es;follow=min(es,key=lambda e:e['actionId']);actions.extend(follow.get('steps')or[follow['actionId']]);at=follow['target']
 plans.append({'targetActionId':edge['actionId'],'actions':actions,'value':nodes[at].get('value'),'boundary':nodes[at].get('boundary')})
assert len(plans)==2;out.write_text(json.dumps({'root':card,'plans':plans,'newAISearches':0,'newNativeInputs':0},ensure_ascii=False,indent=2)+'\n');print(json.dumps(plans,ensure_ascii=False))
