from pathlib import Path
import json
R=Path(__file__).resolve().parents[1];out=R/'reports/ai-foundation-20261119/original20-development-gap-20261119-v1.json'
if out.exists():
 print('Reuse completed development audit');raise SystemExit
A=json.loads((R/'reports/ai-foundation-20261119/original20-income-development-audit-20261119-v1.json').read_text());cohort=[]
for x in A['records']:
 r=json.loads((R/x['record']).read_text());row={'board':x['board'],'score':x['score'],'rounds':[]}
 for e in r['roundEnds']:
  ids=[k for k,v in e['technology']['ownedTiles'].items()if v and not e['technology']['disabledTiles'].get(k)];row['rounds'].append({'round':e['round'],'blue':sum(x.startswith('blue')for x in ids),'orange':sum(x.startswith('orange')for x in ids),'purple':sum(x.startswith('purple')for x in ids),'blueSlots':e['technology']['blueBoardSlots']})
 cohort.append(row)
r=json.loads((R/'reports/research/327c52b2.e08665e6.full.json').read_text());rt=Path('/private/tmp/seti-final-currency-20261119-dx3v3yej');initial=None;incs=[]
with(rt/r['agentTracePath']).open()as f:
 for n,line in enumerate(f,1):
  x=json.loads(line);c=x.get('context')
  if not c or c['seatId']!='player-white':continue
  if initial is None:initial=next(p['income']for p in c['observation']['publicState']['players']if p['playerId']=='player-white')
  if any((a.get('target')or{}).get('choiceId','').startswith('income:')for a in c['legalActions']):incs.append({'round':c['observation']['publicState']['roundNumber'],'line':n,'actionId':x['actionId']})
ref={'record':'reports/research/327c52b2.e08665e6.full.json','scope':'teaching-seed autonomous game; not a matched board control','openingIncome':initial,'roundEnds':[{k:e[k]for k in ['round','score','income','technology']}for e in r['roundEnds']],'incomeChoicesByRound':{str(i):sum(x['round']==i for x in incs)for i in range(1,5)}}
result={'status':'verified-descriptive-audit','newGames':0,'newAISearches':0,'cohortSourcePolicy':A['sourcePolicy'],'cohort':cohort,'meanBlueByRound':{str(i):sum(x['rounds'][i-1]['blue']for x in cohort)/20 for i in range(1,5)},'teacherSeedAIReference':ref,'incomeSummary':A['summary'],'nextQuestion':'Separate income-cycle count and blue-technology development from initial income allocation; do not generalize the rare fusion-card exposure or raise energy-income priority blindly.'};out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'meanBlueByRound':result['meanBlueByRound'],'referenceOpening':initial,'referenceIncomeChoices':ref['incomeChoicesByRound'],'cohortRound3Income':A['summary']['rounds'][2]['meanIncome'],'cohortIncomeChoicesThroughRound3':sum(x['selections']for x in A['summary']['choices'][:3])/20}))
