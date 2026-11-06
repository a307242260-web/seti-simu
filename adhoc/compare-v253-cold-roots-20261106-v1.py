from pathlib import Path
import json,hashlib
F=Path('reports/ai-foundation-20261105/third-round-teacher-v1');read=lambda p:json.loads(Path(p).read_text());old=read(F/'v239-current-source-serial-gate-20261106-v1.json');new=read(F/'v253-current-source-serial-gate-20261106-v1.json');assert len(new['rows'])==576 and all(r['complete']for r in new['rows']);before={r['identity']:r for r in old['rows']};seen=set();by={};changes=[];added=[]
for r in new['rows']:
 if r['identity']in seen:continue
 seen.add(r['identity']);prior=before.get(r['identity']);f=read(r['fixture']);e=f['compositionEnvelope'];s=((e.get('session')or{}).get('session')or{}).get('workingState')or json.loads(e['committedState']);round=str(s['turn']['roundNumber']);
 if prior is None:added.append({'label':r['label'],'round':round,'fixture':r['fixture'],'evidence':r['evidence']});continue
 b=by.setdefault(round,{'roots':0,'valueChanged':0,'choiceChanged':0});b['roots']+=1
 value=r['value']!=prior['value'];choice=r['actionId']!=prior['actionId'];b['valueChanged']+=int(value);b['choiceChanged']+=int(choice)
 if value or choice:changes.append({'label':r['label'],'round':round,'fixture':r['fixture'],'priorValue':prior['value'],'value':r['value'],'priorAction':prior['actionId'],'action':r['actionId'],'evidence':r['evidence']})
assert sum(by[r]['roots']for r in ['1','2'])==304
out=F/'v253-cold-roots-v239-comparison-20261106-v1.json';assert not out.exists();out.write_text(json.dumps({'uniqueRoots':len(seen),'byRound':by,'changes':changes,'unpairedNewRoots':added,'newAutonomousRuns':0},indent=2)+'\n');print(json.dumps({'out':str(out),'unique':len(seen),'byRound':by,'changes':changes,'unpairedNewRoots':added}))
