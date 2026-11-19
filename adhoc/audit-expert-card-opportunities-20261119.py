"""Read accepted twenty-game evidence; no search, replay or new game."""
import hashlib,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
summary=json.loads((ROOT/'reports/iteration/v486-original20-20261119/summary-20261119-v1.json').read_text())
runtime=Path(json.loads((ROOT/'reports/ai-foundation-20261119/v486-random20-runtime-preflight-20261119-v1.json').read_text())['runtime'])
output=ROOT/'reports/expert-learning-20261119/accepted20-expert-card-opportunities-20261119-v2.json'
if output.exists():
 print(output.read_text());raise SystemExit()
targets={'b_41.webp':'建造燃料箱','b_42.webp':'聚变反应堆','b_87.webp':'最佳发射窗口','b_98.webp':'发射前试验'}
stats={k:{'name':v,'visibleBoards':set(),'heldBoards':set(),'playedBoards':set(),'paidOpportunityBoards':set(),'visibleInstances':set(),'maximumKnownEnergyHand':0,'examples':[]}for k,v in targets.items()}
evidence=[]
for board in summary['rows']:
 record=runtime/board['recordPath'];raw=record.read_bytes();assert hashlib.sha256(raw).hexdigest()==board['sourceRecordSha256']
 trace=Path(str(record)+'.decisions.jsonl');digest=hashlib.sha256();counts={'scan':0,'analyze':0,'research_tech':0,'play_card':0}
 with trace.open('rb')as stream:
  for lineno,line in enumerate(stream,1):
   digest.update(line);d=json.loads(line);c=d['context'];obs=c['observation'];self=obs['selfState'];pub=obs['publicState'];seat=c['seatId']
   if seat!='player-white':continue
   assert self['playerId']==seat
   p=next(p for p in pub['players']if p['playerId']==seat);actions=c['legalActions'];chosen=next((a for a in actions if a['actionId']==d['actionId']),None)
   if chosen and chosen['family']in counts:counts[chosen['family']]+=1
   offers=pub['board']['publicCards'];hand=self['hand'];income=sum(x.get('incomeCode')==1 for x in hand if not x.get('hidden'))
   sources=[a for a in actions if (a['family']=='quick_trade'and(a.get('target')or{}).get('tradeId')in ['credits-for-card','energy-for-card','publicity-for-card','cards-for-pick-card'])or(a['family']=='industry'and(a.get('target')or{}).get('abilityId')=='deepspace_swap_cards')]
   for card in hand:
    if card.get('cardId')in targets:stats[card['cardId']]['heldBoards'].add(board['number'])
   if chosen and chosen['family']=='play_card':
    card=next((x for x in hand if x['id']==(chosen.get('target')or{}).get('cardInstanceId')),None)
    if card and card.get('cardId')in targets:stats[card['cardId']]['playedBoards'].add(board['number'])
   for card in offers:
    if not card or card.get('hidden')or card.get('cardId')not in targets:continue
    q=stats[card['cardId']];q['visibleBoards'].add(board['number']);q['visibleInstances'].add((board['number'],card['id']));q['maximumKnownEnergyHand']=max(q['maximumKnownEnergyHand'],income)
    if sources:
     q['paidOpportunityBoards'].add(board['number'])
     if len(q['examples'])<8 and not any(e['board']==board['number']for e in q['examples']):q['examples'].append({'board':board['number'],'traceLine':lineno,'round':pub['roundNumber'],'turn':pub['turnNumber'],'instanceId':card['id'],'knownEnergyIncomeCardsInHand':income,'credits':p['credits'],'energy':p['energy'],'publicity':p['publicity'],'availableData':p['availableData'],'legalAcquisitionSources':[a['target']for a in sources],'chosen':chosen})
 evidence.append({'board':board['number'],'record':board['recordPath'],'recordSha256':board['sourceRecordSha256'],'traceSha256':digest.hexdigest(),'ownActionCounts':counts})
for q in stats.values():
 for k,v in list(q.items()):
  if isinstance(v,set):q[k]=sorted(v)
 q['visibleInstanceCount']=len(q['visibleInstances']);del q['visibleInstances']
result={'status':'completed-evidence-audit','seat':'player-white','sourcePolicy':'94299f385450f80f2720b3dc0d15ea92c9d771f7','newGames':0,'newAISearches':0,'cohort':20,'scoreMeanUnchanged':summary['completedOnly']['mean'],'interpretation':'Only autonomous White contexts count. Other seats have PASS/forced-decision traces too. A legal acquisition source and visible card show exposure, not a fundable useful plan or an AI defect. No counterfactual value inferred from counts.','cards':stats,'records':evidence}
output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'status':result['status'],'cards':{k:{x:v[x]for x in ['name','visibleBoards','heldBoards','playedBoards','paidOpportunityBoards','maximumKnownEnergyHand']}for k,v in stats.items()}},ensure_ascii=False))
