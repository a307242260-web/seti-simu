from pathlib import Path
import hashlib,json,subprocess
base=Path('/private/tmp/seti-v323-autonomous-first3-20261107-v1')
D=Path('reports/ai-foundation-20261107/v324-held-landing-route-v1')
P=Path('reports/ai-foundation-20261107/committed-computer-recovery-v323-v1')
parent=P/'source-manifest-20261107-v1.json'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
read=lambda p:json.loads(p.read_text())
m=read(parent)
files=[f'randomizer/game/ai/{n}.js' for n in ['analysis-port','decision-search','probe-capital','resource-demand','state-value']]+['randomizer/index.html']
for n,h in {**m['baseRuntimeHashes'],**m['sourceHashes']}.items():
 assert sha(base/n)==h,n
 if n not in files:assert sha(Path(n))==h,n
D.mkdir(exist_ok=False)
for n in files:
 p=Path(n)
 if n.endswith('.js'):subprocess.run(['node','--check',n],check=True)
 q=D/'source-snapshot'/n;q.parent.mkdir(parents=True,exist_ok=True);q.write_bytes(p.read_bytes())
m['sourceHashes'].update({n:sha(Path(n)) for n in files})
previous=P/'serial-cold-gate-20261107-v1.json'
assert read(previous)['status']=='complete'
timing=Path('/private/tmp/seti-v323-held-landing-timing-native-20261107-v1.json')
source=P/'v323-known-free-landing-native-20261107-v1.json'
ref=read(source);tf=read(timing)
assert all(x['landed']['envelope']==tf['paths'][0]['landed']['envelope'] for x in tf['paths'])
(D/'v323-held-landing-timing-native-20261107-v1.json').write_bytes(timing.read_bytes())
fixture=read(Path(ref['fixture']))
rows=[{'label':'v323-blue1-keep-publicity-first-r3','fixture':ref['fixture']}]
for name,e in [('v323-held-landing-after-launch',ref['launched']['envelope']),('v323-held-landing-next-white',tf['paths'][0]['after']['envelope'])]:
 p=D/(name+'-root-20261107-v1.json');p.write_text(json.dumps({**fixture,'compositionEnvelope':e},indent=2)+'\n');rows.append({'label':name,'fixture':str(p)})
added=D/'v324-held-landing-cases-20261107-v1.json';added.write_text(json.dumps({'cases':rows},indent=2)+'\n')
m.update(searchVersion='seti-complete-decision-search-v324',scope='Isolated known held simple landing effect with shared wallet, fixed Native direction and exact prefix reuse. No autonomous game or source admission yet.',candidateAdmitted=False,parentManifest=str(parent),parentManifestSha256=sha(parent),previousGate=str(previous),previousGateSha256=sha(previous),addedCases=str(added),addedCasesSha256=sha(added),changedSourceSnapshot=str(D/'source-snapshot'),changedSources=sorted(files),newAutonomousRuns=0)
m.pop('diagnosticReferences',None)
(D/'source-manifest-20261107-v1.json').write_text(json.dumps(m,indent=2)+'\n')
