from pathlib import Path
import json,gzip,hashlib
M=Path('reports/ai-foundation-20261119');m=json.loads((M/'r3-b101-native-control-preflight-20261119-v1.json').read_text());rec=json.loads((Path(m['runtime'])/m['recordPath']).read_text());p=Path(rec['agentTracePath']);blob=p.read_bytes();ts=[json.loads(l) for l in blob.splitlines() if l];white=[t for t in ts if t['context']['seatId']=='player-white'];idx=next(i for i,s in enumerate(rec['metrics']['searches']) if s['step']==104);t=white[idx];q=t['search'];ns={n['node']:n for n in q['lines']};plans=[]
for edge in ns[0]['edges']:
 goal=edge.get('resourcePlan',{}).get('goal',{})
 if goal.get('tileId') not in ['blue1','blue3']:continue
 actions=list(edge['steps']);at=edge['target'];seen=set()
 while ns[at].get('distance',0)>0:
  assert at not in seen;seen.add(at);n=ns[at];es=[e for e in n.get('edges',[]) if e.get('target') in ns and ns[e['target']].get('value')==n.get('value') and ns[e['target']].get('distance',0)+e.get('cost',1)==n.get('distance')];assert es;follow=min(es,key=lambda e:e['actionId']);actions.extend(follow.get('steps')or[follow['actionId']]);at=follow['target']
 plans.append({'goal':goal,'actions':actions,'value':ns[at].get('value'),'leaf':{k:ns[at].get(k) for k in ['node','status','boundary','value']}})
assert len(plans)==2;assert sorted(p['value'] for p in plans)==[97.75,98];r={'schemaVersion':'seti-blue-liquidity-existing-case-v1','input':104,'sourceCommit':m['sourceCommit'],'sourceTraceSha256':hashlib.sha256(blob).hexdigest(),'trace':t,'plans':plans,'newNativeInputs':0,'newAISearches':0};out=M/'r2-blue-liquidity-existing-case104-20261119-v1.json.gz';assert not out.exists();out.write_bytes(gzip.compress(json.dumps(r,ensure_ascii=False).encode(),mtime=0));print(json.dumps({'plans':plans,'checkpointMetadata':rec['rounds'][0]},ensure_ascii=False)[:6500])
