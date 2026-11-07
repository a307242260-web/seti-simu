from pathlib import Path
import hashlib
import json
import subprocess

prior = Path('reports/ai-foundation-20261107/v371-spent-swap-offer-v1')
dest = Path('reports/ai-foundation-20261107/v372-blue-landing-supply-v1')
parent = prior/'source-manifest-20261107-v1.json'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
manifest = json.loads(parent.read_text())
files = ['randomizer/game/ai/'+f+'.js' for f in ('resource-demand','analysis-port','decision-search','local-decision-plans')]
files += ['randomizer/index.html']
for name, h in {**manifest['baseRuntimeHashes'], **manifest['sourceHashes']}.items():
    if name not in files:
        assert sha(Path(name)) == h, name
dest.mkdir(exist_ok=False)
for name in files:
    source = Path(name)
    if name.endswith('.js'):
        subprocess.run(['node','--check',name],check=True)
    archive = dest/'source-snapshot'/name
    archive.parent.mkdir(parents=True,exist_ok=True)
    archive.write_bytes(source.read_bytes())
    manifest['sourceHashes'][name] = sha(source)

fixture_dest = dest/'roots'
fixture_dest.mkdir()
tmp=Path('/private/tmp')
roots=tmp/'seti-v371-blue3-landing-roots-20261107-v1'
supply = json.loads((tmp/'seti-v372-blue-landing-supply-20261107-v4.checkpoint.json').read_text())
handoff = json.loads((tmp/'seti-v372-blue-landing-handoff-20261107-v2.checkpoint.json').read_text())
fixtures={
    'blue-landing-141':json.loads((roots/'v371-actual-r3-before-141-root-20261107-v1.json').read_text()),
    'blue-landing-151':json.loads((roots/'v371-actual-r3-before-151-root-20261107-v1.json').read_text()),
    'blue-landing-prior-alt175':json.loads((roots/'alt175.json').read_text()),
    'blue-landing-overflow-task':json.loads((roots/'alt-task.json').read_text()),
}
source={'seed':fixtures['blue-landing-141']['source']['seed']}
for row in supply['checkpoints'][1:]:
    fixtures['blue-landing-resume-'+str(row['step'])]={'seatId':'player-white','source':source,'compositionEnvelope':row['envelope']}
fixtures['blue-landing-handoff-cycle4']={'seatId':'player-white','source':source,'compositionEnvelope':handoff['envelope']}
cases=[]
for label,fixture in fixtures.items():
    path=fixture_dest/(label+'.json');path.write_text(json.dumps(fixture,indent=2)+'\n')
    cases.append({'label':label,'fixture':str(path),'fixtureSha256':sha(path)})
added=dest/'added-cases-20261107-v1.json'
added.write_text(json.dumps({'cases':cases},indent=2)+'\n')
manifest.update(searchVersion='seti-complete-decision-search-v372',
    scope='One fixed visible blue reward landing supplier, preserve income and Deep Space mark on an exact model tie; leave research-funded persistent publicity tasks until space exists. Never price unknown refill or blind draw identity.',
    parentManifest=str(parent),parentManifestSha256=sha(parent),changedSourceSnapshot=str(dest/'source-snapshot'),
    changedSources=sorted(files),previousGate=str(prior/'serial-cold-gate-20261107-v1.json'),
    addedCases=str(added),addedCasesSha256=sha(added))
(dest/'source-manifest-20261107-v1.json').write_text(json.dumps(manifest,indent=2)+'\n')
