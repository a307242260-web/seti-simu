from pathlib import Path
import hashlib,json,subprocess
P=Path('reports/ai-foundation-20261107/v367-canonical-default-weights-v1')
D=Path('reports/ai-foundation-20261107/v368-sector-task-swap-v1')
parent=P/'source-manifest-20261107-v1.json'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
m=json.loads(parent.read_text())
files=['randomizer/game/ai/card-pick-planning.js', 'randomizer/game/ai/decision-search.js', 'randomizer/index.html']
for name,h in {**m['baseRuntimeHashes'],**m['sourceHashes']}.items():
 if name not in files:assert sha(Path(name))==h,name
D.mkdir(exist_ok=False)
for n in files:
 p=Path(n)
 if n.endswith('.js'):subprocess.run(['node','--check',n],check=True)
 q=D/'source-snapshot'/n;q.parent.mkdir(parents=True,exist_ok=True);q.write_bytes(p.read_bytes())
m['sourceHashes'].update({n:sha(Path(n)) for n in files})
m.update(searchVersion='seti-complete-decision-search-v368',scope='Fix company exchange eligibility when a known publicly displayed two-signal card can win an ordinary sector, complete a held publicity task and fund a next own turn research.',parentManifest=str(parent),parentManifestSha256=sha(parent),changedSourceSnapshot=str(D/'source-snapshot'),changedSources=sorted(files))
m.update(valueModel='seti-purpose-capital-state-value-v58')
roots=Path('reports/ai-foundation-20261107/v367-blue1-dlc19-native-v1')
cases=[{'label':'r3-blue1-before-dlc19','fixture':str(roots/'v367-r3-blue1-before-dlc19-root-20261107-v1.json')}]
for name in ['r3-blue1-dlc19-held','r3-blue1-dlc19-task-funded']:
 q=D/f'v367-{name}-root-20261107-v1.json'
 q.write_bytes(Path('/private/tmp',f'seti-v367-{name}-root-20261107-v1.json').read_bytes())
 cases.append({'label':name,'fixture':str(q)})
added=D/'added-native-roots-20261107-v1.json';added.write_text(json.dumps({'cases':cases},indent=2)+'\n')
m.update(previousGate=str(P/'serial-cold-gate-20261107-v1.json'),addedCases=str(added),addedCasesSha256=sha(added))

(D/'source-manifest-20261107-v1.json').write_text(json.dumps(m,indent=2)+'\n')
