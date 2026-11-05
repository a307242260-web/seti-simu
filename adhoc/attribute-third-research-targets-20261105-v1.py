"""Attribute archived root-family maxima to concrete targets; no new searches."""
from pathlib import Path
import gzip,hashlib,json
stage=Path(__file__).resolve().parents[1];folder=Path('reports/ai-foundation-20261105/third-round-teacher-v1');out=stage/folder/'v198-research-target-attribution-20261105-v1.json';assert not out.exists();sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();rows=[]
for version,label in [('v197','teacher-r3-before-first-research'),('v198','teacher-r3-before-first-research'),('v198','actual-v197-after-orange1')]:
 path=folder/f'{version}-cold-{label}-20261105-v1.raw.json.gz'
 with gzip.open(stage/path,'rt')as f:r=json.load(f)
 assert r['complete'];targets=[]
 for edge in r['lines'][0]['edges']:
  goal=edge.get('resourcePlan',{}).get('goal',{})
  if goal.get('kind')=='research_tech':targets.append({'technology':goal['tileId'],'blueSlot':goal.get('blueSlot'),'value':r['lines'][edge['target']]['value'],'edgeFirstAction':edge['actionId']})
 rows.append({'version':version,'label':label,'raw':str(path),'rawSha256':sha(stage/path),'selectedRootAction':r['actionId'],'bestValue':r['value'],'familyMaxima':[{'actionId':x['actionId'],'value':x['value']}for x in r['roots']if x.get('value')is not None],'concretePaidResearchTargets':targets})
assert next(t['value']for t in rows[0]['concretePaidResearchTargets']if t['technology']=='purple2')==111.5
assert next(t['value']for t in rows[1]['concretePaidResearchTargets']if t['technology']=='purple2')==114
out.write_text(json.dumps({'scope':'Family maximum117.5 is orange1, not the teacher purple2 branch. Fixed-orange2 order controls cannot establish superiority over the actual orange1 choice. Subsequent root after actual orange1 prefers orange4, so forced teacher-purple followup remains a finite counterfactual rather than an AI rollout.','newNativeInputs':0,'newAutonomousRuns':0,'rows':rows},ensure_ascii=False,indent=2)+'\n');print(str(out.relative_to(stage)))
