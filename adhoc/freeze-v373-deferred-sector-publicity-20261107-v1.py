from pathlib import Path
import hashlib, json, subprocess

parent=Path('reports/ai-foundation-20261107/v372-blue-landing-supply-v1/source-manifest-20261107-v2.json')
dest=Path('reports/ai-foundation-20261107/v373-deferred-sector-publicity-v1')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
m=json.loads(parent.read_text())
changed=['randomizer/game/ai/'+x+'.js' for x in ['decision-search','analysis-port','local-decision-plans']]+['randomizer/index.html']
for n,h in {**m['baseRuntimeHashes'],**m['sourceHashes']}.items():
    if n not in changed:assert sha(Path(n))==h,n
dest.mkdir(exist_ok=False)
for n in changed:
    p=Path(n)
    if n.endswith('.js'):subprocess.run(['node','--check',n],check=True)
    q=dest/'source-snapshot'/n;q.parent.mkdir(parents=True,exist_ok=True);q.write_bytes(p.read_bytes())
    m['sourceHashes'][n]=sha(p)
m.pop('commentOnlyComparedWith',None)
tmp=Path('/private/tmp')
base=tmp/'seti-v372-actual-r3-target-roots-20261107-v1'
target=dest/'roots';target.mkdir()
cases=[]
for i in (179,182,188):
    label='deferred-sector-actual-'+str(i)
    p=target/(label+'.json');p.write_bytes((base/f'v372-actual-r3-before-{i}-root-20261107-v1.json').read_bytes())
    cases.append({'label':label,'fixture':str(p),'fixtureSha256':sha(p)})
carry=json.loads((tmp/'seti-v373-red-task-handoff-20261107-v2.checkpoint.json').read_text())
assert carry['endpointAndRngExact'] and carry['end']['wallet']['score']==101
label='deferred-sector-before-pass';p=target/(label+'.json')
p.write_text(json.dumps({'seatId':'player-white','source':{'seed':'seti-free-analyze-v1'},'compositionEnvelope':carry['envelope']},indent=2)+'\n')
cases.append({'label':label,'fixture':str(p),'fixtureSha256':sha(p)})
added=dest/'added-cases-20261107-v1.json';added.write_text(json.dumps({'cases':cases},indent=2)+'\n')
m.update(searchVersion='seti-complete-decision-search-v373',
 scope='Price one persistent ready sector publicity reward only at a materialized next-own-turn boundary, where one already affordable research creates full capacity and the fixed reward independently funds a second. No new successor or hypothetical tile reward.',
 parentManifest=str(parent),parentManifestSha256=sha(parent),changedSourceSnapshot=str(dest/'source-snapshot'),changedSources=sorted(changed),
 previousGate=str(parent.parent/'serial-cold-gate-20261107-v1.json'),addedCases=str(added),addedCasesSha256=sha(added))
(dest/'source-manifest-20261107-v1.json').write_text(json.dumps(m,indent=2)+'\n')
