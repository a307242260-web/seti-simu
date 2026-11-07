from pathlib import Path
import collections,gzip,hashlib,json,sys
root=Path.cwd(); graph=Path(sys.argv[1]);control=Path(sys.argv[2]);out=Path(sys.argv[3])
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
read=lambda p:json.loads(gzip.decompress(p.read_bytes()) if p.suffix=='.gz' else p.read_bytes())
g=read(graph); native=read(control); assert g['complete'] and not g['unresolved'] and g['diagnostics']['nativeExecutions']==245
assert g['actionId']=='industry:e887dc52' and g['value']==154.5 and native['rootAndRngRestored'] and native['nativeInputs']==200
by_node={l['node']:l for l in g['lines']}; actual=[]
for l in g['lines']:
 for edge in l['edges']:
  proof=edge.get('turnTailPlanValue')
  if not proof or not proof.get('publicAmibaCurrencyTail') or not proof.get('dataPlans'):continue
  plans=proof['dataPlans']
  if plans[0]['goal']['kind']!='computer-prefix':continue
  assert plans[0]['goal']['targetComputerSlot']==3 and edge['actualNativeInputs']==0
  assert proof['unrealizedPurposeDelta']==0 and not proof.get('primaryOnly')
  assert plans[-1]['dataCornerIds']==['alien-amiba-5-9']
  assert proof['requiredNativeInputs']==sum(p['requiredNativeInputs'] for p in plans)+1
  value=by_node[edge['target']]['value'];source=value-proof['netGain']
  actual.append((source,value,proof['requiredNativeInputs'],tuple(p['goal']['id'] for p in plans)))
expected=[]
for row in native['results']:
 has_pool=row['afterPrefix']['resources']['availableData']>0
 wanted='pool-blue1-amiba5-blue2' if has_pool else 'amiba5-blue1'
 legacy='pool-blue1-b111-blue2' if has_pool else 'b111-blue1'
 branch=next(b for b in row['branches'] if b['name']==wanted);base=next(b for b in row['branches'] if b['name']==legacy)
 assert branch['end']['value']==base['end']['value']+1 and branch['end']['score']==base['end']['score']+1
 assert branch['end']['debt']==base['end']['debt']==0
 assert branch['end']['rng']==row['before']['rng']==base['end']['rng']
 goals=('data:computer-prefix:3','data:blue:1','data:blue:2') if has_pool else ('data:computer-prefix:3','data:blue:1')
 expected.append((row['before']['value'],branch['end']['value'],len(row['prefix'])+len(branch['route']),goals))
assert len(expected)==len(actual)==8 and collections.Counter(actual)==collections.Counter(expected)
result={'graph':str(graph),'graphSha256':sha(graph),'nativeControls':str(control),'nativeControlsSha256':sha(control),'nativeInputs':200,'currentColdInputs':245,'selectedValue':154.5,'proofsCompared':8,'sourceValueEndpointValueNativeLengthAndOrder':sorted(actual),'rootAndRngUnchanged':True,'newAutonomousRuns':0}
with out.open('x') as f:json.dump(result,f,indent=2);f.write('\n')
print(json.dumps(result))
