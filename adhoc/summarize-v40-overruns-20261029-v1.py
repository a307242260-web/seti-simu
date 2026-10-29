"""List every over-target item in the measured v40 evidence, preserving samples."""
import collections
import gzip
import hashlib
import json
from pathlib import Path

base=Path('reports/ai-foundation-20261023');prefix=base/'v40-overrun-list-20261029-v1'
read=lambda p:json.loads(Path(p).read_text())
audit=read(base/'v40-baseline-overruns-20261029-v1.json');corpus=read(base/'reorg-greedy-corpus-20261029-v1.json')
assert audit['status']=='complete' and len(audit['rows'])==7
rows=[]
for row in audit['rows']:
    rows.append(dict(id=f"baseline-step-{row['step']}",round=row['round'],turn=row['turn'],seatId=row['seatId'],nativeInputs=row['nativeInputs'],milliseconds=row['rootAndSearchMilliseconds'],nodes=row['nodes'],complete=row['complete'],source='baseline-overrun-retest' if row['step']!=295 else 'previous-step295-cold',sourcePath=str(base/'v40-baseline-overruns-20261029-v1.json'),rawPath=row['rawPath']))
for row in corpus['rows']:
    fixture=read(row['fixture']);state=json.loads(fixture['compositionEnvelope']['committedState'])
    rows.append(dict(id=row['caseId'],round=state['turn']['roundNumber'],turn=state['turn']['turnNumber'],seatId=fixture['seatId'],nativeInputs=row['diagnostics']['nativeExecutions'],milliseconds=row['rootAndSearchMilliseconds'],nodes=row['diagnostics']['nodes'],complete=row['complete'],source='previous-ten-cold-checkpoints',sourcePath=str(base/'reorg-greedy-corpus-20261029-v1.json'),rawPath=row['rawPath']))
assert len(rows)==17 and len({r['id'] for r in rows})==17
for row in rows:row.update(overTime=row['milliseconds']>600,overInputs=row['nativeInputs']>256)
remaining=sorted((r for r in rows if r['overTime'] or r['overInputs']),key=lambda r:-r['milliseconds'])
assert [r['id']for r in remaining]==['baseline-step-317','case-152','case-105']
for row in remaining:
    raw=read_gzip=json.loads(gzip.decompress(Path(row['rawPath']).read_bytes()))
    families=collections.Counter(e['actionId'].split(':')[0]for e in raw['sharedPrefixGraph']['edges'])
    assert sum(families.values())==row['nativeInputs']
    row['nativeActionFamilies']=dict(families.most_common())
    goals=collections.Counter()
    for node in raw['lines']:
        for edge in node['edges']:
            if edge.get('resourcePlan'):goals[edge['resourcePlan']['goal']['id']]+=edge['newInputs']
    row['resourceGoalNewInputs']=dict(goals.most_common())
    row['fallbacks']=raw['diagnostics']['resourceFallbacks'];row['sharedResourceInputHits']=raw['diagnostics']['sharedResourceInputHits']
source_paths=[base/'v40-baseline-overruns-20261029-v1.json',base/'reorg-greedy-corpus-20261029-v1.json',base/'reorg-greedy-step295-20261029-v1.json']
for source in source_paths:
    for p,h in read(source)['sourceHashes'].items():assert hashlib.sha256(Path(p).read_bytes()).hexdigest()==h,p
summary=dict(schemaVersion='seti-v40-overrun-list-v1',searchVersion=audit['searchVersion'],thresholds=audit['thresholds'],scope='17 measured v40 roots: all seven old full-game overrun roots plus the existing ten cold fixtures. Six new cold searches; all other evidence reused. Not a complete v40 game or remeasurement of every old in-target root.',allComplete=all(r['complete'] for r in rows),measuredRoots=17,overTime=sum(r['overTime']for r in rows),overInputs=sum(r['overInputs']for r in rows),both=sum(r['overTime']and r['overInputs']for r in rows),remaining=remaining,allRows=rows,sourceHashes={str(p):hashlib.sha256(p.read_bytes()).hexdigest()for p in source_paths})
Path(str(prefix)+'.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
labels={'player-blue':'蓝','player-green':'绿','player-brown':'棕','player-white':'白'}
text=['# v40超过600ms或256次模拟的完整已测清单（2026-10-29）','','现有17个v40单点证据中，3处超过600ms，其中1处同时超过256次原生模拟；全部搜索完整闭合。以含开根搜索墙钟时间和实际原生输入判断，严格大于门槛才列为超线。','',
'## 当前超线项','','| 记录 | 轮/回合/席位 | 含开根耗时 | 模拟输入 | 计费状态 | 超线项 |','|---|---|---:|---:|---:|---|']
for r in remaining:text.append(f"| {r['id']} | R{r['round']}T{r['turn']} {labels[r['seatId']]} | {r['milliseconds']:.1f}ms | {r['nativeInputs']} | {r['nodes']} | {'时间+模拟数'if r['overInputs']else'仅时间'} |")
text+=['','case-105/case-152沿用上轮冷测样本，317为本次新增冷测。时间来自不同批次的单次测量，会受JIT与宿主负载影响，不据此声称稳定超时或统一提速倍数。所有搜索仍使用四项null预算，600ms/256只用于检查结果。','',
'## 三项的全部原生输入分布','','| 原生输入 | 第317步 | case-152 | case-105 |','|---|---:|---:|---:|']
families=sorted(set().union(*(r['nativeActionFamilies']for r in remaining)),key=lambda k:-sum(r['nativeActionFamilies'].get(k,0)for r in remaining))
for family in families:text.append('| '+family+' | '+' | '.join(str(r['nativeActionFamilies'].get(family,0))for r in remaining)+' |')
text+=['','第317步剩余成本分散：付款112次、选牌105次、目标选择98次、结束turn75次。已有共享前缀省338次输入，仍有29次目的内fallback。按首次实际执行归属，卡牌研究83次、赫利昂移除科技换收入66次、sector-1-a扫描66次、计算机收入60次，其他目的与直接行动合计327次。这里的“选牌”不能直接当作“重组”：它们还包括付款、插收入及其他牌效。','',
'case-152有90次目标选择、26次付款、20次移动；case-105有44次目标选择、24次付款、21次移动。这两项的输入均未超过256，后续应同时看执行/恢复/投影成本，不能仅因出现固定输入就认定又在枚举。','',
'## 原完整对局7个超线决策的v40结果','','| 对局步骤 | 轮/回合 | 席位 | v39模拟数 | v40模拟数 | v40含开根耗时 | 结果 |','|---|---|---|---:|---:|---:|---|']
for r in audit['rows']:text.append(f"| {r['step']} | R{r['round']}T{r['turn']} | {labels[r['seatId']]} | {r['before']['nativeInputs']} | {r['nativeInputs']} | {r['rootAndSearchMilliseconds']:.1f}ms | {'超线'if r['overTime']or r['overInputs']else'两项均达标'} |")
text+=['','七项最终动作与V均保持，原生根与RNG未改变；295复用此前v40结果，其他六项只运行一次。','',
'## 范围与证据','','本表覆盖原完整局的全部7个超线根，以及既有10个冷根，共17项。未重跑v40整局，也未把旧完整局其余343步全部冷测；因此这是当前已测超线清单，不是所有可能局面的穷尽结论。','',
'- [汇总JSON及全部17项](v40-overrun-list-20261029-v1.json)','- [原完整局超线根的复测、原始图与源码绑定](v40-baseline-overruns-20261029-v1.json)','- [既有十点冷测](reorg-greedy-corpus-20261029-v1.json)']
Path(str(prefix)+'.md').write_text('\n'.join(text)+'\n')
print(json.dumps({'measured':17,'remaining':[{'id':r['id'],'ms':round(r['milliseconds'],1),'inputs':r['nativeInputs']}for r in remaining]},ensure_ascii=False))
