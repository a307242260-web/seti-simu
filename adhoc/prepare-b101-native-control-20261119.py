from pathlib import Path
import subprocess,tarfile,io,tempfile,json,hashlib,gzip
R=Path('/Users/bilibili/code/seti-simu');M=R/'reports/ai-foundation-20261119';source='838395727df8ae4e4734b101028485aef59dc1b3';recordCommit='aad43e42ab5be10e8c645a8001eb2c9ede0579d0';runtime=Path(tempfile.mkdtemp(prefix='seti-b101-native-control-20261119-'));raw=subprocess.check_output(['git','archive',source,'randomizer','tools','assets/cards/card_model.json'],cwd=R)
files={}
with tarfile.open(fileobj=io.BytesIO(raw)) as archive:
 for member in archive.getmembers():
  path=runtime/member.name;assert path.resolve().is_relative_to(runtime.resolve())
  if member.isdir():path.mkdir(parents=True,exist_ok=True)
  elif member.isfile():
   b=archive.extractfile(member).read();path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(b);files[member.name]=hashlib.sha256(b).hexdigest()
recordPath='reports/research/2170d824.5fabd621.full.json';recordBytes=subprocess.check_output(['git','show',recordCommit+':'+recordPath],cwd=R);record=json.loads(recordBytes);cpPath=record['rounds'][1]['checkpointPath'];savePath=record['savePath'];dependencies={}
for p in [recordPath,cpPath,savePath]:
 b=recordBytes if p==recordPath else subprocess.check_output(['git','show',recordCommit+':'+p],cwd=R);dest=runtime/p;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(b);dependencies[p]={'gitCommit':recordCommit,'sha256':hashlib.sha256(b).hexdigest(),'bytes':len(b)}
assert dependencies[cpPath]['sha256']==record['rounds'][1]['checkpointSha256'];cp=json.loads((runtime/cpPath).read_text());assert cp['replayCursor']['stepIndex']==129
existingPath=R/'reports/ai-foundation-20261119/r3-b101-existing-evidence-20261119-v1.json.gz';existing=json.loads(gzip.decompress(existingPath.read_bytes()));case=next(x for x in existing['cases'] if x['input']==160);q=case['trace']['search'];lines={x['node']:x for x in q['lines']};roots=[x for x in q['roots'] if x['actionId'].startswith('play_card:52a456f8') or x['actionId']==case['trace']['actionId']];print('SAVED_ROOTS',json.dumps(roots,ensure_ascii=False));print('LINE0',json.dumps(lines[0],ensure_ascii=False)[:5000])
# Plan extraction reads the already-completed graph; it performs no search.
def path_for(root):
 edges=[e for e in lines[0]['edges'] if e.get('target')==root.get('target') and e.get('actionId')==root['actionId']]
 if len(edges)!=1:return {'unresolved':'root edge not unique','matches':len(edges),'root':root}
 edge=edges[0];actions=list(edge.get('steps') or [edge['actionId']]);at=edge['target'];nodes=[at];seen=set()
 while lines[at].get('distance',0)>0:
  if at in seen:return {'unresolved':'cycle','root':root}
  seen.add(at);node=lines[at];choices=[e for e in node.get('edges',[]) if e.get('target') in lines and lines[e['target']].get('value')==node.get('value') and lines[e['target']].get('distance',0)+e.get('cost',1)==node.get('distance')]
  if not choices:return {'unresolved':'no stored value/distance witness','node':at,'root':root}
  edge=min(choices,key=lambda e:e['actionId']);actions.extend(edge.get('steps') or [edge['actionId']]);at=edge['target'];nodes.append(at)
 return {'root':root,'actions':actions,'nodes':nodes,'leaf':lines[at]}
plans=[path_for(root) for root in roots if root.get('value') is not None and root.get('target') is not None];assert any(p['root']['value']==118 for p in plans) and any(p['root']['value']==132 for p in plans)
casePath=runtime/'case160-existing.json';casePath.write_text(json.dumps(case)+'\n');plansPath=runtime/'plans160-existing.json';plansPath.write_text(json.dumps(plans,ensure_ascii=False,indent=2)+'\n')
manifest={'sourceCommit':source,'recordCommit':recordCommit,'runtime':str(runtime),'recordPath':recordPath,'checkpointPath':cpPath,'savePath':savePath,'sourceFiles':files,'dependencies':dependencies,'originalEvidenceSha256':hashlib.sha256(existingPath.read_bytes()).hexdigest(),'casePath':str(casePath),'plansPath':str(plansPath),'plans':plans,'nativeInputsExecuted':0,'aiSearches':0}
out=M/'r3-b101-native-control-preflight-20261119-v1.json';assert not out.exists();out.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print('PREFLIGHT',json.dumps({'runtime':str(runtime),'sourceFiles':len(files),'plans':[{'value':p['root']['value'],'actions':p.get('actions'),'leaf':p.get('leaf',{}).get('boundary'),'unresolved':p.get('unresolved')} for p in plans]},ensure_ascii=False))
