"""Extract the existing baseline graph; no game/search execution or policy changes."""
import collections
import csv
import gzip
import hashlib
import json
from pathlib import Path

trace_path=Path('reports/research/a760f3dd.ff4b36c1.full.json.decisions.jsonl')
prefix=Path('reports/ai-foundation-20261023/search-step295-analysis-20261029-v1')
output=Path(str(prefix)+'.summary.json')
if output.exists():
    print(output.read_text())
    raise SystemExit(0)
traces=[json.loads(line) for line in trace_path.read_text().splitlines()]
index,trace=max(enumerate(traces),key=lambda item:item[1]['search']['diagnostics']['nativeExecutions'])
assert index==294
search=trace['search']; graph=search['sharedPrefixGraph']; lines=search['lines']; diag=search['diagnostics']
assert len(graph['edges'])==diag['nativeExecutions']==1095
assert search['complete'] and not search['unresolved']
family_counts=collections.Counter(edge['actionId'].split(':')[0] for edge in graph['edges'])
reorg_id='effect:income:card:card-57-0'
reorg_nodes={n['node'] for n in lines if n.get('resourcePolicy',{}).get('goal',{}).get('id')==reorg_id}
reorg_edges=[e for n in lines for e in n['edges'] if e.get('resourcePlan',{}).get('goal',{}).get('id')==reorg_id]
assert sum(e['newInputs'] for e in reorg_edges)==832
assert sum(e['newInputs'] for e in reorg_edges if e['actionId'].startswith('choose_card:'))==830
assert len(reorg_nodes)==190
all_equivalent=sum(bool(e.get('equivalent')) for n in lines for e in n['edges'])
reorg_equivalent=sum(bool(e.get('equivalent')) for e in reorg_edges)
assert reorg_equivalent==all_equivalent==450
by_node={n['node']:n for n in lines}
contexts=[]
for start,n_cards in [(8,7),(333,6)]:
    pending=[start]; visited=set(); edges=[]
    while pending:
        node=pending.pop()
        if node in visited: continue
        visited.add(node)
        for edge in by_node[node]['edges']:
            edges.append(edge)
            if edge['target'] in reorg_nodes: pending.append(edge['target'])
    assert len(visited)==2**n_cards-1
    expected=n_cards*2**(n_cards-1)+(2**n_cards-1)
    assert len(edges)==expected
    canonical=(2**n_cards-1)*2
    duplicate=sum(bool(e['equivalent']) for e in edges)
    assert len(edges)-canonical==duplicate
    contexts.append(dict(startNode=start,remainingCards=n_cards,decisionStates=len(visited),nativeChoiceInputs=len(edges),equivalentAfterExecution=duplicate,canonicalOrderChoiceInputs=canonical,allSubsets=2**n_cards))
assert sum(c['decisionStates'] for c in contexts)==190
owners=collections.defaultdict(set); reasons=collections.defaultdict(set); goal_totals=collections.defaultdict(lambda:dict(planEdges=0,logicalInputs=0,newNativeInputs=0,reusedInputs=0))
for node in lines:
    for edge in node['edges']:
        if not edge.get('resourcePlan'): continue
        goal=edge['resourcePlan']['goal']['id']; count=goal_totals[goal];count['planEdges']+=1;count['logicalInputs']+=edge['cost'];count['newNativeInputs']+=edge['newInputs'];count['reusedInputs']+=edge['cost']-edge['newInputs']
        for i,eid in enumerate(edge.get('sharedPath',[])):
            owners[eid].add(goal)
            if i<len(edge.get('preparations',[])):reasons[eid].add(edge['preparations'][i].get('reason') or 'native-choice')
assert sum(v['newNativeInputs'] for v in goal_totals.values())+90==1095
with Path(str(prefix)+'.native-inputs.csv').open('w',newline='') as f:
    writer=csv.writer(f,lineterminator="\n");writer.writerow(['native_edge','from','to','family','action_id','goals','reasons'])
    for edge in graph['edges']:writer.writerow([edge['id'],edge['from'],edge['to'],edge['actionId'].split(':')[0],edge['actionId'],' | '.join(sorted(owners[edge['id']])),' | '.join(sorted(reasons[edge['id']]))])
Path(str(prefix)+'.nodes.json').write_text(json.dumps(dict(roots=search['roots'],nodes=lines,nativeGraph=graph),ensure_ascii=False,indent=2)+'\n')
raw=(json.dumps(trace,ensure_ascii=False,separators=(',',':'))+'\n').encode()
Path(str(prefix)+'.trace.json.gz').write_bytes(gzip.compress(raw,mtime=0))
summary=dict(schemaVersion='seti-search-node-analysis-v1',sourceTrace=str(trace_path),sourceTraceSha256=hashlib.sha256(trace_path.read_bytes()).hexdigest(),step=index+1,round=4,turn=6,seat='player-white',selectedActionId=trace['actionId'],selectedValue=search['value'],nativeInputs=1095,rootAndSearchMilliseconds=search['rootAndSearchMilliseconds'],countedStates=diag['nodes'],searchGraphStates=diag['graphNodes'],internalCertificateStates=diag['certificateNodes'],nativeGraphVertices=len(graph['nodes']),evaluatedLeaves=diag['valueEvaluations'],statusCounts=dict(collections.Counter(n['status'] for n in lines)),nativeActionFamilies=dict(family_counts),reorg=dict(cardId='dlc_28.png',name='重组',goalId=reorg_id,totalInputsIncludingCardPlay=832,choiceInputs=830,contexts=contexts,equivalentInputs=450),allEquivalentInputs=all_equivalent,resourceGoals=goal_totals,alreadySharedInputs=diag['sharedResourceInputHits'],estimates=dict(canonicalOrderSavedInputs=450,canonicalOrderRemainingTotalInputs=645,canonicalOrderSavedPercent=450/1095*100,measuredAfterOptimization=False,scope='Graph-derived projection; preserve every discard subset and downstream branch. Policy implementation, tie order, closure and timing still require verification.'),nativeCheck=str(prefix)+'.native-check.json',runtimeChanged=False,fullGameRerun=False)
output.write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:summary[k] for k in ['step','nativeInputs','countedStates','searchGraphStates','reorg','estimates']},ensure_ascii=False,indent=2))
