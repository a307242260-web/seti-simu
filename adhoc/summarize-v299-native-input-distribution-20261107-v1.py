from pathlib import Path
import json,gzip,hashlib,collections
P=Path(__file__).resolve().parents[1];ePath=P/'reports/ai-foundation-20261105/third-round-teacher-v1/v299-cold-actual-v298-r4-venus-late-orbit-20261107-v1.json';e=json.loads(ePath.read_text());raw=P/e['rawPath'];assert hashlib.sha256(raw.read_bytes()).hexdigest()==e['rawSha256'];r=json.loads(gzip.decompress(raw.read_bytes()));edges=r['sharedPrefixGraph']['edges'];assert len(edges)==e['nativeInputs']==263
byFamily=collections.Counter(x['actionId'].split(':')[0] for x in edges);reasons=collections.defaultdict(set);goals=collections.defaultdict(set)
for line in r['lines']:
 for edge in line['edges']:
  if 'sharedPath' not in edge:continue
  for p in edge.get('preparations',[]):
   if p['input']<len(edge['sharedPath']):
    key=edge['sharedPath'][p['input']];reasons[key].add(p['reason']);goals[key].add(edge.get('resourcePlan',{}).get('goal',{}).get('kind','unknown'))
byReason=collections.Counter(reason for values in reasons.values()for reason in values);byGoal=collections.Counter(goal for values in goals.values()for goal in values)
report={'scope':'Counts every actually executed unique Native prefix edge, not logical reused steps. Families partition263 inputs; purpose/reason categories may overlap and must not be summed as a partition.','coldEvidence':str(ePath.relative_to(P)),'coldEvidenceSha256':hashlib.sha256(ePath.read_bytes()).hexdigest(),'raw':str(raw.relative_to(P)),'rawSha256':e['rawSha256'],'nativeInputs':263,'complete':r['complete'],'milliseconds':e['milliseconds'],'byNativeActionFamily':dict(byFamily.most_common()),'overlappingFixedStepReasons':dict(byReason.most_common()),'overlappingGoalKinds':dict(byGoal.most_common()),'coveredUniqueEdges':len(reasons),'logicalResourceInputs':r['diagnostics']['logicalResourceInputs'],'sharedResourceInputHits':r['diagnostics']['sharedResourceInputHits'],'resourceGoalPlans':r['diagnostics']['resourceGoalPlans'],'scanPurposePlans':r['diagnostics']['scanPurposePlans'],'standaloneOrbit':next(x for x in r['roots'] if x.get('goal',{}).get('id')=='rocket:5:orbit:venus:planet:'),'selected':{'actionId':r['actionId'],'value':r['value']},'newAiQueries':0,'newAutonomousRuns':0}
out=P/'reports/ai-foundation-20261107/route-endpoint-completion-v1/native-input-distribution-20261107-v1.json';assert not out.exists();out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'out':str(out.relative_to(P)),'families':report['byNativeActionFamily'],'reasons':report['overlappingFixedStepReasons']},ensure_ascii=False))
