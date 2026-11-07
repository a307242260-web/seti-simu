from pathlib import Path
import hashlib,json,subprocess
P=Path('reports/ai-foundation-20261107/v369-validated-research-layout-pair-v1')
D=Path('reports/ai-foundation-20261107/v370-spent-swap-offer-v1')
parent=P/'source-manifest-20261107-v1.json'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
m=json.loads(parent.read_text())
files=['randomizer/game/ai/resource-demand.js', 'randomizer/game/ai/decision-search.js', 'randomizer/index.html']
for name,h in {**m['baseRuntimeHashes'],**m['sourceHashes']}.items():
 if name not in files:assert sha(Path(name))==h,name
D.mkdir(exist_ok=False)
for n in files:
 p=Path(n)
 if n.endswith('.js'):subprocess.run(['node','--check',n],check=True)
 q=D/'source-snapshot'/n;q.parent.mkdir(parents=True,exist_ok=True);q.write_bytes(p.read_bytes())
m['sourceHashes'].update({n:sha(Path(n)) for n in files})
m.update(searchVersion='seti-complete-decision-search-v370',scope='Forecast the known public exchange with the company mark spent as in the Native successor. Do not price a second exchange on the same round.',parentManifest=str(parent),parentManifestSha256=sha(parent),changedSourceSnapshot=str(D/'source-snapshot'),changedSources=sorted(files))
m.update(valueModel='seti-purpose-capital-state-value-v58')
m.update(previousGate='reports/ai-foundation-20261107/v367-canonical-default-weights-v1/serial-cold-gate-20261107-v1.json')
(D/'source-manifest-20261107-v1.json').write_text(json.dumps(m,indent=2)+'\n')
