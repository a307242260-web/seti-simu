from pathlib import Path
import hashlib,json,subprocess
P=Path('reports/ai-foundation-20261107/v324-held-landing-route-v1')
D=Path('reports/ai-foundation-20261107/v325-timing-cache-v1')
parent=P/'source-manifest-20261107-v1.json'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
m=json.loads(parent.read_text())
files=['randomizer/game/ai/analysis-port.js','randomizer/game/ai/decision-search.js','randomizer/index.html']
for name,h in {**m['baseRuntimeHashes'],**m['sourceHashes']}.items():
 if name not in files:assert sha(Path(name))==h,name
D.mkdir(exist_ok=False)
for n in files:
 p=Path(n)
 if n.endswith('.js'):subprocess.run(['node','--check',n],check=True)
 q=D/'source-snapshot'/n;q.parent.mkdir(parents=True,exist_ok=True);q.write_bytes(p.read_bytes())
m['sourceHashes'].update({n:sha(Path(n)) for n in files})
m.update(searchVersion='seti-complete-decision-search-v325',scope='V324 strategy retained; exact movement timing prefix and suffix indexes replace concatenated whole-board key, same FIFO limit. Isolated candidate only.',parentManifest=str(parent),parentManifestSha256=sha(parent),changedSourceSnapshot=str(D/'source-snapshot'),changedSources=sorted(files))
(D/'source-manifest-20261107-v1.json').write_text(json.dumps(m,indent=2)+'\n')
