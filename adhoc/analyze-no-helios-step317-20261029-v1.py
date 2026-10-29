"""Separate actual inputs, purpose alternatives and branch points in step317."""
import collections
import gzip
import json
from pathlib import Path
prefix='reports/ai-foundation-20261023/no-helios-step317-20261029-v1'
record=json.loads(Path(prefix+'.json').read_text());raw=json.loads(gzip.decompress(Path(record['rawPath']).read_bytes()))
fixture=json.loads(Path('adhoc/ai-decision-corpus-20261029-reorg-v1/step317-20261029-v1.json').read_text());state=json.loads(fixture['compositionEnvelope']['committedState']);owner=next(p for p in state['players']['players']if p['id']==fixture['seatId'])
catalog={c['card_id']:c['card_name']for c in json.loads(Path('assets/cards/card_model.json').read_text())};hand={c['id']:{'cardId':c['cardId'],'name':catalog[c['cardId']]}for c in owner['hand']}
actions=raw['diagnosticActions'];nodes={n['node']:n for n in raw['lines']}
def describe(edge):
    plan=edge.get('resourcePlan');goal=plan.get('goal')if plan else None
    action=actions[edge['actionId']]
    return dict(actionId=edge['actionId'],summary=action.get('summary'),target=action.get('target'),goal=goal,card=hand.get((goal or{}).get('cardId')),cost=edge['cost'],newInputs=edge.get('newInputs'),targetNode=edge['target'],bestValue=nodes[edge['target']]['value'])
branches=[dict(node=n['node'],status=n['status'],alternatives=n['alternatives'],goal=n.get('resourcePolicy',{}).get('goal'),edges=[describe(e)for e in n['edges']])for n in raw['lines']if n['alternatives']>1]
assert [(r['node'],r['alternatives'])for r in branches]==[(0,14),(2,9),(3,3),(28,2),(35,2)]
counts=collections.Counter(e['actionId'].split(':')[0]for e in raw['sharedPrefixGraph']['edges']);assert sum(counts.values())==97
costs=collections.Counter()
for n in raw['lines']:
    for e in n['edges']:
        if e.get('resourcePlan'):costs[e['resourcePlan']['goal']['id']]+=e['newInputs']
result=dict(schemaVersion='seti-no-helios-step317-breakdown-v1',nativeInputs=97,countedStates=99,searchGraphStates=44,planEdges=sum(len(n['edges'])for n in raw['lines']),branchingStates=5,singleAlternativeStates=13,boundaryLeaves=26,disabledRemoveTechIncomeStarts=record['diagnostics']['disabledRemoveTechIncomeStarts'],disabledSkillNativeInputs=0,rootGoals=[describe(e)for e in raw['lines'][0]['edges']],branchPoints=branches,nativeActionFamilies=dict(counts.most_common()),resourceGoalNewInputs=dict(costs.most_common()),alreadySharedInputs=record['diagnostics']['sharedResourceInputHits'])
assert result['planEdges']==43
Path(prefix+'.breakdown.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'nativeInputs':97,'rootPurposes':len(result['rootGoals']),'branchPoints':[(b['node'],b['alternatives'])for b in branches],'sharedInputs':result['alreadySharedInputs']}))
