"""Learn from verified historical states; never treat them as current-kernel states."""
import collections
import gzip
import hashlib
import json
from pathlib import Path
prefix=Path('reports/ai-foundation-20261023/human405-learning-20261029-v1')
savePath=Path('seti-saves/seti-save-537-merged.json');archivePath=Path('adhoc/human-405-history-evidence-20260913.json.gz')
archive=json.loads(gzip.decompress(archivePath.read_bytes()));assert hashlib.sha256(savePath.read_bytes()).hexdigest()==archive['sourceSaveSha256'];assert hashlib.sha256(archive['checkpointsJsonl'].encode()).hexdigest()=='6c905f29b4707eff3fc7858268183416e36791bd341c932721c1e4959a6443e3'
save=json.loads(savePath.read_text());states=[json.loads(l)for l in archive['checkpointsJsonl'].splitlines()];assert len(states)==517 and len(save['replaySteps'])==516
final=json.loads(save['committedState']);assert all(value==states[-1]['state'][key] for key,value in final.items())
white=lambda s:next(p for p in s['players']['players']if p['id']=='player-white')
rounds={};techEvents=[];lastTech=set()
for r in states:
    state=r['state'];own=white(state);round=state['turn']['roundNumber'];tech={k for k,v in own['techState']['ownedTiles'].items()if v}
    if tech-lastTech:techEvents.append(dict(step=r['step'],round=round,turn=state['turn']['turnNumber'],added=sorted(tech-lastTech)))
    lastTech=tech;rounds[round]=dict(lastHistoricalStep=r['step'],baseScore=own['resources']['score'],income=own['income'],ownedTech=sorted(tech),resources=own['resources'],reservedCards=len(own['reservedCards']))
for round in range(1,5):
    counts=collections.Counter()
    for i,step in enumerate(save['replaySteps']):
        if step['actorPlayerId']=='player-white'and states[i]['state']['turn']['roundNumber']==round:counts[step['action']['family']]+=1
    rounds[round]['actions']=dict(counts)
score=next(x for x in final['match']['finalScores']if x['playerId']=='player-white');assert score['totalScore']==405
result=dict(schemaVersion='seti-human405-learning-source-v1',sourceSave=str(savePath),sourceSaveSha256=hashlib.sha256(savePath.read_bytes()).hexdigest(),archive=str(archivePath),archiveSha256=hashlib.sha256(archivePath.read_bytes()).hexdigest(),historicalCommit=archive['historicalCommit'],historicalOnly=True,steps=516,playerScores={p['id']:p['resources']['score']for p in final['players']['players']},whiteFinal=score,whiteScoreSources=white(final)['scoreSources'],rounds=rounds,techEvents=techEvents,learningHypotheses=[{'id':'engine-before-payout','observation':'2/3/6/12 technologies at round ends; base score 15/32/105/249','hypothesis':'current one-turn model lacks explicit retained technology/efficiency value; test a capacity feature before changing weights'},{'id':'data-analysis-loop','observation':'white analyze counts 0/1/2/5 and place-data 5/5/20/38','hypothesis':'compare full resource-to-scan-to-data-to-analysis chains, with known species boundaries preserved'},{'id':'terminal-goal-growth','observation':'118 tile points, including technology, traces and completed tasks','hypothesis':'current-mark greedy forecast may prefer immediate income over growth boards; validate early marking choices separately'},{'id':'resource-liquidation','observation':'human ends with zero credits, energy, hand and availableData','hypothesis':'test finite-horizon resource holding value using the same public information; no hidden future card identity'}],limits=['Other three players mostly PASS, final base 7/7/8: white405 is a teaching trajectory, not a matched four-AI score target.','Historical kernel is 4fe33887, current world metadata differs; do not restore old states into current kernel by relabeling them.','One demonstration does not establish generalized strategy or fitted-value validity.'])
groups={'alien_engine':52+38+48+32,'technology_engine':40+30+42,'tasks':15+28,'planets':41+3+6,'scan':21,'ordinary_card_quick':3,'initial':6}
assert sum(groups.values())==405
result['nonOverlappingScoreGroups']=groups
result['engineShare']=(groups['alien_engine']+groups['technology_engine'])/405
Path(str(prefix)+'.source-summary.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'whiteFinal':score['totalScore'],'roundBase':[rounds[i]['baseScore']for i in range(1,5)],'roundTech':[len(rounds[i]['ownedTech'])for i in range(1,5)],'historicalSourceVerified':True}))
