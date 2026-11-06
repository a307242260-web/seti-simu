from pathlib import Path
import hashlib,json,subprocess
P=Path(__file__).resolve().parents[1];F=Path('reports/ai-foundation-20261105/third-round-teacher-v1');D=Path('reports/ai-foundation-20261106/mixed-blue-analysis-v1');mp=Path('reports/ai-foundation-20261106/candidate-v265-mixed-blue-v1/manifest.json');sha=lambda p:hashlib.sha256((P/p).read_bytes()).hexdigest();read=lambda p:json.loads((P/p).read_text());base='c267098f92c4ed66fc238b5843c4c59d047a9172'
assert not(P/mp).exists()
cp=F/'v264-standard-r3-native-verification-prefix-20261106-v1.checkpoint.json';source=read(cp);record=read('reports/research/8c4df576.4ec84a12.quick-400.json');save=read(record['savePath']);cases=[]
def add(label,envelope,path,input):
 fixture=D/(label+'-root-20261106-v1.json');assert not(P/fixture).exists();(P/fixture).write_text(json.dumps({'seatId':'player-white','source':{'seed':record['seed'],'path':str(path),'sha256':sha(path),'beforeInput':input,'scope':'Already accepted current-rule Native prefix; no new AI game.'},'compositionEnvelope':envelope},separators=(',',':'))+'\n');cases.append({'label':label,'fixture':str(fixture)})
for i in range(113,len(save['replaySteps'])+1):
 if save['replaySteps'][i-1]['actorPlayerId']=='player-white':add('actual-v264-'+str(i),source['prefixes'][str(i)],cp,i)
control=F/'v264-ready-analysis-extra-blue-native-control-20261106-v1.json'
for n,e in read(control)['prefixes'].items():add('extra-blue-control-'+n,e,control,int(n))
added=F/'v265-added-cold-root-cases-20261106-v1.json';(P/added).write_text(json.dumps({'cases':cases,'newNativeInputs':0,'newAutonomousRuns':0,'allRulesCurrent':True},indent=2)+'\n')
old=read('reports/ai-foundation-20261106/candidate-v264-scan-analysis-income-v1/manifest.json')
runtime={n:hashlib.sha256(subprocess.check_output(['git','--no-optional-locks','show',base+':'+n],cwd=P)).hexdigest()for n in old['baseRuntimeHashes']}
owned=['randomizer/app/rule-observation.js','randomizer/game/end-game-scoring.js','randomizer/game/ai/amiba-analysis-capital.js','randomizer/game/ai/amiba-analysis-capital.test.js','randomizer/game/ai/probe-capital.js','randomizer/game/ai/state-value.js','randomizer/game/ai/decision-search.js','randomizer/game/ai/resource-demand.js','randomizer/game/ai/local-decision-plans.js','randomizer/game/ai/mixed-blue-analysis.test.js','tools/node-test-inventory.js','tools/browser-smoke-inventory.js','tools/audit_v_state_inputs.js','adhoc/mixed-blue-analysis-contract-20261106-v1.md',str(control)]
for n in owned:
 target=P/mp.parent/'source-snapshot'/n;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes((P/n).read_bytes())
m={'baseCommit':base,'searchVersion':'seti-complete-decision-search-v265','valueModel':'seti-purpose-capital-state-value-v48','scope':'Complete public self trace counts, one funded greedy mixed-species analysis quote and its exact computer6 preparation; native identity/pruning and four budgets unchanged. Frozen before cold benchmark.','baseRuntimeHashes':runtime,'sourceHashes':{n:sha(n)for n in owned},'newAutonomousRuns':0,'contract':'adhoc/mixed-blue-analysis-contract-20261106-v1.md','addedCases':str(added),'addedCasesSha256':sha(added)};(P/mp).write_text(json.dumps(m,indent=2)+'\n');print(json.dumps({'manifest':str(mp),'sha256':sha(mp),'ownedSources':len(owned),'addedNamedCases':len(cases),'runtime':len(runtime)}))
