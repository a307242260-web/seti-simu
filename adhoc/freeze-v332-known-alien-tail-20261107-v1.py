from pathlib import Path
import hashlib,json,subprocess
P=Path('reports/ai-foundation-20261107/v331-paid-research-v1')
D=Path('reports/ai-foundation-20261107/v332-known-alien-tail-v1')
parent=P/'source-manifest-20261107-v1.json'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
m=json.loads(parent.read_text())
files=['randomizer/game/ai/analysis-port.js','randomizer/game/ai/decision-search.js','randomizer/index.html']
for name,h in {**m['baseRuntimeHashes'],**m['sourceHashes']}.items():
 if name not in files:assert sha(Path(name))==h,name
assert not (D/"source-manifest-20261107-v1.json").exists()
for n in files:
 p=Path(n)
 if n.endswith('.js'):subprocess.run(['node','--check',n],check=True)
 q=D/'source-snapshot'/n;q.parent.mkdir(parents=True,exist_ok=True);q.write_bytes(p.read_bytes())
m['sourceHashes'].update({n:sha(Path(n)) for n in files})
m.update(searchVersion='seti-complete-decision-search-v332',scope='Allow same-turn known inputs after taking the root-visible Amiba card, with all newly exposed identities still masked. No new pruning bound. Isolated candidate only.',parentManifest=str(parent),parentManifestSha256=sha(parent),changedSourceSnapshot=str(D/'source-snapshot'),changedSources=sorted(files))
cases=json.loads(Path(m['addedCases']).read_text())
for step in [189,194]:
 label=f'v323-actual-r3-step-{step}'
 fixture=D/(label+'-root-20261107-v1.json');assert fixture.exists()
 cases['cases'].append({'label':label,'fixture':str(fixture)})
added=D/'v332-added-known-alien-roots-20261107-v1.json'
added.write_text(json.dumps(cases,indent=2)+'\n')
m.update(addedCases=str(added),addedCasesSha256=sha(added))
(D/'source-manifest-20261107-v1.json').write_text(json.dumps(m,indent=2)+'\n')
