from pathlib import Path
import hashlib,json,subprocess
p=Path('reports/ai-foundation-20261107');parent=p/'v374-deferred-sector-publicity-v1'/'source-manifest-20261107-v1.json'
d=p/'v375-known-research-data-v1';d.mkdir(exist_ok=False)
sha=lambda f:hashlib.sha256(Path(f).read_bytes()).hexdigest()
m=json.loads(parent.read_bytes())
files=['randomizer/game/ai/'+n+'.js' for n in ('analysis-port','decision-search','local-decision-plans','resource-demand')]+['randomizer/index.html']
for n,digest in {**m['baseRuntimeHashes'],**m['sourceHashes']}.items():
    if n not in files:assert sha(n)==digest,n
for n in files:
    if n.endswith('.js'):subprocess.run(['node','--check',n],check=True)
    f=d/'source-snapshot'/n;f.parent.mkdir(parents=True,exist_ok=True);f.write_bytes(Path(n).read_bytes());m['sourceHashes'][n]=sha(f)
base=Path(m['addedCases']);cases=json.loads(base.read_bytes())['cases']
for row in cases:assert sha(row['fixture'])==row['fixtureSha256']
root=json.loads(Path('/private/tmp/seti-v374-red-research-order-blue4-20261107-v1.checkpoint.json').read_bytes())['root'];r=d/'roots';r.mkdir()
fixture=r/'known-research-data-actual-192.json';fixture.write_text(json.dumps({'seatId':'player-white','source':{'seed':'seti-free-analyze-v1','production':'V372 Native rules / V374 red task actual handoff'},'compositionEnvelope':root},ensure_ascii=False,indent=2)+'\n')
cases.append({'label':'known-research-data-actual-192','fixture':str(fixture),'fixtureSha256':sha(fixture)});added=d/'added-cases-20261107-v1.json';added.write_text(json.dumps({'cases':cases},indent=2)+'\n')
m.update(searchVersion='seti-complete-decision-search-v375',scope='After claiming a ready sector task during a paid-research turn, quote one proved visible data-producing/publicity-blue pair and two fixed placements. The known held corner would cover the remaining third fee. Compare full current portfolio against only realizable analysis capital with the consumed data. No new Native nodes, hidden rewards or pruning bounds.',parentManifest=str(parent),parentManifestSha256=sha(parent),previousGateSha256=sha(m['previousGate']),addedCases=str(added),addedCasesSha256=sha(added),changedSourceSnapshot=str(d/'source-snapshot'),changedSources=sorted(files),candidateAdmitted=False,newAutonomousRuns=0)
(d/'source-manifest-20261107-v1.json').write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n')
